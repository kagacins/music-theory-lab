/**
 * Floating Palette Component
 * Base class for suggestion palette UI
 * @version 1.1.0 - Updated 2024-11-23 with close button and positioning fixes
 */

import { LayoutConstants, SuggestionEvents } from '../config/SuggestionConfig.js';

export class FloatingPalette {
    constructor(options = {}) {
        this.id = `palette-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.type = options.type || 'generic'; // 'melody' or 'chord'
        this.position = options.position || { x: 0, y: 0 };
        this.suggestions = options.suggestions || [];
        this.config = options.config;

        // Callbacks
        this.onSelect = options.onSelect || (() => {});
        this.onPreview = options.onPreview || (() => {});
        this.onDismiss = options.onDismiss || (() => {});
        this.onExpand = options.onExpand || (() => {});

        // State
        this.selectedIndex = 0;
        this.isVisible = false;
        this.isExpanded = false;
        this.previewActive = false;

        // DOM elements
        this.element = null;
        this.contentElement = null;
        this.itemElements = [];

        // Create the palette element
        this.createElement();
        this.attachEventHandlers();
    }

    /**
     * Create the palette DOM element
     */
    createElement() {
        this.element = document.createElement('div');
        this.element.className = `suggestion-palette suggestion-palette--${this.type}`;
        this.element.id = this.id;
        this.element.setAttribute('role', 'listbox');
        this.element.setAttribute('aria-label', `${this.type} suggestions`);

        // Apply styling
        this.applyStyles();

        // Create content
        this.contentElement = document.createElement('div');
        this.contentElement.className = 'suggestion-palette__content';
        this.element.appendChild(this.contentElement);

        // Render content
        this.renderContent();
    }

    /**
     * Apply styles to the palette
     */
    applyStyles() {
        const config = this.config?.settings || {};
        const size = config.paletteSize || 'medium';
        const width = LayoutConstants.PALETTE_WIDTH[size];

        Object.assign(this.element.style, {
            position: 'absolute',
            left: `${this.position.x}px`,
            top: `${this.position.y}px`,
            width: `${width}px`,
            minHeight: `${LayoutConstants.PALETTE_MIN_HEIGHT}px`,
            maxHeight: `${LayoutConstants.PALETTE_MAX_HEIGHT}px`,
            backgroundColor: LayoutConstants.COLORS.BACKGROUND,
            border: `1px solid ${LayoutConstants.COLORS.BORDER}`,
            borderRadius: `${LayoutConstants.BORDER_RADIUS}px`,
            boxShadow: LayoutConstants.SHADOW,
            zIndex: LayoutConstants.Z_INDEX.PALETTE,
            opacity: '0',
            transform: 'scale(0.95)',
            transition: `opacity ${LayoutConstants.ANIMATION.FADE_IN}ms ease-out, transform ${LayoutConstants.ANIMATION.FADE_IN}ms ease-out`,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        });
    }

    /**
     * Render the palette content
     */
    renderContent() {
        this.contentElement.innerHTML = '';
        this.itemElements = [];

        // Header
        const header = this.createHeader();
        if (header) {
            this.contentElement.appendChild(header);
        }

        // Suggestions list
        const list = this.createSuggestionsList();
        this.contentElement.appendChild(list);

        // Footer (controls, settings)
        const footer = this.createFooter();
        if (footer) {
            this.contentElement.appendChild(footer);
        }
    }

    /**
     * Create header element
     * @returns {HTMLElement|null}
     */
    createHeader() {
        const header = document.createElement('div');
        header.className = 'suggestion-palette__header';

        // CRITICAL: Force flexbox layout with inline styles
        Object.assign(header.style, {
            padding: `${LayoutConstants.PADDING}px`,
            borderBottom: `1px solid ${LayoutConstants.COLORS.BORDER}`,
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            boxSizing: 'border-box'
        });

        const title = document.createElement('div');
        title.className = 'suggestion-palette__title';
        title.textContent = `${this.type.charAt(0).toUpperCase() + this.type.slice(1)} Suggestions`;

        // CRITICAL: Title takes all available space, pushing close button to right
        Object.assign(title.style, {
            fontWeight: 'bold',
            fontSize: '14px',
            color: LayoutConstants.COLORS.TEXT,
            flex: '1',
            textAlign: 'left',
            minWidth: '0'  // Allow flex shrinking
        });

        // Close button
        const closeButton = document.createElement('button');
        closeButton.className = 'suggestion-palette__close';
        closeButton.innerHTML = '&times;';
        closeButton.setAttribute('aria-label', 'Close suggestions');
        closeButton.title = 'Close (Esc)';
        Object.assign(closeButton.style, {
            background: 'none',
            border: 'none',
            fontSize: '24px',
            lineHeight: '1',
            cursor: 'pointer',
            color: LayoutConstants.COLORS.TEXT_MUTED,
            padding: '0 4px',
            marginLeft: '8px',
            flexShrink: '0',  // Don't shrink the close button
            transition: 'color 150ms ease'
        });

        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hide();
            this.onDismiss();
        });

        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.color = LayoutConstants.COLORS.TEXT;
        });

        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.color = LayoutConstants.COLORS.TEXT_MUTED;
        });

        header.appendChild(title);
        header.appendChild(closeButton);

        return header;
    }

    /**
     * Create suggestions list
     * @returns {HTMLElement}
     */
    createSuggestionsList() {
        const list = document.createElement('div');
        list.className = 'suggestion-palette__list';
        list.style.flex = '1';
        list.style.overflowY = 'auto';
        list.style.padding = `${LayoutConstants.PADDING / 2}px`;

        this.suggestions.forEach((suggestion, index) => {
            const item = this.createSuggestionItem(suggestion, index);
            list.appendChild(item);
            this.itemElements.push(item);
        });

        return list;
    }

    /**
     * Create a single suggestion item
     * @param {Object} suggestion - Suggestion data
     * @param {number} index - Item index
     * @returns {HTMLElement}
     */
    createSuggestionItem(suggestion, index) {
        const item = document.createElement('div');
        item.className = 'suggestion-palette__item';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', index === this.selectedIndex);
        item.dataset.index = index;

        // Styling with inline critical CSS as fallback
        Object.assign(item.style, {
            padding: `${LayoutConstants.PADDING / 2}px ${LayoutConstants.PADDING}px`,
            margin: `${LayoutConstants.ITEM_SPACING / 2}px 0`,
            borderRadius: `${LayoutConstants.BORDER_RADIUS / 2}px`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: '48px',  // FIXED HEIGHT to prevent resizing
            boxSizing: 'border-box',
            // Critical CSS for outline-based highlighting (inline fallback)
            transition: 'outline 0.15s ease, outline-offset 0.15s ease',
            outline: index === this.selectedIndex ? '2px solid #4a9eff' : '2px solid transparent',
            outlineOffset: '-2px',
            backgroundColor: 'transparent'  // NO background color, only outline
        });

        // Number indicator
        if (index < 9 && this.config?.settings?.quickSelectNumbers) {
            const number = document.createElement('span');
            number.className = 'suggestion-palette__number';
            number.textContent = index + 1;
            number.style.marginRight = '8px';
            number.style.fontWeight = 'bold';
            number.style.color = LayoutConstants.COLORS.ACCENT;
            number.style.minWidth = '16px';
            item.appendChild(number);
        }

        // Main content (to be implemented by subclasses)
        const content = this.createItemContent(suggestion);
        item.appendChild(content);


        return item;
    }

    /**
     * Create item content (to be overridden by subclasses)
     * @param {Object} suggestion - Suggestion data
     * @returns {HTMLElement}
     */
    createItemContent(suggestion) {
        const content = document.createElement('div');
        content.className = 'suggestion-palette__item-content';
        content.style.flex = '1';
        content.textContent = JSON.stringify(suggestion);
        return content;
    }

    /**
     * Create footer element
     * @returns {HTMLElement|null}
     */
    createFooter() {
        const footer = document.createElement('div');
        footer.className = 'suggestion-palette__footer';
        footer.style.padding = `${LayoutConstants.PADDING / 2}px ${LayoutConstants.PADDING}px`;
        footer.style.borderTop = `1px solid ${LayoutConstants.COLORS.BORDER}`;
        footer.style.fontSize = '12px';
        footer.style.color = '#999';  // Light gray text for better readability on light background
        footer.style.fontWeight = '400';
        footer.style.display = 'flex';
        footer.style.justifyContent = 'space-between';

        footer.innerHTML = `
            <span>Press 1-${Math.min(this.suggestions.length, 9)} or click</span>
            <span>ESC to dismiss</span>
        `;

        return footer;
    }

    /**
     * Attach event handlers
     */
    attachEventHandlers() {
        // Click on items
        this.element.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-palette__item');
            if (item) {
                const index = parseInt(item.dataset.index);
                this.selectItem(index);
            }
        });

        // Hover on items
        this.element.addEventListener('mouseover', (e) => {
            const item = e.target.closest('.suggestion-palette__item');
            if (item) {
                const index = parseInt(item.dataset.index);
                this.hoverItem(index);
                // Apply hover styles inline - OUTLINE ONLY, no background
                item.style.outlineColor = 'rgba(74, 158, 255, 0.5)';
                item.style.backgroundColor = 'transparent';
            }
        });

        // Mouse out from items
        this.element.addEventListener('mouseout', (e) => {
            const item = e.target.closest('.suggestion-palette__item');
            if (item) {
                const index = parseInt(item.dataset.index);
                // Reset to default or selected state - OUTLINE ONLY, no background
                if (index === this.selectedIndex) {
                    item.style.outlineColor = '#4a9eff';
                    item.style.backgroundColor = 'transparent';
                } else {
                    item.style.outlineColor = 'transparent';
                    item.style.backgroundColor = 'transparent';
                }
            }
        });

        // Mouse leave
        this.element.addEventListener('mouseleave', () => {
            this.clearPreview();
        });
    }

    /**
     * Show the palette
     * @param {boolean} animate - Whether to animate
     */
    show(animate = true) {
        if (this.isVisible) return;

        // Add to DOM if not already
        if (!this.element.parentElement) {
            document.body.appendChild(this.element);
        }

        // Force reflow
        this.element.offsetHeight;

        // Show with animation
        requestAnimationFrame(() => {
            this.element.style.opacity = '1';
            this.element.style.transform = 'scale(1)';
        });

        this.isVisible = true;

        // Dispatch event
        this.dispatchEvent(SuggestionEvents.PALETTE_OPENED, { id: this.id, type: this.type });

        // Announce to screen readers
        if (this.config?.settings?.announceToScreenReader) {
            this.announce(`${this.type} suggestions palette opened. ${this.suggestions.length} suggestions available.`);
        }
    }

    /**
     * Hide the palette
     * @param {boolean} animate - Whether to animate
     */
    hide(animate = true) {
        if (!this.isVisible) return;

        this.element.style.opacity = '0';
        this.element.style.transform = 'scale(0.95)';

        // Remove from DOM after animation
        setTimeout(() => {
            if (this.element.parentElement) {
                this.element.parentElement.removeChild(this.element);
            }
        }, LayoutConstants.ANIMATION.FADE_OUT);

        this.isVisible = false;

        // Dispatch event
        this.dispatchEvent(SuggestionEvents.PALETTE_CLOSED, { id: this.id, type: this.type });
    }

    /**
     * Update palette position
     * @param {Object} position - New position {x, y}
     * @param {boolean} animate - Whether to animate
     */
    updatePosition(position, animate = false) {
        this.position = position;

        if (animate) {
            this.element.style.transition = `left ${LayoutConstants.ANIMATION.SLIDE}ms ease, top ${LayoutConstants.ANIMATION.SLIDE}ms ease`;
        } else {
            this.element.style.transition = '';
        }

        this.element.style.left = `${position.x}px`;
        this.element.style.top = `${position.y}px`;

        // Reset transition
        setTimeout(() => {
            this.element.style.transition = `opacity ${LayoutConstants.ANIMATION.FADE_IN}ms ease-out, transform ${LayoutConstants.ANIMATION.FADE_IN}ms ease-out`;
        }, animate ? LayoutConstants.ANIMATION.SLIDE : 0);
    }

    /**
     * Select an item by index
     * @param {number} index - Item index
     */
    selectItem(index) {
        if (index < 0 || index >= this.suggestions.length) return;

        this.selectedIndex = index;
        const suggestion = this.suggestions[index];

        // Update UI
        this.updateSelectedState();

        // Call callback
        this.onSelect(suggestion, index);

        // Dispatch event
        this.dispatchEvent(SuggestionEvents.SUGGESTION_SELECTED, { suggestion, index });

        // Hide if configured
        if (this.config?.settings?.dismissOnSelection) {
            this.hide();
        }
    }

    /**
     * Hover an item (trigger preview)
     * @param {number} index - Item index
     */
    hoverItem(index) {
        if (index < 0 || index >= this.suggestions.length) return;
        if (!this.config?.settings?.previewOnHover) return;

        this.selectedIndex = index;
        const suggestion = this.suggestions[index];

        // Update UI
        this.updateSelectedState();

        // Call preview callback
        this.onPreview(suggestion, index);
        this.previewActive = true;

        // Dispatch event
        this.dispatchEvent(SuggestionEvents.SUGGESTION_PREVIEWED, { suggestion, index });
    }

    /**
     * Clear preview
     */
    clearPreview() {
        if (this.previewActive) {
            this.onPreview(null, -1);
            this.previewActive = false;
        }
    }

    /**
     * Update selected state in UI
     */
    updateSelectedState() {
        this.itemElements.forEach((item, index) => {
            const isSelected = index === this.selectedIndex;
            item.setAttribute('aria-selected', isSelected);
            item.style.backgroundColor = isSelected ?
                LayoutConstants.COLORS.SELECTED :
                'transparent';
        });
    }

    /**
     * Navigate to next item
     */
    navigateNext() {
        this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
        this.updateSelectedState();
        this.scrollToSelected();
    }

    /**
     * Navigate to previous item
     */
    navigatePrevious() {
        this.selectedIndex = (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
        this.updateSelectedState();
        this.scrollToSelected();
    }

    /**
     * Scroll to selected item
     */
    scrollToSelected() {
        if (this.itemElements[this.selectedIndex]) {
            this.itemElements[this.selectedIndex].scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            });
        }
    }

    /**
     * Update suggestions
     * @param {Array} suggestions - New suggestions
     */
    updateSuggestions(suggestions) {
        this.suggestions = suggestions;
        this.selectedIndex = 0;
        this.renderContent();
    }

    /**
     * Dispatch a custom event
     * @param {string} eventName - Event name
     * @param {Object} detail - Event detail
     */
    dispatchEvent(eventName, detail) {
        window.dispatchEvent(new CustomEvent(eventName, {
            detail: { ...detail, paletteId: this.id }
        }));
    }

    /**
     * Announce to screen reader
     * @param {string} message - Message to announce
     */
    announce(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.style.position = 'absolute';
        announcement.style.left = '-10000px';
        announcement.textContent = message;

        document.body.appendChild(announcement);

        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    /**
     * Get palette bounds
     * @returns {Object} Bounds {left, right, top, bottom}
     */
    getBounds() {
        if (!this.element) return null;

        const rect = this.element.getBoundingClientRect();
        return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
        };
    }

    /**
     * Dispose of the palette
     */
    dispose() {
        this.hide(false);
        this.element = null;
        this.contentElement = null;
        this.itemElements = [];
        this.suggestions = [];
    }
}
