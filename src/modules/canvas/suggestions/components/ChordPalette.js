/**
 * Chord Suggestion Palette
 * Specialized palette for chord progression suggestions
 * Phase 2: Enhanced with Section Intent Selector
 */

import { FloatingPalette } from './FloatingPalette.js';
import { LayoutConstants } from '../config/SuggestionConfig.js';
import { SectionIntentSelector } from './SectionIntentSelector.js';
import {
    getSectionIntent,
    refreshInsertContext,
    needsChordSelection,
    subscribeToIntentChanges
} from '../../../state/sectionIntentState.js';

export class ChordPalette extends FloatingPalette {
    constructor(options = {}) {
        super({
            ...options,
            type: 'chord'
        });

        // Phase 2: Section intent integration
        this.sectionIntentSelector = null;
        this.progressionData = options.progressionData || [];
        this.sections = options.sections || [];
        this.onIntentChange = options.onIntentChange || (() => {});
        this.onSelectChordRequest = options.onSelectChordRequest || (() => {});

        // Subscribe to intent changes for real-time updates
        this.intentUnsubscribe = subscribeToIntentChanges((intent) => {
            this.handleIntentChange(intent);
        });
    }

    /**
     * Handle section intent changes
     * @param {Object} intent - New intent state
     */
    handleIntentChange(intent) {
        // Notify parent to refresh recommendations
        this.onIntentChange(intent);
    }

    /**
     * Override applyStyles to use wider palette for section intent selector
     */
    applyStyles() {
        // Use 'expanded' size for chord palette with section intent
        const width = LayoutConstants.PALETTE_WIDTH.expanded || 400;

        Object.assign(this.element.style, {
            position: 'absolute',
            left: `${this.position.x}px`,
            top: `${this.position.y}px`,
            width: `${width}px`,
            minHeight: `${LayoutConstants.PALETTE_MIN_HEIGHT}px`,
            maxHeight: `${LayoutConstants.PALETTE_MAX_HEIGHT + 100}px`, // Extra height for intent selector
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
     * Override renderContent to include section intent selector
     */
    renderContent() {
        this.contentElement.innerHTML = '';
        this.itemElements = [];

        // Header (title + close button)
        const header = this.createHeader();
        if (header) {
            this.contentElement.appendChild(header);
        }

        // Phase 2: Section Intent Selector (below header, above suggestions)
        this.sectionIntentSelector = new SectionIntentSelector({
            progressionData: this.progressionData,
            onIntentChange: (intent) => {
                this.onIntentChange(intent);
            },
            onSelectChordRequest: (action) => {
                this.onSelectChordRequest(action);
            }
        });
        this.contentElement.appendChild(this.sectionIntentSelector.getElement());

        // Suggestions list (only show if we don't need selection)
        if (!needsChordSelection()) {
            const list = this.createSuggestionsList();
            this.contentElement.appendChild(list);
        }

        // Footer (controls, settings)
        const footer = this.createFooter();
        if (footer) {
            this.contentElement.appendChild(footer);
        }
    }

    /**
     * Update palette with new context
     * @param {Object} options - Update options
     */
    updateContext(options = {}) {
        if (options.progressionData !== undefined) {
            this.progressionData = options.progressionData;
        }
        if (options.sections !== undefined) {
            this.sections = options.sections;
        }
        if (options.suggestions !== undefined) {
            this.suggestions = options.suggestions;
        }

        // Refresh the insert context
        refreshInsertContext(this.sections, this.progressionData.length);

        // Update the selector if it exists
        if (this.sectionIntentSelector) {
            this.sectionIntentSelector.update({
                progressionData: this.progressionData
            });
        }

        // Re-render if we have new suggestions
        if (options.suggestions !== undefined) {
            this.renderContent();
        }
    }

    /**
     * Create item content for chord suggestions
     * @param {Object} suggestion - Suggestion data
     * @returns {HTMLElement}
     */
    createItemContent(suggestion) {
        const content = document.createElement('div');
        content.className = 'suggestion-palette__item-content suggestion-palette__item-content--chord';
        content.style.flex = '1';
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.gap = '4px';

        // Top row: Chord name and confidence
        const topRow = document.createElement('div');
        topRow.style.display = 'flex';
        topRow.style.alignItems = 'center';
        topRow.style.justifyContent = 'space-between';

        // Chord name
        const chordName = document.createElement('span');
        chordName.className = 'chord-suggestion__name';
        chordName.textContent = this.formatChordName(suggestion);
        chordName.style.fontWeight = 'bold';
        chordName.style.fontSize = '14px';
        chordName.style.color = LayoutConstants.COLORS.TEXT;
        topRow.appendChild(chordName);

        // Confidence/score stars
        if (this.config?.settings?.showConfidenceScores && (suggestion.confidence !== undefined)) {
            const stars = this.createStarRating(suggestion.confidence);
            topRow.appendChild(stars);
        }

        content.appendChild(topRow);

        // Bottom row: Reason/description
        if (suggestion.reason || suggestion.description) {
            const reason = document.createElement('div');
            reason.className = 'chord-suggestion__reason';
            reason.textContent = suggestion.reason || suggestion.description;
            reason.style.fontSize = '11px';
            reason.style.color = LayoutConstants.COLORS.TEXT_SECONDARY;
            reason.style.fontStyle = 'italic';
            content.appendChild(reason);
        }

        // Inversion indicator (if applicable)
        if (suggestion.nextInversion !== undefined && suggestion.nextInversion !== 0) {
            const inversionBadge = document.createElement('span');
            inversionBadge.className = 'chord-suggestion__inversion';
            inversionBadge.textContent = this.getInversionLabel(suggestion.nextInversion);
            inversionBadge.style.fontSize = '9px';
            inversionBadge.style.padding = '1px 4px';
            inversionBadge.style.borderRadius = '2px';
            inversionBadge.style.backgroundColor = LayoutConstants.COLORS.BORDER;
            inversionBadge.style.color = LayoutConstants.COLORS.TEXT_SECONDARY;
            inversionBadge.style.marginLeft = '4px';
            chordName.appendChild(inversionBadge);
        }

        return content;
    }

    /**
     * Format chord name from suggestion data
     * @param {Object} suggestion - Suggestion data
     * @returns {string} Formatted chord name
     */
    formatChordName(suggestion) {
        const root = suggestion.nextRoot || suggestion.root || '';
        const quality = suggestion.nextChord || suggestion.chord || suggestion.type || '';

        if (!root && !quality) {
            return suggestion.name || 'Unknown';
        }

        // Handle case where root and quality are separate
        if (root && quality) {
            return `${root} ${quality}`;
        }

        // Handle case where it's already formatted
        return suggestion.name || quality || root;
    }

    /**
     * Get inversion label
     * @param {number} inversion - Inversion number
     * @returns {string} Label
     */
    getInversionLabel(inversion) {
        const labels = ['Root', '1st inv.', '2nd inv.', '3rd inv.'];
        return labels[inversion] || `${inversion} inv.`;
    }

    /**
     * Create star rating display
     * @param {number} confidence - Confidence value (0-100)
     * @returns {HTMLElement}
     */
    createStarRating(confidence) {
        const container = document.createElement('div');
        container.className = 'chord-suggestion__stars';
        container.style.display = 'flex';
        container.style.gap = '2px';

        const maxStars = 4;
        const filledStars = Math.round((confidence / 100) * maxStars);

        for (let i = 0; i < maxStars; i++) {
            const star = document.createElement('span');
            star.textContent = i < filledStars ? '★' : '☆';
            star.style.color = LayoutConstants.COLORS.ACCENT;
            star.style.fontSize = '12px';
            container.appendChild(star);
        }

        return container;
    }

    /**
     * Create header with mood and style selectors
     * @returns {HTMLElement}
     */
    createHeader() {
        const header = super.createHeader();

        // Add mood selector
        const controls = document.createElement('div');
        controls.className = 'chord-suggestion__controls';
        controls.style.marginTop = '8px';
        controls.style.display = 'flex';
        controls.style.flexDirection = 'column';
        controls.style.gap = '6px';

        // Mood selector
        const moodRow = document.createElement('div');
        moodRow.style.display = 'flex';
        moodRow.style.alignItems = 'center';
        moodRow.style.gap = '6px';

        const moodLabel = document.createElement('span');
        moodLabel.textContent = 'Mood:';
        moodLabel.style.fontSize = '11px';
        moodLabel.style.fontWeight = '500';
        moodRow.appendChild(moodLabel);

        const moodSelect = document.createElement('select');
        moodSelect.style.flex = '1';
        moodSelect.style.fontSize = '11px';
        moodSelect.style.padding = '3px';
        moodSelect.style.borderRadius = '3px';
        moodSelect.style.border = `1px solid ${LayoutConstants.COLORS.BORDER}`;

        ['Bright', 'Dark', 'Jazzy', 'Tense', 'Calm', 'Energetic'].forEach(mood => {
            const option = document.createElement('option');
            option.value = mood.toLowerCase();
            option.textContent = mood;
            moodSelect.appendChild(option);
        });

        moodSelect.onchange = (e) => {
            this.onMoodChange?.(e.target.value);
        };

        moodRow.appendChild(moodSelect);
        controls.appendChild(moodRow);

        // Style selector
        const styleRow = document.createElement('div');
        styleRow.style.display = 'flex';
        styleRow.style.alignItems = 'center';
        styleRow.style.gap = '6px';

        const styleLabel = document.createElement('span');
        styleLabel.textContent = 'Style:';
        styleLabel.style.fontSize = '11px';
        styleLabel.style.fontWeight = '500';
        styleRow.appendChild(styleLabel);

        const styleSelect = document.createElement('select');
        styleSelect.style.flex = '1';
        styleSelect.style.fontSize = '11px';
        styleSelect.style.padding = '3px';
        styleSelect.style.borderRadius = '3px';
        styleSelect.style.border = `1px solid ${LayoutConstants.COLORS.BORDER}`;

        ['Balanced', 'Pop', 'Jazz', 'Classical', 'Rock', 'Indie'].forEach(style => {
            const option = document.createElement('option');
            option.value = style.toLowerCase();
            option.textContent = style;
            styleSelect.appendChild(option);
        });

        styleSelect.onchange = (e) => {
            this.onStyleChange?.(e.target.value);
        };

        styleRow.appendChild(styleSelect);
        controls.appendChild(styleRow);

        header.appendChild(controls);

        return header;
    }

    /**
     * Override hover to show hold-to-preview hint
     * @param {number} index - Item index
     */
    hoverItem(index) {
        super.hoverItem(index);

        // Add visual hint for hold-to-preview
        const item = this.itemElements[index];
        if (item && !item.querySelector('.preview-hint')) {
            const hint = document.createElement('span');
            hint.className = 'preview-hint';
            hint.textContent = 'Hold to preview';
            hint.style.fontSize = '9px';
            hint.style.color = LayoutConstants.COLORS.TEXT_SECONDARY;
            hint.style.fontStyle = 'italic';
            hint.style.marginTop = '2px';
            item.querySelector('.suggestion-palette__item-content')?.appendChild(hint);

            // Remove hint after a moment
            setTimeout(() => {
                hint?.remove();
            }, 2000);
        }
    }

    /**
     * Override dispose to clean up subscriptions
     */
    dispose() {
        // Clean up intent subscription
        if (this.intentUnsubscribe) {
            this.intentUnsubscribe();
            this.intentUnsubscribe = null;
        }

        // Clean up section intent selector
        if (this.sectionIntentSelector) {
            this.sectionIntentSelector.dispose();
            this.sectionIntentSelector = null;
        }

        // Call parent dispose
        super.dispose();
    }
}
