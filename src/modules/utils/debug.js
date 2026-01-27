// debug.js
// Centralized debug logging utility
// Set DEBUG_ENABLED to false for production builds

// Check for debug mode from localStorage or default to false for production
const DEBUG_ENABLED = localStorage.getItem('debug') === 'true' || false;

/**
 * Debug logger that can be toggled on/off
 * Usage: debugLog('[ModuleName]', 'message', ...args)
 */
export function debugLog(...args) {
    if (DEBUG_ENABLED) {
        console.log(...args);
    }
}

/**
 * Debug warning that can be toggled on/off
 */
export function debugWarn(...args) {
    if (DEBUG_ENABLED) {
        console.warn(...args);
    }
}

/**
 * Always log errors (these should always be visible)
 */
export function debugError(...args) {
    console.error(...args);
}

/**
 * Enable debug mode (persists to localStorage)
 */
export function enableDebug() {
    localStorage.setItem('debug', 'true');
}

/**
 * Disable debug mode (persists to localStorage)
 */
export function disableDebug() {
    localStorage.setItem('debug', 'false');
}

// Expose to window for easy toggling from console
if (typeof window !== 'undefined') {
    window.enableDebug = enableDebug;
    window.disableDebug = disableDebug;
}

export default { debugLog, debugWarn, debugError, enableDebug, disableDebug };
