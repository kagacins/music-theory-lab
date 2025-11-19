/**
 * Auto-Harmonize Modal UI Component
 * Displays chord suggestions for harmonizing a melody
 */

import { autoHarmonize, applyHarmonizeSuggestions } from '../ai/autoHarmonize.js';
import { CHORD_DEFINITIONS } from '../../data/music-data.js';

/**
 * Show the auto-harmonize modal
 * @param {Array} melodyNotes - Array of melody note objects
 * @param {string} key - Key signature (e.g., 'C Major')
 * @param {Function} onApply - Callback when user applies the harmonization
 * @param {Function} onPlayChord - Callback to preview a chord
 * @param {Function} onStopChord - Callback to stop chord preview
 * @param {Array} currentProgression - Optional current chord progression to prioritize
 * @param {Function} onPlayChordWithMelody - Callback to play chord and melody together
 * @param {number} tempo - Tempo in BPM for playback
 */
export function showAutoHarmonizeModal(melodyNotes, key, onApply, onPlayChord, onStopChord, currentProgression = [], onPlayChordWithMelody = null, tempo = 120) {
    // Remove existing modal if any
    const existingModal = document.getElementById('auto-harmonize-modal');
    if (existingModal) existingModal.remove();

    // Remove any existing tooltips
    const existingTooltip = document.getElementById('harmonize-tooltip');
    if (existingTooltip) existingTooltip.remove();

    // Group melody notes by measure for playback
    const notesByMeasure = {};
    melodyNotes.forEach(note => {
        const measureIndex = note.measure || 0;
        if (!notesByMeasure[measureIndex]) {
            notesByMeasure[measureIndex] = [];
        }
        notesByMeasure[measureIndex].push(note);
    });

    // Generate suggestions with current progression for prioritization
    // Use 4 suggestions since the first may be the current chord
    const suggestions = autoHarmonize(melodyNotes, key, {
        numSuggestions: 4,
        currentProgression: currentProgression
    });

    if (suggestions.length === 0) {
        alert('No melody notes found to harmonize. Please record or enter some melody notes first.');
        return;
    }

    // Track selected chord for each measure (default to first suggestion)
    const selections = suggestions.map(() => 0);

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'auto-harmonize-modal';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
    `;
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
        background-color: white;
        border-radius: 8px;
        padding: 24px;
        max-width: 700px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    `;
    modal.onclick = (e) => e.stopPropagation();

    // Title container
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Auto-Harmonize Melody';
    title.style.cssText = `
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #111827;
    `;
    titleContainer.appendChild(title);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 28px;
        color: #6b7280;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
    `;
    closeBtn.title = 'Close';
    closeBtn.onmouseenter = () => {
        closeBtn.style.backgroundColor = '#f3f4f6';
        closeBtn.style.color = '#111827';
    };
    closeBtn.onmouseleave = () => {
        closeBtn.style.backgroundColor = 'transparent';
        closeBtn.style.color = '#6b7280';
    };
    closeBtn.onclick = () => overlay.remove();
    titleContainer.appendChild(closeBtn);
    modal.appendChild(titleContainer);

    // Subtitle with key info
    const subtitle = document.createElement('p');
    subtitle.textContent = `Analyzing melody in ${key} and suggesting chord progressions`;
    subtitle.style.cssText = `
        margin: 0 0 20px 0;
        font-size: 14px;
        color: #6b7280;
    `;
    modal.appendChild(subtitle);

    // Suggestions container
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
    `;

    // Track if any chord is playing with melody (shared across all buttons)
    let isPlayingWithMelody = false;

    // Create a row for each measure
    suggestions.forEach((measure, measureIndex) => {
        const measureRow = document.createElement('div');
        measureRow.style.cssText = `
            background-color: #f9fafb;
            border-radius: 8px;
            padding: 12px;
            border: 1px solid #e5e7eb;
        `;

        // Measure header
        const measureHeader = document.createElement('div');
        measureHeader.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        `;

        const measureLabelContainer = document.createElement('div');
        measureLabelContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        const measureLabel = document.createElement('span');
        measureLabel.textContent = `Measure ${measure.measureIndex + 1}`;
        measureLabel.style.cssText = `
            font-weight: 600;
            font-size: 14px;
            color: #374151;
        `;
        measureLabelContainer.appendChild(measureLabel);

        measureHeader.appendChild(measureLabelContainer);

        const noteCount = document.createElement('span');
        noteCount.textContent = `${measure.noteCount} note${measure.noteCount !== 1 ? 's' : ''}`;
        noteCount.style.cssText = `
            font-size: 12px;
            color: #9ca3af;
        `;
        measureHeader.appendChild(noteCount);
        measureRow.appendChild(measureHeader);

        // Chord options
        const optionsContainer = document.createElement('div');
        optionsContainer.style.cssText = `
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        `;

        measure.suggestions.forEach((suggestion, suggestionIndex) => {
            const optionBtn = document.createElement('button');
            const chordSymbol = CHORD_DEFINITIONS[suggestion.type]?.symbol || '';
            const chordName = `${suggestion.root}${chordSymbol}`;

            // Check if this is the current chord
            const isCurrentChord = suggestion.reasons && suggestion.reasons.includes('Current chord');

            // Create button with play button, info icon and optional "Current" badge
            optionBtn.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-weight: 600; font-size: 14px;">${chordName}</span>
                            ${isCurrentChord ? '<span class="current-badge" style="font-size: 9px; padding: 2px 5px; background-color: #10b981; color: white; border-radius: 3px; font-weight: 600;">CURRENT</span>' : ''}
                        </div>
                        <div class="score-text" style="font-size: 12px; font-weight: 600; color: #4b5563;">${suggestion.score}% match</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        ${onPlayChordWithMelody ? '<span class="play-icon" style="font-size: 10px; color: #111827; background-color: white; border: 1px solid #d1d5db; border-radius: 3px; padding: 2px 4px; cursor: pointer;" title="Play chord with melody">▶</span>' : ''}
                        <span class="info-icon" style="font-size: 12px; color: #9ca3af; cursor: help;">ⓘ</span>
                    </div>
                </div>
            `;

            const isSelected = selections[measureIndex] === suggestionIndex;
            optionBtn.style.cssText = `
                flex: 1;
                min-width: 100px;
                padding: 10px 12px;
                border-radius: 6px;
                cursor: pointer;
                text-align: left;
                transition: all 0.15s ease;
                position: relative;
                ${isSelected
                    ? 'background-color: #3b82f6; color: white; border: 2px solid #3b82f6;'
                    : 'background-color: white; color: #374151; border: 2px solid #e5e7eb;'
                }
            `;

            // Update button styles on selection change
            const updateButtonStyle = (btn, selected) => {
                if (selected) {
                    btn.style.backgroundColor = '#3b82f6';
                    btn.style.color = 'white';
                    btn.style.borderColor = '#3b82f6';
                    const scoreText = btn.querySelector('.score-text');
                    if (scoreText) scoreText.style.color = 'rgba(255, 255, 255, 0.8)';
                    const infoIcon = btn.querySelector('.info-icon');
                    if (infoIcon) infoIcon.style.color = 'rgba(255, 255, 255, 0.6)';
                } else {
                    btn.style.backgroundColor = 'white';
                    btn.style.color = '#374151';
                    btn.style.borderColor = '#e5e7eb';
                    const scoreText = btn.querySelector('.score-text');
                    if (scoreText) scoreText.style.color = '#6b7280';
                    const infoIcon = btn.querySelector('.info-icon');
                    if (infoIcon) infoIcon.style.color = '#9ca3af';
                }
            };

            optionBtn.onclick = (e) => {
                // If clicking on info icon, show tooltip instead
                if (e.target.classList.contains('info-icon')) {
                    showHarmonizeTooltip(e, suggestion, chordName);
                    return;
                }

                // If clicking on play icon, play chord with melody
                if (e.target.classList.contains('play-icon')) {
                    e.stopPropagation();
                    isPlayingWithMelody = true;
                    if (onPlayChordWithMelody) {
                        const measureMelodyNotes = notesByMeasure[measure.measureIndex] || [];
                        onPlayChordWithMelody(suggestion.root, suggestion.type, measureMelodyNotes, 0, tempo);
                    }
                    return;
                }
            };

            // Select and preview on mousedown for simultaneous highlighting and playback
            optionBtn.onmousedown = (e) => {
                if (e.target.classList.contains('info-icon')) return;
                if (e.target.classList.contains('play-icon')) return;

                // Reset the playing with melody flag since user is doing a regular preview
                isPlayingWithMelody = false;

                // Select this chord
                selections[measureIndex] = suggestionIndex;
                // Update all buttons in this measure
                const buttons = optionsContainer.querySelectorAll('button:not(.tooltip-close)');
                buttons.forEach((btn, idx) => {
                    updateButtonStyle(btn, idx === suggestionIndex);
                });

                // Play chord preview
                if (onPlayChord) {
                    onPlayChord(suggestion.root, suggestion.type, 0);
                }
            };

            optionBtn.onmouseup = (e) => {
                if (e.target.classList.contains('info-icon')) return;
                if (e.target.classList.contains('play-icon')) return;
                if (isPlayingWithMelody) return;
                if (onStopChord) onStopChord();
            };

            optionBtn.onmouseleave = () => {
                // Only stop chord preview if not playing with melody
                if (!isPlayingWithMelody && onStopChord) onStopChord();
                // Hide tooltip on mouse leave (with small delay to allow moving to tooltip)
                setTimeout(() => {
                    const tooltip = document.getElementById('harmonize-tooltip');
                    if (tooltip && !tooltip.matches(':hover')) {
                        tooltip.remove();
                    }
                }, 100);
            };

            // Hover support for info icon tooltip
            const infoIcon = optionBtn.querySelector('.info-icon');
            if (infoIcon) {
                infoIcon.onmouseenter = (e) => {
                    showHarmonizeTooltip(e, suggestion, chordName);
                };
                infoIcon.ontouchstart = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showHarmonizeTooltip(e, suggestion, chordName);
                };
            }

            optionsContainer.appendChild(optionBtn);
        });

        measureRow.appendChild(optionsContainer);
        suggestionsContainer.appendChild(measureRow);
    });

    modal.appendChild(suggestionsContainer);

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding-top: 16px;
        border-top: 1px solid #e5e7eb;
    `;

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        background-color: white;
        color: #374151;
        border: 1px solid #d1d5db;
        transition: all 0.15s ease;
    `;
    cancelBtn.onmouseenter = () => {
        cancelBtn.style.backgroundColor = '#f3f4f6';
    };
    cancelBtn.onmouseleave = () => {
        cancelBtn.style.backgroundColor = 'white';
    };
    cancelBtn.onclick = () => overlay.remove();
    buttonContainer.appendChild(cancelBtn);

    // Apply button
    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply Harmonization';
    applyBtn.style.cssText = `
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        background-color: #3b82f6;
        color: white;
        border: none;
        transition: all 0.15s ease;
    `;
    applyBtn.onmouseenter = () => {
        applyBtn.style.backgroundColor = '#2563eb';
    };
    applyBtn.onmouseleave = () => {
        applyBtn.style.backgroundColor = '#3b82f6';
    };
    applyBtn.onclick = () => {
        // Apply the selected harmonization
        const chordProgression = applyHarmonizeSuggestions(suggestions, selections);
        if (onApply) {
            onApply(chordProgression);
        }
        overlay.remove();
    };
    buttonContainer.appendChild(applyBtn);

    modal.appendChild(buttonContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Handle escape key
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

/**
 * Show tooltip with chord recommendation details
 * @param {Event} event - Click/touch event
 * @param {Object} suggestion - Chord suggestion data
 * @param {string} chordName - Display name of the chord
 */
function showHarmonizeTooltip(event, suggestion, chordName) {
    // Remove existing tooltip
    const existingTooltip = document.getElementById('harmonize-tooltip');
    if (existingTooltip) existingTooltip.remove();

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'harmonize-tooltip';
    tooltip.style.cssText = `
        position: fixed;
        background-color: white;
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        z-index: 100000;
        max-width: 280px;
        font-size: 13px;
        border: 1px solid #e5e7eb;
    `;

    // Build reasons list
    const reasonsList = suggestion.reasons && suggestion.reasons.length > 0
        ? suggestion.reasons.map(r => `<li style="margin-bottom: 4px;">${r}</li>`).join('')
        : '<li>An interesting harmonic choice</li>';

    // Check if this is the current chord
    const isCurrentChord = suggestion.reasons && suggestion.reasons.includes('Current chord');

    tooltip.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 600; font-size: 15px; color: #111827;">${chordName}</span>
                ${isCurrentChord ? '<span style="font-size: 9px; padding: 2px 5px; background-color: #10b981; color: white; border-radius: 3px; font-weight: 600;">CURRENT</span>' : ''}
            </div>
            <button class="tooltip-close" style="
                background: none;
                border: none;
                font-size: 20px;
                color: #9ca3af;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
            " aria-label="Close tooltip">×</button>
        </div>
        <div style="margin-bottom: 12px;">
            <div style="font-weight: 500; color: #374151; margin-bottom: 4px;">Why this chord?</div>
            <ul style="margin: 0; padding-left: 16px; color: #6b7280; font-size: 12px;">
                ${reasonsList}
            </ul>
        </div>
        <div style="
            background-color: #f3f4f6;
            padding: 10px;
            border-radius: 4px;
            margin-top: 8px;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 11px; color: #6b7280;">Overall Match</span>
                <span style="font-weight: 700; color: #3b82f6; font-size: 14px;">${suggestion.score}%</span>
            </div>
            ${suggestion.matchPercentage !== undefined ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 10px; color: #9ca3af;">Melody Notes Match</span>
                <span style="font-size: 11px; color: #6b7280;">${suggestion.matchPercentage}%</span>
            </div>
            ` : ''}
            ${suggestion.voiceLeadingScore !== undefined ? `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 10px; color: #9ca3af;">Voice Leading</span>
                <span style="font-size: 11px; color: #6b7280;">${suggestion.voiceLeadingScore}%</span>
            </div>
            ` : ''}
        </div>
        <div style="font-size: 10px; color: #9ca3af; margin-top: 8px; text-align: center;">
            Click chord to select • Hold to preview
        </div>
    `;

    document.body.appendChild(tooltip);

    // Position tooltip near the event
    const rect = event.target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    let top = rect.bottom + 8;

    // Keep within viewport
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
    }
    if (top + tooltipRect.height > window.innerHeight - 10) {
        top = rect.top - tooltipRect.height - 8;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    // Close button handler
    const closeBtn = tooltip.querySelector('.tooltip-close');
    closeBtn.onclick = (e) => {
        e.stopPropagation();
        tooltip.remove();
    };
    closeBtn.onmouseenter = () => {
        closeBtn.style.backgroundColor = '#f3f4f6';
        closeBtn.style.color = '#374151';
    };
    closeBtn.onmouseleave = () => {
        closeBtn.style.backgroundColor = 'transparent';
        closeBtn.style.color = '#9ca3af';
    };

    // Close when clicking outside
    const closeHandler = (e) => {
        if (!tooltip.contains(e.target) && e.target.id !== 'harmonize-tooltip') {
            tooltip.remove();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeHandler);
    }, 100);
}

export default showAutoHarmonizeModal;
