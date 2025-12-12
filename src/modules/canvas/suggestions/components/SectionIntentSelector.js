/**
 * Section Intent Selector Component
 * Phase 2: Section Context Integration
 *
 * UI component for selecting section intent when adding chords.
 * Embedded in the ChordPalette to give users control over:
 * - Continue current section (with sub-options: building, concluding, final)
 * - Start new section (with section type selection)
 */

import { LayoutConstants } from '../config/SuggestionConfig.js';
import {
    getSectionIntent,
    setSectionIntent,
    getSectionIntentMode,
    setSectionIntentMode,
    getContinueSubMode,
    setContinueSubMode,
    getNewSectionType,
    setNewSectionType,
    getInsertAfterIndex,
    getTargetSection,
    needsChordSelection,
    getIntentDescription,
    INTENT_MODES,
    CONTINUE_SUBMODES
} from '../../../state/sectionIntentState.js';
import { SECTION_TYPE_LIST } from '../../../features/sectionProfiles.js';

/**
 * Section type labels for display
 */
const SECTION_TYPE_LABELS = {
    intro: 'Intro',
    verse: 'Verse',
    prechorus: 'Pre-Chorus',
    chorus: 'Chorus',
    bridge: 'Bridge',
    interlude: 'Interlude',
    solo: 'Solo',
    breakdown: 'Breakdown',
    outro: 'Outro',
    custom: 'Custom'
};

/**
 * Continue sub-mode labels
 */
const CONTINUE_SUBMODE_LABELS = {
    building: 'Continue building',
    concluding: 'Work toward conclusion',
    final: 'Conclude section'
};

/**
 * Section Intent Selector Class
 */
export class SectionIntentSelector {
    constructor(options = {}) {
        this.onIntentChange = options.onIntentChange || (() => {});
        this.onSelectChordRequest = options.onSelectChordRequest || (() => {});
        this.progressionData = options.progressionData || [];

        this.element = null;
        this.createElement();
    }

    /**
     * Create the selector DOM element
     */
    createElement() {
        this.element = document.createElement('
        this.element.className = 'section-intent-selector';

        Object.assign(this.element.style, {
            padding: `${LayoutConstants.PADDING}px`,
            borderBottom: `1px solid ${LayoutConstants.COLORS.BORDER}`,
            backgroundColor: '#fafafa',
            fontSize: '12px'
        });

        this.render();
    }

    /**
     * Render the selector content
     */
    render() {
        const intent = getSectionIntent();

        this.element.innerHTML = '';

        // If needs selection, show prompt
        if (intent.needsSelection) {
            this.renderSelectionPrompt();
            return;
        }

        // Section header
        const header = this.createHeader();
        this.element.appendChild(header);

        // Insert position indicator
        const insertIndicator = this.createInsertIndicator();
        this.element.appendChild(insertIndicator);

        // Mode selector (Continue vs New)
        const modeSelector = this.createModeSelector();
        this.element.appendChild(modeSelector);

        // Sub-options based on mode
        if (intent.mode === INTENT_MODES.CONTINUE) {
            const continueOptions = this.createContinueOptions();
            this.element.appendChild(continueOptions);
        } else {
            const newSectionOptions = this.createNewSectionOptions();
            this.element.appendChild(newSectionOptions);
        }
    }

    /**
     * Create section header
     */
    createHeader() {
        const header = document.createElement('
        header.className = 'section-intent-selector__header';

        Object.assign(header.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px'
        });

        const title = document.createElement('
        title.textContent = 'Section Context';
        title.style.fontWeight = '600';
        title.style.color = LayoutConstants.COLORS.TEXT;

        // Help icon/tooltip
        const helpIcon = document.createElement('
        helpIcon.textContent = '?';
        helpIcon.title = 'Choose how the next chord relates to your song structure';
        Object.assign(helpIcon.style, {
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: LayoutConstants.COLORS.BORDER,
            color: LayoutConstants.COLORS.TEXT_SECONDARY,
            fontSize: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'help'
        });

        header.appendChild(title);
        header.appendChild(helpIcon);

        return header;
    }

    /**
     * Create insert position indicator
     */
    createInsertIndicator() {
        const container = document.createElement('
        container.className = 'section-intent-selector__insert-indicator';

        Object.assign(container.style, {
            padding: '6px 8px',
            marginBottom: '8px',
            backgroundColor: '#e8f4fd',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#0066cc'
        });

        const intent = getSectionIntent();
        const insertAfterIndex = intent.insertAfterIndex;

        if (insertAfterIndex === -1) {
            // Inserting at beginning (empty progression)
            container.innerHTML = '<strong>Starting new progression</strong>';
        } else if (insertAfterIndex !== null) {
            // Get chord info
            const chord = this.progressionData[insertAfterIndex];
            const chordName = chord ? `${chord.root} ${chord.type}` : `Chord ${insertAfterIndex + 1}`;

            container.innerHTML = `Inserting after: <strong>${chordName}</strong> (position ${insertAfterIndex + 1})`;

            // Show section info if available
            if (intent.targetSection) {
                container.innerHTML += ` <span style="color: #666;">in ${intent.targetSection.label}</span>`;
            }
        }

        return container;
    }

    /**
     * Create mode selector (Continue vs New Section)
     */
    createModeSelector() {
        const container = document.createElement('
        container.className = 'section-intent-selector__mode';

        Object.assign(container.style, {
            display: 'flex',
            gap: '8px',
            marginBottom: '8px'
        });

        const currentMode = getSectionIntentMode();

        // Continue button
        const continueBtn = this.createModeButton(
            'Continue Section',
            INTENT_MODES.CONTINUE,

        // New Section button
        const newBtn = this.createModeButton(
            'New Section',
            INTENT_MODES.NEW_SECTION,

        container.appendChild(continueBtn);
        container.appendChild(newBtn);

        return container;
    }

    /**
     * Create a mode button
     */
    createModeButton(label, mode, isActive) {
        const button = document.createElement('
        button.className = `section-intent-selector__mode-btn ${isActive ? 'active' : ''}`;
        button.textContent = label;

        Object.assign(button.style, {
            flex: '1',
            padding: '6px 10px',
            border: `1px solid ${isActive ? LayoutConstants.COLORS.ACCENT : LayoutConstants.COLORS.BORDER}`,
            borderRadius: '4px',
            backgroundColor: isActive ? LayoutConstants.COLORS.ACCENT : 'white',
            color: isActive ? 'white' : LayoutConstants.COLORS.TEXT,
            fontSize: '11px',
            fontWeight: isActive ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
        });

        button.addEventListener('mouseenter', () => {
            if (!isActive) {
                button.style.borderColor = LayoutConstants.COLORS.ACCENT;
                button.style.backgroundColor = '#f0f8ff';
            }
        });

        button.addEventListener('mouseleave', () => {
            if (!isActive) {
                button.style.borderColor = LayoutConstants.COLORS.BORDER;
                button.style.backgroundColor = 'white';
            }
        });

        button.addEventListener('click', () => {
            setSectionIntentMode(mode);
            this.render();
            this.onIntentChange(getSectionIntent());
        });

        return button;
    }

    /**
     * Create continue section options
     */
    createContinueOptions() {
        const container = document.createElement('
        container.className = 'section-intent-selector__continue-options';

        Object.assign(container.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            paddingLeft: '4px'
        });

        const currentSubMode = getContinueSubMode();

        Object.entries(CONTINUE_SUBMODE_LABELS).forEach(([value, label]) => {
            const option = this.createRadioOption(
                'continue-submode',
                value,
                label,
                currentSubMode === value,
                () => {
                    setContinueSubMode(value);
                    this.onIntentChange(getSectionIntent());
                }
            );
            container.appendChild(option);
        });

        // Show current section info
        const intent = getSectionIntent();
        if (intent.targetSection) {
            const sectionInfo = document.createElement('
            sectionInfo.style.marginTop = '6px';
            sectionInfo.style.fontSize = '10px';
            sectionInfo.style.color = LayoutConstants.COLORS.TEXT_SECONDARY;
            sectionInfo.innerHTML = `Current section: <strong>${intent.targetSection.label}</strong> (${intent.targetSection.chordIndices.length} chords)`;
            container.appendChild(sectionInfo);
        } else if (intent.ungroupedRange) {
            const rangeInfo = document.createElement('
            rangeInfo.style.marginTop = '6px';
            rangeInfo.style.fontSize = '10px';
            rangeInfo.style.color = LayoutConstants.COLORS.TEXT_SECONDARY;
            rangeInfo.innerHTML = `Ungrouped chords: positions ${intent.ungroupedRange.startIndex + 1}-${intent.ungroupedRange.endIndex + 1}`;
            container.appendChild(rangeInfo);
        }

        return container;
    }

    /**
     * Create new section options
     */
    createNewSectionOptions() {
        const container = document.createElement('
        container.className = 'section-intent-selector__new-options';

        Object.assign(container.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            paddingLeft: '4px'
        });

        // Section type label
        const label = document.createElement('
        label.textContent = 'Section type:';
        label.style.fontSize = '11px';
        label.style.fontWeight = '500';
        label.style.color = LayoutConstants.COLORS.TEXT_SECONDARY;

        // Section type dropdown
        const select = document.createElement('
        select.className = 'section-intent-selector__type-select';

        Object.assign(select.style, {
            padding: '6px 8px',
            fontSize: '12px',
            border: `1px solid ${LayoutConstants.COLORS.BORDER}`,
            borderRadius: '4px',
            backgroundColor: 'white',
            cursor: 'pointer'
        });

        const currentType = getNewSectionType();

        // Add section type options
        SECTION_TYPE_LIST.forEach(type => {
            const option = document.createElement('
            option.value = type;
            option.textContent = SECTION_TYPE_LABELS[type] || type;
            option.selected = type === currentType;
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            setNewSectionType(e.target.value);
            this.onIntentChange(getSectionIntent());
        });

        // Info text
        const info = document.createElement('
        info.style.fontSize = '10px';
        info.style.color = LayoutConstants.COLORS.TEXT_SECONDARY;
        info.style.marginTop = '4px';
        info.innerHTML = 'A new section will be created with this chord as the first chord.';

        container.appendChild(label);
        container.appendChild(select);
        container.appendChild(info);

        return container;
    }

    /**
     * Create a radio option
     */
    createRadioOption(name, value, label, isChecked, onChange) {
        const container = document.createElement('
        container.className = 'section-intent-selector__radio';

        Object.assign(container.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            padding: '4px 0'
        });

        const radio = document.createElement('
        radio.type = 'radio';
        radio.name = name;
        radio.value = value;
        radio.checked = isChecked;

        Object.assign(radio.style, {
            margin: '0',
            cursor: 'pointer'
        });

        radio.addEventListener('change', onChange);

        const labelText = document.createElement('
        labelText.textContent = label;
        labelText.style.fontSize = '11px';
        labelText.style.color = LayoutConstants.COLORS.TEXT;

        container.appendChild(radio);
        container.appendChild(labelText);

        return container;
    }

    /**
     * Render selection prompt when no chord is selected
     */
    renderSelectionPrompt() {
        Object.assign(this.element.style, {
            textAlign: 'center',
            padding: '16px'
        });

        // Warning icon
        const icon = document.createElement('
        icon.textContent = '!';
        Object.assign(icon.style, {
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#fff3cd',
            color: '#856404',
            fontSize: '18px',
            fontWeight: 'bold',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '8px'
        });

        // Message
        const message = document.createElement('
        message.textContent = 'Select a chord card first';
        message.style.fontWeight = '600';
        message.style.marginBottom = '4px';
        message.style.color = LayoutConstants.COLORS.TEXT;

        // Sub-message
        const subMessage = document.createElement('
        subMessage.textContent = 'Click on a chord in your progression to indicate where to insert the next chord.';
        subMessage.style.fontSize = '11px';
        subMessage.style.color = LayoutConstants.COLORS.TEXT_SECONDARY;
        subMessage.style.marginBottom = '12px';

        // Buttons
        const buttonContainer = document.createElement('
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '8px';
        buttonContainer.style.justifyContent = 'center';

        // Select last chord button
        const selectLastBtn = document.createElement('
        selectLastBtn.textContent = 'Select Last Chord';
        Object.assign(selectLastBtn.style, {
            padding: '6px 12px',
            fontSize: '11px',
            border: `1px solid ${LayoutConstants.COLORS.ACCENT}`,
            borderRadius: '4px',
            backgroundColor: LayoutConstants.COLORS.ACCENT,
            color: 'white',
            cursor: 'pointer'
        });
        selectLastBtn.addEventListener('click', () => {
            this.onSelectChordRequest('
        });

        // Cancel button
        const cancelBtn = document.createElement('
        cancelBtn.textContent = 'Cancel';
        Object.assign(cancelBtn.style, {
            padding: '6px 12px',
            fontSize: '11px',
            border: `1px solid ${LayoutConstants.COLORS.BORDER}`,
            borderRadius: '4px',
            backgroundColor: 'white',
            color: LayoutConstants.COLORS.TEXT,
            cursor: 'pointer'
        });
        cancelBtn.addEventListener('click', () => {
            this.onSelectChordRequest('
        });

        buttonContainer.appendChild(selectLastBtn);
        buttonContainer.appendChild(cancelBtn);

        this.element.appendChild(icon);
        this.element.appendChild(message);
        this.element.appendChild(subMessage);
        this.element.appendChild(buttonContainer);
    }

    /**
     * Update the selector with new state
     * @param {Object} options - Update options
     */
    update(options = {}) {
        if (options.progressionData) {
            this.progressionData = options.progressionData;
        }
        this.render();
    }

    /**
     * Get the element for insertion into DOM
     * @returns {HTMLElement}
     */
    getElement() {
        return this.element;
    }

    /**
     * Dispose of the component
     */
    dispose() {
        if (this.element && this.element.parentElement) {
            this.element.parentElement.removeChild(this.element);
        }
        this.element = null;
    }
}
