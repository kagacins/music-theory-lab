/**
 * Quick Add Chord Module
 *
 * Provides functionality for the Quick Add Chord forms in Composition Studio.
 * Features:
 * - Scale-based chord type filtering
 * - Adds chords to progression via addChordToProgressionByParams
 * - Works with multiple form instances (progression builder, melody tab)
 */

import {
    CHORD_DEFINITIONS,
    CHORD_GROUPS,
    SCALE_DEFINITIONS,
    SCALE_CATEGORIES,
    SHARP_NOTES
} from '../../data/music-data.js';
import { isChordInScale } from '../features/chordBuilder.js';

// All chord types grouped for populating dropdown
const ALL_CHORD_TYPES = {
    'TRIADS': ['Major', 'Minor', 'Augmented', 'Diminished', 'Sus2', 'Sus4', 'Power Chord'],
    'SEVENTHS': ['Dominant 7th', 'Major 7th', 'Minor 7th', 'Half-Diminished 7th', 'Diminished 7th', 'Minor-Major 7th'],
    'NINTHS': ['Major 9th', 'Dominant 9th', 'Minor 9th', '6/9', 'Add9'],
    'EXTENDED': ['Dominant 11th', 'Minor 11th', 'Dominant 13th', 'Major 6th', 'Minor 6th'],
    'ALTERED': ['Augmented 7th', '7b5', '7#5', '7b9', '7#9'],
    'INTERVALS': ['Major 2nd', 'Minor 2nd', 'Major 3rd', 'Minor 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th', 'Major 6th', 'Minor 6th', 'Major 7th', 'Minor 7th', 'Octave']
};

// Form ID to element ID suffix mapping
const FORM_CONFIGS = {
    'quick-add-chord-form': {
        root: 'quick-add-chord-form-root',
        type: 'quick-add-chord-form-type-input',
        inversion: 'quick-add-chord-form-inversion',
        scale: 'quick-add-chord-form-scale'
    },
    'quick-add-chord-form-melody': {
        root: 'quick-add-chord-form-melody-root',
        type: 'quick-add-chord-form-melody-type-input',
        inversion: 'quick-add-chord-form-melody-inversion',
        scale: 'quick-add-chord-form-melody-scale'
    }
};

/**
 * Get root note name from pitch class index
 */
function getRootNoteName(pitchClass) {
    return SHARP_NOTES[pitchClass] || 'C';
}

/**
 * Populate the scale filter dropdown with categories
 */
export function populateScaleDropdown(formId) {
    const config = FORM_CONFIGS[formId];
    if (!config) return;

    const scaleSelect = document.getElementById(config.scale);
    if (!scaleSelect) return;

    // Check if already populated (has more than just the default option)
    // This prevents duplicate entries when opening/closing the form multiple times
    if (scaleSelect.querySelectorAll('optgroup').length > 0) {
        return; // Already populated
    }

    // Clear all children and rebuild (handles both options and optgroups)
    scaleSelect.innerHTML = '<option value="">All Chords (no filter)</option>';

    // Get scales grouped by category
    const scalesByCategory = {};
    Object.entries(SCALE_DEFINITIONS).forEach(([scaleName, scaleDef]) => {
        const category = scaleDef.category || 'basic';
        if (!scalesByCategory[category]) {
            scalesByCategory[category] = [];
        }
        scalesByCategory[category].push(scaleName);
    });

    // Add scales organized by category
    Object.entries(SCALE_CATEGORIES).forEach(([categoryKey, categoryInfo]) => {
        const scales = scalesByCategory[categoryKey] || [];
        if (scales.length === 0) return;

        const optgroup = document.createElement('optgroup');
        optgroup.label = `${categoryInfo.icon} ${categoryInfo.name}`;
        optgroup.style.color = '#1f2937';
        optgroup.style.fontWeight = 'bold';
        optgroup.style.background = '#f3f4f6';

        scales.forEach(scaleName => {
            const option = document.createElement('option');
            option.value = scaleName;
            option.textContent = scaleName;
            option.style.color = '#374151';
            option.style.background = 'white';
            optgroup.appendChild(option);
        });

        scaleSelect.appendChild(optgroup);
    });
}

/**
 * Update chord type dropdown based on selected scale filter
 */
export function updateQuickAddChordTypes(formId) {
    const config = FORM_CONFIGS[formId];
    if (!config) return;

    const rootSelect = document.getElementById(config.root);
    const typeSelect = document.getElementById(config.type);
    const scaleSelect = document.getElementById(config.scale);

    if (!rootSelect || !typeSelect) return;

    const rootIndex = parseInt(rootSelect.value, 10);
    const rootNoteName = getRootNoteName(rootIndex);
    const selectedScale = scaleSelect ? scaleSelect.value : '';

    // Store current selection
    const currentType = typeSelect.value;

    // Clear existing options
    typeSelect.innerHTML = '';

    // Build new options with filtering
    Object.entries(ALL_CHORD_TYPES).forEach(([groupName, chordTypes]) => {
        // Skip intervals for scale filtering (they don't have meaningful scale relationships)
        const isIntervalGroup = groupName === 'INTERVALS';

        // Filter chord types if scale is selected
        const filteredTypes = selectedScale && !isIntervalGroup
            ? chordTypes.filter(chordType =>
                CHORD_DEFINITIONS[chordType] && isChordInScale(chordType, rootNoteName, selectedScale, rootNoteName)
            )
            : chordTypes;

        // Skip empty groups when filtering
        if (selectedScale && filteredTypes.length === 0 && !isIntervalGroup) return;

        // Create optgroup
        const optgroup = document.createElement('optgroup');
        const displayName = isIntervalGroup ? 'INTERVALS' : groupName;
        const count = selectedScale && !isIntervalGroup ? ` (${filteredTypes.length})` : '';
        optgroup.label = `─── ${displayName}${count} ───`;
        optgroup.style.color = '#1f2937';
        optgroup.style.fontWeight = 'bold';
        optgroup.style.background = '#f3f4f6';

        // Add interval types without filtering, chord types with filtering
        const typesToShow = isIntervalGroup ? chordTypes : filteredTypes;

        typesToShow.forEach(chordType => {
            const option = document.createElement('option');
            option.value = chordType;
            // Add (interval) suffix for interval display names that conflict with chords
            if (isIntervalGroup && (chordType === 'Major 6th' || chordType === 'Minor 6th' || chordType === 'Major 7th' || chordType === 'Minor 7th')) {
                option.textContent = `${chordType} (interval)`;
            } else {
                option.textContent = chordType;
            }
            option.style.color = '#374151';
            option.style.background = 'white';
            optgroup.appendChild(option);
        });

        typeSelect.appendChild(optgroup);
    });

    // Try to restore previous selection, fallback to first option
    const allOptions = Array.from(typeSelect.options);
    const matchingOption = allOptions.find(opt => opt.value === currentType);
    if (matchingOption) {
        typeSelect.value = currentType;
    } else if (allOptions.length > 0) {
        typeSelect.value = allOptions[0].value;
    }
}

/**
 * Add chord from Quick Add form
 */
export function quickAddChordFromForm(formId) {
    const config = FORM_CONFIGS[formId];
    if (!config) {
        console.error('[QuickAddChord] Unknown form ID:', formId);
        return;
    }

    const rootSelect = document.getElementById(config.root);
    const typeSelect = document.getElementById(config.type);
    const inversionSelect = document.getElementById(config.inversion);

    if (!rootSelect || !typeSelect || !inversionSelect) {
        console.error('[QuickAddChord] Form elements not found for:', formId);
        return;
    }

    const rootIndex = parseInt(rootSelect.value, 10);
    const chordType = typeSelect.value;
    const inversion = parseInt(inversionSelect.value, 10);

    // Get root note name
    const rootNoteName = getRootNoteName(rootIndex);

    console.log('[QuickAddChord] Adding chord:', { rootNoteName, chordType, inversion });

    // Use the existing addChordToProgressionByParams function
    if (window.addChordToProgressionByParams) {
        window.addChordToProgressionByParams(chordType, rootNoteName, inversion, 0, true);

        // Hide the form after adding
        if (window.toggleQuickAddChordForm) {
            window.toggleQuickAddChordForm(formId);
        }
    } else {
        console.error('[QuickAddChord] addChordToProgressionByParams not available');
    }
}

/**
 * Initialize all Quick Add Chord forms
 * Call this after DOM is loaded
 */
export function initQuickAddChordForms() {
    Object.keys(FORM_CONFIGS).forEach(formId => {
        populateScaleDropdown(formId);
    });
    console.log('[QuickAddChord] Initialized Quick Add Chord forms');
}

// Export for window binding
export default {
    quickAddChordFromForm,
    updateQuickAddChordTypes,
    populateScaleDropdown,
    initQuickAddChordForms
};
