/**
 * Runner - The player character
 *
 * A stick figure that runs forward, can lose limbs when caught by the gator,
 * and performs various animations (running, stumbling, jumping, celebrating).
 */

// Limb states
const LimbState = {
    FULL: 'full',           // All limbs intact
    NO_LEFT_ARM: 'no_left_arm',
    NO_ARMS: 'no_arms',
    NO_LEFT_LEG: 'no_left_leg',  // Hopping on one leg
    DEFEATED: 'defeated'    // No more limbs, game over
};

// Animation states
const AnimState = {
    RUNNING: 'running',
    STUMBLING: 'stumbling',
    JUMPING: 'jumping',
    CELEBRATING: 'celebrating',
    HURT: 'hurt'
};

export class Runner {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.baseY = y;

        // Movement
        this.velocityX = 0;
        this.velocityY = 0;
        this.targetX = x;
        this.queuedPositions = []; // Queue of X positions for upcoming barriers

        // State
        this.limbState = LimbState.FULL;
        this.animState = AnimState.RUNNING;
        this.limbsLost = 0;

        // Blocked state - when runner hits a barrier
        this.isBlockedByBarrier = false;
        this.pushBackAmount = 0;

        // Animation
        this.animTime = 0;
        this.runCycle = 0;
        this.stumbleTime = 0;
        this.jumpHeight = 0;
        this.celebrateTime = 0;
        this.hurtFlash = 0;

        // Boost effect
        this.boostTime = 0;
        this.boostTrail = [];

        // Run-through effect (when breaking through barriers)
        this.runThroughTime = 0;
        this.runThroughSpeed = 0;

        // Visual properties
        this.color = '#4ecca3';
        this.headRadius = 12;
        this.bodyLength = 30;
        this.limbLength = 20;
    }

    /**
     * Update runner state
     */
    update(dt) {
        this.animTime += dt;

        // Handle run-through momentum
        if (this.runThroughTime > 0) {
            this.runThroughTime -= dt;
            // Runner surges forward briefly when breaking through
            this.y -= this.runThroughSpeed * dt;
            this.runThroughSpeed *= 0.9; // Decelerate
        } else if (this.isBlockedByBarrier) {
            // Being pushed back by barrier
            if (this.pushBackAmount < 20) {
                this.pushBackAmount += dt * 40;
                this.y = this.baseY + this.pushBackAmount;
            }
        } else {
            // Return to base position when not blocked
            if (this.pushBackAmount > 0) {
                this.pushBackAmount -= dt * 60;
                if (this.pushBackAmount < 0) this.pushBackAmount = 0;
            }
            this.y = this.baseY + this.pushBackAmount;
        }

        // Update animation states
        switch (this.animState) {
            case AnimState.RUNNING:
                this.updateRunning(dt);
                break;
            case AnimState.STUMBLING:
                this.updateStumbling(dt);
                break;
            case AnimState.JUMPING:
                this.updateJumping(dt);
                break;
            case AnimState.CELEBRATING:
                this.updateCelebrating(dt);
                break;
            case AnimState.HURT:
                this.updateHurt(dt);
                break;
        }

        // Update boost effect
        if (this.boostTime > 0) {
            this.boostTime -= dt;
            // Add trail particle
            if (Math.random() < 0.3) {
                this.boostTrail.push({
                    x: this.x + (Math.random() - 0.5) * 20,
                    y: this.y + this.bodyLength,
                    life: 0.3,
                    size: 3 + Math.random() * 3
                });
            }
        }

        // Update trail particles
        this.boostTrail = this.boostTrail.filter(p => {
            p.life -= dt;
            p.y += 50 * dt;
            p.size *= 0.95;
            return p.life > 0;
        });

        // Horizontal movement:
        // Runner stays in current lane (targetX) until the barrier passes,
        // then moves to the next queued position for the next barrier

        // Always move toward current target (smooth interpolation)
        this.x += (this.targetX - this.x) * 10 * dt;

        // Update hurt flash
        if (this.hurtFlash > 0) {
            this.hurtFlash -= dt;
        }
    }

    /**
     * Update running animation
     */
    updateRunning(dt) {
        // Leg animation cycle - slower when blocked
        const cycleSpeed = this.isBlockedByBarrier ? 2 : (this.limbState === LimbState.NO_LEFT_LEG ? 8 : 6);
        this.runCycle += dt * cycleSpeed;

        // Slight bobbing (only when not being pushed back by barrier)
        if (!this.isBlockedByBarrier && this.runThroughTime <= 0) {
            const bobOffset = Math.sin(this.runCycle * 2) * 3;
            this.y = this.baseY + this.pushBackAmount + bobOffset;
        }
    }

    /**
     * Update stumbling animation
     */
    updateStumbling(dt) {
        this.stumbleTime -= dt;

        // Wobble effect
        this.x += Math.sin(this.stumbleTime * 20) * 2;

        if (this.stumbleTime <= 0) {
            this.animState = AnimState.RUNNING;
        }
    }

    /**
     * Update jumping animation
     */
    updateJumping(dt) {
        // Arc motion
        this.jumpHeight += this.velocityY * dt;
        this.velocityY += 800 * dt; // Gravity

        this.y = this.baseY - this.jumpHeight;

        if (this.jumpHeight <= 0) {
            this.jumpHeight = 0;
            this.y = this.baseY;
            this.animState = AnimState.RUNNING;
        }
    }

    /**
     * Update celebrating animation
     */
    updateCelebrating(dt) {
        this.celebrateTime -= dt;

        if (this.celebrateTime <= 0) {
            this.animState = AnimState.RUNNING;
        }
    }

    /**
     * Update hurt animation - dramatic wobble and flash
     */
    updateHurt(dt) {
        this.hurtFlash -= dt;

        // Wobble back and forth while hurt
        this.x += Math.sin(this.hurtFlash * 30) * 3;

        // Gradually return to base Y
        if (this.y > this.baseY) {
            this.y -= dt * 30;
        }

        if (this.hurtFlash <= 0) {
            this.animState = AnimState.RUNNING;
            this.y = this.baseY; // Reset position
        }
    }

    /**
     * Render the runner
     */
    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Determine color (flash red when hurt, yellow when blocked)
        let color = this.color;
        if (this.hurtFlash > 0 && Math.floor(this.hurtFlash * 10) % 2 === 0) {
            color = '#ff6b6b';
        } else if (this.isBlockedByBarrier) {
            // Slight yellow tint when blocked
            color = '#cccc66';
        }

        // Draw boost trail
        for (const particle of this.boostTrail) {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = particle.life / 0.3;
            ctx.beginPath();
            ctx.arc(particle.x - this.x, particle.y - this.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Draw run-through trail when breaking through
        if (this.runThroughTime > 0) {
            ctx.strokeStyle = '#4ecca3';
            ctx.lineWidth = 2;
            ctx.globalAlpha = this.runThroughTime / 0.3;
            for (let i = 1; i <= 3; i++) {
                ctx.beginPath();
                ctx.moveTo(-10, i * 15);
                ctx.lineTo(10, i * 15);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';

        // Head
        ctx.beginPath();
        ctx.arc(0, -this.bodyLength - this.headRadius, this.headRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Eyes (simple dots) - squint when blocked
        ctx.fillStyle = color;
        ctx.beginPath();
        if (this.isBlockedByBarrier) {
            // Squinting eyes
            ctx.fillRect(-6, -this.bodyLength - this.headRadius - 2, 4, 2);
            ctx.fillRect(2, -this.bodyLength - this.headRadius - 2, 4, 2);
        } else {
            ctx.arc(-4, -this.bodyLength - this.headRadius - 2, 2, 0, Math.PI * 2);
            ctx.arc(4, -this.bodyLength - this.headRadius - 2, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Body - lean forward slightly when blocked
        ctx.beginPath();
        if (this.isBlockedByBarrier) {
            ctx.moveTo(3, -this.bodyLength);
            ctx.lineTo(-3, 0);
        } else {
            ctx.moveTo(0, -this.bodyLength);
            ctx.lineTo(0, 0);
        }
        ctx.stroke();

        // Arms (based on limb state)
        this.renderArms(ctx, color);

        // Legs (based on limb state)
        this.renderLegs(ctx, color);

        // Celebration effect
        if (this.animState === AnimState.CELEBRATING) {
            this.renderCelebration(ctx);
        }

        ctx.restore();
    }

    /**
     * Render arms based on limb state
     */
    renderArms(ctx, color) {
        const armWave = Math.sin(this.runCycle) * 0.5;
        const shoulderY = -this.bodyLength + 5;

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;

        // Right arm (always there until game over)
        if (this.limbState !== LimbState.DEFEATED) {
            ctx.beginPath();
            ctx.moveTo(0, shoulderY);
            if (this.animState === AnimState.CELEBRATING) {
                // Arms up!
                ctx.lineTo(this.limbLength * 0.7, shoulderY - this.limbLength);
            } else {
                ctx.lineTo(this.limbLength * Math.cos(armWave + 0.5), shoulderY + this.limbLength * Math.sin(armWave + 0.5));
            }
            ctx.stroke();
        }

        // Left arm
        if (this.limbState === LimbState.FULL) {
            ctx.beginPath();
            ctx.moveTo(0, shoulderY);
            if (this.animState === AnimState.CELEBRATING) {
                ctx.lineTo(-this.limbLength * 0.7, shoulderY - this.limbLength);
            } else {
                ctx.lineTo(-this.limbLength * Math.cos(-armWave + 0.5), shoulderY + this.limbLength * Math.sin(-armWave + 0.5));
            }
            ctx.stroke();
        } else if (this.limbState !== LimbState.FULL) {
            // Stump
            ctx.beginPath();
            ctx.moveTo(0, shoulderY);
            ctx.lineTo(-8, shoulderY + 5);
            ctx.stroke();
        }
    }

    /**
     * Render legs based on limb state
     */
    renderLegs(ctx, color) {
        const legSwing = Math.sin(this.runCycle);
        const hipY = 0;

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;

        if (this.limbState === LimbState.NO_LEFT_LEG || this.limbState === LimbState.DEFEATED) {
            // Hopping on one leg
            const hopOffset = Math.abs(Math.sin(this.runCycle * 2)) * 5;
            ctx.beginPath();
            ctx.moveTo(0, hipY);
            ctx.lineTo(5, hipY + this.limbLength - hopOffset);
            ctx.stroke();

            // Left leg stump
            ctx.beginPath();
            ctx.moveTo(0, hipY);
            ctx.lineTo(-5, hipY + 8);
            ctx.stroke();
        } else {
            // Normal running legs
            // Right leg
            ctx.beginPath();
            ctx.moveTo(0, hipY);
            ctx.lineTo(this.limbLength * 0.5 * Math.sin(legSwing), hipY + this.limbLength * Math.abs(Math.cos(legSwing * 0.5)));
            ctx.stroke();

            // Left leg
            ctx.beginPath();
            ctx.moveTo(0, hipY);
            ctx.lineTo(-this.limbLength * 0.5 * Math.sin(legSwing), hipY + this.limbLength * Math.abs(Math.cos(-legSwing * 0.5)));
            ctx.stroke();
        }
    }

    /**
     * Render celebration particles
     */
    renderCelebration(ctx) {
        const sparkleCount = 5;
        for (let i = 0; i < sparkleCount; i++) {
            const angle = (i / sparkleCount) * Math.PI * 2 + this.animTime * 3;
            const radius = 30 + Math.sin(this.animTime * 5 + i) * 10;
            const x = Math.cos(angle) * radius;
            const y = -this.bodyLength / 2 + Math.sin(angle) * radius * 0.5;

            ctx.fillStyle = ['#ffd700', '#ff6b6b', '#4ecca3'][i % 3];
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * Move runner to a horizontal position (immediate)
     */
    moveTo(x) {
        this.targetX = x;
    }

    /**
     * Queue a target X position for an upcoming barrier
     */
    queueTargetX(x) {
        this.queuedPositions.push(x);
    }

    /**
     * Called when a barrier passes - move to next queued position
     */
    onBarrierPassed() {
        if (this.queuedPositions.length > 0) {
            this.targetX = this.queuedPositions.shift();
        }
    }

    /**
     * Set whether runner is blocked by a barrier
     */
    setBlocked(blocked) {
        this.isBlockedByBarrier = blocked;
    }

    /**
     * Trigger run-through animation (when breaking through a barrier)
     * Runner surges forward briefly
     */
    runThrough() {
        this.runThroughTime = 0.25;
        this.runThroughSpeed = 100;
        this.isBlockedByBarrier = false;
        this.pushBackAmount = Math.max(0, this.pushBackAmount - 10);
    }

    /**
     * Trigger stumble animation
     */
    stumble() {
        this.animState = AnimState.STUMBLING;
        this.stumbleTime = 0.5;
    }

    /**
     * Trigger speed boost
     */
    boost() {
        this.boostTime = 0.3;
    }

    /**
     * Trigger jump for black key launch pad
     */
    launchJump() {
        this.animState = AnimState.JUMPING;
        this.velocityY = -400;
        this.jumpHeight = 0;
    }

    /**
     * Trigger celebration animation
     */
    celebrate() {
        this.animState = AnimState.CELEBRATING;
        this.celebrateTime = 0.5;
    }

    /**
     * Lose a limb (called when gator catches runner)
     */
    loseLimb() {
        this.limbsLost++;
        this.hurtFlash = 1.0; // Longer flash for more visible feedback
        this.animState = AnimState.HURT;

        // Dramatic knockback when hit
        this.y += 15; // Push forward briefly
        this.x += (Math.random() - 0.5) * 20; // Side wobble

        switch (this.limbsLost) {
            case 1:
                this.limbState = LimbState.NO_LEFT_ARM;
                break;
            case 2:
                this.limbState = LimbState.NO_ARMS;
                break;
            case 3:
                this.limbState = LimbState.NO_LEFT_LEG;
                break;
            default:
                this.limbState = LimbState.DEFEATED;
                break;
        }

        return this.limbState;
    }

    /**
     * Get current limb state for UI
     */
    getLimbState() {
        return {
            state: this.limbState,
            limbsRemaining: Math.max(0, 4 - this.limbsLost),
            hasLeftArm: this.limbState === LimbState.FULL,
            hasRightArm: this.limbState !== LimbState.DEFEATED,
            hasLeftLeg: this.limbState !== LimbState.NO_LEFT_LEG && this.limbState !== LimbState.DEFEATED,
            hasRightLeg: true // Always keep right leg until defeated
        };
    }

    /**
     * Get number of limbs remaining
     */
    getLimbCount() {
        return Math.max(0, 4 - this.limbsLost);
    }

    /**
     * Check if runner is defeated
     */
    isDefeated() {
        return this.limbState === LimbState.DEFEATED;
    }

    /**
     * Get runner's vertical position (for gator collision)
     */
    getY() {
        return this.y;
    }

    /**
     * Get runner's bounds for collision
     */
    getBounds() {
        return {
            x: this.x - 15,
            y: this.y - this.bodyLength - this.headRadius * 2,
            width: 30,
            height: this.bodyLength + this.headRadius * 2 + this.limbLength
        };
    }
}

export { LimbState, AnimState };
