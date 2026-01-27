/**
 * GameUI - DOM-based UI overlay for Chord Runner
 *
 * Renders score, lives (limb indicator), chord announcer,
 * pause button, menus, and level complete screens.
 *
 * Uses retro arcade styling to match the game aesthetic.
 */

export class GameUI {
    constructor(container, game) {
        this.container = container;
        this.game = game;

        // UI elements
        this.overlay = null;
        this.scoreDisplay = null;
        this.livesDisplay = null;
        this.chordAnnouncer = null;
        this.progressBar = null;
        this.pauseButton = null;

        // Menu elements
        this.menuOverlay = null;
        this.levelSelectOverlay = null;
        this.pauseOverlay = null;
        this.levelCompleteOverlay = null;
        this.gameOverOverlay = null;

        // Create UI
        this.createUI();
    }

    /**
     * Create all UI elements
     */
    createUI() {
        // Main game UI overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'chord-runner-ui';
        this.overlay.innerHTML = `
            <style>
                .chord-runner-ui {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    pointer-events: none;
                    font-family: 'Press Start 2P', 'Courier New', monospace;
                    color: #ffffff;
                    text-shadow: 2px 2px 0 #000000;
                }

                .chord-runner-ui * {
                    box-sizing: border-box;
                }

                .cr-hud {
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    right: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    pointer-events: auto;
                }

                .cr-score {
                    font-size: 14px;
                    color: #4ecca3;
                }

                .cr-lives {
                    display: flex;
                    gap: 5px;
                    align-items: center;
                }

                .cr-limb {
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    transition: all 0.3s ease;
                }

                .cr-limb.lost {
                    opacity: 0.3;
                    filter: grayscale(1);
                }

                .cr-pause-btn {
                    background: rgba(0, 0, 0, 0.5);
                    border: 2px solid #4ecca3;
                    color: #4ecca3;
                    padding: 8px 12px;
                    font-size: 10px;
                    cursor: pointer;
                    font-family: inherit;
                    transition: all 0.2s ease;
                }

                .cr-pause-btn:hover {
                    background: #4ecca3;
                    color: #1a1a2e;
                }

                .cr-announcer {
                    position: absolute;
                    top: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    text-align: center;
                    pointer-events: none;
                }

                .cr-chord-name {
                    font-size: 24px;
                    color: #ffd700;
                    animation: cr-pulse 0.5s ease-out;
                    text-transform: uppercase;
                }

                .cr-chord-notes {
                    font-size: 12px;
                    color: #ffffff;
                    margin-top: 5px;
                    opacity: 0.8;
                }

                @keyframes cr-pulse {
                    0% { transform: scale(1.5); opacity: 0; }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); opacity: 1; }
                }

                .cr-progress {
                    position: absolute;
                    bottom: 10px;
                    left: 10px;
                    right: 10px;
                }

                .cr-progress-bar {
                    height: 10px;
                    background: rgba(0, 0, 0, 0.5);
                    border: 2px solid #4ecca3;
                    border-radius: 5px;
                    overflow: hidden;
                }

                .cr-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #4ecca3, #45b393);
                    transition: width 0.3s ease;
                }

                .cr-progress-text {
                    font-size: 10px;
                    text-align: center;
                    margin-top: 5px;
                }

                /* Menu Overlays */
                .cr-menu-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(26, 26, 46, 0.95);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    pointer-events: auto;
                    padding: 20px;
                }

                .cr-menu-title {
                    font-size: 28px;
                    color: #4ecca3;
                    margin-bottom: 30px;
                    text-align: center;
                }

                .cr-menu-subtitle {
                    font-size: 14px;
                    color: #ffd700;
                    margin-bottom: 20px;
                }

                .cr-menu-btn {
                    background: linear-gradient(180deg, #4ecca3, #3dbb94);
                    border: none;
                    color: #1a1a2e;
                    padding: 15px 30px;
                    font-size: 14px;
                    font-family: inherit;
                    cursor: pointer;
                    margin: 10px;
                    transition: all 0.2s ease;
                    text-shadow: none;
                }

                .cr-menu-btn:hover {
                    transform: scale(1.05);
                    box-shadow: 0 0 20px rgba(78, 204, 163, 0.5);
                }

                .cr-menu-btn.secondary {
                    background: transparent;
                    border: 2px solid #4ecca3;
                    color: #4ecca3;
                }

                .cr-menu-btn.danger {
                    background: linear-gradient(180deg, #ff6b6b, #ee5a5a);
                }

                /* Level Select */
                .cr-level-grid {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 10px;
                    max-width: 350px;
                    margin: 20px 0;
                }

                .cr-level-btn {
                    width: 50px;
                    height: 50px;
                    background: rgba(0, 0, 0, 0.5);
                    border: 2px solid #4ecca3;
                    color: #4ecca3;
                    font-size: 14px;
                    font-family: inherit;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }

                .cr-level-btn:hover:not(.locked) {
                    background: #4ecca3;
                    color: #1a1a2e;
                }

                .cr-level-btn.locked {
                    opacity: 0.3;
                    cursor: not-allowed;
                }

                .cr-level-btn.completed {
                    background: #4ecca3;
                    color: #1a1a2e;
                }

                .cr-stars {
                    color: #ffd700;
                    font-size: 12px;
                    margin-top: 5px;
                }

                /* Level Complete */
                .cr-complete-stats {
                    text-align: center;
                    margin: 20px 0;
                }

                .cr-stat {
                    font-size: 12px;
                    margin: 10px 0;
                }

                .cr-stat-value {
                    color: #4ecca3;
                    font-size: 18px;
                }

                .cr-big-stars {
                    font-size: 36px;
                    margin: 20px 0;
                }

                /* Runner status (for level complete) */
                .cr-runner-status {
                    font-size: 10px;
                    color: #ff6b6b;
                    margin-top: 10px;
                }

                /* Settings toggle */
                .cr-settings {
                    margin-top: 20px;
                    text-align: center;
                }

                .cr-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    font-size: 10px;
                    margin: 10px 0;
                }

                .cr-toggle-switch {
                    width: 40px;
                    height: 20px;
                    background: rgba(0, 0, 0, 0.5);
                    border: 2px solid #4ecca3;
                    border-radius: 10px;
                    cursor: pointer;
                    position: relative;
                }

                .cr-toggle-switch::after {
                    content: '';
                    position: absolute;
                    width: 14px;
                    height: 14px;
                    background: #4ecca3;
                    border-radius: 50%;
                    top: 1px;
                    left: 1px;
                    transition: left 0.2s ease;
                }

                .cr-toggle-switch.active::after {
                    left: 21px;
                }

                .hidden {
                    display: none !important;
                }
            </style>

            <!-- HUD -->
            <div class="cr-hud hidden" id="cr-hud">
                <div class="cr-score" id="cr-score">SCORE: 0</div>
                <div class="cr-lives" id="cr-lives">
                    <span class="cr-limb" title="Left Arm">🦾</span>
                    <span class="cr-limb" title="Right Arm">💪</span>
                    <span class="cr-limb" title="Left Leg">🦵</span>
                    <span class="cr-limb" title="Right Leg">🦶</span>
                </div>
                <button class="cr-pause-btn" id="cr-pause-btn">❚❚</button>
            </div>

            <!-- Chord Announcer -->
            <div class="cr-announcer hidden" id="cr-announcer">
                <div class="cr-chord-name" id="cr-chord-name">C MAJOR</div>
                <div class="cr-chord-notes" id="cr-chord-notes">C - E - G</div>
            </div>

            <!-- Progress Bar -->
            <div class="cr-progress hidden" id="cr-progress">
                <div class="cr-progress-bar">
                    <div class="cr-progress-fill" id="cr-progress-fill" style="width: 0%"></div>
                </div>
                <div class="cr-progress-text" id="cr-progress-text">0 / 10 CHORDS</div>
            </div>
        `;

        this.container.appendChild(this.overlay);

        // Cache element references
        this.scoreDisplay = this.overlay.querySelector('#cr-score');
        this.livesDisplay = this.overlay.querySelector('#cr-lives');
        this.chordAnnouncer = this.overlay.querySelector('#cr-announcer');
        this.progressBar = this.overlay.querySelector('#cr-progress-fill');
        this.pauseButton = this.overlay.querySelector('#cr-pause-btn');

        // Attach pause button handler
        this.pauseButton.addEventListener('click', () => this.game.pause());
    }

    /**
     * Show the main menu
     */
    showMenu() {
        this.hideAllOverlays();

        if (!this.menuOverlay) {
            this.menuOverlay = document.createElement('div');
            this.menuOverlay.className = 'cr-menu-overlay';
            this.menuOverlay.id = 'cr-menu';
            this.overlay.appendChild(this.menuOverlay);
        }

        this.menuOverlay.innerHTML = `
            <div class="cr-menu-title">🐊 CHORD<br>RUNNER</div>
            <div class="cr-menu-subtitle">Learn chords or get chomped!</div>
            <button class="cr-menu-btn" id="cr-start-btn">START GAME</button>
            <button class="cr-menu-btn secondary" id="cr-levels-btn">SELECT LEVEL</button>

            <div class="cr-settings">
                <div class="cr-toggle">
                    <span>ASSIST MODE</span>
                    <div class="cr-toggle-switch ${this.game.settings.assistMode ? 'active' : ''}" id="cr-assist-toggle"></div>
                </div>
                <div class="cr-toggle">
                    <span>SOUND</span>
                    <div class="cr-toggle-switch ${this.game.settings.soundStyle === '8bit' ? 'active' : ''}" id="cr-sound-toggle"></div>
                    <span>${this.game.settings.soundStyle === '8bit' ? '8-BIT' : 'PIANO'}</span>
                </div>
            </div>
        `;

        this.menuOverlay.classList.remove('hidden');

        // Attach handlers
        this.menuOverlay.querySelector('#cr-start-btn').addEventListener('click', () => {
            this.game.startLevel(1, 1);
        });

        this.menuOverlay.querySelector('#cr-levels-btn').addEventListener('click', () => {
            this.game.showLevelSelect();
        });

        this.menuOverlay.querySelector('#cr-assist-toggle').addEventListener('click', (e) => {
            e.target.classList.toggle('active');
            this.game.updateSettings({ assistMode: e.target.classList.contains('active') });
        });

        this.menuOverlay.querySelector('#cr-sound-toggle').addEventListener('click', (e) => {
            e.target.classList.toggle('active');
            const newStyle = e.target.classList.contains('active') ? '8bit' : 'piano';
            this.game.updateSettings({ soundStyle: newStyle });
            e.target.nextElementSibling.textContent = newStyle === '8bit' ? '8-BIT' : 'PIANO';
        });
    }

    /**
     * Show level select screen
     */
    showLevelSelect(worlds, progress) {
        this.hideAllOverlays();

        if (!this.levelSelectOverlay) {
            this.levelSelectOverlay = document.createElement('div');
            this.levelSelectOverlay.className = 'cr-menu-overlay';
            this.levelSelectOverlay.id = 'cr-level-select';
            this.overlay.appendChild(this.levelSelectOverlay);
        }

        let worldsHTML = '';
        for (const world of worlds) {
            worldsHTML += `
                <div class="cr-menu-subtitle">${world.name}</div>
                <div class="cr-level-grid">
            `;

            for (let i = 0; i < world.levels.length; i++) {
                const levelNum = i + 1;
                const levelKey = `${world.id}-${levelNum}`;
                const isCompleted = progress.completed.includes(levelKey);
                const isUnlocked = this.isLevelUnlocked(world.id, levelNum, progress);
                const stars = progress.stars[levelKey] || 0;

                worldsHTML += `
                    <button class="cr-level-btn ${isCompleted ? 'completed' : ''} ${!isUnlocked ? 'locked' : ''}"
                            data-world="${world.id}" data-level="${levelNum}"
                            ${!isUnlocked ? 'disabled' : ''}>
                        ${levelNum}
                        ${isCompleted ? `<br><span class="cr-stars">${'★'.repeat(stars)}</span>` : ''}
                    </button>
                `;
            }

            worldsHTML += '</div>';
        }

        this.levelSelectOverlay.innerHTML = `
            <div class="cr-menu-title">SELECT LEVEL</div>
            ${worldsHTML}
            <button class="cr-menu-btn secondary" id="cr-back-btn">BACK</button>
        `;

        this.levelSelectOverlay.classList.remove('hidden');

        // Attach handlers
        this.levelSelectOverlay.querySelectorAll('.cr-level-btn:not(.locked)').forEach(btn => {
            btn.addEventListener('click', () => {
                const world = parseInt(btn.dataset.world);
                const level = parseInt(btn.dataset.level);
                this.game.startLevel(world, level);
            });
        });

        this.levelSelectOverlay.querySelector('#cr-back-btn').addEventListener('click', () => {
            this.game.showMenu();
        });
    }

    /**
     * Check if a level is unlocked
     */
    isLevelUnlocked(worldId, levelNum, progress) {
        // First level of first world is always unlocked
        if (worldId === 1 && levelNum === 1) return true;

        // Previous level in same world must be completed
        if (levelNum > 1) {
            return progress.completed.includes(`${worldId}-${levelNum - 1}`);
        }

        // First level of new world: last level of previous world must be completed
        // For simplicity, assume 5 levels per world
        return progress.completed.includes(`${worldId - 1}-5`);
    }

    /**
     * Show game UI (HUD, announcer, progress)
     */
    showGameUI(levelData) {
        this.hideAllOverlays();

        this.overlay.querySelector('#cr-hud').classList.remove('hidden');
        this.overlay.querySelector('#cr-announcer').classList.remove('hidden');
        this.overlay.querySelector('#cr-progress').classList.remove('hidden');
    }

    /**
     * Hide game UI
     */
    hideGameUI() {
        this.overlay.querySelector('#cr-hud').classList.add('hidden');
        this.overlay.querySelector('#cr-announcer').classList.add('hidden');
        this.overlay.querySelector('#cr-progress').classList.add('hidden');
    }

    /**
     * Update score display
     */
    updateScore(score) {
        this.scoreDisplay.textContent = `SCORE: ${score}`;
    }

    /**
     * Update lives display based on limb state
     */
    updateLives(limbState) {
        const limbs = this.livesDisplay.querySelectorAll('.cr-limb');

        limbs[0].classList.toggle('lost', !limbState.hasLeftArm);
        limbs[1].classList.toggle('lost', !limbState.hasRightArm);
        limbs[2].classList.toggle('lost', !limbState.hasLeftLeg);
        limbs[3].classList.toggle('lost', !limbState.hasRightLeg);
    }

    /**
     * Update progress bar
     */
    updateProgress(completed, total) {
        const percent = (completed / total) * 100;
        this.progressBar.style.width = `${percent}%`;
        this.overlay.querySelector('#cr-progress-text').textContent = `${completed} / ${total} CHORDS`;
    }

    /**
     * Announce a new chord
     */
    announceChord(chordData) {
        const nameEl = this.overlay.querySelector('#cr-chord-name');
        const notesEl = this.overlay.querySelector('#cr-chord-notes');

        nameEl.textContent = `${chordData.root} ${chordData.type}`.toUpperCase();

        // Show notes only in assist mode
        if (this.game.settings.assistMode && chordData.notes) {
            const noteNames = chordData.notes.map(n => n.replace(/\d+$/, ''));
            notesEl.textContent = noteNames.join(' - ');
            notesEl.classList.remove('hidden');
        } else {
            notesEl.classList.add('hidden');
        }

        // Trigger animation
        nameEl.style.animation = 'none';
        nameEl.offsetHeight; // Trigger reflow
        nameEl.style.animation = 'cr-pulse 0.5s ease-out';
    }

    /**
     * Show pause menu
     */
    showPauseMenu() {
        if (!this.pauseOverlay) {
            this.pauseOverlay = document.createElement('div');
            this.pauseOverlay.className = 'cr-menu-overlay';
            this.pauseOverlay.id = 'cr-pause';
            this.overlay.appendChild(this.pauseOverlay);
        }

        this.pauseOverlay.innerHTML = `
            <div class="cr-menu-title">PAUSED</div>
            <button class="cr-menu-btn" id="cr-resume-btn">RESUME</button>
            <button class="cr-menu-btn secondary" id="cr-restart-btn">RESTART</button>
            <button class="cr-menu-btn secondary" id="cr-quit-btn">QUIT</button>
        `;

        this.pauseOverlay.classList.remove('hidden');

        this.pauseOverlay.querySelector('#cr-resume-btn').addEventListener('click', () => {
            this.game.resume();
        });

        this.pauseOverlay.querySelector('#cr-restart-btn').addEventListener('click', () => {
            this.hidePauseMenu();
            this.game.restart();
        });

        this.pauseOverlay.querySelector('#cr-quit-btn').addEventListener('click', () => {
            this.hidePauseMenu();
            this.game.showMenu();
        });
    }

    /**
     * Hide pause menu
     */
    hidePauseMenu() {
        if (this.pauseOverlay) {
            this.pauseOverlay.classList.add('hidden');
        }
    }

    /**
     * Show level complete screen
     */
    showLevelComplete(score, stars, limbState) {
        this.hideGameUI();

        if (!this.levelCompleteOverlay) {
            this.levelCompleteOverlay = document.createElement('div');
            this.levelCompleteOverlay.className = 'cr-menu-overlay';
            this.levelCompleteOverlay.id = 'cr-level-complete';
            this.overlay.appendChild(this.levelCompleteOverlay);
        }

        const starDisplay = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        const limbsLost = 4 - limbState.limbsRemaining;
        const runnerMessage = limbsLost === 0 ? 'PERFECT RUN!' :
                             limbsLost === 1 ? 'Just a scratch!' :
                             limbsLost === 2 ? 'A bit chewed up...' :
                             'Barely escaped!';

        this.levelCompleteOverlay.innerHTML = `
            <div class="cr-menu-title">LEVEL COMPLETE!</div>
            <div class="cr-big-stars">${starDisplay}</div>
            <div class="cr-complete-stats">
                <div class="cr-stat">SCORE<br><span class="cr-stat-value">${score}</span></div>
                <div class="cr-runner-status">${runnerMessage}</div>
            </div>
            <button class="cr-menu-btn" id="cr-next-btn">NEXT LEVEL</button>
            <button class="cr-menu-btn secondary" id="cr-replay-btn">REPLAY</button>
            <button class="cr-menu-btn secondary" id="cr-menu-btn">MENU</button>
        `;

        this.levelCompleteOverlay.classList.remove('hidden');

        this.levelCompleteOverlay.querySelector('#cr-next-btn').addEventListener('click', () => {
            this.levelCompleteOverlay.classList.add('hidden');
            this.game.nextLevel();
        });

        this.levelCompleteOverlay.querySelector('#cr-replay-btn').addEventListener('click', () => {
            this.levelCompleteOverlay.classList.add('hidden');
            this.game.restart();
        });

        this.levelCompleteOverlay.querySelector('#cr-menu-btn').addEventListener('click', () => {
            this.levelCompleteOverlay.classList.add('hidden');
            this.game.showMenu();
        });
    }

    /**
     * Show game over screen
     */
    showGameOver(score, chordsCompleted) {
        this.hideGameUI();

        if (!this.gameOverOverlay) {
            this.gameOverOverlay = document.createElement('div');
            this.gameOverOverlay.className = 'cr-menu-overlay';
            this.gameOverOverlay.id = 'cr-game-over';
            this.overlay.appendChild(this.gameOverOverlay);
        }

        this.gameOverOverlay.innerHTML = `
            <div class="cr-menu-title" style="color: #ff6b6b;">GAME OVER</div>
            <div style="font-size: 48px; margin: 20px 0;">🐊</div>
            <div class="cr-menu-subtitle">The gator got you!</div>
            <div class="cr-complete-stats">
                <div class="cr-stat">SCORE<br><span class="cr-stat-value">${score}</span></div>
                <div class="cr-stat">CHORDS<br><span class="cr-stat-value">${chordsCompleted}</span></div>
            </div>
            <button class="cr-menu-btn" id="cr-retry-btn">TRY AGAIN</button>
            <button class="cr-menu-btn secondary" id="cr-menu-btn2">MENU</button>
        `;

        this.gameOverOverlay.classList.remove('hidden');

        this.gameOverOverlay.querySelector('#cr-retry-btn').addEventListener('click', () => {
            this.gameOverOverlay.classList.add('hidden');
            this.game.restart();
        });

        this.gameOverOverlay.querySelector('#cr-menu-btn2').addEventListener('click', () => {
            this.gameOverOverlay.classList.add('hidden');
            this.game.showMenu();
        });
    }

    /**
     * Hide all overlay screens
     */
    hideAllOverlays() {
        if (this.menuOverlay) this.menuOverlay.classList.add('hidden');
        if (this.levelSelectOverlay) this.levelSelectOverlay.classList.add('hidden');
        if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');
        if (this.levelCompleteOverlay) this.levelCompleteOverlay.classList.add('hidden');
        if (this.gameOverOverlay) this.gameOverOverlay.classList.add('hidden');
    }

    /**
     * Clean up
     */
    destroy() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }
}
