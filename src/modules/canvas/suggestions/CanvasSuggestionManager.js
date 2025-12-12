/**
 * Canvas Suggestion Manager
 * Main controller for integrated suggestion system
 * Phase 2.1: Enhanced with section intent integration
 */

import { FeatureFlags } from './config/FeatureFlags.js';
import { SuggestionConfig, SuggestionEvents } from './config/SuggestionConfig.js';
import { SmartPositioner } from './SmartPositioner.js';
import { GhostNoteRenderer } from './GhostNoteRenderer.js';
import { KeyboardHandler } from './KeyboardHandler.js';
// Note: MelodyPalette and ChordPalette have been removed.
// Palette UI is now provided by UnifiedRecommendationModal.
// The engines (MelodySuggestionEngine, ChordSuggestionEngine) are still available.

// Phase 2.1: Section intent state
import {
    refreshInsertContext,
    getSectionIntent,
    needsChordSelection,
    setInsertAfterIndex
} from '../../state/sectionIntentState.js';
import { getProgressionData, getSelectedIndicesArray, selectSingle } from '../../state/trainerState.js';

export class CanvasSuggestionManager {
    constructor(options = {}) {
        // Core references
        this.canvas = options.canvas;
        this.context = options.context;
        this.compositionState = options.compositionState;
        this.notationRenderer = options.notationRenderer;
        this.layoutManager = options.layoutManager;

        // Configuration
        this.config = new SuggestionConfig();

        // Components
        this.positioner = new SmartPositioner(this.canvas, this.config);
        this.ghostRenderer = new GhostNoteRenderer({
            canvas: this.canvas,
            context: this.context,
            renderer: this.notationRenderer,
            layoutManager: this.layoutManager
        });
        this.keyboardHandler = new KeyboardHandler({
            onShortcut: this.handleKeyboardShortcut.bind(this)
        });

        // State
        this.activePalettes = new Map();
        this.currentContext = null;
        this.lastMousePosition = null;
        this.enabled = FeatureFlags.isEnabled(FeatureFlags.FLAGS.INTEGRATED_SUGGESTIONS);

        // Suggestion engines (to be set externally or initialized)
        this.melodyEngine = options.melodyEngine || null;
        this.chordEngine = options.chordEngine || null;

        // Initialize
        this.initialize();
    }

    /**
     * Initialize the manager
     */
    initialize() {
        // Attach keyboard handler
        if (this.config.get('enableKeyboardShortcuts')) {
            this.keyboardHandler.attach();
        }

        // Listen to canvas events
        this.attachCanvasListeners();

        // Listen to composition state events
        this.attachStateListeners();

        // Listen to feature flag changes
        this.attachFeatureFlagListeners();
    }

    /**
     * Attach canvas event listeners
     */
    attachCanvasListeners() {
        if (!this.canvas) return;

        // TEMPORARILY DISABLED: Canvas click handler interferes with note editing
        // Users should use Tab/Shift+Tab keyboard shortcuts to open palettes
        // this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));

        this.canvas.addEventListener('contextmenu', this.handleRightClick.bind(this));

        // REMOVED: Canvas mousemove was calling getMusicalContext() constantly, causing severe lag
        // this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));

        // Track global mouse position for palette positioning (lightweight, just stores coordinates)
        document.addEventListener('mousemove', (event) => {
            this.lastMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
        });
    }

    /**
     * Attach composition state listeners
     */
    attachStateListeners() {
        if (!this.compositionState) return;

        this.compositionState.on?.('cursorMoved', this.handleCursorMove.bind(this));
        this.compositionState.on?.('noteAdded', this.handleNoteAdded.bind(this));
        this.compositionState.on?.('chordChanged', this.handleChordChanged.bind(this));
        this.compositionState.on?.('measureChanged', this.handleMeasureChanged.bind(this));
    }

    /**
     * Attach feature flag listeners
     */
    attachFeatureFlagListeners() {
        window.addEventListener('featureFlagChange', (e) => {
            if (e.detail.flag === FeatureFlags.FLAGS.INTEGRATED_SUGGESTIONS) {
                this.enabled = e.detail.enabled;
                if (!this.enabled) {
                    this.hideAllPalettes();
                }
            }
        });
    }

    /**
     * Handle canvas click
     * @param {MouseEvent} event - Click event
     */
    handleCanvasClick(event) {
        if (!this.enabled) return;

        const position = this.getCanvasPosition(event);
        const clickedElement = this.detectClickedElement(position);

        if (clickedElement?.type === 'note') {
            this.handleNoteClick(clickedElement, position);
        } else if (clickedElement?.type === 'chord') {
            this.handleChordSymbolClick(clickedElement, position);
        } else if (clickedElement?.type === 'empty') {
            // Clicked on empty staff - potentially show suggestions
            if (this.config.get('autoShow')) {
                this.showMelodySuggestions(position);
            }
        }
    }

    /**
     * Handle right-click (context menu)
     * @param {MouseEvent} event - Click event
     */
    handleRightClick(event) {
        if (!this.enabled) return;

        event.preventDefault();

        const position = this.getCanvasPosition(event);
        const clickedElement = this.detectClickedElement(position);

        // Show context menu with suggestion options
        this.showContextMenu(clickedElement, position);
    }

    /**
     * Handle mouse move
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseMove(event) {
        if (!this.enabled) return;

        const canvasPosition = this.getCanvasPosition(event);
        this.currentContext = this.getMusicalContext(canvasPosition);

        // Update ghost preview if palette is active
        // This would show what note would be added at cursor position
    }

    /**
     * Handle note click
     * @param {Object} noteElement - Note element data
     * @param {Object} position - Click position
     */
    handleNoteClick(noteElement, position) {
        // Could show suggestions for the next note after this one

    }

    /**
     * Handle chord symbol click
     * @param {Object} chordElement - Chord element data
     * @param {Object} position - Click position
     */
    handleChordSymbolClick(chordElement, position) {
        // Show chord progression suggestions
        if (this.config.get('autoShow')) {
            this.showChordSuggestions(position, chordElement);
        }
    }

    /**
     * Handle keyboard shortcut
     * @param {string} action - Shortcut action
     * @param {Object} args - Action arguments
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyboardShortcut(action, args, event) {
        if (!this.enabled) return;

        switch (action) {
            case 'showMelodySuggestions':
                this.showMelodySuggestions(this.lastMousePosition || this.currentContext?.position);
                break;

            case 'showChordSuggestions':
                this.showChordSuggestions(this.lastMousePosition || this.currentContext?.position);
                break;

            case 'selectSuggestion':
                this.selectSuggestionByIndex(args.index);
                break;

            case 'navigateUp':
                this.navigateActivePalette('up');
                break;

            case 'navigateDown':
                this.navigateActivePalette('down');
                break;

            case 'navigateLeft':
                this.navigateActivePalette('left');
                break;

            case 'navigateRight':
                this.navigateActivePalette('right');
                break;

            case 'applySuggestion':
                this.applySelectedSuggestion();
                break;

            case 'previewSuggestion':
                this.previewSelectedSuggestion();
                break;

            case 'previewSuggestionRelease':
                this.clearPreview();
                break;

            case 'dismissSuggestions':
                this.hideAllPalettes();
                break;

            case 'toggleAssistMode':
                this.toggleAssistMode();
                break;
        }
    }

    /**
     * Show melody suggestions at position
     * Note: Palette UI has been removed. Use UnifiedRecommendationModal instead.
     * This method now only generates suggestions and dispatches an event.
     * @param {Object} position - Position to show suggestions
     * @param {Object} context - Additional context
     */
    async showMelodySuggestions(position, context = {}) {
        if (!this.enabled || !this.melodyEngine) return;

        // Get musical context
        const musicalContext = context.musicalContext || this.getMusicalContext(position);

        // Generate suggestions
        const suggestions = await this.melodyEngine.generateSuggestions(musicalContext);

        if (!suggestions || suggestions.length === 0) {

            return;
        }

        // Dispatch event with suggestions (UnifiedRecommendationModal can listen for this)
        window.dispatchEvent(new CustomEvent(SuggestionEvents.PALETTE_OPENED, {
            detail: { type: 'melody', suggestions, context: musicalContext }
        }));

        return suggestions;
    }

    /**
     * Show chord suggestions at position
     * Note: Palette UI has been removed. Use UnifiedRecommendationModal instead.
     * This method now only generates suggestions and dispatches an event.
     * @param {Object} position - Position to show suggestions
     * @param {Object} context - Additional context
     */
    async showChordSuggestions(position, context = {}) {
        if (!this.enabled || !this.chordEngine) return;

        // Phase 2.1: Initialize section intent context
        const progressionData = getProgressionData();
        let sections = [];
        try {
            const compositionState = window.getCompositionState?.();
            if (compositionState) {
                sections = compositionState.getSections() || [];
            }
        } catch (e) {

        }

        // Refresh the insert context based on current selection
        refreshInsertContext(sections, progressionData.length);

        // Get musical context
        const musicalContext = context.musicalContext || this.getMusicalContext(position);

        // Generate suggestions
        const suggestions = await this.chordEngine.generateSuggestions(musicalContext);

        if (!suggestions || suggestions.length === 0) {

            return;
        }

        // Dispatch event with suggestions (UnifiedRecommendationModal can listen for this)
        window.dispatchEvent(new CustomEvent(SuggestionEvents.PALETTE_OPENED, {
            detail: { type: 'chord', suggestions, context: musicalContext, progressionData, sections }
        }));

        return suggestions;
    }

    /**
     * Phase 2.1: Handle section intent changes from the palette
     * @param {Object} intent - New intent state
     */
    handleSectionIntentChange(intent) {

        // Refresh recommendations with new intent
        // The recommendationService listens for sectionIntentChanged events
    }

    /**
     * Phase 2.1: Handle chord selection requests from the palette
     * @param {string} action - 'last' to select last chord, 'cancel' to dismiss
     */
    handleSelectChordRequest(action) {
        if (action === 'last') {
            // Select the last chord in the progression
            const progressionData = getProgressionData();
            if (progressionData.length > 0) {
                const lastIndex = progressionData.length - 1;
                selectSingle(lastIndex);
                setInsertAfterIndex(lastIndex);

                // Refresh the palette to show normal UI
                const palette = this.activePalettes.get('chord');
                if (palette) {
                    const sections = window.getCompositionState?.()?.getSections() || [];
                    refreshInsertContext(sections, progressionData.length);
                    palette.updateContext({
                        progressionData: progressionData,
                        sections: sections
                    });
                }

                // Dispatch selection event
                window.dispatchEvent(new CustomEvent('chordSelected', {
                    detail: { index: lastIndex }
                }));
            }
        } else if (action === 'cancel') {
            this.hidePalette('chord');
        }
    }

    /**
     * Handle melody suggestion selection
     * @param {Object} suggestion - Selected suggestion
     * @param {number} index - Suggestion index
     */
    handleMelodySuggestionSelect(suggestion, index) {


        // Apply the suggestion using the global addNoteIntelligently function
        if (window.addNoteIntelligently) {
            const pitch = suggestion.note || suggestion.pitch || 'C4';
            const duration = suggestion.duration || '4n';
            const dotted = suggestion.dotted || false;
            const isRest = suggestion.isRest || false;
            const accidental = suggestion.accidental;



            const result = window.addNoteIntelligently(
                pitch,
                duration,
                dotted,
                isRest,
                accidental
            );



            // Hide palette after selection
            this.hidePalette('melody');
        } else {

        }

        // Dispatch event
        window.dispatchEvent(new CustomEvent(SuggestionEvents.SUGGESTION_SELECTED, {
            detail: { type: 'melody', suggestion, index }
        }));
    }

    /**
     * Handle melody suggestion preview
     * @param {Object} suggestion - Suggestion to preview
     * @param {number} index - Suggestion index
     */
    handleMelodySuggestionPreview(suggestion, index) {
        if (!suggestion) {
            this.ghostRenderer.clearGhosts();
            return;
        }

        if (this.config.get('previewOnHover') && FeatureFlags.isEnabled(FeatureFlags.FLAGS.GHOST_PREVIEW)) {
            this.ghostRenderer.clearGhosts();

            const position = this.currentContext?.position || this.getDefaultPosition();
            this.ghostRenderer.renderGhostNote({
                pitch: suggestion.note || suggestion.pitch,
                duration: '4n',
                position
            });
        }
    }

    /**
     * Handle chord suggestion selection
     * @param {Object} suggestion - Selected suggestion
     * @param {number} index - Suggestion index
     */
    handleChordSuggestionSelect(suggestion, index) {


        // TODO: Implement chord application
        // The compositionState needs a method to set the chord for the current measure
        // For now, just log the selection

        // Hide palette after selection
        this.hidePalette('chord');

        // Dispatch event
        window.dispatchEvent(new CustomEvent(SuggestionEvents.SUGGESTION_SELECTED, {
            detail: { type: 'chord', suggestion, index }
        }));
    }

    /**
     * Handle chord suggestion preview
     * @param {Object} suggestion - Suggestion to preview
     * @param {number} index - Suggestion index
     */
    handleChordSuggestionPreview(suggestion, index) {
        if (!suggestion) {
            this.ghostRenderer.clearGhosts();
            return;
        }

        if (this.config.get('previewOnHover') && FeatureFlags.isEnabled(FeatureFlags.FLAGS.GHOST_PREVIEW)) {
            this.ghostRenderer.clearGhosts();

            // Render ghost chord
            const position = this.currentContext?.position || this.getDefaultPosition();
            this.ghostRenderer.renderGhostChord({
                notes: suggestion.notes || [],
                name: suggestion.nextChord || suggestion.chord,
                position
            });
        }
    }

    /**
     * Handle melody style change
     * @param {string} style - New style
     */
    async handleMelodyStyleChange(style) {


        // Get the existing melody palette
        const palette = this.activePalettes.get('melody');
        if (!palette) {

            return;
        }

        // Get musical context
        const musicalContext = this.getMusicalContext(palette.position);

        // Generate new suggestions with the selected style
        // TODO: Pass style to melody engine when it supports style filtering
        const suggestions = await this.melodyEngine.generateSuggestions({
            ...musicalContext,
            style
        });

        if (!suggestions || suggestions.length === 0) {

            return;
        }

        // Update the palette's suggestions without recreating it
        palette.updateSuggestions(suggestions);
    }

    /**
     * Handle mood change
     * @param {string} mood - New mood
     */
    async handleMoodChange(mood) {

        // Regenerate chord suggestions with new mood
        const palette = this.activePalettes.get('chord');
        if (palette) {
            const position = palette.position;
            await this.showChordSuggestions(position, { mood });
        }
    }

    /**
     * Handle style change
     * @param {string} style - New style
     */
    async handleStyleChange(style) {

        // Regenerate chord suggestions with new style
        const palette = this.activePalettes.get('chord');
        if (palette) {
            const position = palette.position;
            await this.showChordSuggestions(position, { style });
        }
    }

    /**
     * Navigate active palette
     * @param {string} direction - Direction ('up', 'down', 'left', 'right')
     */
    navigateActivePalette(direction) {
        const activePalette = this.getActivePalette();
        if (!activePalette) return;

        switch (direction) {
            case 'up':
                activePalette.navigatePrevious();
                break;
            case 'down':
                activePalette.navigateNext();
                break;
            case 'right':
                // Could expand palette or show more options
                break;
        }
    }

    /**
     * Select suggestion by index in active palette
     * @param {number} index - Suggestion index
     */
    selectSuggestionByIndex(index) {
        const activePalette = this.getActivePalette();
        if (activePalette) {
            activePalette.selectItem(index);
        }
    }

    /**
     * Apply currently selected suggestion
     */
    applySelectedSuggestion() {
        const activePalette = this.getActivePalette();
        if (activePalette) {
            activePalette.selectItem(activePalette.selectedIndex);
        }
    }

    /**
     * Preview currently selected suggestion
     */
    previewSelectedSuggestion() {
        const activePalette = this.getActivePalette();
        if (activePalette && activePalette.selectedIndex >= 0) {
            const suggestion = activePalette.suggestions[activePalette.selectedIndex];
            if (activePalette.type === 'melody') {
                this.handleMelodySuggestionPreview(suggestion, activePalette.selectedIndex);
            } else if (activePalette.type === 'chord') {
                this.handleChordSuggestionPreview(suggestion, activePalette.selectedIndex);
            }
        }
    }

    /**
     * Clear preview
     */
    clearPreview() {
        this.ghostRenderer.clearGhosts();
    }

    /**
     * Hide a specific palette
     * @param {string} type - Palette type
     */
    hidePalette(type) {
        const palette = this.activePalettes.get(type);
        if (palette) {
            palette.hide();
            this.activePalettes.delete(type);
        }
    }

    /**
     * Hide all palettes
     */
    hideAllPalettes() {
        this.activePalettes.forEach(palette => palette.hide());
        this.activePalettes.clear();
        this.clearPreview();
    }

    /**
     * Get active palette (first one in the map)
     * @returns {FloatingPalette|null}
     */
    getActivePalette() {
        return this.activePalettes.values().next().value || null;
    }

    /**
     * Get canvas position from mouse event
     * @param {MouseEvent} event - Mouse event
     * @returns {Object} Position {x, y}
     */
    getCanvasPosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    /**
     * Detect what element was clicked
     * @param {Object} position - Click position
     * @returns {Object|null} Element data
     */
    detectClickedElement(position) {
        // This would use the layout manager to detect clicked elements
        // For now, return empty for prototyping
        return { type: 'empty', position };
    }

    /**
     * Get musical context at position
     * @param {Object} position - Position
     * @returns {Object} Musical context
     */
    getMusicalContext(position) {
        // Extract data from composition state if available
        let measure = 0;
        let chord = null;
        let key = 'C';
        let timeSignature = '4/4';
        let previousNotes = [];

        if (this.compositionState) {
            // Get current measure (default to 0 if not available)
            measure = this.compositionState.currentMeasure || 0;

            // Get current chord from composition state
            if (typeof this.compositionState.getChord === 'function') {
                const chordData = this.compositionState.getChord(measure);
                if (chordData) {
                    chord = {
                        root: chordData.root,
                        type: chordData.type || chordData.quality,
                        inversion: chordData.inversion || 0
                    };
                }
            }

            // Get key signature
            if (this.compositionState.key) {
                key = this.compositionState.key;
            }

            // Get time signature
            if (this.compositionState.timeSignature) {
                timeSignature = this.compositionState.timeSignature;
            }

            // Get previous notes from melody
            if (this.compositionState.melody && Array.isArray(this.compositionState.melody)) {
                previousNotes = this.compositionState.melody.slice(-8).map(note => note.pitch || note.note);
            }
        }

        // Fallback: try to get key from global getCurrentKey function if available
        if (key === 'C' && typeof window.getCurrentKey === 'function') {
            try {
                key = window.getCurrentKey() || 'C';
            } catch (e) {
                // Ignore errors
            }
        }

        return {
            position,
            measure,
            chord,
            key,
            timeSignature,
            previousNotes
        };
    }

    /**
     * Get default position for palette
     * @returns {Object} Position {x, y}
     */
    getDefaultPosition() {
        const rect = this.canvas?.getBoundingClientRect() || { width: 800, height: 600 };
        return {
            x: rect.width / 2,
            y: rect.height / 3
        };
    }

    /**
     * Get palette size based on configuration
     * @returns {Object} Size {width, height}
     */
    getPaletteSize() {
        const config = this.config.getAll();
        const sizeKey = config.paletteSize || 'medium';

        return {
            width: { small: 200, medium: 280, large: 360 }[sizeKey] || 280,
            height: 300 // Estimated
        };
    }

    /**
     * Get existing UI elements for collision detection
     * @returns {Array<Object>} Elements with bounds
     */
    getExistingElements() {
        const elements = [];

        // Add bounds of existing palettes
        this.activePalettes.forEach(palette => {
            const bounds = palette.getBounds();
            if (bounds) {
                elements.push(bounds);
            }
        });

        return elements;
    }

    /**
     * Show context menu
     * @param {Object} element - Clicked element
     * @param {Object} position - Position
     */
    showContextMenu(element, position) {
        // Would show radial context menu as per design

    }

    /**
     * Toggle assist mode
     */
    toggleAssistMode() {
        const currentValue = FeatureFlags.isEnabled(FeatureFlags.FLAGS.AUTO_SHOW_SUGGESTIONS);
        FeatureFlags.toggle(FeatureFlags.FLAGS.AUTO_SHOW_SUGGESTIONS);


    }

    /**
     * Event handlers for composition state changes
     */
    handleCursorMove(data) {
        this.currentContext = this.getMusicalContext(data.position);
    }

    handleNoteAdded(note) {
        // Could auto-show suggestions for next note
        if (this.config.get('autoShow')) {
            // Show suggestions with a small delay
            setTimeout(() => {
                this.showMelodySuggestions(null);
            }, this.config.get('debounceDelay'));
        }
    }

    handleChordChanged(chord) {
        // Update context and potentially refresh suggestions
        this.currentContext = { ...this.currentContext, chord };
    }

    handleMeasureChanged(measure) {
        this.currentContext = { ...this.currentContext, measure };
    }

    /**
     * Set melody engine
     * @param {Object} engine - Melody suggestion engine
     */
    setMelodyEngine(engine) {
        this.melodyEngine = engine;
    }

    /**
     * Set chord engine
     * @param {Object} engine - Chord suggestion engine
     */
    setChordEngine(engine) {
        this.chordEngine = engine;
    }

    /**
     * Update configuration
     * @param {Object} updates - Configuration updates
     */
    updateConfig(updates) {
        this.config.updateMultiple(updates);
    }

    /**
     * Enable the suggestion system
     */
    enable() {
        this.enabled = true;
        FeatureFlags.enable(FeatureFlags.FLAGS.INTEGRATED_SUGGESTIONS);
    }

    /**
     * Disable the suggestion system
     */
    disable() {
        this.enabled = false;
        this.hideAllPalettes();
        FeatureFlags.disable(FeatureFlags.FLAGS.INTEGRATED_SUGGESTIONS);
    }

    /**
     * Dispose of the manager
     */
    dispose() {
        this.hideAllPalettes();
        this.keyboardHandler.dispose();
        this.ghostRenderer.dispose();
        this.activePalettes.clear();
        this.canvas = null;
        this.context = null;
        this.compositionState = null;
        this.notationRenderer = null;
    }
}
