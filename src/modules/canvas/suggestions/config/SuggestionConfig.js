/**
 * Suggestion Configuration
 * Centralized configuration for integrated suggestion system
 */

export class SuggestionConfig {
    constructor() {
        this.loadSettings();
    }

    /**
     * Default configuration
     */
    static DEFAULTS = {
        // Palette appearance
        paletteSize: 'medium', // 'small', 'medium', 'large'
        maxSuggestions: 5,
        showConfidenceScores: true,
        showCategories: true,

        // Behavior
        autoShow: true,
        dismissOnSelection: true,
        previewOnHover: true,
        animationDuration: 200,

        // Keyboard
        enableKeyboardShortcuts: true,
        quickSelectNumbers: true,

        // Positioning
        preferredPosition: 'auto', // 'auto', 'above', 'below', 'left', 'right'
        avoidCollisions: true,
        offsetX: 20,
        offsetY: 20,

        // Performance
        debounceDelay: 100,
        cacheResults: true,
        maxCacheSize: 50,

        // Accessibility
        announceToScreenReader: true,
        reducedMotion: false
    };

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        const saved = localStorage.getItem('integratedSuggestionsConfig');
        if (saved) {
            try {
                this.settings = { ...SuggestionConfig.DEFAULTS, ...JSON.parse(saved) };
            } catch (e) {
                console.warn('Failed to load suggestion settings, using defaults', e);
                this.settings = { ...SuggestionConfig.DEFAULTS };
            }
        } else {
            this.settings = { ...SuggestionConfig.DEFAULTS };
        }

        // Check for reduced motion preference
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.settings.reducedMotion = true;
            this.settings.animationDuration = 0;
        }
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem('integratedSuggestionsConfig', JSON.stringify(this.settings));
        } catch (e) {
            console.error('Failed to save suggestion settings', e);
        }
    }

    /**
     * Get a setting value
     * @param {string} key - Setting key
     * @returns {*}
     */
    get(key) {
        return this.settings[key];
    }

    /**
     * Set a setting value
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    set(key, value) {
        this.settings[key] = value;
        this.saveSettings();
    }

    /**
     * Reset to defaults
     */
    reset() {
        this.settings = { ...SuggestionConfig.DEFAULTS };
        this.saveSettings();
    }

    /**
     * Get all settings
     * @returns {Object}
     */
    getAll() {
        return { ...this.settings };
    }

    /**
     * Update multiple settings at once
     * @param {Object} updates - Settings to update
     */
    updateMultiple(updates) {
        this.settings = { ...this.settings, ...updates };
        this.saveSettings();
    }
}

/**
 * Layout constants for suggestion UI
 */
export const LayoutConstants = {
    // Palette dimensions
    PALETTE_WIDTH: {
        small: 200,
        medium: 280,
        large: 360
    },
    PALETTE_MIN_HEIGHT: 120,
    PALETTE_MAX_HEIGHT: 500,

    // Spacing
    PADDING: 12,
    ITEM_SPACING: 8,
    ITEM_HEIGHT: 36,

    // Z-index layers
    Z_INDEX: {
        GHOST_NOTE: 100,
        PALETTE: 200,
        OVERLAY: 300
    },

    // Animation timing
    ANIMATION: {
        FADE_IN: 200,
        FADE_OUT: 150,
        SLIDE: 250,
        QUICK: 100
    },

    // Colors
    COLORS: {
        BACKGROUND: '#ffffff',
        BORDER: '#e0e0e0',
        HOVER: '#f5f5f5',
        SELECTED: '#e3f2fd',
        TEXT: '#333333',
        TEXT_SECONDARY: '#666666',
        ACCENT: '#4a9eff',
        GHOST: 'rgba(74, 158, 255, 0.4)'
    },

    // Shadows
    SHADOW: '0 2px 8px rgba(0, 0, 0, 0.15)',
    SHADOW_HOVER: '0 4px 12px rgba(0, 0, 0, 0.2)',

    // Border radius
    BORDER_RADIUS: 8
};

/**
 * Event types for suggestion system
 */
export const SuggestionEvents = {
    SUGGESTION_REQUESTED: 'suggestionRequested',
    SUGGESTION_SELECTED: 'suggestionSelected',
    SUGGESTION_PREVIEWED: 'suggestionPreviewed',
    SUGGESTION_DISMISSED: 'suggestionDismissed',
    PALETTE_OPENED: 'paletteOpened',
    PALETTE_CLOSED: 'paletteClosed',
    PALETTE_MOVED: 'paletteMoved'
};
