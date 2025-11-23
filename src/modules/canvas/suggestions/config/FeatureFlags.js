/**
 * Feature Flag System
 * Manages gradual rollout of integrated suggestions feature
 */

export class FeatureFlags {
    static FLAGS = {
        INTEGRATED_SUGGESTIONS: 'integratedSuggestions',
        LEGACY_SIDEBAR: 'legacySidebar',
        GHOST_PREVIEW: 'ghostPreview',
        TOUCH_SUPPORT: 'touchSupport',
        AUTO_SHOW_SUGGESTIONS: 'autoShowSuggestions'
    };

    /**
     * Check if a feature flag is enabled
     * @param {string} flag - Feature flag name
     * @returns {boolean}
     */
    static isEnabled(flag) {
        // Check user preference first
        const userPreference = localStorage.getItem(`feature_${flag}`);
        if (userPreference !== null) {
            return userPreference === 'true';
        }

        // Fall back to default value
        return this.getDefaultValue(flag);
    }

    /**
     * Enable a feature flag
     * @param {string} flag - Feature flag name
     */
    static enable(flag) {
        localStorage.setItem(`feature_${flag}`, 'true');
        this.dispatchFlagChangeEvent(flag, true);
    }

    /**
     * Disable a feature flag
     * @param {string} flag - Feature flag name
     */
    static disable(flag) {
        localStorage.setItem(`feature_${flag}`, 'false');
        this.dispatchFlagChangeEvent(flag, false);
    }

    /**
     * Toggle a feature flag
     * @param {string} flag - Feature flag name
     * @returns {boolean} New state
     */
    static toggle(flag) {
        const newState = !this.isEnabled(flag);
        if (newState) {
            this.enable(flag);
        } else {
            this.disable(flag);
        }
        return newState;
    }

    /**
     * Get default value for a feature flag
     * @param {string} flag - Feature flag name
     * @returns {boolean}
     */
    static getDefaultValue(flag) {
        const defaults = {
            [this.FLAGS.INTEGRATED_SUGGESTIONS]: true, // Enable by default
            [this.FLAGS.LEGACY_SIDEBAR]: false, // Disable legacy mode
            [this.FLAGS.GHOST_PREVIEW]: true,
            [this.FLAGS.TOUCH_SUPPORT]: 'ontouchstart' in window,
            [this.FLAGS.AUTO_SHOW_SUGGESTIONS]: true
        };
        return defaults[flag] || false;
    }

    /**
     * Dispatch a custom event when a flag changes
     * @param {string} flag - Feature flag name
     * @param {boolean} enabled - New state
     */
    static dispatchFlagChangeEvent(flag, enabled) {
        window.dispatchEvent(new CustomEvent('featureFlagChange', {
            detail: { flag, enabled }
        }));
    }

    /**
     * Reset all feature flags to defaults
     */
    static resetToDefaults() {
        Object.values(this.FLAGS).forEach(flag => {
            localStorage.removeItem(`feature_${flag}`);
        });
    }

    /**
     * Get all feature flags and their states
     * @returns {Object}
     */
    static getAllFlags() {
        const flags = {};
        Object.entries(this.FLAGS).forEach(([key, flag]) => {
            flags[flag] = this.isEnabled(flag);
        });
        return flags;
    }
}
