/**
 * Settings Modal Component
 * Universal settings for chord and melody recommendation weights
 */

import {
    DEFAULT_WEIGHTS,
    DEFAULT_CONTEXT_WEIGHTS,
    WEIGHT_PRESETS,
    APPROACH_PRESETS,
    GENRE_TEMPLATES,
    getSavedWeights,
    saveWeights,
    resetWeightsToDefault,
    applyPreset,
    normalizeWeights,
    // Melody weight imports
    DEFAULT_MELODY_WEIGHTS,
    MELODY_APPROACH_PRESETS,
    MELODY_GENRE_TEMPLATES,
    MELODY_WEIGHT_PRESETS,
    getSavedMelodyWeights,
    saveMelodyWeights,
    resetMelodyWeightsToDefault,
    applyMelodyPreset,
    findMatchingMelodyPreset
} from '../config/weightPresets.js';

/**
 * Helper: Check if two weight objects are equal (within tolerance)
 * @param {Object} weights1 - First weight object
 * @param {Object} weights2 - Second weight object
 * @returns {boolean} True if weights match
 */
function weightsMatch(weights1, weights2) {
    const keys = Object.keys(weights1);
    const tolerance = 0.01; // 1% tolerance for floating point comparison

    // Check if all keys exist in both objects
    if (!keys.every(key => key in weights2)) return false;

    // Check if all values match within tolerance
    return keys.every(key => {
        const diff = Math.abs(weights1[key] - weights2[key]);
        return diff < tolerance;
    });
}

/**
 * Find which preset (if any) matches the given weights
 * @param {Object} weights - Current weight configuration
 * @returns {string|null} Preset key or null if no match
 */
function findMatchingPreset(weights) {
    // Check all presets
    for (const [key, preset] of Object.entries(WEIGHT_PRESETS)) {
        if (preset.requiresContext) continue; // Skip context-aware preset
        if (weightsMatch(weights, preset.weights)) {
            return key;
        }
    }
    return null;
}

/**
 * Show the settings modal
 * @param {string} initialTab - Which tab to show initially: 'chords' or 'melody'
 */
export function showSettingsModal(initialTab = 'chords') {
    // Remove existing modal if any
    const existing = document.getElementById('settings-modal');
    if (existing) existing.remove();

    // Get current weights
    let currentChordWeights = getSavedWeights(false);
    let currentMelodyWeights = getSavedMelodyWeights();

    // Track which tab is active
    let activeTab = initialTab;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'settings-modal';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '100000';
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    // Create modal
    const modal = document.createElement('div');
    modal.style.backgroundColor = 'white';
    modal.style.borderRadius = '12px';
    modal.style.padding = '32px';
    modal.style.maxWidth = '700px';
    modal.style.width = '90%';
    modal.style.maxHeight = '85vh';
    modal.style.overflowY = 'auto';
    modal.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
    modal.onclick = (e) => e.stopPropagation();

    // Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '24px';

    const title = document.createElement('h2');
    title.textContent = 'Recommendation Settings';
    title.style.margin = '0';
    title.style.fontSize = '24px';
    title.style.fontWeight = '700';
    title.style.color = '#111827';

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '32px';
    closeBtn.style.color = '#6b7280';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '0';
    closeBtn.style.width = '36px';
    closeBtn.style.height = '36px';
    closeBtn.style.borderRadius = '6px';
    closeBtn.style.transition = 'all 0.2s';
    closeBtn.onmouseenter = () => { closeBtn.style.backgroundColor = '#f3f4f6'; };
    closeBtn.onmouseleave = () => { closeBtn.style.backgroundColor = 'transparent'; };
    closeBtn.onclick = () => overlay.remove();

    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Tab navigation
    const tabNav = document.createElement('div');
    tabNav.style.display = 'flex';
    tabNav.style.gap = '8px';
    tabNav.style.marginBottom = '24px';
    tabNav.style.borderBottom = '2px solid #e5e7eb';
    tabNav.style.paddingBottom = '0';

    const createTab = (id, label, emoji) => {
        const tab = document.createElement('button');
        tab.dataset.tab = id;
        tab.innerHTML = `${emoji} ${label}`;
        tab.style.padding = '12px 20px';
        tab.style.border = 'none';
        tab.style.background = 'none';
        tab.style.fontSize = '14px';
        tab.style.fontWeight = '600';
        tab.style.cursor = 'pointer';
        tab.style.borderBottom = '2px solid transparent';
        tab.style.marginBottom = '-2px';
        tab.style.transition = 'all 0.2s';
        tab.style.color = '#6b7280';

        tab.onclick = () => {
            activeTab = id;
            updateTabs();
        };

        return tab;
    };

    const chordsTab = createTab('chords', 'Chord Weights', '🎹');
    const melodyTab = createTab('melody', 'Melody Weights', '🎵');

    tabNav.appendChild(chordsTab);
    tabNav.appendChild(melodyTab);
    modal.appendChild(tabNav);

    // Content containers
    const chordsContent = document.createElement('div');
    chordsContent.id = 'chords-tab-content';

    const melodyContent = document.createElement('div');
    melodyContent.id = 'melody-tab-content';

    // Function to update tab styles
    function updateTabs() {
        const isChords = activeTab === 'chords';

        chordsTab.style.color = isChords ? '#3b82f6' : '#6b7280';
        chordsTab.style.borderBottomColor = isChords ? '#3b82f6' : 'transparent';

        melodyTab.style.color = !isChords ? '#3b82f6' : '#6b7280';
        melodyTab.style.borderBottomColor = !isChords ? '#3b82f6' : 'transparent';

        chordsContent.style.display = isChords ? 'block' : 'none';
        melodyContent.style.display = !isChords ? 'block' : 'none';
    }

    // ==========================================================================
    // CHORD WEIGHTS CONTENT
    // ==========================================================================

    // Description
    const chordDescription = document.createElement('p');
    chordDescription.textContent = 'Customize how chord suggestions are scored and ranked. These settings will be used across all chord recommendation features.';
    chordDescription.style.color = '#6b7280';
    chordDescription.style.fontSize = '14px';
    chordDescription.style.marginBottom = '24px';
    chordDescription.style.lineHeight = '1.6';
    chordsContent.appendChild(chordDescription);

    // Normalization notice
    const chordNotice = document.createElement('div');
    chordNotice.style.backgroundColor = '#eff6ff';
    chordNotice.style.border = '1px solid #bfdbfe';
    chordNotice.style.borderRadius = '8px';
    chordNotice.style.padding = '12px 16px';
    chordNotice.style.marginBottom = '24px';
    chordNotice.innerHTML = `
        <div style="display: flex; align-items: start; gap: 12px;">
            <span style="font-size: 20px;">ℹ️</span>
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #1e40af; margin-bottom: 4px;">About Weights</div>
                <div style="font-size: 13px; color: #1e3a8a; line-height: 1.5;">
                    Weights determine the importance of each factor when ranking chord suggestions.
                    They are automatically normalized to sum to 100%, so you can think of them as percentages.
                </div>
            </div>
        </div>
    `;
    chordsContent.appendChild(chordNotice);

    // Quick save button at top
    const chordQuickSaveRow = document.createElement('div');
    chordQuickSaveRow.style.display = 'flex';
    chordQuickSaveRow.style.justifyContent = 'flex-end';
    chordQuickSaveRow.style.marginBottom = '20px';

    const chordQuickSaveBtn = document.createElement('button');
    chordQuickSaveBtn.textContent = 'Save Settings';
    chordQuickSaveBtn.style.padding = '8px 16px';
    chordQuickSaveBtn.style.backgroundColor = '#3b82f6';
    chordQuickSaveBtn.style.border = 'none';
    chordQuickSaveBtn.style.borderRadius = '6px';
    chordQuickSaveBtn.style.cursor = 'pointer';
    chordQuickSaveBtn.style.fontSize = '13px';
    chordQuickSaveBtn.style.fontWeight = '600';
    chordQuickSaveBtn.style.color = 'white';
    chordQuickSaveBtn.style.transition = 'all 0.2s';
    chordQuickSaveBtn.onmouseenter = () => {
        chordQuickSaveBtn.style.backgroundColor = '#2563eb';
    };
    chordQuickSaveBtn.onmouseleave = () => {
        chordQuickSaveBtn.style.backgroundColor = '#3b82f6';
    };
    chordQuickSaveBtn.onclick = () => {
        saveWeights(currentChordWeights);
        chordQuickSaveBtn.textContent = '✓ Saved!';
        chordQuickSaveBtn.style.backgroundColor = '#10b981';
        setTimeout(() => {
            chordQuickSaveBtn.textContent = 'Save Settings';
            chordQuickSaveBtn.style.backgroundColor = '#3b82f6';
            overlay.remove();
            if (window.refreshChordRecommendations) {
                window.refreshChordRecommendations();
            }
        }, 1000);
    };

    chordQuickSaveRow.appendChild(chordQuickSaveBtn);
    chordsContent.appendChild(chordQuickSaveRow);

    // Chord presets section
    const chordPresetsSection = document.createElement('div');
    chordPresetsSection.style.marginBottom = '28px';

    const chordPresetsTitle = document.createElement('h3');
    chordPresetsTitle.textContent = 'Presets';
    chordPresetsTitle.style.fontSize = '16px';
    chordPresetsTitle.style.fontWeight = '600';
    chordPresetsTitle.style.color = '#111827';
    chordPresetsTitle.style.marginBottom = '16px';
    chordPresetsSection.appendChild(chordPresetsTitle);

    // Store chord button references for updating active states
    const chordPresetButtons = {};

    // Helper function to update chord active states
    function updateChordPresetActiveStates() {
        const activePreset = findMatchingPreset(currentChordWeights);

        Object.keys(chordPresetButtons).forEach(key => {
            const btn = chordPresetButtons[key];
            const isActive = key === activePreset;

            if (isActive) {
                btn.style.backgroundColor = '#dbeafe';
                btn.style.borderColor = '#3b82f6';
                btn.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            } else {
                btn.style.backgroundColor = '#f9fafb';
                btn.style.borderColor = '#e5e7eb';
                btn.style.boxShadow = 'none';
            }
        });
    }

    // Helper function to create chord preset section
    const createChordPresetSection = (sectionTitle, presets, description, emoji) => {
        const section = document.createElement('div');
        section.style.marginBottom = '20px';

        const sectionHeader = document.createElement('div');
        sectionHeader.style.display = 'flex';
        sectionHeader.style.alignItems = 'baseline';
        sectionHeader.style.gap = '8px';
        sectionHeader.style.marginBottom = '12px';

        const titleEl = document.createElement('div');
        titleEl.textContent = `${emoji} ${sectionTitle}`;
        titleEl.style.fontSize = '14px';
        titleEl.style.fontWeight = '600';
        titleEl.style.color = '#374151';
        sectionHeader.appendChild(titleEl);

        if (description) {
            const sectionDesc = document.createElement('div');
            sectionDesc.textContent = description;
            sectionDesc.style.fontSize = '12px';
            sectionDesc.style.color = '#9ca3af';
            sectionDesc.style.fontStyle = 'italic';
            sectionHeader.appendChild(sectionDesc);
        }

        section.appendChild(sectionHeader);

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
        grid.style.gap = '12px';

        Object.keys(presets).forEach(key => {
            const preset = presets[key];

            const presetBtn = document.createElement('button');
            presetBtn.style.padding = '12px 16px';
            presetBtn.style.backgroundColor = '#f9fafb';
            presetBtn.style.border = '2px solid #e5e7eb';
            presetBtn.style.borderRadius = '8px';
            presetBtn.style.cursor = 'pointer';
            presetBtn.style.transition = 'all 0.2s';
            presetBtn.style.textAlign = 'left';
            presetBtn.title = preset.tooltip;

            const presetName = document.createElement('div');
            presetName.textContent = preset.name;
            presetName.style.fontWeight = '600';
            presetName.style.color = '#111827';
            presetName.style.marginBottom = '4px';
            presetBtn.appendChild(presetName);

            const presetDesc = document.createElement('div');
            presetDesc.textContent = preset.description;
            presetDesc.style.fontSize = '12px';
            presetDesc.style.color = '#6b7280';
            presetDesc.style.lineHeight = '1.4';
            presetBtn.appendChild(presetDesc);

            presetBtn.onmouseenter = () => {
                const isActive = findMatchingPreset(currentChordWeights) === key;
                if (!isActive) {
                    presetBtn.style.backgroundColor = '#eff6ff';
                    presetBtn.style.borderColor = '#3b82f6';
                }
            };
            presetBtn.onmouseleave = () => {
                updateChordPresetActiveStates();
            };

            presetBtn.onclick = () => {
                const weights = applyPreset(key, false);
                if (weights) {
                    currentChordWeights = weights;
                    updateChordSliders();
                    updateChordPresetActiveStates();
                }
            };

            chordPresetButtons[key] = presetBtn;
            grid.appendChild(presetBtn);
        });

        section.appendChild(grid);
        return section;
    };

    // Approaches section
    const chordApproachesSection = createChordPresetSection(
        'Approaches',
        APPROACH_PRESETS,
        'What to prioritize',
        '🎯'
    );
    chordPresetsSection.appendChild(chordApproachesSection);

    // Separator
    const chordSeparator = document.createElement('div');
    chordSeparator.style.height = '1px';
    chordSeparator.style.backgroundColor = '#e5e7eb';
    chordSeparator.style.margin = '20px 0';
    chordPresetsSection.appendChild(chordSeparator);

    // Genre templates section
    const chordGenreSection = createChordPresetSection(
        'Genre Templates',
        GENRE_TEMPLATES,
        'Complete genre profiles',
        '🎸'
    );
    chordPresetsSection.appendChild(chordGenreSection);

    chordsContent.appendChild(chordPresetsSection);

    // Set initial active states
    updateChordPresetActiveStates();

    // Custom chord weights section
    const chordWeightsSection = document.createElement('div');
    chordWeightsSection.style.marginBottom = '24px';

    const chordWeightsTitle = document.createElement('h3');
    chordWeightsTitle.textContent = 'Custom Weights';
    chordWeightsTitle.style.fontSize = '16px';
    chordWeightsTitle.style.fontWeight = '600';
    chordWeightsTitle.style.color = '#111827';
    chordWeightsTitle.style.marginBottom = '16px';
    chordWeightsSection.appendChild(chordWeightsTitle);

    // Weight sliders container
    const chordSlidersContainer = document.createElement('div');
    chordSlidersContainer.style.display = 'flex';
    chordSlidersContainer.style.flexDirection = 'column';
    chordSlidersContainer.style.gap = '20px';

    const chordSliders = {};
    const chordLabels = {
        harmonic: 'Harmonic Function',
        voiceLeading: 'Voice Leading',
        style: 'Style Fit',
        mood: 'Mood Fit',
        modalInterchange: 'Modal Interchange'
    };

    const chordDescriptions = {
        harmonic: 'How well the chord follows traditional harmonic progressions (tonic→subdominant→dominant)',
        voiceLeading: 'Smoothness of voice movement - minimal note jumps, common tones, contrary motion',
        style: 'How well the chord fits your selected musical style (pop, jazz, classical, etc.)',
        mood: 'How well the chord matches your desired emotional character (bright, dark, jazzy, etc.)',
        modalInterchange: 'How often to suggest borrowed chords from parallel modes (♭VII, iv, ♭VI from parallel minor, etc.)'
    };

    function updateChordSliders() {
        Object.keys(chordLabels).forEach(key => {
            chordSliders[key].slider.value = Math.round(currentChordWeights[key] * 100);
            chordSliders[key].valueLabel.textContent = `${Math.round(currentChordWeights[key] * 100)}%`;
        });
    }

    function onChordSliderChange() {
        // Get current slider values
        const newWeights = {};
        Object.keys(chordLabels).forEach(key => {
            newWeights[key] = parseFloat(chordSliders[key].slider.value) / 100;
        });

        // Normalize
        currentChordWeights = normalizeWeights(newWeights);

        // Update display
        updateChordSliders();
        updateChordPresetActiveStates();
    }

    Object.keys(chordLabels).forEach(key => {
        const sliderGroup = document.createElement('div');

        const labelRow = document.createElement('div');
        labelRow.style.display = 'flex';
        labelRow.style.justifyContent = 'space-between';
        labelRow.style.alignItems = 'center';
        labelRow.style.marginBottom = '8px';

        const label = document.createElement('label');
        label.textContent = chordLabels[key];
        label.style.fontSize = '14px';
        label.style.fontWeight = '600';
        label.style.color = '#374151';

        const valueLabel = document.createElement('span');
        valueLabel.textContent = `${Math.round(currentChordWeights[key] * 100)}%`;
        valueLabel.style.fontSize = '14px';
        valueLabel.style.fontWeight = '600';
        valueLabel.style.color = '#3b82f6';
        valueLabel.style.minWidth = '45px';
        valueLabel.style.textAlign = 'right';

        labelRow.appendChild(label);
        labelRow.appendChild(valueLabel);

        const desc = document.createElement('div');
        desc.textContent = chordDescriptions[key];
        desc.style.fontSize = '12px';
        desc.style.color = '#6b7280';
        desc.style.marginBottom = '8px';
        desc.style.lineHeight = '1.4';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.value = Math.round(currentChordWeights[key] * 100);
        slider.style.width = '100%';
        slider.style.cursor = 'pointer';
        slider.oninput = onChordSliderChange;

        chordSliders[key] = { slider, valueLabel };

        sliderGroup.appendChild(labelRow);
        sliderGroup.appendChild(desc);
        sliderGroup.appendChild(slider);

        chordSlidersContainer.appendChild(sliderGroup);
    });

    chordWeightsSection.appendChild(chordSlidersContainer);
    chordsContent.appendChild(chordWeightsSection);

    // Chord buttons
    const chordButtonRow = document.createElement('div');
    chordButtonRow.style.display = 'flex';
    chordButtonRow.style.gap = '12px';
    chordButtonRow.style.justifyContent = 'flex-end';
    chordButtonRow.style.paddingTop = '24px';
    chordButtonRow.style.borderTop = '1px solid #e5e7eb';

    const chordResetBtn = document.createElement('button');
    chordResetBtn.textContent = 'Reset to Default';
    chordResetBtn.style.padding = '10px 20px';
    chordResetBtn.style.backgroundColor = '#f9fafb';
    chordResetBtn.style.border = '1px solid #d1d5db';
    chordResetBtn.style.borderRadius = '6px';
    chordResetBtn.style.cursor = 'pointer';
    chordResetBtn.style.fontSize = '14px';
    chordResetBtn.style.fontWeight = '600';
    chordResetBtn.style.color = '#374151';
    chordResetBtn.style.transition = 'all 0.2s';
    chordResetBtn.onmouseenter = () => {
        chordResetBtn.style.backgroundColor = '#f3f4f6';
    };
    chordResetBtn.onmouseleave = () => {
        chordResetBtn.style.backgroundColor = '#f9fafb';
    };
    chordResetBtn.onclick = () => {
        currentChordWeights = resetWeightsToDefault(false);
        updateChordSliders();
        updateChordPresetActiveStates();
    };

    const chordSaveBtn = document.createElement('button');
    chordSaveBtn.textContent = 'Save Settings';
    chordSaveBtn.style.padding = '10px 24px';
    chordSaveBtn.style.backgroundColor = '#3b82f6';
    chordSaveBtn.style.border = 'none';
    chordSaveBtn.style.borderRadius = '6px';
    chordSaveBtn.style.cursor = 'pointer';
    chordSaveBtn.style.fontSize = '14px';
    chordSaveBtn.style.fontWeight = '600';
    chordSaveBtn.style.color = 'white';
    chordSaveBtn.style.transition = 'all 0.2s';
    chordSaveBtn.onmouseenter = () => {
        chordSaveBtn.style.backgroundColor = '#2563eb';
    };
    chordSaveBtn.onmouseleave = () => {
        chordSaveBtn.style.backgroundColor = '#3b82f6';
    };
    chordSaveBtn.onclick = () => {
        saveWeights(currentChordWeights);
        chordSaveBtn.textContent = '✓ Saved!';
        chordSaveBtn.style.backgroundColor = '#10b981';
        setTimeout(() => {
            chordSaveBtn.textContent = 'Save Settings';
            chordSaveBtn.style.backgroundColor = '#3b82f6';
            overlay.remove();

            // Trigger chord recommendations refresh
            if (window.refreshChordRecommendations) {
                window.refreshChordRecommendations();
            }
        }, 1000);
    };

    chordButtonRow.appendChild(chordResetBtn);
    chordButtonRow.appendChild(chordSaveBtn);
    chordsContent.appendChild(chordButtonRow);

    // ==========================================================================
    // MELODY WEIGHTS CONTENT
    // ==========================================================================

    // Description
    const melodyDescription = document.createElement('p');
    melodyDescription.textContent = 'Customize how melody note suggestions are scored and ranked. These weights are multipliers that boost or reduce the importance of each factor.';
    melodyDescription.style.color = '#6b7280';
    melodyDescription.style.fontSize = '14px';
    melodyDescription.style.marginBottom = '24px';
    melodyDescription.style.lineHeight = '1.6';
    melodyContent.appendChild(melodyDescription);

    // Melody notice
    const melodyNotice = document.createElement('div');
    melodyNotice.style.backgroundColor = '#f0fdf4';
    melodyNotice.style.border = '1px solid #bbf7d0';
    melodyNotice.style.borderRadius = '8px';
    melodyNotice.style.padding = '12px 16px';
    melodyNotice.style.marginBottom = '24px';
    melodyNotice.innerHTML = `
        <div style="display: flex; align-items: start; gap: 12px;">
            <span style="font-size: 20px;">ℹ️</span>
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #166534; margin-bottom: 4px;">About Melody Weights</div>
                <div style="font-size: 13px; color: #15803d; line-height: 1.5;">
                    Melody weights are multipliers (0.5× to 2.0×) that adjust how much each factor influences note suggestions.
                    A value of 1.0× is neutral, higher values increase importance, lower values decrease it.
                </div>
            </div>
        </div>
    `;
    melodyContent.appendChild(melodyNotice);

    // Quick save button at top
    const melodyQuickSaveRow = document.createElement('div');
    melodyQuickSaveRow.style.display = 'flex';
    melodyQuickSaveRow.style.justifyContent = 'flex-end';
    melodyQuickSaveRow.style.marginBottom = '20px';

    const melodyQuickSaveBtn = document.createElement('button');
    melodyQuickSaveBtn.textContent = 'Save Settings';
    melodyQuickSaveBtn.style.padding = '8px 16px';
    melodyQuickSaveBtn.style.backgroundColor = '#22c55e';
    melodyQuickSaveBtn.style.border = 'none';
    melodyQuickSaveBtn.style.borderRadius = '6px';
    melodyQuickSaveBtn.style.cursor = 'pointer';
    melodyQuickSaveBtn.style.fontSize = '13px';
    melodyQuickSaveBtn.style.fontWeight = '600';
    melodyQuickSaveBtn.style.color = 'white';
    melodyQuickSaveBtn.style.transition = 'all 0.2s';
    melodyQuickSaveBtn.onmouseenter = () => {
        melodyQuickSaveBtn.style.backgroundColor = '#16a34a';
    };
    melodyQuickSaveBtn.onmouseleave = () => {
        melodyQuickSaveBtn.style.backgroundColor = '#22c55e';
    };
    melodyQuickSaveBtn.onclick = () => {
        saveMelodyWeights(currentMelodyWeights);
        melodyQuickSaveBtn.textContent = '✓ Saved!';
        melodyQuickSaveBtn.style.backgroundColor = '#10b981';
        setTimeout(() => {
            melodyQuickSaveBtn.textContent = 'Save Settings';
            melodyQuickSaveBtn.style.backgroundColor = '#22c55e';
            overlay.remove();
            if (window.refreshMelodySuggestions) {
                window.refreshMelodySuggestions();
            }
        }, 1000);
    };

    melodyQuickSaveRow.appendChild(melodyQuickSaveBtn);
    melodyContent.appendChild(melodyQuickSaveRow);

    // Melody presets section
    const melodyPresetsSection = document.createElement('div');
    melodyPresetsSection.style.marginBottom = '28px';

    const melodyPresetsTitle = document.createElement('h3');
    melodyPresetsTitle.textContent = 'Presets';
    melodyPresetsTitle.style.fontSize = '16px';
    melodyPresetsTitle.style.fontWeight = '600';
    melodyPresetsTitle.style.color = '#111827';
    melodyPresetsTitle.style.marginBottom = '16px';
    melodyPresetsSection.appendChild(melodyPresetsTitle);

    // Store melody button references
    const melodyPresetButtons = {};

    // Helper function to update melody active states
    function updateMelodyPresetActiveStates() {
        const activePreset = findMatchingMelodyPreset(currentMelodyWeights);

        Object.keys(melodyPresetButtons).forEach(key => {
            const btn = melodyPresetButtons[key];
            const isActive = key === activePreset;

            if (isActive) {
                btn.style.backgroundColor = '#dcfce7';
                btn.style.borderColor = '#22c55e';
                btn.style.boxShadow = '0 0 0 3px rgba(34, 197, 94, 0.1)';
            } else {
                btn.style.backgroundColor = '#f9fafb';
                btn.style.borderColor = '#e5e7eb';
                btn.style.boxShadow = 'none';
            }
        });
    }

    // Helper function to create melody preset section
    const createMelodyPresetSection = (sectionTitle, presets, description, emoji) => {
        const section = document.createElement('div');
        section.style.marginBottom = '20px';

        const sectionHeader = document.createElement('div');
        sectionHeader.style.display = 'flex';
        sectionHeader.style.alignItems = 'baseline';
        sectionHeader.style.gap = '8px';
        sectionHeader.style.marginBottom = '12px';

        const titleEl = document.createElement('div');
        titleEl.textContent = `${emoji} ${sectionTitle}`;
        titleEl.style.fontSize = '14px';
        titleEl.style.fontWeight = '600';
        titleEl.style.color = '#374151';
        sectionHeader.appendChild(titleEl);

        if (description) {
            const sectionDesc = document.createElement('div');
            sectionDesc.textContent = description;
            sectionDesc.style.fontSize = '12px';
            sectionDesc.style.color = '#9ca3af';
            sectionDesc.style.fontStyle = 'italic';
            sectionHeader.appendChild(sectionDesc);
        }

        section.appendChild(sectionHeader);

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
        grid.style.gap = '12px';

        Object.keys(presets).forEach(key => {
            const preset = presets[key];

            const presetBtn = document.createElement('button');
            presetBtn.style.padding = '12px 16px';
            presetBtn.style.backgroundColor = '#f9fafb';
            presetBtn.style.border = '2px solid #e5e7eb';
            presetBtn.style.borderRadius = '8px';
            presetBtn.style.cursor = 'pointer';
            presetBtn.style.transition = 'all 0.2s';
            presetBtn.style.textAlign = 'left';
            presetBtn.title = preset.tooltip;

            const presetName = document.createElement('div');
            presetName.textContent = preset.name;
            presetName.style.fontWeight = '600';
            presetName.style.color = '#111827';
            presetName.style.marginBottom = '4px';
            presetBtn.appendChild(presetName);

            const presetDesc = document.createElement('div');
            presetDesc.textContent = preset.description;
            presetDesc.style.fontSize = '12px';
            presetDesc.style.color = '#6b7280';
            presetDesc.style.lineHeight = '1.4';
            presetBtn.appendChild(presetDesc);

            presetBtn.onmouseenter = () => {
                const isActive = findMatchingMelodyPreset(currentMelodyWeights) === key;
                if (!isActive) {
                    presetBtn.style.backgroundColor = '#f0fdf4';
                    presetBtn.style.borderColor = '#22c55e';
                }
            };
            presetBtn.onmouseleave = () => {
                updateMelodyPresetActiveStates();
            };

            presetBtn.onclick = () => {
                const weights = applyMelodyPreset(key);
                if (weights) {
                    currentMelodyWeights = weights;
                    updateMelodySliders();
                    updateMelodyPresetActiveStates();
                }
            };

            melodyPresetButtons[key] = presetBtn;
            grid.appendChild(presetBtn);
        });

        section.appendChild(grid);
        return section;
    };

    // Melody approaches section
    const melodyApproachesSection = createMelodyPresetSection(
        'Approaches',
        MELODY_APPROACH_PRESETS,
        'What to prioritize',
        '🎯'
    );
    melodyPresetsSection.appendChild(melodyApproachesSection);

    // Separator
    const melodySeparator = document.createElement('div');
    melodySeparator.style.height = '1px';
    melodySeparator.style.backgroundColor = '#e5e7eb';
    melodySeparator.style.margin = '20px 0';
    melodyPresetsSection.appendChild(melodySeparator);

    // Genre templates section
    const melodyGenreSection = createMelodyPresetSection(
        'Genre Templates',
        MELODY_GENRE_TEMPLATES,
        'Complete genre profiles',
        '🎸'
    );
    melodyPresetsSection.appendChild(melodyGenreSection);

    melodyContent.appendChild(melodyPresetsSection);

    // Set initial active states
    updateMelodyPresetActiveStates();

    // Custom melody weights section
    const melodyWeightsSection = document.createElement('div');
    melodyWeightsSection.style.marginBottom = '24px';

    const melodyWeightsTitle = document.createElement('h3');
    melodyWeightsTitle.textContent = 'Custom Weights';
    melodyWeightsTitle.style.fontSize = '16px';
    melodyWeightsTitle.style.fontWeight = '600';
    melodyWeightsTitle.style.color = '#111827';
    melodyWeightsTitle.style.marginBottom = '16px';
    melodyWeightsSection.appendChild(melodyWeightsTitle);

    // Melody sliders container
    const melodySlidersContainer = document.createElement('div');
    melodySlidersContainer.style.display = 'flex';
    melodySlidersContainer.style.flexDirection = 'column';
    melodySlidersContainer.style.gap = '20px';

    const melodySliders = {};
    const melodyLabels = {
        chordTone: 'Chord Tone',
        scaleTone: 'Scale Tone',
        voiceLeading: 'Voice Leading',
        approachTone: 'Approach Tone',
        tensionTolerance: 'Tension Tolerance',
        recencyPenalty: 'Recency Penalty'
    };

    const melodyDescriptions = {
        chordTone: 'How much to favor notes that are part of the current chord (root, 3rd, 5th, 7th)',
        scaleTone: 'How much to favor notes that are in the current key/scale',
        voiceLeading: 'How much to favor smooth stepwise motion from the previous note',
        approachTone: 'How much to favor chromatic approach tones that lead to chord tones',
        tensionTolerance: 'How much to allow tension/dissonance notes (higher = more tension allowed)',
        recencyPenalty: 'How much to penalize recently used notes (higher = more variety)'
    };

    function updateMelodySliders() {
        Object.keys(melodyLabels).forEach(key => {
            melodySliders[key].slider.value = Math.round(currentMelodyWeights[key] * 100);
            melodySliders[key].valueLabel.textContent = `${currentMelodyWeights[key].toFixed(2)}×`;
        });
    }

    function onMelodySliderChange() {
        // Get current slider values
        Object.keys(melodyLabels).forEach(key => {
            currentMelodyWeights[key] = parseFloat(melodySliders[key].slider.value) / 100;
        });

        // Update display
        updateMelodySliders();
        updateMelodyPresetActiveStates();
    }

    Object.keys(melodyLabels).forEach(key => {
        const sliderGroup = document.createElement('div');

        const labelRow = document.createElement('div');
        labelRow.style.display = 'flex';
        labelRow.style.justifyContent = 'space-between';
        labelRow.style.alignItems = 'center';
        labelRow.style.marginBottom = '8px';

        const label = document.createElement('label');
        label.textContent = melodyLabels[key];
        label.style.fontSize = '14px';
        label.style.fontWeight = '600';
        label.style.color = '#374151';

        const valueLabel = document.createElement('span');
        valueLabel.textContent = `${currentMelodyWeights[key].toFixed(2)}×`;
        valueLabel.style.fontSize = '14px';
        valueLabel.style.fontWeight = '600';
        valueLabel.style.color = '#22c55e';
        valueLabel.style.minWidth = '50px';
        valueLabel.style.textAlign = 'right';

        labelRow.appendChild(label);
        labelRow.appendChild(valueLabel);

        const desc = document.createElement('div');
        desc.textContent = melodyDescriptions[key];
        desc.style.fontSize = '12px';
        desc.style.color = '#6b7280';
        desc.style.marginBottom = '8px';
        desc.style.lineHeight = '1.4';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '25';  // 0.25×
        slider.max = '200'; // 2.0×
        slider.value = Math.round(currentMelodyWeights[key] * 100);
        slider.style.width = '100%';
        slider.style.cursor = 'pointer';
        slider.oninput = onMelodySliderChange;

        melodySliders[key] = { slider, valueLabel };

        sliderGroup.appendChild(labelRow);
        sliderGroup.appendChild(desc);
        sliderGroup.appendChild(slider);

        melodySlidersContainer.appendChild(sliderGroup);
    });

    melodyWeightsSection.appendChild(melodySlidersContainer);
    melodyContent.appendChild(melodyWeightsSection);

    // Melody buttons
    const melodyButtonRow = document.createElement('div');
    melodyButtonRow.style.display = 'flex';
    melodyButtonRow.style.gap = '12px';
    melodyButtonRow.style.justifyContent = 'flex-end';
    melodyButtonRow.style.paddingTop = '24px';
    melodyButtonRow.style.borderTop = '1px solid #e5e7eb';

    const melodyResetBtn = document.createElement('button');
    melodyResetBtn.textContent = 'Reset to Default';
    melodyResetBtn.style.padding = '10px 20px';
    melodyResetBtn.style.backgroundColor = '#f9fafb';
    melodyResetBtn.style.border = '1px solid #d1d5db';
    melodyResetBtn.style.borderRadius = '6px';
    melodyResetBtn.style.cursor = 'pointer';
    melodyResetBtn.style.fontSize = '14px';
    melodyResetBtn.style.fontWeight = '600';
    melodyResetBtn.style.color = '#374151';
    melodyResetBtn.style.transition = 'all 0.2s';
    melodyResetBtn.onmouseenter = () => {
        melodyResetBtn.style.backgroundColor = '#f3f4f6';
    };
    melodyResetBtn.onmouseleave = () => {
        melodyResetBtn.style.backgroundColor = '#f9fafb';
    };
    melodyResetBtn.onclick = () => {
        currentMelodyWeights = resetMelodyWeightsToDefault();
        updateMelodySliders();
        updateMelodyPresetActiveStates();
    };

    const melodySaveBtn = document.createElement('button');
    melodySaveBtn.textContent = 'Save Settings';
    melodySaveBtn.style.padding = '10px 24px';
    melodySaveBtn.style.backgroundColor = '#22c55e';
    melodySaveBtn.style.border = 'none';
    melodySaveBtn.style.borderRadius = '6px';
    melodySaveBtn.style.cursor = 'pointer';
    melodySaveBtn.style.fontSize = '14px';
    melodySaveBtn.style.fontWeight = '600';
    melodySaveBtn.style.color = 'white';
    melodySaveBtn.style.transition = 'all 0.2s';
    melodySaveBtn.onmouseenter = () => {
        melodySaveBtn.style.backgroundColor = '#16a34a';
    };
    melodySaveBtn.onmouseleave = () => {
        melodySaveBtn.style.backgroundColor = '#22c55e';
    };
    melodySaveBtn.onclick = () => {
        saveMelodyWeights(currentMelodyWeights);
        melodySaveBtn.textContent = '✓ Saved!';
        melodySaveBtn.style.backgroundColor = '#10b981';
        setTimeout(() => {
            melodySaveBtn.textContent = 'Save Settings';
            melodySaveBtn.style.backgroundColor = '#22c55e';
            overlay.remove();

            // Trigger melody suggestions refresh
            if (window.refreshMelodySuggestions) {
                window.refreshMelodySuggestions();
            }
        }, 1000);
    };

    melodyButtonRow.appendChild(melodyResetBtn);
    melodyButtonRow.appendChild(melodySaveBtn);
    melodyContent.appendChild(melodyButtonRow);

    // ==========================================================================
    // FINALIZE MODAL
    // ==========================================================================

    modal.appendChild(chordsContent);
    modal.appendChild(melodyContent);

    // Set initial tab
    updateTabs();

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

/**
 * Show settings modal with chord weights tab
 */
export function showChordWeightsModal() {
    showSettingsModal('chords');
}

/**
 * Show settings modal with melody weights tab
 */
export function showMelodyWeightsModal() {
    showSettingsModal('melody');
}
