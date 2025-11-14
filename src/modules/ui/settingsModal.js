/**
 * Settings Modal Component
 * Universal settings for chord recommendation weights
 */

import {
    DEFAULT_WEIGHTS,
    DEFAULT_CONTEXT_WEIGHTS,
    WEIGHT_PRESETS,
    getSavedWeights,
    saveWeights,
    resetWeightsToDefault,
    applyPreset,
    normalizeWeights
} from '../config/weightPresets.js';

/**
 * Show the settings modal
 */
export function showSettingsModal() {
    // Remove existing modal if any
    const existing = document.getElementById('settings-modal');
    if (existing) existing.remove();

    // Get current weights
    let currentWeights = getSavedWeights(false); // Start with non-context mode

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
    title.textContent = 'Chord Recommendation Settings';
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

    // Description
    const description = document.createElement('p');
    description.textContent = 'Customize how chord suggestions are scored and ranked. These settings will be used across all chord recommendation features.';
    description.style.color = '#6b7280';
    description.style.fontSize = '14px';
    description.style.marginBottom = '24px';
    description.style.lineHeight = '1.6';
    modal.appendChild(description);

    // Normalization notice
    const notice = document.createElement('div');
    notice.style.backgroundColor = '#eff6ff';
    notice.style.border = '1px solid #bfdbfe';
    notice.style.borderRadius = '8px';
    notice.style.padding = '12px 16px';
    notice.style.marginBottom = '24px';
    notice.innerHTML = `
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
    modal.appendChild(notice);

    // Presets section
    const presetsSection = document.createElement('div');
    presetsSection.style.marginBottom = '28px';

    const presetsTitle = document.createElement('h3');
    presetsTitle.textContent = 'Presets';
    presetsTitle.style.fontSize = '16px';
    presetsTitle.style.fontWeight = '600';
    presetsTitle.style.color = '#111827';
    presetsTitle.style.marginBottom = '12px';
    presetsSection.appendChild(presetsTitle);

    const presetsGrid = document.createElement('div');
    presetsGrid.style.display = 'grid';
    presetsGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
    presetsGrid.style.gap = '12px';

    // Create preset buttons
    Object.keys(WEIGHT_PRESETS).forEach(key => {
        const preset = WEIGHT_PRESETS[key];

        // Skip context preset in this view (show only in context-aware mode)
        if (preset.requiresContext) return;

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
            presetBtn.style.backgroundColor = '#eff6ff';
            presetBtn.style.borderColor = '#3b82f6';
        };
        presetBtn.onmouseleave = () => {
            presetBtn.style.backgroundColor = '#f9fafb';
            presetBtn.style.borderColor = '#e5e7eb';
        };

        presetBtn.onclick = () => {
            const weights = applyPreset(key, false);
            if (weights) {
                currentWeights = weights;
                updateSliders();
            }
        };

        presetsGrid.appendChild(presetBtn);
    });

    presetsSection.appendChild(presetsGrid);
    modal.appendChild(presetsSection);

    // Custom weights section
    const weightsSection = document.createElement('div');
    weightsSection.style.marginBottom = '24px';

    const weightsTitle = document.createElement('h3');
    weightsTitle.textContent = 'Custom Weights';
    weightsTitle.style.fontSize = '16px';
    weightsTitle.style.fontWeight = '600';
    weightsTitle.style.color = '#111827';
    weightsTitle.style.marginBottom = '16px';
    weightsSection.appendChild(weightsTitle);

    // Weight sliders container
    const slidersContainer = document.createElement('div');
    slidersContainer.style.display = 'flex';
    slidersContainer.style.flexDirection = 'column';
    slidersContainer.style.gap = '20px';

    const sliders = {};
    const labels = {
        harmonic: 'Harmonic Function',
        voiceLeading: 'Voice Leading',
        style: 'Style Fit',
        mood: 'Mood Fit'
    };

    const descriptions = {
        harmonic: 'How well the chord follows traditional harmonic progressions (tonic→subdominant→dominant)',
        voiceLeading: 'Smoothness of voice movement - minimal note jumps, common tones, contrary motion',
        style: 'How well the chord fits your selected musical style (pop, jazz, classical, etc.)',
        mood: 'How well the chord matches your desired emotional character (bright, dark, jazzy, etc.)'
    };

    function updateSliders() {
        Object.keys(labels).forEach(key => {
            sliders[key].slider.value = Math.round(currentWeights[key] * 100);
            sliders[key].valueLabel.textContent = `${Math.round(currentWeights[key] * 100)}%`;
        });
    }

    function onSliderChange() {
        // Get current slider values
        const newWeights = {};
        Object.keys(labels).forEach(key => {
            newWeights[key] = parseFloat(sliders[key].slider.value) / 100;
        });

        // Normalize
        currentWeights = normalizeWeights(newWeights);

        // Update display
        updateSliders();
    }

    Object.keys(labels).forEach(key => {
        const sliderGroup = document.createElement('div');

        const labelRow = document.createElement('div');
        labelRow.style.display = 'flex';
        labelRow.style.justifyContent = 'space-between';
        labelRow.style.alignItems = 'center';
        labelRow.style.marginBottom = '8px';

        const label = document.createElement('label');
        label.textContent = labels[key];
        label.style.fontSize = '14px';
        label.style.fontWeight = '600';
        label.style.color = '#374151';

        const valueLabel = document.createElement('span');
        valueLabel.textContent = `${Math.round(currentWeights[key] * 100)}%`;
        valueLabel.style.fontSize = '14px';
        valueLabel.style.fontWeight = '600';
        valueLabel.style.color = '#3b82f6';
        valueLabel.style.minWidth = '45px';
        valueLabel.style.textAlign = 'right';

        labelRow.appendChild(label);
        labelRow.appendChild(valueLabel);

        const desc = document.createElement('div');
        desc.textContent = descriptions[key];
        desc.style.fontSize = '12px';
        desc.style.color = '#6b7280';
        desc.style.marginBottom = '8px';
        desc.style.lineHeight = '1.4';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.value = Math.round(currentWeights[key] * 100);
        slider.style.width = '100%';
        slider.style.cursor = 'pointer';
        slider.oninput = onSliderChange;

        sliders[key] = { slider, valueLabel };

        sliderGroup.appendChild(labelRow);
        sliderGroup.appendChild(desc);
        sliderGroup.appendChild(slider);

        slidersContainer.appendChild(sliderGroup);
    });

    weightsSection.appendChild(slidersContainer);
    modal.appendChild(weightsSection);

    // Buttons
    const buttonRow = document.createElement('div');
    buttonRow.style.display = 'flex';
    buttonRow.style.gap = '12px';
    buttonRow.style.justifyContent = 'flex-end';
    buttonRow.style.paddingTop = '24px';
    buttonRow.style.borderTop = '1px solid #e5e7eb';

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset to Default';
    resetBtn.style.padding = '10px 20px';
    resetBtn.style.backgroundColor = '#f9fafb';
    resetBtn.style.border = '1px solid #d1d5db';
    resetBtn.style.borderRadius = '6px';
    resetBtn.style.cursor = 'pointer';
    resetBtn.style.fontSize = '14px';
    resetBtn.style.fontWeight = '600';
    resetBtn.style.color = '#374151';
    resetBtn.style.transition = 'all 0.2s';
    resetBtn.onmouseenter = () => {
        resetBtn.style.backgroundColor = '#f3f4f6';
    };
    resetBtn.onmouseleave = () => {
        resetBtn.style.backgroundColor = '#f9fafb';
    };
    resetBtn.onclick = () => {
        currentWeights = resetWeightsToDefault(false);
        updateSliders();
    };

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save Settings';
    saveBtn.style.padding = '10px 24px';
    saveBtn.style.backgroundColor = '#3b82f6';
    saveBtn.style.border = 'none';
    saveBtn.style.borderRadius = '6px';
    saveBtn.style.cursor = 'pointer';
    saveBtn.style.fontSize = '14px';
    saveBtn.style.fontWeight = '600';
    saveBtn.style.color = 'white';
    saveBtn.style.transition = 'all 0.2s';
    saveBtn.onmouseenter = () => {
        saveBtn.style.backgroundColor = '#2563eb';
    };
    saveBtn.onmouseleave = () => {
        saveBtn.style.backgroundColor = '#3b82f6';
    };
    saveBtn.onclick = () => {
        saveWeights(currentWeights);
        saveBtn.textContent = '✓ Saved!';
        saveBtn.style.backgroundColor = '#10b981';
        setTimeout(() => {
            saveBtn.textContent = 'Save Settings';
            saveBtn.style.backgroundColor = '#3b82f6';
            overlay.remove();
        }, 1000);
    };

    buttonRow.appendChild(resetBtn);
    buttonRow.appendChild(saveBtn);
    modal.appendChild(buttonRow);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}
