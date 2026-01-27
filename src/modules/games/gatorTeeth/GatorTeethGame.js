/**
 * GatorTeeth - A chord-learning arcade game (3D Perspective)
 *
 * Player runs AWAY from camera INTO the screen toward a gator mouth.
 * Piano key "teeth" barriers approach FROM the distance (getting larger).
 * Like Temple Run / Subway Surfers perspective.
 * 5 failures = game over.
 */

import { TeethBarrier } from './TeethBarrier.js';
import { Player } from './Player.js';
import { AudioManager } from './AudioManager.js';
import { getLevelData, WORLDS } from './levelData.js';

const GameState = {
    MENU: 'menu',
    LEVEL_SELECT: 'level_select',
    PLAYING: 'playing',
    PAUSED: 'paused',
    LEVEL_COMPLETE: 'level_complete',
    GAME_OVER: 'game_over'
};

const BASE_WIDTH = 400;
const BASE_HEIGHT = 600;

// 3D Perspective constants - NEAR HORIZONTAL camera angle (looking straight ahead)
const HORIZON_Y = 10;            // Vanishing point almost at top edge (near 0 degrees)
const GROUND_Y = 600;            // At very bottom
const PERSPECTIVE_SCALE = 0.02;  // Even tinier at horizon = EVEN BIGGER when close
const GATOR_BANNER_HEIGHT = 45;  // Height of gator banner at top

export class GatorTeethGame {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = null;
        this.canvas = null;
        this.ctx = null;

        // Game state
        this.state = GameState.MENU;
        this.currentWorld = 1;
        this.currentLevel = 1;

        // Scoring
        this.score = 0;
        this.failures = 0;
        this.maxFailures = 5;
        this.chordsCompleted = 0;
        this.chordsRequired = 10;

        // Combo system
        this.combo = 0;
        this.maxCombo = 0;
        this.comboMessage = null;  // { text, timer, color }

        // Encouragement messages
        this.encourageMessages = [
            { threshold: 3, messages: ['Nice!', 'Good!', 'Keep it up!'] },
            { threshold: 5, messages: ['Great!', 'Awesome!', 'On fire!'] },
            { threshold: 8, messages: ['Amazing!', 'Incredible!', 'Unstoppable!'] },
            { threshold: 12, messages: ['LEGENDARY!', 'GODLIKE!', 'PERFECT!'] }
        ];

        // Timing
        this.lastTime = 0;
        this.gameTime = 0;

        // Scale
        this.scale = 1;
        this.width = BASE_WIDTH;
        this.height = BASE_HEIGHT;

        // Entities
        this.player = null;
        this.barriers = [];
        this.currentBarrierIndex = 0;

        // Systems
        this.audioManager = null;

        // Level data
        this.levelData = null;
        this.chordQueue = [];
        this.currentChordIndex = 0;

        // 3D barrier timing (Z depth - 0 = at player, 1 = at horizon)
        this.barrierSpeed = 0.15;   // Z units per second (slower)
        this.noteSpacing = 0.45;    // Z distance between notes in same chord
        this.chordSpacing = 0.55;   // Z distance between chords (not much more than notes)

        // Barrier becomes "active" (clickable, highlighted) when it reaches this Z
        this.activeBarrierZ = 0.7;  // Further away = more time to react

        // Chord announcement
        this.chordAnnouncement = null;  // { name, timer }
        this.announcementDuration = 2.0; // seconds to show announcement (longer)

        // Visual theme (base)
        this.theme = {
            background: '#1a1a2e',
            ground: '#2d3a4d',
            gatorGreen: '#2d5a3d',
            teethWhite: '#f0f0f0',
            accent: '#4ecca3',
            danger: '#ff6b6b'
        };

        // Color themes that cycle as you progress
        this.colorThemes = [
            { accent: '#4ecca3', name: 'Emerald' },    // Green (default)
            { accent: '#f39c12', name: 'Gold' },       // Gold
            { accent: '#9b59b6', name: 'Amethyst' },   // Purple
            { accent: '#3498db', name: 'Sapphire' },   // Blue
            { accent: '#e74c3c', name: 'Ruby' },       // Red
            { accent: '#1abc9c', name: 'Teal' },       // Teal
            { accent: '#ff6b9d', name: 'Rose' },       // Pink
        ];
        this.currentThemeIndex = 0;

        // Bind methods
        this.gameLoop = this.gameLoop.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    /**
     * Initialize the game
     */
    async init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.error('Game container not found:', this.containerId);
            return false;
        }

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'display: block; width: 100%; height: 100%;';
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        // Handle sizing
        this.handleResize();
        window.addEventListener('resize', this.handleResize);

        // Input handlers
        this.canvas.addEventListener('click', this.handleClick);
        window.addEventListener('keydown', this.handleKeyDown);

        // Initialize audio
        this.audioManager = new AudioManager({});
        await this.audioManager.init();

        // Start game loop
        requestAnimationFrame(this.gameLoop);

        return true;
    }

    /**
     * Handle window resize
     */
    handleResize() {
        const rect = this.container.getBoundingClientRect();
        const aspectRatio = BASE_WIDTH / BASE_HEIGHT;

        let width = rect.width;
        let height = rect.height;

        if (width / height > aspectRatio) {
            width = height * aspectRatio;
        } else {
            height = width / aspectRatio;
        }

        this.canvas.width = width;
        this.canvas.height = height;
        this.scale = width / BASE_WIDTH;
        this.width = BASE_WIDTH;
        this.height = BASE_HEIGHT;
    }

    /**
     * Convert 3D Z depth to screen Y position and scale
     * z = 0 means at player (bottom), z = 1 means at horizon (far)
     * z < 0 means past the player (scrolling off bottom of screen)
     */
    zToScreen(z) {
        // Clamp z at the far end only, allow negative z for scrolling off
        z = Math.min(1, z);

        // Y position (lerp from ground to horizon, continues past ground for z < 0)
        const y = GROUND_Y - z * (GROUND_Y - HORIZON_Y);

        // Scale (larger when closer, smaller when far)
        // For z < 0, scale continues to grow slightly
        const scale = 1 - z * (1 - PERSPECTIVE_SCALE);

        return { y, scale };
    }

    /**
     * Main game loop
     */
    gameLoop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        if (this.state === GameState.PLAYING) {
            this.update(dt);
        }

        this.render();
        requestAnimationFrame(this.gameLoop);
    }

    /**
     * Update game state
     */
    update(dt) {
        this.gameTime += dt;

        // Update chord announcement timer
        if (this.chordAnnouncement) {
            this.chordAnnouncement.timer -= dt;
            if (this.chordAnnouncement.timer <= 0) {
                this.chordAnnouncement = null;
            }
        }

        // Update combo message timer
        if (this.comboMessage) {
            this.comboMessage.timer -= dt;
            if (this.comboMessage.timer <= 0) {
                this.comboMessage = null;
            }
        }

        // Update player
        if (this.player) {
            this.player.update(dt);
        }

        // Get current barrier
        const currentBarrier = this.barriers[this.currentBarrierIndex];

        // ALWAYS move barriers toward player (z decreases)
        for (const barrier of this.barriers) {
            const isActive = barrier === currentBarrier;
            barrier.update(dt, this.barrierSpeed, isActive);
        }

        // Check if current barrier has fully scrolled off the bottom of the screen
        // z < -0.15 means the barrier is completely off screen (smoothly scrolled away)
        if (currentBarrier && currentBarrier.z < -0.15) {
            // If barrier wasn't cleared, it's a failure
            if (!currentBarrier.isCleared) {
                this.onFailure('Too slow!');
            }
            // NOW advance to next barrier (previous one is fully gone)
            this.currentBarrierIndex++;
        }

        // Remove barriers that are way off screen (well past the player)
        const beforeLength = this.barriers.length;
        this.barriers = this.barriers.filter(b => b.z > -0.4);
        const removed = beforeLength - this.barriers.length;

        // Adjust index if barriers were removed from front of array
        if (removed > 0) {
            this.currentBarrierIndex = Math.max(0, this.currentBarrierIndex - removed);
        }

        // Spawn new barriers as needed
        this.spawnBarriersIfNeeded();

        // Check win condition
        if (this.chordsCompleted >= this.chordsRequired && this.barriers.length === 0) {
            this.onLevelComplete();
        }
    }

    /**
     * Render the game
     */
    render() {
        const ctx = this.ctx;

        // Clear
        ctx.fillStyle = this.theme.background;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.scale(this.scale, this.scale);

        switch (this.state) {
            case GameState.MENU:
                this.renderMenu(ctx);
                break;
            case GameState.LEVEL_SELECT:
                this.renderLevelSelect(ctx);
                break;
            case GameState.PLAYING:
            case GameState.PAUSED:
                this.renderGame(ctx);
                break;
            case GameState.LEVEL_COMPLETE:
                this.renderGame(ctx);
                this.renderLevelComplete(ctx);
                break;
            case GameState.GAME_OVER:
                this.renderGame(ctx);
                this.renderGameOver(ctx);
                break;
        }

        ctx.restore();
    }

    /**
     * Render main menu
     */
    renderMenu(ctx) {
        // Draw gator banner
        this.renderGatorBanner(ctx);

        // Draw perspective ground for visual interest
        this.renderPerspectiveGround(ctx);

        // Title (bigger, centered)
        ctx.fillStyle = this.theme.accent;
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = this.theme.accent;
        ctx.shadowBlur = 15;
        ctx.fillText('GATOR', BASE_WIDTH / 2, 180);
        ctx.fillText('TEETH', BASE_WIDTH / 2, 240);
        ctx.shadowBlur = 0;

        // Gator emoji
        ctx.font = '90px serif';
        ctx.fillText('🐊', BASE_WIDTH / 2, 360);

        // Instructions
        ctx.fillStyle = '#aaa';
        ctx.font = '16px monospace';
        ctx.fillText('Run through the piano keys!', BASE_WIDTH / 2, 440);
        ctx.fillText('Click the highlighted key to open', BASE_WIDTH / 2, 465);
        ctx.fillText('a hole and pass through', BASE_WIDTH / 2, 490);

        // Start button
        ctx.fillStyle = this.theme.accent;
        ctx.font = 'bold 22px monospace';
        ctx.fillText('[ CLICK TO START ]', BASE_WIDTH / 2, 550);
    }

    /**
     * Render level select
     */
    renderLevelSelect(ctx) {
        ctx.fillStyle = this.theme.accent;
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SELECT WORLD', BASE_WIDTH / 2, 50);

        // Render world buttons
        WORLDS.forEach((world, i) => {
            const y = 100 + i * 90;

            ctx.fillStyle = world.theme.primary;
            ctx.fillRect(50, y, BASE_WIDTH - 100, 70);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 18px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(world.name, 70, y + 30);

            ctx.font = '12px monospace';
            ctx.fillStyle = '#ddd';
            ctx.fillText(world.description, 70, y + 50);
        });
    }

    /**
     * Render the 3D game view
     */
    renderGame(ctx) {
        // Draw gator banner at top (decorative)
        this.renderGatorBanner(ctx);

        // Draw perspective ground/road
        this.renderPerspectiveGround(ctx);

        // Sort barriers by Z (far to near) for proper depth ordering
        const sortedBarriers = [...this.barriers].sort((a, b) => b.z - a.z);

        // Draw ALL barriers from far to near (including cleared ones with holes)
        const currentBarrier = this.barriers[this.currentBarrierIndex];
        for (const barrier of sortedBarriers) {
            // Render barrier if it's on screen or scrolling off (z > -0.2 and z < 1.1)
            // Barriers smoothly scroll off the bottom before being removed
            if (barrier.z > -0.2 && barrier.z < 1.1) {
                // Only the CURRENT barrier is "active" (can be clicked) AND only if not cleared
                const isActive = barrier === currentBarrier && !barrier.isCleared && barrier.z <= this.activeBarrierZ;
                barrier.render(ctx, this.theme, this.zToScreen.bind(this), isActive);
            }
        }

        // Draw player (always in front)
        if (this.player) {
            this.player.render(ctx);
        }

        // Draw chord announcement overlay
        if (this.chordAnnouncement) {
            this.renderChordAnnouncement(ctx);
        }

        // Draw combo message
        if (this.comboMessage) {
            this.renderComboMessage(ctx);
        }

        // Draw HUD
        this.renderHUD(ctx);
    }

    /**
     * Render combo encouragement message
     */
    renderComboMessage(ctx) {
        const msg = this.comboMessage;
        const progress = msg.timer / 0.8;

        // Float up and fade out
        const yOffset = (1 - progress) * 50;
        const alpha = progress;
        const scale = 1 + (1 - progress) * 0.3;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(BASE_WIDTH / 2, 300 - yOffset);
        ctx.scale(scale, scale);

        // Glowing text
        ctx.fillStyle = msg.color;
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = msg.color;
        ctx.shadowBlur = 15;
        ctx.fillText(msg.text, 0, 0);

        // Combo count below
        if (this.combo >= 3) {
            ctx.font = 'bold 18px monospace';
            ctx.fillText(`${this.combo}x COMBO`, 0, 30);
        }

        ctx.restore();
    }

    /**
     * Render 3D perspective ground - extremely low camera angle
     */
    renderPerspectiveGround(ctx) {
        // Ground fills everything below the banner
        const groundTop = GATOR_BANNER_HEIGHT;

        // Ground with perspective - darker at horizon, lighter at bottom
        const groundGrad = ctx.createLinearGradient(0, groundTop, 0, GROUND_Y);
        groundGrad.addColorStop(0, '#050a10');
        groundGrad.addColorStop(0.2, '#0a1520');
        groundGrad.addColorStop(0.5, '#1a2a3a');
        groundGrad.addColorStop(1, '#2d3a4d');
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, groundTop, BASE_WIDTH, GROUND_Y - groundTop);

        // Perspective grid lines - very dramatic convergence
        ctx.strokeStyle = 'rgba(78, 204, 163, 0.12)';
        ctx.lineWidth = 1;

        // Converging vertical lines (road/track effect)
        const vanishX = BASE_WIDTH / 2;
        const vanishY = GATOR_BANNER_HEIGHT - 5; // At banner bottom
        for (let x = -150; x <= BASE_WIDTH + 150; x += 30) {
            ctx.beginPath();
            ctx.moveTo(x, GROUND_Y + 100);
            ctx.lineTo(vanishX, vanishY);
            ctx.stroke();
        }

        // Horizontal depth lines (distance markers) - fewer, more spread out
        for (let z = 0.15; z < 1; z += 0.15) {
            const { y } = this.zToScreen(z);
            if (y < groundTop) continue;

            const width = BASE_WIDTH * (1 - z * 0.95);
            const x = (BASE_WIDTH - width) / 2;

            ctx.globalAlpha = 1 - z * 0.7;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + width, y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    /**
     * Render gator banner at top of screen (decorative header)
     */
    renderGatorBanner(ctx) {
        // Dark banner background
        const bannerGrad = ctx.createLinearGradient(0, 0, 0, GATOR_BANNER_HEIGHT);
        bannerGrad.addColorStop(0, '#1a3a2a');
        bannerGrad.addColorStop(1, '#0a1a10');
        ctx.fillStyle = bannerGrad;
        ctx.fillRect(0, 0, BASE_WIDTH, GATOR_BANNER_HEIGHT);

        // Bottom border (teeth-like)
        ctx.fillStyle = '#2d5a3d';
        for (let x = 0; x < BASE_WIDTH; x += 16) {
            ctx.beginPath();
            ctx.moveTo(x, GATOR_BANNER_HEIGHT);
            ctx.lineTo(x + 8, GATOR_BANNER_HEIGHT + 6);
            ctx.lineTo(x + 16, GATOR_BANNER_HEIGHT);
            ctx.fill();
        }

        // Gator eyes (left side) - smaller for compact banner
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.ellipse(40, 22, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(75, 22, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Pupils
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(44, 22, 4, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(79, 22, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Gator eyes (right side)
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.ellipse(BASE_WIDTH - 40, 22, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(BASE_WIDTH - 75, 22, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Pupils (right side)
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(BASE_WIDTH - 36, 22, 4, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(BASE_WIDTH - 71, 22, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Title in center
        ctx.fillStyle = this.theme.accent;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GATOR TEETH', BASE_WIDTH / 2, 28);
    }

    /**
     * Render chord announcement (big text when new chord appears)
     */
    renderChordAnnouncement(ctx) {
        const ann = this.chordAnnouncement;
        const progress = ann.timer / this.announcementDuration;

        // Fade in/out
        const alpha = progress > 0.7 ? (1 - progress) / 0.3 : progress < 0.2 ? progress / 0.2 : 1;

        // Scale effect (starts big, settles to normal)
        const scale = 1 + (progress > 0.7 ? (progress - 0.7) * 1.5 : 0);

        ctx.save();
        ctx.globalAlpha = alpha * 0.95;

        // Position announcement in upper portion of screen (not blocking gameplay)
        const boxY = 80;
        const boxHeight = 100;

        // Dark overlay behind text with gradient
        const grad = ctx.createLinearGradient(0, boxY, 0, boxY + boxHeight);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
        grad.addColorStop(1, 'rgba(20, 40, 30, 0.85)');
        ctx.fillStyle = grad;
        ctx.fillRect(30, boxY, BASE_WIDTH - 60, boxHeight);

        // Glowing border
        ctx.strokeStyle = this.theme.accent;
        ctx.lineWidth = 3;
        ctx.shadowColor = this.theme.accent;
        ctx.shadowBlur = 15 * alpha;
        ctx.strokeRect(30, boxY, BASE_WIDTH - 60, boxHeight);
        ctx.shadowBlur = 0;

        ctx.translate(BASE_WIDTH / 2, boxY + boxHeight / 2);
        ctx.scale(scale, scale);

        // Chord name (big and bold) - PRIMARY focus
        ctx.fillStyle = this.theme.accent;
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = this.theme.accent;
        ctx.shadowBlur = 10;
        ctx.fillText(ann.name, 0, 5);
        ctx.shadowBlur = 0;

        // Notes hint below
        if (ann.notes) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px monospace';
            ctx.fillText(ann.notes.join('  →  '), 0, 35);
        }

        ctx.restore();
    }

    /**
     * Render HUD
     */
    renderHUD(ctx) {
        // Lives (hearts)
        const livesRemaining = this.maxFailures - this.failures;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${'❤️'.repeat(livesRemaining)}${'🖤'.repeat(this.failures)}`, 10, 30);

        // Score
        ctx.textAlign = 'right';
        ctx.fillText(`Score: ${this.score}`, BASE_WIDTH - 10, 30);

        // Combo (if active)
        if (this.combo >= 3) {
            ctx.fillStyle = this.theme.accent;
            ctx.font = 'bold 12px monospace';
            ctx.fillText(`${this.combo}x`, BASE_WIDTH - 10, 45);
        }

        // Progress
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`${this.chordsCompleted}/${this.chordsRequired}`, BASE_WIDTH / 2, 30);

        // Current chord name
        const currentBarrier = this.barriers[this.currentBarrierIndex];
        if (currentBarrier) {
            ctx.fillStyle = this.theme.accent;
            ctx.font = 'bold 18px monospace';
            ctx.fillText(currentBarrier.chordName, BASE_WIDTH / 2, 55);

            // Target note hint
            ctx.font = '14px monospace';
            ctx.fillStyle = '#aaa';
            ctx.fillText(`Press: ${currentBarrier.targetNote.name}`, BASE_WIDTH / 2, 75);
        }
    }

    /**
     * Render level complete overlay
     */
    renderLevelComplete(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        ctx.fillStyle = this.theme.accent;
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = this.theme.accent;
        ctx.shadowBlur = 15;
        ctx.fillText('LEVEL', BASE_WIDTH / 2, 180);
        ctx.fillText('COMPLETE!', BASE_WIDTH / 2, 230);
        ctx.shadowBlur = 0;

        ctx.font = '24px monospace';
        ctx.fillStyle = '#fff';
        ctx.fillText(`Score: ${this.score}`, BASE_WIDTH / 2, 300);

        // Show max combo
        if (this.maxCombo >= 3) {
            ctx.font = '18px monospace';
            ctx.fillStyle = '#f39c12';
            ctx.fillText(`Max Combo: ${this.maxCombo}x`, BASE_WIDTH / 2, 340);
        }

        // Show theme color achieved
        const themeName = this.colorThemes[this.currentThemeIndex].name;
        ctx.font = '14px monospace';
        ctx.fillStyle = this.theme.accent;
        ctx.fillText(`Theme: ${themeName}`, BASE_WIDTH / 2, 380);

        ctx.font = '18px monospace';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Click to continue', BASE_WIDTH / 2, 440);
    }

    /**
     * Render game over overlay
     */
    renderGameOver(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

        ctx.fillStyle = this.theme.danger;
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', BASE_WIDTH / 2, 220);

        ctx.font = '60px serif';
        ctx.fillText('🐊', BASE_WIDTH / 2, 310);

        ctx.font = '20px monospace';
        ctx.fillStyle = '#aaa';
        ctx.fillText(`Final Score: ${this.score}`, BASE_WIDTH / 2, 380);

        ctx.font = '16px monospace';
        ctx.fillText('Click to try again', BASE_WIDTH / 2, 450);
    }

    /**
     * Handle click events
     */
    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.scale;
        const y = (e.clientY - rect.top) / this.scale;

        switch (this.state) {
            case GameState.MENU:
                this.showLevelSelect();
                break;
            case GameState.LEVEL_SELECT:
                this.handleLevelSelectClick(x, y);
                break;
            case GameState.PLAYING:
                this.handleGameClick(x, y);
                break;
            case GameState.LEVEL_COMPLETE:
                this.nextLevel();
                break;
            case GameState.GAME_OVER:
                this.restartLevel();
                break;
        }
    }

    /**
     * Handle level select click
     */
    handleLevelSelectClick(x, y) {
        WORLDS.forEach((world, i) => {
            const btnY = 100 + i * 90;
            if (x >= 50 && x <= BASE_WIDTH - 50 && y >= btnY && y <= btnY + 70) {
                this.startLevel(world.id, 1);
            }
        });
    }

    /**
     * Handle click during gameplay - click on barrier keys
     * Can ONLY click on the CURRENT barrier (the one you need to clear next)
     */
    handleGameClick(x, y) {
        // Get the current barrier
        const barrier = this.barriers[this.currentBarrierIndex];

        // Must have a barrier that's not yet cleared
        if (!barrier || barrier.isCleared) {
            return;
        }

        // Barrier must be close enough to interact with
        if (barrier.z > 0.9) {
            return;
        }

        const result = barrier.checkClick(x, y, this.zToScreen.bind(this));

        if (result.hit) {
            if (result.correct) {
                this.onCorrectKey(barrier, result);
            } else {
                this.onWrongKey(barrier, result);
            }
        }
    }

    /**
     * Handle keyboard input
     */
    handleKeyDown(e) {
        if (this.state !== GameState.PLAYING) return;

        const currentBarrier = this.barriers[this.currentBarrierIndex];
        if (!currentBarrier || currentBarrier.isCleared) return;

        // Map keyboard keys to notes
        const keyMap = {
            'KeyA': 'C', 'KeyW': 'C#', 'KeyS': 'D', 'KeyE': 'D#', 'KeyD': 'E',
            'KeyF': 'F', 'KeyT': 'F#', 'KeyG': 'G', 'KeyY': 'G#', 'KeyH': 'A',
            'KeyU': 'A#', 'KeyJ': 'B', 'KeyK': 'C', 'KeyO': 'C#', 'KeyL': 'D'
        };

        const noteName = keyMap[e.code];
        if (noteName) {
            e.preventDefault();
            const result = currentBarrier.checkKeyPress(noteName);
            if (result.correct) {
                this.onCorrectKey(currentBarrier, result);
            } else {
                this.onWrongKey(currentBarrier, result);
            }
        }

        // Space/Enter as quick confirm for target note
        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            const targetNote = currentBarrier.targetNote;
            if (targetNote) {
                this.onCorrectKey(currentBarrier, {
                    note: targetNote.fullName,
                    isBlackKey: targetNote.isBlackKey,
                    x: targetNote.x
                });
            }
        }
    }

    /**
     * Show level select
     */
    showLevelSelect() {
        this.state = GameState.LEVEL_SELECT;
    }

    /**
     * Start a level
     */
    startLevel(worldId, levelNum) {
        this.currentWorld = worldId;
        this.currentLevel = levelNum;
        this.levelData = getLevelData(worldId, levelNum);

        if (!this.levelData) {
            console.error(`Level ${worldId}-${levelNum} not found`);
            return;
        }

        // Reset game state
        this.score = 0;
        this.failures = 0;
        this.chordsCompleted = 0;
        this.chordsRequired = this.levelData.chordsRequired || 10;
        this.gameTime = 0;
        this.barriers = [];
        this.currentBarrierIndex = 0;

        // Reset combo
        this.combo = 0;
        this.maxCombo = 0;
        this.comboMessage = null;

        // Reset theme to default
        this.currentThemeIndex = 0;
        this.theme.accent = this.colorThemes[0].accent;

        // Set speed (base is slower, level speed multiplier adjusts)
        this.barrierSpeed = 0.15 * (this.levelData.speed || 1.0);

        // Create chord queue
        this.chordQueue = [...this.levelData.chords];
        this.currentChordIndex = 0;
        if (this.levelData.shuffle) {
            this.shuffleArray(this.chordQueue);
        }

        // Create player (positioned at very bottom of screen)
        this.player = new Player(BASE_WIDTH / 2, GROUND_Y - 10);

        // Spawn initial barriers
        this.spawnInitialBarriers();

        // Announce first chord
        this.announceNextChord();

        this.state = GameState.PLAYING;
    }

    /**
     * Spawn initial barriers at different Z depths
     */
    spawnInitialBarriers() {
        let z = 0.9; // Start near horizon

        for (let i = 0; i < 3 && this.currentChordIndex < this.chordQueue.length; i++) {
            const chord = this.chordQueue[this.currentChordIndex % this.chordQueue.length];

            // Each note in the chord becomes a barrier
            chord.notes.forEach((note, noteIndex) => {
                const barrier = new TeethBarrier(
                    note,
                    z + noteIndex * this.noteSpacing,
                    chord,
                    noteIndex === chord.notes.length - 1
                );
                this.barriers.push(barrier);
            });

            z += chord.notes.length * this.noteSpacing + this.chordSpacing;
            this.currentChordIndex++;
        }
    }

    /**
     * Spawn more barriers as needed
     */
    spawnBarriersIfNeeded() {
        if (this.chordsCompleted >= this.chordsRequired) return;

        // Find furthest barrier Z
        let furthestZ = 0;
        for (const b of this.barriers) {
            if (b.z > furthestZ) furthestZ = b.z;
        }

        // Spawn more if needed
        while (furthestZ < 1.5 && this.currentChordIndex < this.chordsRequired) {
            const chord = this.chordQueue[this.currentChordIndex % this.chordQueue.length];

            chord.notes.forEach((note, noteIndex) => {
                const z = furthestZ + this.chordSpacing + noteIndex * this.noteSpacing;
                const barrier = new TeethBarrier(
                    note,
                    z,
                    chord,
                    noteIndex === chord.notes.length - 1
                );
                this.barriers.push(barrier);
                if (noteIndex === chord.notes.length - 1) {
                    furthestZ = z;
                }
            });

            furthestZ += this.chordSpacing;
            this.currentChordIndex++;
        }
    }

    /**
     * Handle correct key press
     */
    onCorrectKey(barrier, result) {
        // Play note
        this.audioManager.playNote(result.note);

        // Open a hole in the barrier at the target key position
        barrier.shatter();

        // Mark as cleared (but barrier stays visible until it goes off screen)
        barrier.markCleared();

        // Move player to that X position (to go through the hole)
        if (result.x !== undefined) {
            this.player.moveTo(result.x);
        }

        // Jump if black key
        if (result.isBlackKey) {
            this.player.jump();
        }

        // Combo system
        this.combo++;
        if (this.combo > this.maxCombo) {
            this.maxCombo = this.combo;
        }

        // Score with combo multiplier
        const comboMultiplier = 1 + Math.floor(this.combo / 3) * 0.5;  // +50% every 3 hits
        const baseScore = 100;
        const earnedScore = Math.floor(baseScore * comboMultiplier);
        this.score += earnedScore;

        // Show encouragement message at combo thresholds
        this.checkComboMessage();

        // Speed up the NEXT barrier to close the gap
        const nextBarrier = this.barriers[this.currentBarrierIndex + 1];
        if (nextBarrier && !nextBarrier.isCleared) {
            nextBarrier.speedBoost = 3.0;  // Start next barrier moving faster
        }

        // DON'T advance index here - wait until barrier fully scrolls off screen
        // This prevents interacting with next barrier until this one is gone

        // Check if chord complete
        if (barrier.isLastInChord) {
            this.onChordComplete(barrier);
        }
    }

    /**
     * Check if we should show a combo message
     */
    checkComboMessage() {
        // Find the highest threshold we've reached
        let message = null;
        let color = this.theme.accent;

        for (const tier of this.encourageMessages) {
            if (this.combo >= tier.threshold) {
                const msgs = tier.messages;
                message = msgs[Math.floor(Math.random() * msgs.length)];
                // Color gets warmer as combo increases
                if (tier.threshold >= 12) color = '#ff6b9d';
                else if (tier.threshold >= 8) color = '#f39c12';
                else if (tier.threshold >= 5) color = '#9b59b6';
            }
        }

        if (message && this.combo === 3 || this.combo === 5 || this.combo === 8 || this.combo === 12 || this.combo % 5 === 0) {
            this.comboMessage = {
                text: message,
                timer: 0.8,
                color: color
            };
        }
    }

    /**
     * Handle wrong key press
     */
    onWrongKey(barrier, result) {
        this.audioManager.playError();
        barrier.flashWrong();
        this.combo = 0;  // Reset combo on wrong key
        this.onFailure('Wrong key!');
    }

    /**
     * Handle failure
     */
    onFailure(reason) {
        this.failures++;
        this.combo = 0;  // Reset combo on any failure
        this.player.stumble();

        if (this.failures >= this.maxFailures) {
            this.onGameOver();
        }
    }

    /**
     * Handle chord completion
     */
    onChordComplete(barrier) {
        this.chordsCompleted++;
        this.score += 250;
        this.audioManager.playSuccess();
        this.player.celebrate();

        // Cycle color theme every 2 chords
        if (this.chordsCompleted % 2 === 0) {
            this.currentThemeIndex = (this.currentThemeIndex + 1) % this.colorThemes.length;
            this.theme.accent = this.colorThemes[this.currentThemeIndex].accent;
        }

        // Gradually increase speed (cap at 2x)
        const speedIncrease = 0.02;
        this.barrierSpeed = Math.min(0.30, this.barrierSpeed + speedIncrease);

        // Announce next chord if there is one
        this.announceNextChord();
    }

    /**
     * Announce the next chord prominently
     */
    announceNextChord() {
        // Find the first barrier of the next chord (look for isLastInChord to skip current chord)
        let foundCurrentChordEnd = false;

        for (let i = this.currentBarrierIndex; i < this.barriers.length; i++) {
            const barrier = this.barriers[i];

            // Skip cleared barriers
            if (barrier.isCleared) {
                if (barrier.isLastInChord) {
                    foundCurrentChordEnd = true;
                }
                continue;
            }

            // If we haven't passed the current chord yet, check if this starts a new one
            // The first uncleared barrier after a chord ends (or the first overall) is what we want
            if (foundCurrentChordEnd || i === this.currentBarrierIndex) {
                this.chordAnnouncement = {
                    name: barrier.chordName,
                    notes: barrier.chordData.notes,
                    timer: this.announcementDuration
                };
                return;
            }

            // Mark when we pass the end of current chord
            if (barrier.isLastInChord) {
                foundCurrentChordEnd = true;
            }
        }
    }

    /**
     * Handle level complete
     */
    onLevelComplete() {
        this.state = GameState.LEVEL_COMPLETE;
        this.audioManager.playVictory();
    }

    /**
     * Handle game over
     */
    onGameOver() {
        this.state = GameState.GAME_OVER;
        this.audioManager.playGameOver();
    }

    /**
     * Go to next level
     */
    nextLevel() {
        const world = WORLDS.find(w => w.id === this.currentWorld);
        if (this.currentLevel < world.levels.length) {
            this.startLevel(this.currentWorld, this.currentLevel + 1);
        } else if (this.currentWorld < WORLDS.length) {
            this.startLevel(this.currentWorld + 1, 1);
        } else {
            this.state = GameState.MENU;
        }
    }

    /**
     * Restart current level
     */
    restartLevel() {
        this.startLevel(this.currentWorld, this.currentLevel);
    }

    /**
     * Shuffle array
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    /**
     * Clean up
     */
    destroy() {
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('keydown', this.handleKeyDown);

        if (this.canvas) {
            this.canvas.removeEventListener('click', this.handleClick);
            this.canvas.remove();
        }

        if (this.audioManager) {
            this.audioManager.destroy();
        }
    }
}

export { GameState, HORIZON_Y, GROUND_Y };
