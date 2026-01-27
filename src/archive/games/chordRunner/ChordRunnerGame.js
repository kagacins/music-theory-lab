/**
 * ChordRunner - A chord-learning endless runner game
 *
 * Core game class that manages the canvas, game loop, and coordinates
 * all game systems (entities, input, audio, UI).
 */

import { Runner } from './entities/Runner.js';
import { Gator } from './entities/Gator.js';
import { ChordBarrier } from './entities/ChordBarrier.js';
import { InputHandler } from './systems/InputHandler.js';
import { AudioManager } from './systems/AudioManager.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { GameUI } from './ui/GameUI.js';
import { getLevelData, WORLDS } from './levels/levelData.js';
import { SaveManager } from './systems/SaveManager.js';

// Game states
const GameState = {
    MENU: 'menu',
    LEVEL_SELECT: 'level_select',
    PLAYING: 'playing',
    PAUSED: 'paused',
    LEVEL_COMPLETE: 'level_complete',
    GAME_OVER: 'game_over'
};

// Base dimensions (will scale to fit container)
const BASE_WIDTH = 400;
const BASE_HEIGHT = 600;

export class ChordRunnerGame {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = null;
        this.canvas = null;
        this.ctx = null;

        // Game state
        this.state = GameState.MENU;
        this.currentWorld = 1;
        this.currentLevel = 1;
        this.score = 0;
        this.chordsCompleted = 0;
        this.chordsRequired = 10; // Per level

        // Settings
        this.settings = {
            assistMode: false,
            soundStyle: 'piano', // 'piano' or '8bit'
            speed: 1.0 // Hook for variable speed
        };

        // Timing
        this.lastTime = 0;
        this.deltaTime = 0;
        this.gameTime = 0;

        // Scale factor for responsive sizing
        this.scale = 1;
        this.width = BASE_WIDTH;
        this.height = BASE_HEIGHT;

        // Entities
        this.runner = null;
        this.gator = null;
        this.barriers = [];
        this.activeBarrier = null;

        // Systems
        this.inputHandler = null;
        this.audioManager = null;
        this.collisionSystem = null;
        this.ui = null;
        this.saveManager = null;

        // Current level data
        this.levelData = null;
        this.chordQueue = [];
        this.currentChordIndex = 0;

        // Visual theme
        this.theme = {
            background: '#1a1a2e',
            ground: '#16213e',
            accent: '#4ecca3',
            danger: '#ff6b6b'
        };

        // Bind methods
        this.gameLoop = this.gameLoop.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    /**
     * Initialize the game
     */
    async init() {
        // Get or create container
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.error(`ChordRunner: Container #${this.containerId} not found`);
            return false;
        }

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'chord-runner-canvas';
        this.canvas.style.display = 'block';
        this.canvas.style.touchAction = 'none'; // Prevent touch scrolling
        this.container.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');

        // Initialize systems
        this.saveManager = new SaveManager();
        this.audioManager = new AudioManager(this.settings);
        this.inputHandler = new InputHandler(this.canvas, this);
        this.collisionSystem = new CollisionSystem(this);
        this.ui = new GameUI(this.container, this);

        // Set up responsive sizing
        this.handleResize();
        window.addEventListener('resize', this.handleResize);

        // Initialize audio (user interaction required for Tone.js)
        await this.audioManager.init();

        // Show main menu
        this.showMenu();

        // Start game loop
        requestAnimationFrame(this.gameLoop);

        console.log('ChordRunner initialized');
        return true;
    }

    /**
     * Handle window/container resize
     */
    handleResize() {
        const containerRect = this.container.getBoundingClientRect();
        const containerWidth = containerRect.width || BASE_WIDTH;
        const containerHeight = containerRect.height || BASE_HEIGHT;

        // Calculate scale to fit while maintaining aspect ratio
        const scaleX = containerWidth / BASE_WIDTH;
        const scaleY = containerHeight / BASE_HEIGHT;
        this.scale = Math.min(scaleX, scaleY);

        // Set canvas size
        this.width = BASE_WIDTH * this.scale;
        this.height = BASE_HEIGHT * this.scale;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Update input handler with new scale
        if (this.inputHandler) {
            this.inputHandler.setScale(this.scale);
        }
    }

    /**
     * Main game loop
     */
    gameLoop(timestamp) {
        // Calculate delta time
        this.deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Cap delta time to prevent spiral of death
        if (this.deltaTime > 0.1) this.deltaTime = 0.1;

        // Update and render based on state
        switch (this.state) {
            case GameState.PLAYING:
                this.gameTime += this.deltaTime;
                this.update(this.deltaTime);
                this.render();
                break;
            case GameState.PAUSED:
                this.render();
                break;
            case GameState.LEVEL_COMPLETE:
            case GameState.GAME_OVER:
            case GameState.MENU:
            case GameState.LEVEL_SELECT:
                this.render();
                break;
        }

        requestAnimationFrame(this.gameLoop);
    }

    /**
     * Update game logic
     */
    update(dt) {
        const adjustedDt = dt * this.settings.speed;

        // Update barriers first to know where they are
        for (const barrier of this.barriers) {
            barrier.update(adjustedDt);
        }

        // Find the current barrier (the one closest to the runner that hasn't fully passed)
        let newCurrentBarrier = null;
        let runnerBlocked = false;

        if (this.runner) {
            const runnerY = this.runner.getY(); // ~450

            for (const barrier of this.barriers) {
                const bassNoteY = barrier.getClosestBarrierY();
                if (bassNoteY === null) continue;

                // Barrier blocks until bass note Y is GREATER than runner Y
                // (bass note has scrolled past/behind the runner)
                if (bassNoteY <= runnerY) {
                    newCurrentBarrier = barrier;
                    runnerBlocked = true;
                    break;
                }
            }

            // Detect when a barrier passes - the current barrier changed to a different one
            // (or became null, meaning no barrier is blocking anymore)
            if (this.currentBarrier !== null && this.currentBarrier !== newCurrentBarrier) {
                // The barrier we were passing through has now passed!
                // Move runner to the next queued position
                this.runner.onBarrierPassed();
            }
        }

        // Store current barrier for next frame comparison
        this.currentBarrier = newCurrentBarrier;

        // Update runner - pass blocked state for visual feedback
        if (this.runner) {
            this.runner.setBlocked(runnerBlocked);
            this.runner.update(adjustedDt);
        }

        // Update gator - gains ground faster when runner is blocked!
        if (this.gator) {
            this.gator.update(adjustedDt, this.runner, runnerBlocked);

            // Check if gator catches runner
            if (this.gator.hasCaughtRunner(this.runner)) {
                this.onGatorCatch();
            }
        }

        // Remove off-screen barriers
        this.barriers = this.barriers.filter(b => !b.isOffScreen());

        // Spawn new barriers to keep the play area populated
        // Check if we need to spawn more barriers (spawn when we have fewer than 3 active)
        if (this.barriers.length < 3 && this.chordsCompleted < this.chordsRequired) {
            this.spawnNextBarrier();
        }

        // Update active barrier to be the one the player is currently facing
        this.updateActiveBarrier();

        // Check for level completion
        if (this.chordsCompleted >= this.chordsRequired) {
            this.onLevelComplete();
        }
    }

    /**
     * Render the game
     */
    render() {
        const ctx = this.ctx;

        // Clear canvas
        ctx.fillStyle = this.theme.background;
        ctx.fillRect(0, 0, this.width, this.height);

        // Apply scale transform
        ctx.save();
        ctx.scale(this.scale, this.scale);

        // Draw based on state
        switch (this.state) {
            case GameState.PLAYING:
            case GameState.PAUSED:
                this.renderGame(ctx);
                break;
            case GameState.MENU:
                this.renderMenu(ctx);
                break;
            case GameState.LEVEL_SELECT:
                this.renderLevelSelect(ctx);
                break;
            case GameState.LEVEL_COMPLETE:
                this.renderGame(ctx);
                break;
            case GameState.GAME_OVER:
                this.renderGame(ctx);
                break;
        }

        ctx.restore();
    }

    /**
     * Render the main game
     */
    renderGame(ctx) {
        // Draw ground/lanes
        this.renderBackground(ctx);

        // Draw barriers (keyboard strips)
        for (const barrier of this.barriers) {
            barrier.render(ctx, this.settings.assistMode);
        }

        // Draw runner
        if (this.runner) {
            this.runner.render(ctx);
        }

        // Draw gator
        if (this.gator) {
            this.gator.render(ctx);
        }

        // Draw distance indicator between gator and runner
        this.renderDistanceIndicator(ctx);
    }

    /**
     * Render background with theme
     */
    renderBackground(ctx) {
        // Scrolling ground effect
        const scrollOffset = (this.gameTime * 100 * this.settings.speed) % 50;

        ctx.strokeStyle = this.theme.ground;
        ctx.lineWidth = 1;

        // Horizontal lines for depth
        for (let y = 0; y < BASE_HEIGHT; y += 50) {
            const adjustedY = y + scrollOffset;
            ctx.globalAlpha = 0.3 + (adjustedY / BASE_HEIGHT) * 0.4;
            ctx.beginPath();
            ctx.moveTo(0, adjustedY);
            ctx.lineTo(BASE_WIDTH, adjustedY);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    /**
     * Render distance indicator (gator proximity)
     */
    renderDistanceIndicator(ctx) {
        if (!this.gator || !this.runner) return;

        const distance = this.gator.getDistanceToRunner(this.runner);
        const maxDistance = 200;
        const dangerLevel = 1 - Math.min(distance / maxDistance, 1);

        // Draw danger border when gator is close
        if (dangerLevel > 0.3) {
            ctx.strokeStyle = this.theme.danger;
            ctx.lineWidth = 4 * dangerLevel;
            ctx.globalAlpha = dangerLevel * 0.5;
            ctx.strokeRect(2, 2, BASE_WIDTH - 4, BASE_HEIGHT - 4);
            ctx.globalAlpha = 1;
        }
    }

    /**
     * Render main menu
     */
    renderMenu(ctx) {
        // Title
        ctx.fillStyle = this.theme.accent;
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CHORD', BASE_WIDTH / 2, 150);
        ctx.fillText('RUNNER', BASE_WIDTH / 2, 195);

        // Gator decoration
        ctx.font = '64px serif';
        ctx.fillText('🐊', BASE_WIDTH / 2, 300);

        // Instructions rendered by UI overlay
    }

    /**
     * Render level select screen
     */
    renderLevelSelect(ctx) {
        ctx.fillStyle = this.theme.accent;
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SELECT LEVEL', BASE_WIDTH / 2, 60);

        // Level grid rendered by UI overlay
    }

    /**
     * Show main menu
     */
    showMenu() {
        this.state = GameState.MENU;
        this.ui.showMenu();
    }

    /**
     * Show level select
     */
    showLevelSelect() {
        this.state = GameState.LEVEL_SELECT;
        const progress = this.saveManager.getProgress();
        this.ui.showLevelSelect(WORLDS, progress);
    }

    /**
     * Start a specific level
     */
    startLevel(world, level) {
        this.currentWorld = world;
        this.currentLevel = level;
        this.levelData = getLevelData(world, level);

        if (!this.levelData) {
            console.error(`Level ${world}-${level} not found`);
            return;
        }

        // Apply level theme
        if (this.levelData.theme) {
            this.theme = { ...this.theme, ...this.levelData.theme };
        }

        // Reset game state
        this.score = 0;
        this.chordsCompleted = 0;
        this.chordsRequired = this.levelData.chordsRequired || 10;
        this.gameTime = 0;
        this.barriers = [];
        this.activeBarrier = null;
        this.currentBarrier = null; // Track which barrier runner is currently passing through

        // Create chord queue from level data
        this.chordQueue = [...this.levelData.chords];
        this.currentChordIndex = 0;

        // Shuffle if level allows
        if (this.levelData.shuffle) {
            this.shuffleArray(this.chordQueue);
        }

        // Pre-spawn all barriers at fixed positions
        // Gap between chords (from last note of one chord to first note of next)
        this.chordSpacing = 120; // Gap between chords (visible separation)
        this.nextChordStartY = -50; // Where the first chord spawns

        // Create entities
        this.runner = new Runner(BASE_WIDTH / 2, BASE_HEIGHT - 150);
        this.gator = new Gator(BASE_WIDTH / 2, BASE_HEIGHT + 100);

        // Update UI
        this.ui.showGameUI(this.levelData);
        this.ui.updateScore(this.score);
        this.ui.updateLives(this.runner.getLimbState());
        this.ui.updateProgress(this.chordsCompleted, this.chordsRequired);

        // Start playing
        this.state = GameState.PLAYING;

        // Spawn first barrier
        this.spawnNextBarrier();

        console.log(`Starting level ${world}-${level}: ${this.levelData.name}`);
    }

    /**
     * Update which barrier is the "active" one (the one the player is currently facing)
     */
    updateActiveBarrier() {
        // Find the barrier with an incomplete note that's closest to the runner
        let closestBarrier = null;
        let closestY = -Infinity;

        for (const barrier of this.barriers) {
            if (!barrier.isComplete()) {
                const nextY = barrier.getNextBarrierY();
                if (nextY !== null && nextY > closestY) {
                    closestBarrier = barrier;
                    closestY = nextY;
                }
            }
        }

        this.activeBarrier = closestBarrier;
    }

    /**
     * Spawn the next chord barrier at a fixed position
     */
    spawnNextBarrier() {
        if (this.chordsCompleted >= this.chordsRequired) return;

        // Get next chord from queue (loop if needed)
        const chordData = this.chordQueue[this.currentChordIndex % this.chordQueue.length];
        this.currentChordIndex++;

        // Create barrier at the predetermined start position
        const barrier = new ChordBarrier(
            chordData,
            this.levelData.octaveRange || 1,
            this.levelData.speed || 1.0
        );

        // Set the barrier's starting Y position
        barrier.baseY = this.nextChordStartY;

        // Calculate where the next chord should start
        // The stagger distance is 100px between notes in a chord
        // After all notes of this chord, add a gap before the next chord
        const notesInChord = barrier.notes.length;
        const chordTotalHeight = (notesInChord - 1) * barrier.staggerDistance;

        // Next chord starts after: current chord height + gap between chords
        this.nextChordStartY -= (chordTotalHeight + this.chordSpacing);

        this.barriers.push(barrier);
        this.activeBarrier = barrier;

        // Update UI with chord name
        this.ui.announceChord(chordData);
    }

    /**
     * Handle key/note tap on a barrier
     */
    onNoteTap(x, y) {
        if (this.state !== GameState.PLAYING) return;

        // Convert screen coords to game coords
        const gameX = x / this.scale;
        const gameY = y / this.scale;

        // Check which barrier/note was tapped
        for (const barrier of this.barriers) {
            const result = barrier.checkNoteTap(gameX, gameY);

            if (result.hit) {
                if (result.correct) {
                    this.onCorrectNote(barrier, result);
                } else {
                    this.onWrongNote(barrier, result);
                }
                break;
            }
        }
    }

    /**
     * Handle correct note tap
     */
    onCorrectNote(barrier, result) {
        // Play note sound
        this.audioManager.playNote(result.note, this.settings.soundStyle);

        // Visual feedback
        barrier.shatterNote(result.noteIndex);

        // Score
        this.score += 100;
        this.ui.updateScore(this.score);

        // ALWAYS queue the position - the runner will only move when the barrier passes
        // This ensures the runner waits until the barrier has physically scrolled past
        const brokenNote = barrier.notes[result.noteIndex];
        if (brokenNote && brokenNote.x) {
            this.runner.queueTargetX(brokenNote.x);
        }

        // Visual boost effect (but don't trigger run-through movement yet)
        this.runner.boost();

        // Check if chord is complete
        if (barrier.isComplete()) {
            this.onChordComplete(barrier);
        }

        // If it's a black key, trigger launch pad (jump bonus)
        if (result.isBlackKey) {
            this.runner.launchJump();
        }
    }

    /**
     * Handle wrong note tap
     */
    onWrongNote(barrier, result) {
        // Play error sound
        this.audioManager.playError();

        // Visual feedback
        barrier.flashWrong(result.noteIndex);

        // Runner stumbles
        this.runner.stumble();

        // Gator gains ground
        this.gator.gainGround(30);

        // Score penalty
        this.score = Math.max(0, this.score - 25);
        this.ui.updateScore(this.score);
    }

    /**
     * Handle chord completion
     */
    onChordComplete(barrier) {
        // Play full chord
        this.audioManager.playChord(barrier.getChordNotes(), this.settings.soundStyle);

        // Play success sound
        this.audioManager.playSuccess();

        // Bonus points
        this.score += 250;
        this.ui.updateScore(this.score);

        // Progress
        this.chordsCompleted++;
        this.ui.updateProgress(this.chordsCompleted, this.chordsRequired);

        // Push gator back
        this.gator.fallBack(50);

        // Runner celebration
        this.runner.celebrate();
    }

    /**
     * Handle gator catching the runner
     */
    onGatorCatch() {
        // Chomp animation
        this.gator.chomp();
        this.runner.loseLimb();

        // Update UI
        this.ui.updateLives(this.runner.getLimbState());

        // Play chomp sound
        this.audioManager.playChomp();

        // Check if runner is out of limbs
        if (this.runner.isDefeated()) {
            this.onGameOver();
        } else {
            // Reset positions
            this.gator.resetDistance();
        }
    }

    /**
     * Handle level completion
     */
    onLevelComplete() {
        this.state = GameState.LEVEL_COMPLETE;

        // Save progress
        this.saveManager.completeLevel(this.currentWorld, this.currentLevel, this.score);

        // Play victory sound
        this.audioManager.playVictory();

        // Show UI
        const stars = this.calculateStars();
        this.ui.showLevelComplete(this.score, stars, this.runner.getLimbState());
    }

    /**
     * Handle game over
     */
    onGameOver() {
        this.state = GameState.GAME_OVER;

        // Play game over sound
        this.audioManager.playGameOver();

        // Show UI
        this.ui.showGameOver(this.score, this.chordsCompleted);
    }

    /**
     * Calculate star rating based on performance
     */
    calculateStars() {
        const limbsRemaining = this.runner.getLimbCount();
        // 3 stars: all limbs, 2 stars: lost 1-2 limbs, 1 star: barely survived
        if (limbsRemaining >= 3) return 3;
        if (limbsRemaining >= 1) return 2;
        return 1;
    }

    /**
     * Pause the game
     */
    pause() {
        if (this.state === GameState.PLAYING) {
            this.state = GameState.PAUSED;
            this.ui.showPauseMenu();
        }
    }

    /**
     * Resume the game
     */
    resume() {
        if (this.state === GameState.PAUSED) {
            this.state = GameState.PLAYING;
            this.ui.hidePauseMenu();
        }
    }

    /**
     * Restart current level
     */
    restart() {
        this.startLevel(this.currentWorld, this.currentLevel);
    }

    /**
     * Go to next level
     */
    nextLevel() {
        const nextLevelData = this.getNextLevel();
        if (nextLevelData) {
            this.startLevel(nextLevelData.world, nextLevelData.level);
        } else {
            // All levels complete!
            this.showLevelSelect();
        }
    }

    /**
     * Get next level info
     */
    getNextLevel() {
        const worldData = WORLDS.find(w => w.id === this.currentWorld);
        if (!worldData) return null;

        if (this.currentLevel < worldData.levels.length) {
            return { world: this.currentWorld, level: this.currentLevel + 1 };
        }

        // Try next world
        const nextWorld = WORLDS.find(w => w.id === this.currentWorld + 1);
        if (nextWorld) {
            return { world: nextWorld.id, level: 1 };
        }

        return null;
    }

    /**
     * Update settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.audioManager.updateSettings(this.settings);
    }

    /**
     * Shuffle array in place
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        window.removeEventListener('resize', this.handleResize);
        this.inputHandler.destroy();
        this.audioManager.destroy();
        this.ui.destroy();

        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

// Export game state enum for external use
export { GameState };
