/**
 * Melody Suggestion Palette
 * Specialized palette for melody note suggestions
 */

import { FloatingPalette } from './FloatingPalette.js';
import { LayoutConstants } from '../config/SuggestionConfig.js';

export class MelodyPalette extends FloatingPalette {
    // Initialize these properties before constructor runs
    activeFilters = new Set(['All']);  // Track multiple active filters
    filterButtons = {};
    selectedStyle = 'any';  // Track selected style

    constructor(options = {}) {
        super({
            ...options,
            type: 'melody'
        });
        this.onStyleChange = options.onStyleChange || (() => {});
    }

    /**
     * Create item content for melody suggestions
     * @param {Object} suggestion - Suggestion data
     * @returns {HTMLElement}
     */
    createItemContent(suggestion) {
        const content = document.createElement('
        content.className = 'suggestion-palette__item-content suggestion-palette__item-content--melody';
        content.style.flex = '1';
        content.style.display = 'flex';
        content.style.alignItems = 'center';
        content.style.justifyContent = 'space-between';

        // Left side: Note name and category
        const leftSide = document.createElement('
        leftSide.style.display = 'flex';
        leftSide.style.alignItems = 'center';
        leftSide.style.gap = '8px';

        // Note name
        const noteName = document.createElement('
        noteName.className = 'melody-suggestion__note';
        noteName.textContent = suggestion.note || suggestion.pitch || 'Unknown';
        noteName.style.fontWeight = 'bold';
        noteName.style.fontSize = '14px';
        noteName.style.color = LayoutConstants.COLORS.TEXT;
        leftSide.appendChild(noteName);

        // Category badge
        if (suggestion.category || suggestion.type) {
            const category = document.createElement('
            category.className = 'melody-suggestion__category';
            category.textContent = suggestion.category || suggestion.type;
            category.style.fontSize = '10px';
            category.style.padding = '2px 6px';
            category.style.borderRadius = '3px';
            category.style.backgroundColor = this.getCategoryColor(suggestion.category || suggestion.type);
            category.style.color = '#fff';
            leftSide.appendChild(category);
        }

        content.appendChild(leftSide);

        // Right side: Score/confidence indicator
        const rightSide = document.createElement('
        rightSide.style.display = 'flex';
        rightSide.style.alignItems = 'center';
        rightSide.style.gap = '4px';

        if (this.config?.settings?.showConfidenceScores && (suggestion.score !== undefined || suggestion.confidence !== undefined)) {
            const score = suggestion.score || suggestion.confidence || 0;
            const scoreDisplay = this.createScoreDisplay(score);
            rightSide.appendChild(scoreDisplay);
        }

        content.appendChild(rightSide);

        // Description tooltip (optional)
        if (suggestion.description || suggestion.reason) {
            content.title = suggestion.description || suggestion.reason;
        }

        return content;
    }

    /**
     * Create score display (dots or percentage)
     * @param {number} score - Score value (0-100)
     * @returns {HTMLElement}
     */
    createScoreDisplay(score) {
        const container = document.createElement('
        container.className = 'melody-suggestion__score';
        container.style.display = 'flex';
        container.style.gap = '2px';

        // Convert score to 5-dot scale
        const maxDots = 5;
        const filledDots = Math.round((score / 100) * maxDots);

        for (let i = 0; i < maxDots; i++) {
            const dot = document.createElement('
            dot.className = 'score-dot';
            dot.style.width = '6px';
            dot.style.height = '6px';
            dot.style.borderRadius = '50%';
            dot.style.backgroundColor = i < filledDots ?
                LayoutConstants.COLORS.ACCENT :
                LayoutConstants.COLORS.BORDER;
            container.appendChild(dot);
        }

        return container;
    }

    /**
     * Get color for note category
     * @param {string} category - Note category
     * @returns {string} Color code
     */
    getCategoryColor(category) {
        const colors = {
            'Chord Tone': '#4CAF50',
            'chordTone': '#4CAF50',
            'Scale Tone': '#2196F3',
            'scaleTone': '#2196F3',
            'Stepwise': '#9C27B0',
            'stepwiseMotion': '#9C27B0',
            'Approach': '#FF9800',
            'approachTone': '#FF9800',
            'Passing': '#FFC107',
            'passingTone': '#FFC107',
            'Tension': '#F44336',
            'tension': '#F44336',
            'Avoid': '#757575',
            'avoid': '#757575'
        };

        return colors[category] || LayoutConstants.COLORS.ACCENT;
    }

    /**
     * Create enhanced header with filter options
     * @returns {HTMLElement}
     */
    createHeader() {
        const header = super.createHeader();

        // Initialize filterButtons if not already initialized
        if (!this.filterButtons) {
            this.filterButtons = {};
        }
        if (!this.activeFilters) {
            this.activeFilters = new Set(['All']);
        }

        // Make header a column layout to avoid crowding
        header.style.flexDirection = 'column';
        header.style.alignItems = 'stretch';
        header.style.gap = '0';

        // Wrap existing title and close button in a row
        const titleRow = document.createElement('
        titleRow.style.display = 'flex';
        titleRow.style.flexDirection = 'row';
        titleRow.style.justifyContent = 'space-between';
        titleRow.style.alignItems = 'center';
        titleRow.style.width = '100%';
        titleRow.style.marginBottom = '8px';

        // Move title and close button into the title row
        const title = header.querySelector('.suggestion-palette__
        const closeBtn = header.querySelector('.suggestion-palette__
        if (title) titleRow.appendChild(title);
        if (closeBtn) titleRow.appendChild(closeBtn);

        // Clear header and add title row first
        while (header.firstChild) {
            header.removeChild(header.firstChild);
        }
        header.appendChild(titleRow);

        // Add quick filter buttons (if configured)
        if (this.config?.settings?.showCategories) {
            const filterContainer = document.createElement('
            filterContainer.className = 'melody-suggestion__filters';
            filterContainer.style.display = 'flex';
            filterContainer.style.gap = '6px';
            filterContainer.style.flexWrap = 'wrap';
            filterContainer.style.paddingTop = '8px';
            filterContainer.style.borderTop = '1px solid #e5e7eb';

            const categories = ['All', 'Chord Tones', 'Scale', 'Passing'];
            categories.forEach(cat => {
                const btn = document.createElement('
                btn.textContent = cat;
                btn.dataset.category = cat;

                // Better contrast styling
                const isActive = this.activeFilters.has(cat);
                Object.assign(btn.style, {
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: '600',
                    border: '2px solid #e5e7eb',
                    borderRadius: '4px',
                    backgroundColor: isActive ? '#4a9eff' : '#fff',
                    color: isActive ? '#fff' : '#1f2937',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap'
                });

                btn.onclick = () => this.filterByCategory(cat);
                this.filterButtons[cat] = btn;
                filterContainer.appendChild(btn);
            });

            header.appendChild(filterContainer);
        }

        return header;
    }

    /**
     * Filter suggestions by category (multi-select)
     * @param {string} category - Category to filter by
     */
    filterByCategory(category) {
        const specificCategories = ['Chord Tones', 'Scale', 'Passing'];

        if (category === 'All') {
            // Clicking "All"
            if (this.activeFilters.has('All')) {
                // "All" is already selected - deselect everything
                this.activeFilters.clear();
            } else {
                // "All" is not selected - select all categories
                this.activeFilters.clear();
                this.activeFilters.add('A
                specificCategories.forEach(cat => this.activeFilters.add(cat));
            }
        } else {
            // Clicking a specific category
            if (this.activeFilters.has(category)) {
                // Already selected - deselect it
                this.activeFilters.delete(category);
                // Always deselect "All" when deselecting any specific category
                this.activeFilters.delete('A
            } else {
                // Not selected - select it
                this.activeFilters.add(category);
                // If "All" was selected but we're toggling a specific one, deselect "All" first
                // Then add this category back (since clicking when All is active means "show only this one")
                if (this.activeFilters.has('All')) {
                    // User clicked a specific category while "All" was active
                    // Clear everything and select only this category
                    this.activeFilters.clear();
                    this.activeFilters.add(category);
                } else {
                    // Check if all specific categories are now selected
                    const allSpecificSelected = specificCategories.every(cat => this.activeFilters.has(cat));
                    if (allSpecificSelected) {
                        this.activeFilters.add('A
                    }
                }
            }
        }

        // Update button styles
        Object.entries(this.filterButtons).forEach(([cat, btn]) => {
            const isActive = this.activeFilters.has(cat);
            btn.style.backgroundColor = isActive ? '#4a9eff' : '#fff';
            btn.style.color = isActive ? '#fff' : '#1f2937';
            btn.style.borderColor = isActive ? '#4a9eff' : '#e5e7eb';
        });

        // Filter the items
        this.itemElements.forEach((item, index) => {
            const suggestion = this.suggestions[index];
            const itemCategory = suggestion.category || suggestion.type || '';

            let shouldShow = false;

            // If no filters active, show nothing
            if (this.activeFilters.size === 0) {
                shouldShow = false;
            } else {
                const catLower = itemCategory.toLowerCase();

                // Check each active filter
                for (const activeFilter of this.activeFilters) {
                    if (activeFilter === 'All') {
                        continue;  // Skip 'All', check specific categories
                    }

                    if (activeFilter === 'Chord Tones') {
                        if (catLower.includes('chord') || suggestion.isChordTone === true) {
                            shouldShow = true;
                            break;
                        }
                    } else if (activeFilter === 'Scale') {
                        // Scale tones include chord tones (since chord tones are in the scale)
                        if (catLower.includes('scale') || suggestion.isScaleTone === true) {
                            shouldShow = true;
                            break;
                        }
                    } else if (activeFilter === 'Passing') {
                        if (catLower.includes('passing') || catLower.includes('approach') || catLower.includes('neighbor')) {
                            shouldShow = true;
                            break;
                        }
                    }
                }
            }

            item.style.display = shouldShow ? 'flex' : 'none';
        });
    }

    /**
     * Create footer with additional controls
     * @returns {HTMLElement}
     */
    createFooter() {
        const footer = super.createFooter();

        // Add style selector if configured
        const styleSelector = document.createElement('
        styleSelector.style.marginTop = '4px';
        styleSelector.style.fontSize = '10px';

        const label = document.createElement('
        label.textContent = 'Style: ';
        label.style.marginRight = '6px';
        label.style.fontWeight = '600';
        label.style.color = '#1f2937';  // Better contrast
        styleSelector.appendChild(label);

        const select = document.createElement('
        Object.assign(select.style, {
            fontSize: '11px',
            padding: '3px 6px',
            borderRadius: '3px',
            border: '1px solid #d1d5db',
            backgroundColor: '#fff',
            color: '#1f2937',
            cursor: 'pointer'
        });

        ['Any', 'Pop', 'Jazz', 'Classical', 'Rock'].forEach(style => {
            const option = document.createElement('
            option.value = style.toLowerCase();
            option.textContent = style;
            select.appendChild(option);
        });

        // Set the currently selected style
        select.value = this.selectedStyle;

        // Add onchange handler
        select.onchange = (e) => {
            this.selectedStyle = e.target.value;  // Store the selected style
            this.onStyleChange?.(e.target.value);
        };

        styleSelector.appendChild(select);
        footer.appendChild(styleSelector);

        return footer;
    }
}
