/**
 * Chord Suggestion Modal UI Component
 * Reusable modal for displaying chord suggestions with style/mood controls
 * Styled to match the Chord Builder modal
 * Now uses the comprehensive 3D recommendation engine
 */

import { generateComprehensiveRecommendations } from '../features/comprehensiveChordRecommendations.js';
import { SUGGESTION_STYLES, SUGGESTION_MOODS } from '../features/unifiedChordSuggestions.js';
import { CHORD_DEFINITIONS, INVERSION_NAMES } from '../../data/music-data.js';
import { getCurrentKey } from '../state/trainerState.js';
import { showChordExplorerModal } from './chordExplorerModal.js';

/**
 * Show chord suggestion modal
 * @param {string} currentChordType - Current chord type
 * @param {string} currentRoot - Current root note
 * @param {number} currentInversion - Current inversion
 * @param {Function} onAddChord - Callback when user clicks "Add to Progression"
 * @param {Function} onPlayChord - Callback when user wants to preview a chord (start playing)
 * @param {Function} onStopChord - Callback when user releases the button (stop playing)
 */
export function showChordSuggestionModal(currentChordType, currentRoot, currentInversion = 0, onAddChord, onPlayChord, onStopChord) {
    // Remove existing modal if any
    const existingModal = document.getElementById('unified-chord-suggestion-modal');
    if (existingModal) existingModal.remove();

    // Get saved preferences or defaults
    let currentStyle = localStorage.getItem('chord-suggestion-style') || 'balanced';
    let currentMood = localStorage.getItem('chord-suggestion-mood') || 'bright';

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'unified-chord-suggestion-modal';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '99999';
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    };

    // Create modal content
    const modal = document.createElement('div');
    modal.style.backgroundColor = 'white';
    modal.style.borderRadius = '8px';
    modal.style.padding = '24px';
    modal.style.maxWidth = '500px';
    modal.style.maxHeight = '80vh';
    modal.style.overflowY = 'auto';
    modal.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1)';
    modal.onclick = (e) => e.stopPropagation();

    const inversionName = INVERSION_NAMES[currentInversion] || `Inversion ${currentInversion}`;
    const chordSymbol = CHORD_DEFINITIONS[currentChordType]?.symbol || '';

    // Title container with close button
    const titleContainer = document.createElement('div');
    titleContainer.style.display = 'flex';
    titleContainer.style.justifyContent = 'space-between';
    titleContainer.style.alignItems = 'flex-start';
    titleContainer.style.marginBottom = '16px';
    
    // Title
    const title = document.createElement('h2');
    title.textContent = `Suggested Next Chords After ${currentRoot}${chordSymbol} (${inversionName})`;
    title.style.margin = '0';
    title.style.fontSize = '18px';
    title.style.fontWeight = '600';
    title.style.color = '#111827';
    title.style.flex = '1';
    titleContainer.appendChild(title);
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '28px';
    closeBtn.style.color = '#6b7280';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '0';
    closeBtn.style.width = '32px';
    closeBtn.style.height = '32px';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.style.borderRadius = '4px';
    closeBtn.style.lineHeight = '1';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.backgroundColor = '#f3f4f6';
        closeBtn.style.color = '#111827';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.backgroundColor = 'transparent';
        closeBtn.style.color = '#6b7280';
    });
    closeBtn.addEventListener('click', () => {
        overlay.remove();
    });
    titleContainer.appendChild(closeBtn);
    
    modal.appendChild(titleContainer);

    // Style & Mood Controls (sticky at top)
    const controlsRow = document.createElement('div');
    controlsRow.style.display = 'grid';
    controlsRow.style.gridTemplateColumns = '1fr 1fr';
    controlsRow.style.gap = '12px';
    controlsRow.style.marginBottom = '16px';
    controlsRow.style.position = 'sticky';
    controlsRow.style.top = '-24px'; // Offset modal padding to stick to very top
    controlsRow.style.marginLeft = '-24px'; // Offset modal padding
    controlsRow.style.marginRight = '-24px'; // Offset modal padding
    controlsRow.style.paddingLeft = '24px'; // Restore padding for content
    controlsRow.style.paddingRight = '24px'; // Restore padding for content
    controlsRow.style.paddingTop = '8px';
    controlsRow.style.paddingBottom = '8px';
    controlsRow.style.backgroundColor = 'white';
    controlsRow.style.zIndex = '10';
    controlsRow.style.borderBottom = '1px solid #e5e7eb';

    // Style selector
    const styleControl = document.createElement('div');
    const styleLabel = document.createElement('label');
    styleLabel.textContent = 'Musical Style:';
    styleLabel.style.fontSize = '12px';
    styleLabel.style.fontWeight = '600';
    styleLabel.style.color = '#374151';
    styleLabel.style.display = 'block';
    styleLabel.style.marginBottom = '4px';
    styleControl.appendChild(styleLabel);

    const styleSelect = document.createElement('select');
    styleSelect.id = 'suggestion-modal-style';
    styleSelect.style.width = '100%';
    styleSelect.style.padding = '6px 8px';
    styleSelect.style.border = '1px solid #d1d5db';
    styleSelect.style.borderRadius = '4px';
    styleSelect.style.fontSize = '12px';
    styleSelect.style.backgroundColor = 'white';

    SUGGESTION_STYLES.forEach(s => {
        const option = document.createElement('option');
        option.value = s.id;
        option.textContent = s.label;
        if (s.id === currentStyle) option.selected = true;
        styleSelect.appendChild(option);
    });
    styleControl.appendChild(styleSelect);
    controlsRow.appendChild(styleControl);

    // Mood selector
    const moodControl = document.createElement('div');
    const moodLabel = document.createElement('label');
    moodLabel.textContent = 'Intended Mood:';
    moodLabel.style.fontSize = '12px';
    moodLabel.style.fontWeight = '600';
    moodLabel.style.color = '#374151';
    moodLabel.style.display = 'block';
    moodLabel.style.marginBottom = '4px';
    moodControl.appendChild(moodLabel);

    const moodSelect = document.createElement('select');
    moodSelect.id = 'suggestion-modal-mood';
    moodSelect.style.width = '100%';
    moodSelect.style.padding = '6px 8px';
    moodSelect.style.border = '1px solid #d1d5db';
    moodSelect.style.borderRadius = '4px';
    moodSelect.style.fontSize = '12px';
    moodSelect.style.backgroundColor = 'white';

    SUGGESTION_MOODS.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.label;
        if (m.id === currentMood) option.selected = true;
        moodSelect.appendChild(option);
    });
    moodControl.appendChild(moodSelect);
    controlsRow.appendChild(moodControl);

    modal.appendChild(controlsRow);

    // Suggestions container
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.id = 'modal-suggestions-container';
    modal.appendChild(suggestionsContainer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Helper to create hold-to-play buttons
    const createHoldPlayButton = (label, chordType, root, inv) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.padding = '6px 8px';
        btn.style.fontSize = '11px';
        btn.style.border = '1px solid #d1d5db';
        btn.style.borderRadius = '4px';
        btn.style.backgroundColor = '#f9fafb';
        btn.style.color = '#111827';
        btn.style.cursor = 'pointer';
        btn.style.transition = 'all 0.15s';
        btn.style.flex = '1';
        btn.style.minWidth = '120px';

        btn.addEventListener('mouseenter', () => { btn.style.backgroundColor = '#f3f4f6'; });
        btn.addEventListener('mouseleave', () => { btn.style.backgroundColor = '#f9fafb'; });

        let isPlaying = false;
        btn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (onPlayChord && !isPlaying) {
                isPlaying = true;
                onPlayChord(chordType, root, inv);
                btn.style.backgroundColor = '#e5e7eb';
            }
        });

        const stopPlaying = (e) => {
            if (e) e.stopPropagation();
            if (isPlaying) {
                isPlaying = false;
                btn.style.backgroundColor = '#f9fafb';
                if (onStopChord) onStopChord();
            }
        };

        btn.addEventListener('mouseup', stopPlaying);
        btn.addEventListener('mouseleave', stopPlaying);

        return btn;
    };

    // Function to render suggestions
    const renderSuggestions = (style, mood) => {
        suggestionsContainer.innerHTML = '';

        // Save preferences
        localStorage.setItem('chord-suggestion-style', style);
        localStorage.setItem('chord-suggestion-mood', mood);

        // Get musical key context
        const key = getCurrentKey() || 'C';

        // Determine tension direction based on mood
        let tensionDirection = 'maintain';
        if (mood === 'bright' || mood === 'calm') {
            tensionDirection = 'resolve';
        } else if (mood === 'tense' || mood === 'energetic') {
            tensionDirection = 'build';
        }

        // Generate comprehensive suggestions using 3D scoring system
        const recommendations = generateComprehensiveRecommendations(
            currentRoot,
            currentChordType,
            currentInversion,
            key,
            style,
            mood,
            tensionDirection
        );

        // Transform to expected format
        const suggestions = recommendations.map(rec => ({
            nextRoot: rec.root,
            nextChord: rec.type,
            nextInversion: rec.inversion,
            reason: rec.reason,
            confidence: rec.confidence
        }));

        // Display each suggestion
        suggestions.forEach((suggestion) => {
            const card = document.createElement('div');
            card.style.padding = '12px';
            card.style.marginBottom = '12px';
            card.style.backgroundColor = '#f3f4f6';
            card.style.borderLeft = '4px solid #60a5fa';
            card.style.borderRadius = '4px';
            card.style.cursor = 'pointer';
            card.style.transition = 'all 0.2s';

            card.addEventListener('mouseenter', () => {
                card.style.backgroundColor = '#e5e7eb';
                card.style.borderLeftColor = '#3b82f6';
            });

            card.addEventListener('mouseleave', () => {
                card.style.backgroundColor = '#f3f4f6';
                card.style.borderLeftColor = '#60a5fa';
            });

            // Chord header
            const chordHeader = document.createElement('div');
            chordHeader.style.fontWeight = '600';
            chordHeader.style.marginBottom = '4px';
            chordHeader.style.color = '#1f2937';
            chordHeader.style.display = 'flex';
            chordHeader.style.alignItems = 'center';
            chordHeader.style.gap = '6px';

            const nextSymbol = CHORD_DEFINITIONS[suggestion.nextChord]?.symbol || '';
            const nextInvName = INVERSION_NAMES[suggestion.nextInversion] || `Inversion ${suggestion.nextInversion}`;
            const stars = suggestion.confidence >= 90 ? '⭐⭐⭐' : suggestion.confidence >= 75 ? '⭐⭐' : '⭐';

            chordHeader.innerHTML = `
                <span>→ ${suggestion.nextRoot}${nextSymbol} (${nextInvName})</span>
                <span style="font-size: 10px;">${stars}</span>
            `;
            card.appendChild(chordHeader);

            // Playback row (Current vs Next)
            const playbackRow = document.createElement('div');
            playbackRow.style.display = 'flex';
            playbackRow.style.gap = '8px';
            playbackRow.style.margin = '8px 0';
            playbackRow.style.flexWrap = 'wrap';
            playbackRow.style.alignItems = 'center';

            // Stop propagation so clicking buttons doesn't trigger card click
            playbackRow.addEventListener('click', (e) => e.stopPropagation());
            playbackRow.addEventListener('mousedown', (e) => e.stopPropagation());
            playbackRow.addEventListener('mouseup', (e) => e.stopPropagation());

            const currentSymbol = CHORD_DEFINITIONS[currentChordType]?.symbol || '';
            const currentInvName = INVERSION_NAMES[currentInversion] || currentInversion;
            const currentLabel = `Current: ${currentRoot}${currentSymbol} (${currentInvName})`;
            const nextLabel = `Next: ${suggestion.nextRoot}${nextSymbol} (${nextInvName})`;

            playbackRow.appendChild(createHoldPlayButton(currentLabel, currentChordType, currentRoot, currentInversion));
            playbackRow.appendChild(createHoldPlayButton(nextLabel, suggestion.nextChord, suggestion.nextRoot, suggestion.nextInversion));

            // Add to Progression button
            const addBtn = document.createElement('button');
            addBtn.textContent = '➕ Add to Progression';
            addBtn.style.padding = '6px 12px';
            addBtn.style.fontSize = '11px';
            addBtn.style.border = '1px solid #10b981';
            addBtn.style.borderRadius = '4px';
            addBtn.style.backgroundColor = '#10b981';
            addBtn.style.color = 'white';
            addBtn.style.cursor = 'pointer';
            addBtn.style.transition = 'all 0.15s';
            addBtn.style.fontWeight = '600';

            addBtn.addEventListener('mouseenter', () => {
                addBtn.style.backgroundColor = '#059669';
                addBtn.style.borderColor = '#059669';
            });

            addBtn.addEventListener('mouseleave', () => {
                addBtn.style.backgroundColor = '#10b981';
                addBtn.style.borderColor = '#10b981';
            });

            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onAddChord) {
                    onAddChord(suggestion.nextChord, suggestion.nextRoot, suggestion.nextInversion);
                }
                overlay.remove();
            });

            playbackRow.appendChild(addBtn);
            card.appendChild(playbackRow);

            // Reason
            const reason = document.createElement('div');
            reason.style.fontSize = '12px';
            reason.style.color = '#4b5563';
            reason.style.lineHeight = '1.4';
            reason.textContent = suggestion.reason;
            card.appendChild(reason);

            suggestionsContainer.appendChild(card);
        });
    };

    // Initial render
    renderSuggestions(currentStyle, currentMood);

    // Add change listeners
    styleSelect.onchange = () => {
        renderSuggestions(styleSelect.value, moodSelect.value);
    };

    moodSelect.onchange = () => {
        renderSuggestions(styleSelect.value, moodSelect.value);
    };
    
    // Show All Details button (opens 3D explorer)
    const showAllBtn = document.createElement('button');
    showAllBtn.textContent = '🔬 Show All Details (3D Explorer)';
    showAllBtn.style.marginTop = '16px';
    showAllBtn.style.padding = '10px 16px';
    showAllBtn.style.backgroundColor = '#667eea';
    showAllBtn.style.border = 'none';
    showAllBtn.style.borderRadius = '4px';
    showAllBtn.style.cursor = 'pointer';
    showAllBtn.style.fontWeight = '600';
    showAllBtn.style.width = '100%';
    showAllBtn.style.color = 'white';
    showAllBtn.style.fontSize = '14px';
    showAllBtn.addEventListener('mouseenter', () => {
        showAllBtn.style.backgroundColor = '#5568d3';
    });
    showAllBtn.addEventListener('mouseleave', () => {
        showAllBtn.style.backgroundColor = '#667eea';
    });
    showAllBtn.addEventListener('click', () => {
        const key = getCurrentKey() || 'C';
        // Use current values from dropdowns (user may have changed them)
        const selectedStyle = styleSelect.value;
        const selectedMood = moodSelect.value;
        let tensionDirection = 'maintain';
        if (selectedMood === 'bright' || selectedMood === 'calm') {
            tensionDirection = 'resolve';
        } else if (selectedMood === 'tense' || selectedMood === 'energetic') {
            tensionDirection = 'build';
        }

        showChordExplorerModal(
            currentRoot,
            currentChordType,
            currentInversion,
            key,
            selectedStyle,
            selectedMood,
            onAddChord, // Use the provided callback
            onPlayChord, // Use the provided callback
            onStopChord  // Use the provided callback
        );
    });
    modal.appendChild(showAllBtn);
    
    // Close button at bottom
    const closeBottomBtn = document.createElement('button');
    closeBottomBtn.textContent = 'Close';
    closeBottomBtn.style.marginTop = '16px';
    closeBottomBtn.style.padding = '8px 16px';
    closeBottomBtn.style.backgroundColor = '#e5e7eb';
    closeBottomBtn.style.border = '1px solid #d1d5db';
    closeBottomBtn.style.borderRadius = '4px';
    closeBottomBtn.style.cursor = 'pointer';
    closeBottomBtn.style.fontWeight = '600';
    closeBottomBtn.style.width = '100%';
    closeBottomBtn.addEventListener('click', () => overlay.remove());
    closeBottomBtn.addEventListener('mouseenter', () => closeBottomBtn.style.backgroundColor = '#d1d5db');
    closeBottomBtn.addEventListener('mouseleave', () => closeBottomBtn.style.backgroundColor = '#e5e7eb');
    modal.appendChild(closeBottomBtn);
}
