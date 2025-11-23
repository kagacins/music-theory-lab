/**
 * Keyboard Handler
 * Manages keyboard shortcuts and navigation for suggestion system
 */

import { SuggestionEvents } from './config/SuggestionConfig.js';

export class KeyboardHandler {
    constructor(options = {}) {
        this.enabled = true;
        this.activeElement = null;
        this.shortcuts = new Map();
        this.keySequence = [];
        this.sequenceTimeout = null;

        // Callbacks
        this.onShortcut = options.onShortcut || (() => {});
        this.onNavigate = options.onNavigate || (() => {});

        // Initialize default shortcuts
        this.initializeDefaultShortcuts();

        // Bind event handlers
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
    }

    /**
     * Initialize default keyboard shortcuts
     */
    initializeDefaultShortcuts() {
        // Show/hide suggestions
        this.registerShortcut('Tab', {
            action: 'showMelodySuggestions',
            description: 'Show melody suggestions'
        });

        this.registerShortcut('Shift+Tab', {
            action: 'showChordSuggestions',
            description: 'Show chord suggestions'
        });

        // Quick selection
        for (let i = 1; i <= 9; i++) {
            this.registerShortcut(`${i}`, {
                action: 'selectSuggestion',
                args: { index: i - 1 },
                description: `Select suggestion ${i}`
            });
        }

        // Navigation
        this.registerShortcut('ArrowUp', {
            action: 'navigateUp',
            description: 'Navigate up in suggestions'
        });

        this.registerShortcut('ArrowDown', {
            action: 'navigateDown',
            description: 'Navigate down in suggestions'
        });

        this.registerShortcut('ArrowLeft', {
            action: 'navigateLeft',
            description: 'Navigate left in suggestions'
        });

        this.registerShortcut('ArrowRight', {
            action: 'navigateRight',
            description: 'Navigate right / expand suggestions'
        });

        // Actions
        this.registerShortcut('Enter', {
            action: 'applySuggestion',
            description: 'Apply selected suggestion'
        });

        this.registerShortcut('Space', {
            action: 'previewSuggestion',
            description: 'Preview suggestion (hold)',
            holdable: true
        });

        this.registerShortcut('Escape', {
            action: 'dismissSuggestions',
            description: 'Dismiss suggestions'
        });

        // Toggle assist mode
        this.registerShortcut('Ctrl+I', {
            action: 'toggleAssistMode',
            description: 'Toggle AI assist mode'
        });

        this.registerShortcut('Meta+I', { // For Mac
            action: 'toggleAssistMode',
            description: 'Toggle AI assist mode'
        });
    }

    /**
     * Register a keyboard shortcut
     * @param {string} key - Key combination (e.g., 'Ctrl+S', 'Tab')
     * @param {Object} config - Shortcut configuration
     */
    registerShortcut(key, config) {
        const normalizedKey = this.normalizeKey(key);
        this.shortcuts.set(normalizedKey, {
            ...config,
            key: normalizedKey
        });
    }

    /**
     * Unregister a keyboard shortcut
     * @param {string} key - Key combination
     */
    unregisterShortcut(key) {
        const normalizedKey = this.normalizeKey(key);
        this.shortcuts.delete(normalizedKey);
    }

    /**
     * Normalize key string for consistent matching
     * @param {string} key - Key string
     * @returns {string} Normalized key
     */
    normalizeKey(key) {
        const parts = key.split('+');
        const modifiers = parts.slice(0, -1).map(m => m.toLowerCase()).sort();
        const mainKey = parts[parts.length - 1];

        return [...modifiers, mainKey].join('+');
    }

    /**
     * Get key string from keyboard event
     * @param {KeyboardEvent} event - Keyboard event
     * @returns {string} Key string
     */
    getKeyString(event) {
        const modifiers = [];

        if (event.ctrlKey) modifiers.push('ctrl');
        if (event.shiftKey) modifiers.push('shift');
        if (event.altKey) modifiers.push('alt');
        if (event.metaKey) modifiers.push('meta');

        const key = event.key;

        if (modifiers.length === 0) {
            return key;
        }

        return [...modifiers.sort(), key].join('+');
    }

    /**
     * Handle keydown event
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyDown(event) {
        if (!this.enabled) return;

        const keyString = this.getKeyString(event);
        const shortcut = this.shortcuts.get(keyString);

        if (shortcut) {
            // PHASE 1.3: Don't intercept arrow keys if notes are selected in the notation editor
            // This allows note transposition to work via arrow keys
            if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
                window.notationEditorHasSelection && window.notationEditorHasSelection()) {
                // Let the note editor handle arrow keys when notes are selected
                return;
            }

            // PHASE 1.4: Don't intercept Escape if notes are selected in the notation editor
            // This allows Escape to clear note selection highlighting
            if (event.key === 'Escape' &&
                window.notationEditorHasSelection && window.notationEditorHasSelection()) {
                // Let the note editor handle Escape when notes are selected
                return;
            }

            // PHASE 1.5: Don't intercept number keys (1-6), Shift+Arrow, or Shift+S/A/T/M when notes are selected
            // This allows the note editor to handle duration changes, insertions, and articulations
            if (window.notationEditorHasSelection && window.notationEditorHasSelection()) {
                const isNumberKey = /^[1-6]$/.test(event.key);
                const isShiftArrow = event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight');
                const isArticulationKey = event.shiftKey && /^[satmSATM]$/.test(event.key);
                const isTieKey = !event.shiftKey && /^[tT]$/.test(event.key);

                if (isNumberKey || isShiftArrow || isArticulationKey || isTieKey) {
                    // Let the note editor handle these keys when notes are selected
                    return;
                }
            }

            // Prevent default behavior for registered shortcuts
            event.preventDefault();
            event.stopPropagation();

            // Execute shortcut action
            this.executeShortcut(shortcut, event);

            // Dispatch custom event
            this.dispatchShortcutEvent(shortcut.action, shortcut.args);
        }
    }

    /**
     * Handle keyup event
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyUp(event) {
        if (!this.enabled) return;

        const keyString = this.getKeyString(event);
        const shortcut = this.shortcuts.get(keyString);

        if (shortcut && shortcut.holdable) {
            // Handle release of holdable keys (like Space for preview)
            this.dispatchShortcutEvent(`${shortcut.action}Release`, shortcut.args);
        }
    }

    /**
     * Execute a shortcut action
     * @param {Object} shortcut - Shortcut configuration
     * @param {KeyboardEvent} event - Keyboard event
     */
    executeShortcut(shortcut, event) {
        // Call the callback
        this.onShortcut(shortcut.action, shortcut.args || {}, event);
    }

    /**
     * Dispatch a custom event for the shortcut
     * @param {string} action - Action name
     * @param {Object} args - Action arguments
     */
    dispatchShortcutEvent(action, args = {}) {
        window.dispatchEvent(new CustomEvent('suggestionShortcut', {
            detail: { action, args }
        }));
    }

    /**
     * Attach keyboard event listeners
     */
    attach() {
        // Use capture phase to intercept Tab before browser's default behavior
        document.addEventListener('keydown', this.handleKeyDown, true);
        document.addEventListener('keyup', this.handleKeyUp, true);
    }

    /**
     * Detach keyboard event listeners
     */
    detach() {
        document.removeEventListener('keydown', this.handleKeyDown, true);
        document.removeEventListener('keyup', this.handleKeyUp, true);
    }

    /**
     * Enable keyboard shortcuts
     */
    enable() {
        this.enabled = true;
    }

    /**
     * Disable keyboard shortcuts
     */
    disable() {
        this.enabled = false;
    }

    /**
     * Set active element for context-aware shortcuts
     * @param {HTMLElement} element - Active element
     */
    setActiveElement(element) {
        this.activeElement = element;
    }

    /**
     * Clear active element
     */
    clearActiveElement() {
        this.activeElement = null;
    }

    /**
     * Check if handler should process event based on active element
     * @returns {boolean}
     */
    shouldProcessEvent() {
        // Don't process if typing in an input field
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
            return false;
        }

        return true;
    }

    /**
     * Get all registered shortcuts
     * @returns {Array<Object>} Array of shortcuts
     */
    getAllShortcuts() {
        return Array.from(this.shortcuts.values());
    }

    /**
     * Get shortcut by action
     * @param {string} action - Action name
     * @returns {Object|null} Shortcut configuration
     */
    getShortcutByAction(action) {
        for (const shortcut of this.shortcuts.values()) {
            if (shortcut.action === action) {
                return shortcut;
            }
        }
        return null;
    }

    /**
     * Create keyboard shortcut cheat sheet
     * @returns {string} HTML string with shortcuts
     */
    createCheatSheet() {
        const shortcuts = this.getAllShortcuts();
        const grouped = this.groupShortcutsByCategory(shortcuts);

        let html = '<div class="keyboard-shortcuts-cheat-sheet">';

        Object.entries(grouped).forEach(([category, shortcuts]) => {
            html += `<div class="shortcut-category">`;
            html += `<h3>${category}</h3>`;
            html += `<ul>`;

            shortcuts.forEach(shortcut => {
                html += `<li>`;
                html += `<span class="shortcut-key">${this.formatKeyForDisplay(shortcut.key)}</span>`;
                html += `<span class="shortcut-description">${shortcut.description}</span>`;
                html += `</li>`;
            });

            html += `</ul>`;
            html += `</div>`;
        });

        html += '</div>';
        return html;
    }

    /**
     * Group shortcuts by category
     * @param {Array} shortcuts - Shortcuts to group
     * @returns {Object} Grouped shortcuts
     */
    groupShortcutsByCategory(shortcuts) {
        const categories = {
            'Show/Hide': [],
            'Navigation': [],
            'Selection': [],
            'Actions': [],
            'Other': []
        };

        shortcuts.forEach(shortcut => {
            if (shortcut.action.includes('show') || shortcut.action.includes('dismiss')) {
                categories['Show/Hide'].push(shortcut);
            } else if (shortcut.action.includes('navigate')) {
                categories['Navigation'].push(shortcut);
            } else if (shortcut.action.includes('select')) {
                categories['Selection'].push(shortcut);
            } else if (shortcut.action.includes('apply') || shortcut.action.includes('preview')) {
                categories['Actions'].push(shortcut);
            } else {
                categories['Other'].push(shortcut);
            }
        });

        // Remove empty categories
        Object.keys(categories).forEach(key => {
            if (categories[key].length === 0) {
                delete categories[key];
            }
        });

        return categories;
    }

    /**
     * Format key for display
     * @param {string} key - Key string
     * @returns {string} Formatted key
     */
    formatKeyForDisplay(key) {
        return key
            .split('+')
            .map(part => {
                // Capitalize first letter
                return part.charAt(0).toUpperCase() + part.slice(1);
            })
            .join(' + ');
    }

    /**
     * Dispose of the handler
     */
    dispose() {
        this.detach();
        this.shortcuts.clear();
        this.activeElement = null;
        if (this.sequenceTimeout) {
            clearTimeout(this.sequenceTimeout);
        }
    }
}
