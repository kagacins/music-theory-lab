/**
 * Gator - The chasing alligator enemy
 *
 * Follows behind the runner, gets closer when the player makes mistakes,
 * and chomps the runner when it catches up.
 */

// Animation states
const GatorAnimState = {
    SWIMMING: 'swimming',
    LUNGING: 'lunging',
    CHOMPING: 'chomping',
    RETREATING: 'retreating'
};

export class Gator {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.baseY = y;

        // Distance management (gator follows at a distance behind runner)
        this.distanceBehind = 150; // Pixels behind runner
        this.minDistance = 30;     // Catch distance
        this.maxDistance = 250;    // Max fallback distance

        // Movement
        this.baseSpeed = 80;       // Base approach speed
        this.currentSpeed = 0;
        this.targetX = x;

        // State
        this.animState = GatorAnimState.SWIMMING;
        this.animTime = 0;

        // Animation timers
        this.chompTime = 0;
        this.lungeTime = 0;
        this.retreatTime = 0;

        // Visual properties
        this.width = 90;            // Wider body
        this.height = 50;           // Taller to accommodate long snout
        this.jawAngle = 0;          // 0 = closed, 1 = open
        this.tailWag = 0;

        // Color - more vibrant alligator green
        this.bodyColor = '#2d6a2f';
        this.bellyColor = '#9fcc8f';
        this.eyeColor = '#ffdd00';

        // Splash particles
        this.splashes = [];
    }

    /**
     * Update gator state
     */
    update(dt, runner, runnerBlocked = false) {
        this.animTime += dt;

        // Follow runner's X position
        if (runner) {
            this.targetX = runner.x;
        }

        // Smooth horizontal movement
        this.x += (this.targetX - this.x) * 3 * dt;

        // Update animation state
        switch (this.animState) {
            case GatorAnimState.SWIMMING:
                this.updateSwimming(dt, runner, runnerBlocked);
                break;
            case GatorAnimState.LUNGING:
                this.updateLunging(dt);
                break;
            case GatorAnimState.CHOMPING:
                this.updateChomping(dt);
                break;
            case GatorAnimState.RETREATING:
                this.updateRetreating(dt);
                break;
        }

        // Update splash particles
        this.updateSplashes(dt);

        // Add swimming splashes - more when chasing blocked runner
        const splashRate = runnerBlocked ? 0.25 : 0.1;
        if (this.animState === GatorAnimState.SWIMMING && Math.random() < splashRate) {
            this.addSplash();
        }
    }

    /**
     * Update swimming animation
     */
    updateSwimming(dt, runner, runnerBlocked = false) {
        // Tail wagging - faster when chasing blocked runner
        const wagSpeed = runnerBlocked ? 10 : 5;
        this.tailWag = Math.sin(this.animTime * wagSpeed) * 0.3;

        // Jaw movement - more aggressive when runner is blocked
        if (runnerBlocked) {
            this.jawAngle = 0.3 + Math.sin(this.animTime * 4) * 0.2; // Snapping anticipation
        } else {
            this.jawAngle = 0.1 + Math.sin(this.animTime * 2) * 0.05;
        }

        // Bobbing in water
        this.y = this.baseY + Math.sin(this.animTime * 3) * 5;

        // Approach runner
        if (runner) {
            const runnerY = runner.getY();

            if (runnerBlocked) {
                // Runner is stuck at a barrier - gator closes in!
                // Move toward the runner at a steady pace
                const closeSpeed = 80;
                if (this.baseY > runnerY + this.minDistance) {
                    this.baseY -= closeSpeed * dt;
                }
                // Reduce distance behind tracking
                this.distanceBehind = Math.max(this.minDistance, this.distanceBehind - 20 * dt);
            } else {
                // Normal pursuit - maintain distance behind runner
                const targetY = runnerY + this.distanceBehind;
                this.baseY += (targetY - this.baseY) * 0.5 * dt;

                // Slowly recover distance when runner is moving freely
                this.distanceBehind = Math.min(this.maxDistance, this.distanceBehind + 15 * dt);
            }

            // Keep gator visible on screen (don't go off bottom)
            this.baseY = Math.min(this.baseY, 620);
        }
    }

    /**
     * Update lunging animation
     */
    updateLunging(dt) {
        this.lungeTime -= dt;

        // Quick forward motion
        this.baseY -= 200 * dt;

        // Open jaw
        this.jawAngle = Math.min(1, this.jawAngle + 5 * dt);

        if (this.lungeTime <= 0) {
            this.animState = GatorAnimState.CHOMPING;
            this.chompTime = 0.3;
        }
    }

    /**
     * Update chomping animation - dramatic snap!
     */
    updateChomping(dt) {
        this.chompTime -= dt;

        // Snap jaw shut FAST with shake
        this.jawAngle = Math.max(0, this.jawAngle - 15 * dt);

        // Shake effect during chomp
        this.x += (Math.random() - 0.5) * 8;
        this.y += (Math.random() - 0.5) * 6;

        // More splashes during the violent chomp
        if (Math.random() < 0.4) {
            this.addSplash();
        }

        if (this.chompTime <= 0) {
            this.animState = GatorAnimState.RETREATING;
            this.retreatTime = 0.6; // Slightly longer retreat
        }
    }

    /**
     * Update retreating animation
     */
    updateRetreating(dt) {
        this.retreatTime -= dt;

        // Move back but stay on screen (screen height ~600, gator should stay visible)
        if (this.baseY < 620) {
            this.baseY += 150 * dt;
        }
        this.y = this.baseY + Math.sin(this.animTime * 3) * 5;

        if (this.retreatTime <= 0) {
            this.animState = GatorAnimState.SWIMMING;
        }
    }

    /**
     * Update splash particles
     */
    updateSplashes(dt) {
        this.splashes = this.splashes.filter(splash => {
            splash.life -= dt;
            splash.y -= splash.vy * dt;
            splash.vy -= 200 * dt; // Gravity
            splash.x += splash.vx * dt;
            return splash.life > 0;
        });
    }

    /**
     * Add a splash particle
     */
    addSplash() {
        this.splashes.push({
            x: this.x + (Math.random() - 0.5) * this.width,
            y: this.y - this.height / 2,
            vx: (Math.random() - 0.5) * 50,
            vy: -50 - Math.random() * 50,
            life: 0.5,
            size: 2 + Math.random() * 3
        });
    }

    /**
     * Render the gator
     */
    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Draw splashes
        this.renderSplashes(ctx);

        // Draw water effect around gator
        this.renderWater(ctx);

        // Draw body
        this.renderBody(ctx);

        // Draw tail
        this.renderTail(ctx);

        // Draw head and jaws
        this.renderHead(ctx);

        ctx.restore();
    }

    /**
     * Render water splashes
     */
    renderSplashes(ctx) {
        ctx.fillStyle = '#87ceeb';
        for (const splash of this.splashes) {
            ctx.globalAlpha = splash.life / 0.5;
            ctx.beginPath();
            ctx.arc(splash.x - this.x, splash.y - this.y, splash.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    /**
     * Render water effect
     */
    renderWater(ctx) {
        // Ripples
        ctx.strokeStyle = '#87ceeb';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;

        for (let i = 0; i < 3; i++) {
            const rippleOffset = (this.animTime * 2 + i * 0.5) % 1;
            const rippleWidth = this.width * (0.8 + rippleOffset * 0.5);
            ctx.globalAlpha = 0.5 * (1 - rippleOffset);

            ctx.beginPath();
            ctx.ellipse(0, 0, rippleWidth / 2, 10, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    /**
     * Render gator body
     */
    renderBody(ctx) {
        // Main body (oval)
        ctx.fillStyle = this.bodyColor;
        ctx.beginPath();
        ctx.ellipse(0, -5, this.width / 3, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Belly lighter
        ctx.fillStyle = this.bellyColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.width / 4, this.height / 4, 0, 0, Math.PI);
        ctx.fill();

        // Scales/texture
        ctx.fillStyle = '#1a3d1a';
        for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.arc(i * 8, -10, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * Render gator tail
     */
    renderTail(ctx) {
        ctx.fillStyle = this.bodyColor;

        ctx.save();
        ctx.translate(0, 10);
        ctx.rotate(this.tailWag);

        // Tail segments
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.quadraticCurveTo(0, 30, 10, 0);
        ctx.quadraticCurveTo(0, 50, -5, 0);
        ctx.fill();

        // Tail spikes
        ctx.fillStyle = '#1a3d1a';
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(-3, 5 + i * 10);
            ctx.lineTo(0, i * 10);
            ctx.lineTo(3, 5 + i * 10);
            ctx.fill();
        }

        ctx.restore();
    }

    /**
     * Render gator head and jaws - proper long alligator snout
     */
    renderHead(ctx) {
        ctx.save();
        ctx.translate(0, -this.height / 2 - 5);

        const snoutLength = 60; // Long alligator snout
        const snoutWidth = 18;  // Narrow snout
        const headWidth = 28;   // Head is wider than snout
        const jawOpen = this.jawAngle * 12; // How much jaw opens

        // === UPPER JAW / SNOUT (long and narrow) ===
        ctx.fillStyle = this.bodyColor;
        ctx.beginPath();
        // Start at back of head
        ctx.moveTo(-headWidth / 2, 5);
        // Curve up to eye ridge
        ctx.quadraticCurveTo(-headWidth / 2, -8, -12, -10);
        // Top of snout - long and narrow, tapers toward tip
        ctx.lineTo(-snoutWidth / 2, -snoutLength * 0.3 - jawOpen);
        ctx.lineTo(-8, -snoutLength * 0.7 - jawOpen);
        ctx.lineTo(-4, -snoutLength - jawOpen); // Tip of snout
        ctx.lineTo(4, -snoutLength - jawOpen);
        ctx.lineTo(8, -snoutLength * 0.7 - jawOpen);
        ctx.lineTo(snoutWidth / 2, -snoutLength * 0.3 - jawOpen);
        // Back to eye ridge
        ctx.lineTo(12, -10);
        ctx.quadraticCurveTo(headWidth / 2, -8, headWidth / 2, 5);
        ctx.closePath();
        ctx.fill();

        // Snout ridge/texture bumps
        ctx.fillStyle = '#1a3d1a';
        for (let i = 0; i < 4; i++) {
            const bumpY = -15 - i * 12 - jawOpen * (i / 4);
            ctx.beginPath();
            ctx.arc(0, bumpY, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // === LOWER JAW ===
        ctx.fillStyle = this.bodyColor;
        ctx.beginPath();
        // Start at back of head
        ctx.moveTo(-headWidth / 2 + 4, 8);
        // Bottom of lower jaw - also long but slightly shorter than upper
        ctx.lineTo(-snoutWidth / 2 + 2, -snoutLength * 0.25 + jawOpen);
        ctx.lineTo(-6, -snoutLength * 0.6 + jawOpen);
        ctx.lineTo(-3, -snoutLength * 0.85 + jawOpen); // Lower jaw tip
        ctx.lineTo(3, -snoutLength * 0.85 + jawOpen);
        ctx.lineTo(6, -snoutLength * 0.6 + jawOpen);
        ctx.lineTo(snoutWidth / 2 - 2, -snoutLength * 0.25 + jawOpen);
        ctx.lineTo(headWidth / 2 - 4, 8);
        ctx.closePath();
        ctx.fill();

        // Lighter belly color on lower jaw
        ctx.fillStyle = this.bellyColor;
        ctx.beginPath();
        ctx.moveTo(-headWidth / 2 + 6, 6);
        ctx.lineTo(-4, -snoutLength * 0.5 + jawOpen);
        ctx.lineTo(4, -snoutLength * 0.5 + jawOpen);
        ctx.lineTo(headWidth / 2 - 6, 6);
        ctx.closePath();
        ctx.fill();

        // === TEETH (visible along the snout when jaw is open) ===
        if (this.jawAngle > 0.1) {
            ctx.fillStyle = '#ffffff';
            const teethCount = 8;
            for (let i = 0; i < teethCount; i++) {
                const t = i / (teethCount - 1);
                // Upper teeth - along the snout
                const upperTeethY = -15 - t * 40 - jawOpen * t;
                const teethSpread = 6 + (1 - t) * 4; // Wider at back

                // Upper left tooth
                ctx.beginPath();
                ctx.moveTo(-teethSpread - 1, upperTeethY);
                ctx.lineTo(-teethSpread, upperTeethY + 5);
                ctx.lineTo(-teethSpread + 1, upperTeethY);
                ctx.fill();

                // Upper right tooth
                ctx.beginPath();
                ctx.moveTo(teethSpread - 1, upperTeethY);
                ctx.lineTo(teethSpread, upperTeethY + 5);
                ctx.lineTo(teethSpread + 1, upperTeethY);
                ctx.fill();

                // Lower teeth (pointing up)
                const lowerTeethY = -10 - t * 35 + jawOpen * (1 - t * 0.5);
                const lowerSpread = 5 + (1 - t) * 3;

                ctx.beginPath();
                ctx.moveTo(-lowerSpread - 1, lowerTeethY);
                ctx.lineTo(-lowerSpread, lowerTeethY - 4);
                ctx.lineTo(-lowerSpread + 1, lowerTeethY);
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(lowerSpread - 1, lowerTeethY);
                ctx.lineTo(lowerSpread, lowerTeethY - 4);
                ctx.lineTo(lowerSpread + 1, lowerTeethY);
                ctx.fill();
            }
        }

        // === NOSTRILS (at tip of snout) ===
        ctx.fillStyle = '#1a3d1a';
        ctx.beginPath();
        ctx.ellipse(-3, -snoutLength + 3 - jawOpen, 2, 1.5, 0, 0, Math.PI * 2);
        ctx.ellipse(3, -snoutLength + 3 - jawOpen, 2, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // === EYES (bulging on top of head, set back from snout) ===
        // Eye bumps/ridges
        ctx.fillStyle = this.bodyColor;
        ctx.beginPath();
        ctx.ellipse(-10, -5, 8, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(10, -5, 8, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye whites
        ctx.fillStyle = this.eyeColor;
        ctx.beginPath();
        ctx.ellipse(-10, -6, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(10, -6, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupils (slit-like, looking up toward runner)
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(-10, -8, 2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(10, -8, 2, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye shine
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-12, -9, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(8, -9, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * Make gator gain ground (get closer to runner)
     */
    gainGround(amount) {
        this.distanceBehind = Math.max(this.minDistance + 20, this.distanceBehind - amount);

        // Trigger lunge if very close
        if (this.distanceBehind < 60 && this.animState === GatorAnimState.SWIMMING) {
            this.animState = GatorAnimState.LUNGING;
            this.lungeTime = 0.2;
        }
    }

    /**
     * Make gator fall back (get further from runner)
     */
    fallBack(amount) {
        this.distanceBehind = Math.min(this.maxDistance, this.distanceBehind + amount);
        // Also push baseY back a little, but stay on screen
        this.baseY = Math.min(this.baseY + amount * 0.5, 620);
    }

    /**
     * Trigger chomp animation with dramatic lunge
     */
    chomp() {
        // First lunge forward dramatically
        this.animState = GatorAnimState.LUNGING;
        this.lungeTime = 0.15; // Quick lunge
        this.jawAngle = 1; // Open jaw wide during lunge

        // Move gator up toward runner for dramatic effect
        this.baseY -= 40;

        // Big splash effect
        for (let i = 0; i < 15; i++) {
            this.addSplash();
        }
    }

    /**
     * Reset distance after catching runner - dramatic fallback
     */
    resetDistance() {
        this.distanceBehind = 180; // Further back after catch
        // Move gator back significantly - add 150px to current position
        this.baseY += 150;
        // Keep on screen
        this.baseY = Math.min(this.baseY, 580);
        this.animState = GatorAnimState.RETREATING;
        this.retreatTime = 0.8; // Longer retreat animation

        // Splash on retreat
        for (let i = 0; i < 8; i++) {
            this.addSplash();
        }
    }

    /**
     * Check if gator has caught the runner
     */
    hasCaughtRunner(runner) {
        if (!runner || this.animState !== GatorAnimState.SWIMMING) return false;

        const distance = this.getDistanceToRunner(runner);
        return distance <= this.minDistance;
    }

    /**
     * Get distance to runner
     */
    getDistanceToRunner(runner) {
        if (!runner) return this.maxDistance;
        // Gator is below runner (higher Y), so distance is gator.y - runner.y
        return this.y - runner.getY();
    }

    /**
     * Get gator bounds for collision
     */
    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height,
            width: this.width,
            height: this.height
        };
    }
}

export { GatorAnimState };
