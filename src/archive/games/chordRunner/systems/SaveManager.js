/**
 * SaveManager - Handles saving and loading game progress
 *
 * Uses localStorage to persist:
 * - Completed levels
 * - Star ratings per level
 * - High scores
 * - Settings (assist mode, sound style)
 */

const STORAGE_KEY = 'chordRunner_progress';

export class SaveManager {
    constructor() {
        this.progress = this.load();
    }

    /**
     * Get default progress structure
     */
    getDefaultProgress() {
        return {
            completed: [],      // Array of "worldId-levelNum" strings
            stars: {},          // { "worldId-levelNum": starCount }
            highScores: {},     // { "worldId-levelNum": score }
            totalScore: 0,
            settings: {
                assistMode: false,
                soundStyle: 'piano'
            },
            lastPlayed: null,
            createdAt: Date.now()
        };
    }

    /**
     * Load progress from localStorage
     */
    load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults to handle any new fields
                return {
                    ...this.getDefaultProgress(),
                    ...parsed
                };
            }
        } catch (error) {
            console.warn('Failed to load ChordRunner progress:', error);
        }

        return this.getDefaultProgress();
    }

    /**
     * Save progress to localStorage
     */
    save() {
        try {
            this.progress.lastPlayed = Date.now();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
            return true;
        } catch (error) {
            console.error('Failed to save ChordRunner progress:', error);
            return false;
        }
    }

    /**
     * Mark a level as completed
     */
    completeLevel(worldId, levelNum, score) {
        const levelKey = `${worldId}-${levelNum}`;

        // Add to completed list if not already there
        if (!this.progress.completed.includes(levelKey)) {
            this.progress.completed.push(levelKey);
        }

        // Update high score
        const currentHigh = this.progress.highScores[levelKey] || 0;
        if (score > currentHigh) {
            this.progress.highScores[levelKey] = score;
        }

        // Update total score
        this.progress.totalScore += score;

        this.save();
    }

    /**
     * Set star rating for a level
     */
    setStars(worldId, levelNum, stars) {
        const levelKey = `${worldId}-${levelNum}`;

        // Only update if better than current
        const currentStars = this.progress.stars[levelKey] || 0;
        if (stars > currentStars) {
            this.progress.stars[levelKey] = stars;
            this.save();
        }
    }

    /**
     * Get progress data
     */
    getProgress() {
        return {
            completed: [...this.progress.completed],
            stars: { ...this.progress.stars },
            highScores: { ...this.progress.highScores },
            totalScore: this.progress.totalScore
        };
    }

    /**
     * Check if a level is completed
     */
    isLevelCompleted(worldId, levelNum) {
        return this.progress.completed.includes(`${worldId}-${levelNum}`);
    }

    /**
     * Check if a level is unlocked
     */
    isLevelUnlocked(worldId, levelNum) {
        // First level of first world is always unlocked
        if (worldId === 1 && levelNum === 1) return true;

        // Previous level must be completed
        if (levelNum > 1) {
            return this.isLevelCompleted(worldId, levelNum - 1);
        }

        // First level of new world: last level of previous world must be completed
        // Assuming 5 levels per world
        return this.isLevelCompleted(worldId - 1, 5);
    }

    /**
     * Get stars for a level
     */
    getStars(worldId, levelNum) {
        return this.progress.stars[`${worldId}-${levelNum}`] || 0;
    }

    /**
     * Get high score for a level
     */
    getHighScore(worldId, levelNum) {
        return this.progress.highScores[`${worldId}-${levelNum}`] || 0;
    }

    /**
     * Get total stars earned
     */
    getTotalStars() {
        return Object.values(this.progress.stars).reduce((sum, stars) => sum + stars, 0);
    }

    /**
     * Get settings
     */
    getSettings() {
        return { ...this.progress.settings };
    }

    /**
     * Update settings
     */
    updateSettings(newSettings) {
        this.progress.settings = {
            ...this.progress.settings,
            ...newSettings
        };
        this.save();
    }

    /**
     * Reset all progress
     */
    reset() {
        this.progress = this.getDefaultProgress();
        this.save();
    }

    /**
     * Export progress as JSON string (for backup)
     */
    export() {
        return JSON.stringify(this.progress, null, 2);
    }

    /**
     * Import progress from JSON string
     */
    import(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            this.progress = {
                ...this.getDefaultProgress(),
                ...imported
            };
            this.save();
            return true;
        } catch (error) {
            console.error('Failed to import progress:', error);
            return false;
        }
    }

    /**
     * Get completion percentage
     */
    getCompletionPercent(totalLevels) {
        return Math.round((this.progress.completed.length / totalLevels) * 100);
    }

    /**
     * Get stats summary
     */
    getStats() {
        return {
            levelsCompleted: this.progress.completed.length,
            totalStars: this.getTotalStars(),
            totalScore: this.progress.totalScore,
            lastPlayed: this.progress.lastPlayed
        };
    }
}
