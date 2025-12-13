/**
 * Integrated Canvas Suggestions - Main Entry Point
 *
 * This module provides the integrated suggestion system for the Music Theory Lab.
 * Import this file to access all suggestion system components.
 *
 * @example
 * import { CanvasSuggestionManager, FeatureFlags } from './modules/canvas/suggestions/index.js';
 *
 * const manager = new CanvasSuggestionManager({ ... });
 * FeatureFlags.enable(FeatureFlags.FLAGS.INTEGRATED_SUGGESTIONS);
 */

// Main Controller
export { CanvasSuggestionManager } from './CanvasSuggestionManager.js';

// Configuration
export { FeatureFlags } from './config/FeatureFlags.js';
export { SuggestionConfig, LayoutConstants, SuggestionEvents } from './config/SuggestionConfig.js';

// Import for internal use in initializeIntegratedSuggestions
import { CanvasSuggestionManager } from './CanvasSuggestionManager.js';
import { MelodySuggestionEngine } from './engines/MelodySuggestionEngine.js';
import { ChordSuggestionEngine } from './engines/ChordSuggestionEngine.js';

// Core Systems
export { SmartPositioner, CollisionDetector } from './SmartPositioner.js';
export { GhostNoteRenderer } from './GhostNoteRenderer.js';
export { KeyboardHandler } from './KeyboardHandler.js';

// UI Components
// Note: FloatingPalette, MelodyPalette, and ChordPalette have been removed.
// Palette UI is now provided by UnifiedRecommendationModal.

// Suggestion Engines
export { MelodySuggestionEngine, MELODY_STYLE_PRESETS, MELODY_CONTOUR_PRESETS } from './engines/MelodySuggestionEngine.js';
export { ChordSuggestionEngine, SUGGESTION_STYLES, SUGGESTION_MOODS } from './engines/ChordSuggestionEngine.js';

/**
 * Quick start helper function
 *
 * @param {Object} options - Initialization options
 * @param {HTMLCanvasElement} options.canvas - Canvas element
 * @param {CanvasRenderingContext2D} options.context - Canvas context
 * @param {Object} options.compositionState - Composition state manager
 * @param {Object} options.notationRenderer - VexFlow renderer
 * @param {Object} options.layoutManager - Staff layout manager
 * @param {Object} options.melodyEngine - Melody suggestion engine
 * @param {Object} options.chordEngine - Chord suggestion engine
 * @returns {CanvasSuggestionManager}
 */
export function initializeIntegratedSuggestions(options) {
    const {
        canvas,
        context,
        compositionState,
        notationRenderer,
        layoutManager,
        melodyEngine,
        chordEngine,
        config = {}
    } = options;

    if (!canvas || !context) {
        throw new Error('Canvas and context are required to initialize suggestions');
    }

    const manager = new CanvasSuggestionManager({
        canvas,
        context,
        compositionState,
        notationRenderer,
        layoutManager
    });

    // Create or use provided melody engine
    const melody = melodyEngine || new MelodySuggestionEngine(config.melody);
    manager.setMelodyEngine(melody);

    // Create or use provided chord engine
    const chord = chordEngine || new ChordSuggestionEngine(config.chord);
    manager.setChordEngine(chord);

    console.log('📋 Keyboard Shortcuts:');
    console.log('  Space (hold)  - Preview suggestion');

    return manager;
}

/**
 * Version information
 */
export const VERSION = {
    major: 1,
    minor: 0,
    patch: 0,
    phase: 'Phase 1 - Foundation Complete',
    toString() {
        return `${this.major}.${this.minor}.${this.patch} (${this.phase})`;
    }
};
