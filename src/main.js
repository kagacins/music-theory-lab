/**
 * Main Entry Point
 * Initializes the application and exposes necessary functions to the global scope for HTML event handlers
 *
 * GOOGLE CUSTOM SEARCH API CONFIGURATION:
 * - Production (Netlify): Uses serverless function with env vars (API key hidden)
 * - Local dev: Uses VITE_GOOGLE_SEARCH_API_KEY from .env.local
 *
 * See GOOGLE_SEARCH_API_SETUP.md for detailed setup instructions.
 */

// =============================================================================
// DEBUG LOGGING FILTER
// Suppresses [ModuleName] style debug logs unless debug mode is enabled
// Enable debug mode: localStorage.setItem('debug', 'true') then refresh
// =============================================================================
(() => {
    const DEBUG_ENABLED = localStorage.getItem('debug') === 'true';
    if (!DEBUG_ENABLED) {
        const originalLog = console.log;
        const originalWarn = console.warn;

        // Filter out logs that start with [ (debug prefix pattern)
        console.log = function(...args) {
            if (args.length > 0 && typeof args[0] === 'string' && args[0].startsWith('[')) {
                return; // Suppress debug logs
            }
            originalLog.apply(console, args);
        };

        // Also filter warnings with debug prefix
        console.warn = function(...args) {
            if (args.length > 0 && typeof args[0] === 'string' && args[0].startsWith('[')) {
                return; // Suppress debug warnings
            }
            originalWarn.apply(console, args);
        };
    }

    // Expose debug toggle functions
    window.enableDebug = () => {
        localStorage.setItem('debug', 'true');
        console.log('Debug mode enabled. Refresh the page to see debug logs.');
    };
    window.disableDebug = () => {
        localStorage.setItem('debug', 'false');
        console.log('Debug mode disabled. Refresh the page to hide debug logs.');
    };
})();

// Google Custom Search API Configuration
// In production, these will be undefined and the Netlify function will be used instead
// In local dev, these come from .env.local (gitignored)
window.GOOGLE_SEARCH_API_KEY = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY || '';
window.GOOGLE_SEARCH_ENGINE_ID = import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID || '';

// Phase 3 Refactor: Import initialization modules
import { setupWindowExports } from './init/windowExports.js';
import { setupApp } from './init/appSetup.js';
import { initializeModules } from './init/moduleInitialization.js';
import { setupGlobalEventHandlers } from './init/globalEventHandlers.js';

// CRITICAL: Setup window exports FIRST (before DOMContentLoaded)
// HTML onclick handlers need these to be available immediately
setupWindowExports();

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    // Phase 3.2: App setup (UI state, dark mode, saved state, responsive title)
    setupApp();

    // Phase 3.3: Module initialization (audio FIRST, then other modules)
    await initializeModules();

    // Phase 3.4: Global event handlers (keyboard shortcuts, click-outside, custom events)
    setupGlobalEventHandlers();
});
