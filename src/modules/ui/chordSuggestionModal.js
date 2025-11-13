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
import { getInvertedChordNotes } from '../utils/noteUtils.js';

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
    // Track current inversion (can be changed by user)
    let activeInversion = currentInversion;

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
    modal.style.maxWidth = '850px';
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
    // Store handler for later cleanup
    const closeBtnHandler = () => overlay.remove();
    closeBtn.addEventListener('click', closeBtnHandler);
    titleContainer.appendChild(closeBtn);
    
    modal.appendChild(titleContainer);

    // Style & Mood Controls (sticky at top) with Show All button
    const controlsRow = document.createElement('div');
    controlsRow.style.display = 'flex';
    controlsRow.style.alignItems = 'flex-end';
    controlsRow.style.justifyContent = 'flex-start';
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
    controlsRow.style.flexWrap = 'wrap';

    // Style selector (compact)
    const styleControl = document.createElement('div');
    const styleLabel = document.createElement('label');
    styleLabel.textContent = 'Style:';
    styleLabel.style.fontSize = '11px';
    styleLabel.style.fontWeight = '600';
    styleLabel.style.color = '#374151';
    styleLabel.style.display = 'block';
    styleLabel.style.marginBottom = '4px';
    styleControl.appendChild(styleLabel);

    const styleSelect = document.createElement('select');
    styleSelect.id = 'suggestion-modal-style';
    styleSelect.style.width = '160px';
    styleSelect.style.padding = '4px 6px';
    styleSelect.style.border = '1px solid #d1d5db';
    styleSelect.style.borderRadius = '4px';
    styleSelect.style.fontSize = '11px';
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

    // Mood selector (compact)
    const moodControl = document.createElement('div');
    const moodLabel = document.createElement('label');
    moodLabel.textContent = 'Mood:';
    moodLabel.style.fontSize = '11px';
    moodLabel.style.fontWeight = '600';
    moodLabel.style.color = '#374151';
    moodLabel.style.display = 'block';
    moodLabel.style.marginBottom = '4px';
    moodControl.appendChild(moodLabel);

    const moodSelect = document.createElement('select');
    moodSelect.id = 'suggestion-modal-mood';
    moodSelect.style.width = '160px';
    moodSelect.style.padding = '4px 6px';
    moodSelect.style.border = '1px solid #d1d5db';
    moodSelect.style.borderRadius = '4px';
    moodSelect.style.fontSize = '11px';
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

    // Show All Details button (compact, inline, aligned with selectors)
    const showAllBtn = document.createElement('button');
    showAllBtn.textContent = '🔬 Show All';
    showAllBtn.style.padding = '4px 12px';
    showAllBtn.style.backgroundColor = '#667eea';
    showAllBtn.style.border = 'none';
    showAllBtn.style.borderRadius = '4px';
    showAllBtn.style.cursor = 'pointer';
    showAllBtn.style.fontWeight = '600';
    showAllBtn.style.color = 'white';
    showAllBtn.style.fontSize = '11px';
    showAllBtn.style.height = '28px';
    showAllBtn.style.alignSelf = 'flex-end';
    showAllBtn.title = 'Show All Details (3D Explorer)';
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
            activeInversion, // Use active inversion
            key,
            selectedStyle,
            selectedMood,
            onAddChord, // Use the provided callback
            onPlayChord, // Use the provided callback
            onStopChord  // Use the provided callback
        );
    });
    controlsRow.appendChild(showAllBtn);

    modal.appendChild(controlsRow);

    // Inversion selector row
    const inversionRow = document.createElement('div');
    inversionRow.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e5e7eb;
    `;
    
    const inversionLabel = document.createElement('label');
    inversionLabel.textContent = 'Current Chord Inversion:';
    inversionLabel.style.cssText = 'font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap;';
    inversionRow.appendChild(inversionLabel);
    
    const inversionButtonsContainer = document.createElement('div');
    inversionButtonsContainer.style.cssText = 'display: flex; gap: 4px; flex-wrap: wrap;';
    
    // Calculate max inversions for this chord type
    const chordDef = CHORD_DEFINITIONS[currentChordType];
    const maxInversion = chordDef ? Math.max(0, chordDef.intervals.length - 1) : 0;
    
    // Create inversion buttons
    for (let inv = 0; inv <= maxInversion; inv++) {
        const invBtn = document.createElement('button');
        invBtn.textContent = INVERSION_NAMES[inv] || `Inversion ${inv}`;
        invBtn.dataset.inversion = inv;
        invBtn.style.cssText = `
            padding: 6px 12px;
            border: 2px solid ${inv === activeInversion ? '#667eea' : '#d1d5db'};
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            font-weight: ${inv === activeInversion ? '600' : '500'};
            background-color: ${inv === activeInversion ? '#667eea' : 'white'};
            color: ${inv === activeInversion ? 'white' : '#374151'};
            transition: all 0.2s;
        `;
        let heldNotes = null;
        
        // Hold-to-play functionality
        invBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            const key = getCurrentKey() || 'C';
            const res = getInvertedChordNotes(
                currentRoot,
                currentChordType,
                inv,
                key,
                0, // octave shift
                'sharp', // enharmonic preference
                'full' // notation preference
            );
            heldNotes = res.specificNotes || [];
            const instrument = window.getInstrument && window.getInstrument();
            if (instrument && heldNotes.length > 0) {
                const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                const baseTime = Tone.now() + 0.01;
                if (isGuitar) {
                    heldNotes.forEach((n, idx) => instrument.triggerAttack(n, baseTime + idx * 0.0001));
                } else {
                    instrument.triggerAttack(heldNotes, Tone.now());
                }
            }
        });
        
        const stopHeld = (e) => {
            if (e) e.stopPropagation();
            const instrument = window.getInstrument && window.getInstrument();
            if (instrument && heldNotes && heldNotes.length > 0) {
                const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                if (isGuitar) {
                    heldNotes.forEach(n => {
                        try { instrument.triggerRelease(n, Tone.now()); } catch (_) {}
                    });
                } else {
                    instrument.triggerRelease(heldNotes, Tone.now());
                }
                heldNotes = null;
            }
        };
        
        invBtn.addEventListener('mouseup', stopHeld);
        invBtn.addEventListener('mouseleave', (e) => {
            stopHeld(e);
            if (parseInt(invBtn.dataset.inversion) !== activeInversion) {
                invBtn.style.backgroundColor = 'white';
            }
        });
        
        invBtn.addEventListener('click', () => {
            activeInversion = inv;
            // Update button styles
            inversionButtonsContainer.querySelectorAll('button').forEach(btn => {
                const btnInv = parseInt(btn.dataset.inversion);
                btn.style.borderColor = btnInv === inv ? '#667eea' : '#d1d5db';
                btn.style.backgroundColor = btnInv === inv ? '#667eea' : 'white';
                btn.style.color = btnInv === inv ? 'white' : '#374151';
                btn.style.fontWeight = btnInv === inv ? '600' : '500';
            });
            // Update title
            const newInversionName = INVERSION_NAMES[inv] || `Inversion ${inv}`;
            title.textContent = `Suggested Next Chords After ${currentRoot}${chordSymbol} (${newInversionName})`;
            // Re-render suggestions with new inversion
            renderSuggestions(currentStyle, currentMood);
            // Dispatch event to sync with Explorer modal
            const event = new CustomEvent('chord-suggestion-inversion-changed', {
                detail: { inversion: inv }
            });
            document.dispatchEvent(event);
        });
        invBtn.addEventListener('mouseenter', () => {
            if (parseInt(invBtn.dataset.inversion) !== activeInversion) {
                invBtn.style.backgroundColor = '#f3f4f6';
            }
        });
        inversionButtonsContainer.appendChild(invBtn);
    }
    
    inversionRow.appendChild(inversionButtonsContainer);
    modal.appendChild(inversionRow);

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
        
        // Touch events for mobile/tablet
        btn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (onPlayChord && !isPlaying) {
                isPlaying = true;
                onPlayChord(chordType, root, inv);
                btn.style.backgroundColor = '#e5e7eb';
            }
        }, { passive: false });
        
        btn.addEventListener('touchend', (e) => {
            e.stopPropagation();
            e.preventDefault();
            stopPlaying(e);
        }, { passive: false });
        
        btn.addEventListener('touchcancel', (e) => {
            e.stopPropagation();
            e.preventDefault();
            stopPlaying(e);
        }, { passive: false });

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
            activeInversion, // Use active inversion instead of currentInversion
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
            const currentInvName = INVERSION_NAMES[activeInversion] || activeInversion;
            const currentLabel = `Current: ${currentRoot}${currentSymbol} (${currentInvName})`;
            const nextLabel = `Next: ${suggestion.nextRoot}${nextSymbol} (${nextInvName})`;

            playbackRow.appendChild(createHoldPlayButton(currentLabel, currentChordType, currentRoot, activeInversion));
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
    
    // Listen for changes from the Comprehensive Chord Explorer modal
    const preferenceChangeHandler = (e) => {
        const { style, mood } = e.detail;
        // Update the dropdowns to match
        if (styleSelect.value !== style) {
            styleSelect.value = style;
        }
        if (moodSelect.value !== mood) {
            moodSelect.value = mood;
        }
        // Update current values and re-render
        currentStyle = style;
        currentMood = mood;
        renderSuggestions(style, mood);
    };
    document.addEventListener('chord-suggestion-preference-changed', preferenceChangeHandler);
    
    // Listen for inversion changes from the Comprehensive Chord Explorer modal
    const inversionChangeHandler = (e) => {
        const { inversion } = e.detail;
        if (inversion !== activeInversion && inversion <= maxInversion) {
            activeInversion = inversion;
            // Update button styles
            inversionButtonsContainer.querySelectorAll('button').forEach(btn => {
                const btnInv = parseInt(btn.dataset.inversion);
                btn.style.borderColor = btnInv === inversion ? '#667eea' : '#d1d5db';
                btn.style.backgroundColor = btnInv === inversion ? '#667eea' : 'white';
                btn.style.color = btnInv === inversion ? 'white' : '#374151';
                btn.style.fontWeight = btnInv === inversion ? '600' : '500';
            });
            // Update title
            const newInversionName = INVERSION_NAMES[inversion] || `Inversion ${inversion}`;
            title.textContent = `Suggested Next Chords After ${currentRoot}${chordSymbol} (${newInversionName})`;
            // Re-render suggestions
            renderSuggestions(currentStyle, currentMood);
        }
    };
    document.addEventListener('chord-suggestion-inversion-changed', inversionChangeHandler);
    
    // Update close button to clean up event listeners
    closeBtn.removeEventListener('click', closeBtnHandler);
    closeBtn.addEventListener('click', () => {
        document.removeEventListener('chord-suggestion-preference-changed', preferenceChangeHandler);
        document.removeEventListener('chord-suggestion-inversion-changed', inversionChangeHandler);
        overlay.remove();
    });
    
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
    closeBottomBtn.addEventListener('click', () => {
        document.removeEventListener('chord-suggestion-preference-changed', preferenceChangeHandler);
        document.removeEventListener('chord-suggestion-inversion-changed', inversionChangeHandler);
        overlay.remove();
    });
    closeBottomBtn.addEventListener('mouseenter', () => closeBottomBtn.style.backgroundColor = '#d1d5db');
    closeBottomBtn.addEventListener('mouseleave', () => closeBottomBtn.style.backgroundColor = '#e5e7eb');
    modal.appendChild(closeBottomBtn);
    
    // Clean up event listeners when modal is closed via overlay click
    const originalOverlayClick = overlay.onclick;
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            document.removeEventListener('chord-suggestion-preference-changed', preferenceChangeHandler);
            document.removeEventListener('chord-suggestion-inversion-changed', inversionChangeHandler);
            if (originalOverlayClick) originalOverlayClick(e);
        }
    };
}
