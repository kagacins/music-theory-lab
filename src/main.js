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
