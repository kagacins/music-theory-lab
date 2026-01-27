/**
 * Gator Teeth - Main Entry Point
 *
 * A Subway Surfers-style chord learning game.
 * Run into the gator's mouth, break through the teeth by pressing correct keys!
 */

import { GatorTeethGame, GameState } from './GatorTeethGame.js';

// Singleton instance
let gameInstance = null;

/**
 * Launch Gator Teeth game
 */
export async function launchGatorTeeth(containerId = 'gator-teeth-container') {
    // If game already exists, destroy it first
    if (gameInstance) {
        gameInstance.destroy();
        gameInstance = null;
    }

    // Ensure container exists
    let container = document.getElementById(containerId);
    if (!container) {
        // Create fullscreen container
        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #1a1a2e;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid #4ecca3;
            color: #4ecca3;
            font-size: 24px;
            width: 40px;
            height: 40px;
            cursor: pointer;
            border-radius: 5px;
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        `;
        closeBtn.addEventListener('mouseover', () => {
            closeBtn.style.background = '#4ecca3';
            closeBtn.style.color = '#1a1a2e';
        });
        closeBtn.addEventListener('mouseout', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
            closeBtn.style.color = '#4ecca3';
        });
        closeBtn.addEventListener('click', () => closeGatorTeeth());
        container.appendChild(closeBtn);

        // Game container
        const gameContainer = document.createElement('div');
        gameContainer.id = 'gator-teeth-game';
        gameContainer.style.cssText = `
            width: 100%;
            max-width: 450px;
            height: 100%;
            max-height: 700px;
            position: relative;
            background: #1a1a2e;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 0 50px rgba(78, 204, 163, 0.3);
        `;
        container.appendChild(gameContainer);

        document.body.appendChild(container);
    }

    // Create and initialize game
    gameInstance = new GatorTeethGame('gator-teeth-game');

    const success = await gameInstance.init();
    if (!success) {
        console.error('Failed to initialize Gator Teeth');
        closeGatorTeeth();
        return null;
    }

    return gameInstance;
}

/**
 * Close Gator Teeth game
 */
export function closeGatorTeeth() {
    if (gameInstance) {
        gameInstance.destroy();
        gameInstance = null;
    }

    const container = document.getElementById('gator-teeth-container');
    if (container) {
        container.remove();
    }
}

/**
 * Get the current game instance
 */
export function getGatorTeethInstance() {
    return gameInstance;
}

/**
 * Check if game is running
 */
export function isGatorTeethRunning() {
    return gameInstance !== null && gameInstance.state !== GameState.MENU;
}

export { GatorTeethGame, GameState };
