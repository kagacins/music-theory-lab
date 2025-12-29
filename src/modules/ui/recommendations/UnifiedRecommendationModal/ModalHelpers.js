/**
 * Modal Helper Functions for Unified Recommendation Modal
 *
 * Small UI helper functions for modal operations like updating badges and showing info dialogs.
 * These are coordinator functions that depend on modal state and DOM.
 */

import { modalState } from './ModalState.js';
import { TAB_INFO, SECTION_TYPES } from './Constants.js';
import { CHORD_DEFINITIONS } from '../../../../data/music-data.js';
import { getProgressionData, getCurrentKey } from '../../../state/trainerState.js';
import {
    getSectionIntent,
    setSectionIntent,
    INTENT_MODES,
    CONTINUE_SUBMODES
} from '../../../state/sectionIntentState.js';
import { getInvertedChordNotes } from '../../../utils/noteUtils.js';

/**
 * Update the header selection badge to reflect current modal state
 * Shows either "Adding after", "Range", or "Selected" based on mode
 * @param {HTMLElement} badge - Badge element to update (optional, will find by ID if not provided)
 */
export function updateHeaderSelectionBadge(badge) {
    if (!badge) {
        badge = document.getElementById('header-selection-badge');
    }
    if (!badge) return;

    const progressionData = getProgressionData() || [];
    const hasMultiSelectChords = modalState.selectedProgressionStart >= 0 && modalState.selectedProgressionEnd >= 0 &&
                           modalState.selectedProgressionStart !== modalState.selectedProgressionEnd;

    if (modalState.selectedProgressionIndex === -1 && !hasMultiSelectChords) {
        badge.innerHTML = `<strong style="color: #6ee7b7;">Adding</strong> after #${progressionData.length || 0}`;
    } else if (hasMultiSelectChords) {
        const start = Math.min(modalState.selectedProgressionStart, modalState.selectedProgressionEnd);
        const end = Math.max(modalState.selectedProgressionStart, modalState.selectedProgressionEnd);
        const count = end - start + 1;
        badge.innerHTML = `<strong style="color: #c4b5fd;">Range:</strong> #${start + 1} - #${end + 1} (${count})`;
    } else {
        const selectedChord = progressionData[modalState.selectedProgressionIndex];
        const chordDef = CHORD_DEFINITIONS[selectedChord?.type];
        const symbol = chordDef?.symbol || '';
        badge.innerHTML = `<strong style="color: #c4b5fd;">Selected:</strong> ${selectedChord?.root}${symbol} (#${modalState.selectedProgressionIndex + 1})`;
    }
}

/**
 * Show an info popup for a section or tab
 * Creates a modal overlay with title and description
 * @param {string} sectionId - Section/tab identifier (not currently used, for future filtering)
 * @param {string} title - Popup title
 * @param {string} description - Popup description text
 */
export function showSectionInfo(sectionId, title, description) {
    // Remove existing info popup if any
    const existing = document.getElementById('section-info-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'section-info-popup';
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        padding: 24px;
        max-width: 400px;
        z-index: 100001;
    `;
    popup.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 18px; color: #374151;">${title}</h3>
            <button id="close-section-info" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #9ca3af; padding: 4px;">&times;</button>
        </div>
        <p style="margin: 0; color: #6b7280; line-height: 1.6; font-size: 14px;">${description}</p>
    `;

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'section-info-backdrop';
    backdrop.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 100000;';
    backdrop.onclick = () => { popup.remove(); backdrop.remove(); };

    document.body.appendChild(backdrop);
    document.body.appendChild(popup);

    popup.querySelector('#close-section-info').onclick = () => {
        popup.remove();
        backdrop.remove();
    };
}

/**
 * Show tab-specific help information
 * Looks up tab info from TAB_INFO constant and displays in popup
 * @param {string} tabId - Tab identifier (chord, melody, section, harmonize, polyphony)
 */
export function showTabInfo(tabId) {
    const info = TAB_INFO[tabId];
    if (info) {
        showSectionInfo(tabId, info.title, info.description);
    }
}

/**
 * Get chord notes for playback with error handling
 * Wraps getInvertedChordNotes with try-catch for safe playback
 * @param {string} root - Root note
 * @param {string} type - Chord type from CHORD_DEFINITIONS
 * @param {number} inversion - Inversion number (0-based)
 * @returns {Array<string>} Array of note strings with octaves
 */
export function getChordNotesForPlayback(root, type, inversion) {
    try {
        const result = getInvertedChordNotes(root, type, inversion, getCurrentKey() || 'C', 0);
        return result?.specificNotes || [];
    } catch (e) {
        console.warn('[Compare] Could not get notes for', root, type);
        return [];
    }
}

/**
 * Update the section submode selector based on current intent mode
 * Shows different controls for Continue mode vs New Section mode
 * Delegates to window.renderActiveTab (still in old module) for re-rendering
 */
export function updateSubModeSelector() {
    const container = document.getElementById('section-submode-container');
    if (!container) return;
    container.innerHTML = '';

    const intent = getSectionIntent();
    const modeSelect = document.getElementById('section-mode-select');

    // Get renderActiveTab from window (still in old module during migration)
    const renderActiveTab = window.renderActiveTab;

    if (modeSelect?.value === INTENT_MODES.CONTINUE || intent.mode === INTENT_MODES.CONTINUE) {
        // Continue mode: show submode dropdown instead of buttons
        const submodes = [
            { id: CONTINUE_SUBMODES.BUILDING, label: 'Build', title: 'Continue building the section' },
            { id: CONTINUE_SUBMODES.CONCLUDING, label: 'Resolve', title: 'Work toward section resolution' },
            { id: CONTINUE_SUBMODES.FINAL, label: 'Final', title: 'Last chord of section' }
        ];

        const subModeSelect = document.createElement('select');
        subModeSelect.id = 'section-submode-select';
        subModeSelect.style.cssText = `
            padding: 4px 6px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 11px;
            background: white;
            cursor: pointer;
        `;
        submodes.forEach(sm => {
            const opt = document.createElement('option');
            opt.value = sm.id;
            opt.textContent = sm.label;
            opt.title = sm.title;
            subModeSelect.appendChild(opt);
        });
        subModeSelect.value = intent.subMode || CONTINUE_SUBMODES.BUILDING;
        subModeSelect.addEventListener('change', () => {
            setSectionIntent({ subMode: subModeSelect.value });
            modalState.currentPhraseCandidates = []; // Clear cached phrases to force regeneration
            if (renderActiveTab) renderActiveTab(); // Re-render to update scoring
        });
        container.appendChild(subModeSelect);
    } else {
        // New section mode: show section type selector
        const typeSelect = document.createElement('select');
        typeSelect.style.cssText = `
            padding: 4px 6px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 11px;
            background: white;
            cursor: pointer;
        `;
        SECTION_TYPES.forEach(st => {
            const opt = document.createElement('option');
            opt.value = st.id;
            opt.textContent = `${st.icon} ${st.name}`;
            typeSelect.appendChild(opt);
        });
        typeSelect.value = intent.newSectionType || 'verse';
        typeSelect.addEventListener('change', () => {
            setSectionIntent({ newSectionType: typeSelect.value });
            modalState.currentPhraseCandidates = []; // Clear cached phrases to force regeneration
            if (renderActiveTab) renderActiveTab(); // Re-render to update scoring
        });
        container.appendChild(typeSelect);
    }
}
