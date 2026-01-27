/**
 * Chord Suggestion Modal UI Component
 * Reusable modal for displaying chord suggestions with style/mood controls
 * Styled to match the Chord Builder modal
 * Now uses the comprehensive 3D recommendation engine
 */

import { generateComprehensiveRecommendations } from '../features/comprehensiveChordRecommendations.js';
import { generateChordSequences, describeSequence, generateSequenceReason } from '../features/chordSequences.js';
import { SUGGESTION_STYLES, SUGGESTION_MOODS } from '../features/unifiedChordSuggestions.js';
import { CHORD_DEFINITIONS, INVERSION_NAMES } from '../../data/music-data.js';
import {
    getCurrentKey,
    getProgressionData,
    getContextAwareMode,
    setContextAwareMode,
    getProgressionLookback,
    setProgressionLookback
} from '../state/trainerState.js';
// chordExplorerModal is lazy-loaded when needed (2000+ lines)
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

    // Mode Toggle (Current Chord vs Context Aware)
    const modeControl = document.createElement('div');
    const modeLabel = document.createElement('label');
    modeLabel.textContent = 'Mode:';
    modeLabel.style.fontSize = '11px';
    modeLabel.style.fontWeight = '600';
    modeLabel.style.color = '#374151';
    modeLabel.style.display = 'block';
    modeLabel.style.marginBottom = '4px';
    modeControl.appendChild(modeLabel);

    const modeToggleContainer = document.createElement('div');
    modeToggleContainer.style.display = 'flex';
    modeToggleContainer.style.gap = '4px';
    modeToggleContainer.style.backgroundColor = '#f3f4f6';
    modeToggleContainer.style.borderRadius = '4px';
    modeToggleContainer.style.padding = '2px';

    let contextMode = getContextAwareMode();

    const currentChordBtn = document.createElement('button');
    currentChordBtn.textContent = 'Current Chord';
    currentChordBtn.style.padding = '4px 8px';
    currentChordBtn.style.border = 'none';
    currentChordBtn.style.borderRadius = '3px';
    currentChordBtn.style.cursor = 'pointer';
    currentChordBtn.style.fontSize = '10px';
    currentChordBtn.style.fontWeight = '600';
    currentChordBtn.style.transition = 'all 0.2s';

    const contextAwareBtn = document.createElement('button');
    contextAwareBtn.textContent = 'Context Aware';
    contextAwareBtn.style.padding = '4px 8px';
    contextAwareBtn.style.border = 'none';
    contextAwareBtn.style.borderRadius = '3px';
    contextAwareBtn.style.cursor = 'pointer';
    contextAwareBtn.style.fontSize = '10px';
    contextAwareBtn.style.fontWeight = '600';
    contextAwareBtn.style.transition = 'all 0.2s';

    const updateModeButtons = () => {
        if (contextMode) {
            currentChordBtn.style.backgroundColor = 'transparent';
            currentChordBtn.style.color = '#6b7280';
            contextAwareBtn.style.backgroundColor = 'white';
            contextAwareBtn.style.color = '#2563eb';
        } else {
            currentChordBtn.style.backgroundColor = 'white';
            currentChordBtn.style.color = '#2563eb';
            contextAwareBtn.style.backgroundColor = 'transparent';
            contextAwareBtn.style.color = '#6b7280';
        }
    };

    updateModeButtons();

    currentChordBtn.addEventListener('click', () => {
        contextMode = false;
        setContextAwareMode(false);
        updateModeButtons();
        lookbackControl.style.display = 'none';
        renderSuggestions(styleSelect.value, moodSelect.value, contextMode);
    });

    contextAwareBtn.addEventListener('click', () => {
        contextMode = true;
        setContextAwareMode(true);
        updateModeButtons();
        lookbackControl.style.display = 'block';
        renderSuggestions(styleSelect.value, moodSelect.value, contextMode);
    });

    modeToggleContainer.appendChild(currentChordBtn);
    modeToggleContainer.appendChild(contextAwareBtn);
    modeControl.appendChild(modeToggleContainer);
    controlsRow.appendChild(modeControl);

    // Lookback Depth Control (only visible in Context Aware mode) - DROPDOWN
    const lookbackControl = document.createElement('div');
    lookbackControl.style.display = contextMode ? 'block' : 'none';

    const lookbackLabel = document.createElement('label');
    lookbackLabel.textContent = 'Analyze:';
    lookbackLabel.style.fontSize = '11px';
    lookbackLabel.style.fontWeight = '600';
    lookbackLabel.style.color = '#374151';
    lookbackLabel.style.display = 'block';
    lookbackLabel.style.marginBottom = '4px';
    lookbackControl.appendChild(lookbackLabel);

    const lookbackDropdown = document.createElement('select');
    lookbackDropdown.style.width = '120px';
    lookbackDropdown.style.padding = '4px 6px';
    lookbackDropdown.style.border = '1px solid #d1d5db';
    lookbackDropdown.style.borderRadius = '4px';
    lookbackDropdown.style.fontSize = '11px';
    lookbackDropdown.style.backgroundColor = 'white';
    lookbackDropdown.style.cursor = 'pointer';

    // Create options for 1-8 chords
    for (let i = 1; i <= 8; i++) {
        const option = document.createElement('option');
        option.value = i.toString();
        option.textContent = `Last ${i} chord${i === 1 ? '' : 's'}`;
        if (i === getProgressionLookback()) {
            option.selected = true;
        }
        lookbackDropdown.appendChild(option);
    }

    lookbackDropdown.addEventListener('change', () => {
        const value = parseInt(lookbackDropdown.value);
        setProgressionLookback(value);
        if (contextMode) {
            renderSuggestions(styleSelect.value, moodSelect.value, contextMode);
        }
    });

    lookbackControl.appendChild(lookbackDropdown);
    controlsRow.appendChild(lookbackControl);

    // Rhythm Awareness Toggle
    const rhythmControl = document.createElement('div');
    rhythmControl.style.display = 'flex';
    rhythmControl.style.flexDirection = 'column';

    const rhythmLabel = document.createElement('label');
    rhythmLabel.textContent = 'Duration:';
    rhythmLabel.style.fontSize = '11px';
    rhythmLabel.style.fontWeight = '600';
    rhythmLabel.style.color = '#374151';
    rhythmLabel.style.display = 'block';
    rhythmLabel.style.marginBottom = '4px';
    rhythmControl.appendChild(rhythmLabel);

    const rhythmToggleContainer = document.createElement('div');
    rhythmToggleContainer.style.display = 'flex';
    rhythmToggleContainer.style.alignItems = 'center';
    rhythmToggleContainer.style.gap = '6px';
    rhythmToggleContainer.style.height = '28px';

    const rhythmCheckbox = document.createElement('input');
    rhythmCheckbox.type = 'checkbox';
    rhythmCheckbox.id = 'rhythm-awareness-toggle';
    rhythmCheckbox.checked = localStorage.getItem('chord-suggestion-rhythm-awareness') !== 'false';
    rhythmCheckbox.style.width = '16px';
    rhythmCheckbox.style.height = '16px';
    rhythmCheckbox.style.cursor = 'pointer';
    rhythmCheckbox.style.accentColor = '#667eea';

    const rhythmCheckboxLabel = document.createElement('label');
    rhythmCheckboxLabel.htmlFor = 'rhythm-awareness-toggle';
    rhythmCheckboxLabel.textContent = 'Suggest';
    rhythmCheckboxLabel.style.fontSize = '11px';
    rhythmCheckboxLabel.style.color = '#374151';
    rhythmCheckboxLabel.style.cursor = 'pointer';
    rhythmCheckboxLabel.style.userSelect = 'none';
    rhythmCheckboxLabel.title = 'When enabled, suggestions include recommended chord durations based on harmonic rhythm analysis';

    rhythmCheckbox.addEventListener('change', () => {
        localStorage.setItem('chord-suggestion-rhythm-awareness', rhythmCheckbox.checked ? 'true' : 'false');
        // Dispatch event so other components can react
        window.dispatchEvent(new CustomEvent('rhythmAwarenessChanged', {
            detail: { enabled: rhythmCheckbox.checked }
        }));
    });

    rhythmToggleContainer.appendChild(rhythmCheckbox);
    rhythmToggleContainer.appendChild(rhythmCheckboxLabel);
    rhythmControl.appendChild(rhythmToggleContainer);
    controlsRow.appendChild(rhythmControl);

    // Rhythmic Context Info Panel (Phase 5.6) - shows current harmonic rhythm analysis
    const rhythmInfoPanel = document.createElement('div');
    rhythmInfoPanel.id = 'rhythm-context-info';
    rhythmInfoPanel.style.cssText = 'display: none; padding: 8px 12px; background: #f5f3ff; border-radius: 6px; margin-left: auto; font-size: 11px; color: #4b5563; max-width: 220px;';

    const updateRhythmInfo = () => {
        if (!rhythmCheckbox.checked) {
            rhythmInfoPanel.style.display = 'none';
            return;
        }

        // Try to get rhythmic context from CompositionContext
        if (window.getCompositionContext) {
            try {
                const ctx = window.getCompositionContext();
                const rhythmicSnapshot = ctx.getRhythmicSnapshot ? ctx.getRhythmicSnapshot() : null;

                if (rhythmicSnapshot && rhythmicSnapshot.totalChords > 0) {
                    rhythmInfoPanel.style.display = 'block';
                    const trendEmoji = {
                        'accelerating': '⬇️',
                        'decelerating': '⬆️',
                        'steady': '➡️',
                        'varied': '↔️',
                        'unknown': '❓'
                    };
                    const trend = rhythmicSnapshot.harmonicRhythmTrend || 'unknown';
                    rhythmInfoPanel.innerHTML = `
                        <div style="font-weight: 600; margin-bottom: 4px; color: #6366f1;">⏱ Rhythmic Context</div>
                        <div style="display: grid; gap: 2px;">
                            <span>Avg: <strong>${rhythmicSnapshot.averageDuration || 4}</strong> beats</span>
                            <span>Trend: ${trendEmoji[trend] || '❓'} <strong>${trend}</strong></span>
                            ${rhythmicSnapshot.detectedPattern ? `<span>Pattern: <strong>${rhythmicSnapshot.detectedPattern.name}</strong></span>` : ''}
                        </div>
                    `;
                } else {
                    rhythmInfoPanel.style.display = 'block';
                    rhythmInfoPanel.innerHTML = `
                        <div style="font-weight: 600; color: #6366f1;">⏱ Rhythmic Context</div>
                        <div style="color: #9ca3af;">No chords yet - using style defaults</div>
                    `;
                }
            } catch (e) {
                rhythmInfoPanel.style.display = 'none';
            }
        }
    };

    // Update rhythm info when toggle changes
    rhythmCheckbox.addEventListener('change', updateRhythmInfo);
    // Initial update
    setTimeout(updateRhythmInfo, 100);

    controlsRow.appendChild(rhythmInfoPanel);

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

        // Lazy load the chord explorer modal (2000+ lines)
        import('./chordExplorerModal.js').then(module => {
            module.showChordExplorerModal(
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
    inversionLabel.textContent = 'Change Chord Inversion:';
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
        
        // Helper function to update button highlighting
        const updateButtonHighlighting = () => {
            inversionButtonsContainer.querySelectorAll('button').forEach(btn => {
                const btnInv = parseInt(btn.dataset.inversion);
                btn.style.borderColor = btnInv === inv ? '#667eea' : '#d1d5db';
                btn.style.backgroundColor = btnInv === inv ? '#667eea' : 'white';
                btn.style.color = btnInv === inv ? 'white' : '#374151';
                btn.style.fontWeight = btnInv === inv ? '600' : '500';
            });
        };
        
        // Hold-to-play functionality
        invBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            // Update highlighting immediately when playback starts
            updateButtonHighlighting();
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
        
        // Touch events for mobile/tablet
        invBtn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // Update highlighting immediately when playback starts
            updateButtonHighlighting();
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
        }, { passive: false });
        
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
        invBtn.addEventListener('touchend', (e) => {
            e.stopPropagation();
            e.preventDefault();
            stopHeld(e);
        }, { passive: false });
        invBtn.addEventListener('touchcancel', (e) => {
            e.stopPropagation();
            e.preventDefault();
            stopHeld(e);
        }, { passive: false });
        invBtn.addEventListener('mouseleave', (e) => {
            stopHeld(e);
            if (parseInt(invBtn.dataset.inversion) !== activeInversion) {
                invBtn.style.backgroundColor = 'white';
            }
        });
        
        invBtn.addEventListener('click', () => {
            activeInversion = inv;
            // Highlighting already updated on mousedown, just update state and re-render
            // Update title
            const newInversionName = INVERSION_NAMES[inv] || `Inversion ${inv}`;
            title.textContent = `Suggested Next Chords After ${currentRoot}${chordSymbol} (${newInversionName})`;
            // Re-render suggestions with new inversion
            renderSuggestions(currentStyle, currentMood, contextMode);
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

        let isPlaying = false;
        let heldNotes = null;

        const startPlaying = (e) => {
            if (e) e.stopPropagation();
            // Update highlighting immediately (before any checks)
            btn.style.backgroundColor = '#e5e7eb';
            
            if (!isPlaying) {
                isPlaying = true;
                // Get chord notes for direct playback
                const key = getCurrentKey() || 'C';
                const res = getInvertedChordNotes(
                    root,
                    chordType,
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
            }
        };

        const stopPlaying = (e) => {
            if (e) e.stopPropagation();
            // Update highlighting immediately
            if (isPlaying) {
                isPlaying = false;
                // Stop playback
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
            }
            // Reset to default color
            btn.style.backgroundColor = '#f9fafb';
        };

        btn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startPlaying(e);
        });

        btn.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            stopPlaying(e);
        });

        btn.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
            stopPlaying(e);
        });
        
        // Touch events for mobile/tablet
        btn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startPlaying(e);
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

        btn.addEventListener('mouseenter', () => {
            if (!isPlaying) {
                btn.style.backgroundColor = '#f3f4f6';
            }
        });

        btn.addEventListener('mouseleave', (e) => {
            // Only reset hover color if not playing (stopPlaying handles the reset when playing)
            if (!isPlaying) {
                btn.style.backgroundColor = '#f9fafb';
            }
        });

        return btn;
    };

    // Function to play a chord sequence
    const playChordSequence = (sequence, gap = 500) => {
        let currentIndex = 0;

        const playNext = () => {
            if (currentIndex >= sequence.length) {
                return; // Sequence finished
            }

            const chord = sequence[currentIndex];

            // Play the current chord
            if (onPlayChord) {
                onPlayChord(chord.type, chord.root, chord.inversion);
            }

            // Schedule next chord or stop
            setTimeout(() => {
                if (onStopChord) onStopChord();

                currentIndex++;
                if (currentIndex < sequence.length) {
                    setTimeout(playNext, gap); // Gap between chords
                }
            }, 800); // Play each chord for 800ms
        };

        playNext();
    };

    // Function to show loading splash screen
    const showLoadingSplash = () => {
        suggestionsContainer.innerHTML = '';
        const loadingDiv = document.createElement('div');
        loadingDiv.style.display = 'flex';
        loadingDiv.style.flexDirection = 'column';
        loadingDiv.style.alignItems = 'center';
        loadingDiv.style.justifyContent = 'center';
        loadingDiv.style.padding = '40px 20px';
        loadingDiv.style.color = '#6b7280';

        const iconContainer = document.createElement('div');
        iconContainer.style.fontSize = '48px';
        iconContainer.style.marginBottom = '16px';
        iconContainer.innerHTML = '🎵 🎶';
        iconContainer.style.animation = 'pulse 1.5s ease-in-out infinite';

        const loadingText = document.createElement('div');
        loadingText.textContent = 'Updating Suggestions...';
        loadingText.style.fontSize = '16px';
        loadingText.style.fontWeight = '600';
        loadingText.style.color = '#374151';

        loadingDiv.appendChild(iconContainer);
        loadingDiv.appendChild(loadingText);
        suggestionsContainer.appendChild(loadingDiv);

        // Add keyframe animation for pulse
        if (!document.getElementById('pulse-animation-style')) {
            const style = document.createElement('style');
            style.id = 'pulse-animation-style';
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.1); }
                }
            `;
            document.head.appendChild(style);
        }
    };

    // Function to render chord sequence suggestions
    const renderSequenceSuggestions = (style, mood, tensionDirection, key, progressionData, lookbackDepth) => {
        // Show loading splash
        showLoadingSplash();

        // Use setTimeout to allow UI to update before heavy computation
        setTimeout(() => {
            // Generate sequences (pass contextMode for weight calculation)
            const sequences = generateChordSequences(
                currentRoot,
                currentChordType,
                activeInversion,
                progressionData,
                key,
                style,
                mood,
                tensionDirection,
                lookbackDepth,
                3,    // Generate 3-chord sequences
                10,   // Return top 10
                null, // sectionInfo
                getContextAwareMode()  // contextMode for weight calculation
            );

            // Clear loading screen
            suggestionsContainer.innerHTML = '';

            if (sequences.length === 0) {
                const noResultsMsg = document.createElement('p');
                noResultsMsg.textContent = 'No sequences found. Try adjusting the settings or add more chords to your progression.';
                noResultsMsg.style.color = '#6b7280';
                noResultsMsg.style.fontStyle = 'italic';
                suggestionsContainer.appendChild(noResultsMsg);
                return;
            }

            // Display each sequence
            sequences.forEach((seq, index) => {
            const card = document.createElement('div');
            card.style.padding = '16px';
            card.style.marginBottom = '16px';
            card.style.backgroundColor = '#f8fafc';
            card.style.border = '2px solid #e2e8f0';
            card.style.borderRadius = '6px';
            card.style.transition = 'all 0.2s';

            card.addEventListener('mouseenter', () => {
                card.style.backgroundColor = '#f1f5f9';
                card.style.borderColor = '#cbd5e1';
            });

            card.addEventListener('mouseleave', () => {
                card.style.backgroundColor = '#f8fafc';
                card.style.borderColor = '#e2e8f0';
            });

            // Sequence header
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.marginBottom = '12px';

            const sequenceTitle = document.createElement('div');
            sequenceTitle.style.fontWeight = '600';
            sequenceTitle.style.color = '#1e293b';
            sequenceTitle.style.fontSize = '14px';

            const stars = seq.score >= 85 ? '⭐⭐⭐' : seq.score >= 70 ? '⭐⭐' : '⭐';
            sequenceTitle.innerHTML = `${stars} Sequence #${index + 1} <span style="color: #64748b; font-weight: normal; font-size: 12px;">(Score: ${seq.score})</span>`;
            header.appendChild(sequenceTitle);

            card.appendChild(header);

            // Sequence path visualization - Include current chord as first
            const pathContainer = document.createElement('div');
            pathContainer.style.marginBottom = '12px';
            pathContainer.style.display = 'flex';
            pathContainer.style.alignItems = 'center';
            pathContainer.style.gap = '8px';
            pathContainer.style.flexWrap = 'wrap';

            // Create array with current chord first, then sequence chords
            const fullSequence = [
                { root: currentRoot, type: currentChordType, inversion: activeInversion, isCurrent: true },
                ...seq.chords.map(c => ({ ...c, isCurrent: false }))
            ];

            fullSequence.forEach((chord, chordIndex) => {
                const chordBox = document.createElement('button');
                chordBox.style.display = 'inline-block';
                chordBox.style.padding = '6px 10px';
                chordBox.style.backgroundColor = chord.isCurrent ? '#64748b' : '#3b82f6';
                chordBox.style.color = 'white';
                chordBox.style.borderRadius = '4px';
                chordBox.style.fontSize = '12px';
                chordBox.style.fontWeight = '600';
                chordBox.style.border = 'none';
                chordBox.style.cursor = 'pointer';
                chordBox.style.transition = 'all 0.2s';
                chordBox.title = 'Hold to play';

                const symbol = CHORD_DEFINITIONS[chord.type]?.symbol || '';
                const invName = chord.inversion > 0 ? ` (${INVERSION_NAMES[chord.inversion] || 'inv' + chord.inversion})` : '';
                chordBox.textContent = `${chord.root}${symbol}${invName}`;

                // Add current chord badge
                if (chord.isCurrent) {
                    const badge = document.createElement('span');
                    badge.textContent = ' (Current)';
                    badge.style.fontSize = '9px';
                    badge.style.opacity = '0.8';
                    chordBox.appendChild(document.createTextNode(' '));
                    chordBox.appendChild(badge);
                }

                // Make chord box playable (hold to play)
                let isPlaying = false;
                let heldNotes = null;

                const startPlaying = (e) => {
                    if (e) e.stopPropagation();
                    // Update highlighting immediately
                    chordBox.style.backgroundColor = chord.isCurrent ? '#475569' : '#2563eb';
                    
                    if (onPlayChord && !isPlaying) {
                        isPlaying = true;
                        // Get chord notes for direct playback
                        const key = getCurrentKey() || 'C';
                        const res = getInvertedChordNotes(
                            chord.root,
                            chord.type,
                            chord.inversion,
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
                    }
                };

                const stopPlaying = (e) => {
                    if (e) e.stopPropagation();
                    // Update highlighting immediately
                    if (isPlaying) {
                        isPlaying = false;
                        // Stop playback
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
                    }
                    // Reset to default color
                    chordBox.style.backgroundColor = chord.isCurrent ? '#64748b' : '#3b82f6';
                };

                chordBox.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    startPlaying(e);
                });
                chordBox.addEventListener('mouseup', (e) => {
                    e.stopPropagation();
                    stopPlaying(e);
                });
                chordBox.addEventListener('mouseleave', (e) => {
                    e.stopPropagation();
                    stopPlaying(e);
                });
                chordBox.addEventListener('touchstart', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    startPlaying(e);
                }, { passive: false });
                chordBox.addEventListener('touchend', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    stopPlaying(e);
                }, { passive: false });
                chordBox.addEventListener('touchcancel', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    stopPlaying(e);
                }, { passive: false });

                chordBox.addEventListener('mouseenter', () => {
                    if (!isPlaying) {
                        chordBox.style.backgroundColor = chord.isCurrent ? '#475569' : '#2563eb';
                    }
                });
                chordBox.addEventListener('mouseleave', (e) => {
                    // Only reset hover color if not playing (stopPlaying handles the reset when playing)
                    if (!isPlaying) {
                        chordBox.style.backgroundColor = chord.isCurrent ? '#64748b' : '#3b82f6';
                    }
                });

                pathContainer.appendChild(chordBox);

                if (chordIndex < fullSequence.length - 1) {
                    const arrow = document.createElement('span');
                    arrow.textContent = '→';
                    arrow.style.color = '#64748b';
                    arrow.style.fontSize = '18px';
                    arrow.style.fontWeight = '600';
                    pathContainer.appendChild(arrow);
                }
            });

            card.appendChild(pathContainer);

            // Reason text
            const reason = document.createElement('div');
            reason.style.fontSize = '12px';
            reason.style.color = '#475569';
            reason.style.marginBottom = '12px';
            reason.textContent = generateSequenceReason(seq.chords, seq.score, key);
            card.appendChild(reason);

            // Action buttons
            const buttonRow = document.createElement('div');
            buttonRow.style.display = 'flex';
            buttonRow.style.gap = '8px';
            buttonRow.style.flexWrap = 'wrap';

            // Play Sequence button
            const playBtn = document.createElement('button');
            playBtn.innerHTML = '▶️ Play Sequence';
            playBtn.style.padding = '8px 12px';
            playBtn.style.backgroundColor = '#10b981';
            playBtn.style.color = 'white';
            playBtn.style.border = 'none';
            playBtn.style.borderRadius = '4px';
            playBtn.style.cursor = 'pointer';
            playBtn.style.fontSize = '12px';
            playBtn.style.fontWeight = '600';
            playBtn.style.transition = 'background-color 0.2s';

            playBtn.addEventListener('mouseenter', () => {
                playBtn.style.backgroundColor = '#059669';
            });
            playBtn.addEventListener('mouseleave', () => {
                playBtn.style.backgroundColor = '#10b981';
            });

            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                playChordSequence(seq.chords);
            });

            buttonRow.appendChild(playBtn);

            // Add All to Progression button
            const addAllBtn = document.createElement('button');
            addAllBtn.innerHTML = '➕ Add All to Progression';
            addAllBtn.style.padding = '8px 12px';
            addAllBtn.style.backgroundColor = '#3b82f6';
            addAllBtn.style.color = 'white';
            addAllBtn.style.border = 'none';
            addAllBtn.style.borderRadius = '4px';
            addAllBtn.style.cursor = 'pointer';
            addAllBtn.style.fontSize = '12px';
            addAllBtn.style.fontWeight = '600';
            addAllBtn.style.transition = 'background-color 0.2s';

            addAllBtn.addEventListener('mouseenter', () => {
                addAllBtn.style.backgroundColor = '#2563eb';
            });
            addAllBtn.addEventListener('mouseleave', () => {
                addAllBtn.style.backgroundColor = '#3b82f6';
            });

            addAllBtn.addEventListener('click', async (e) => {
                e.stopPropagation();

                // Disable button during addition
                addAllBtn.disabled = true;
                addAllBtn.style.opacity = '0.6';
                addAllBtn.style.cursor = 'not-allowed';

                // Add all chords in sequence to progression (skipping current chord)
                // Add them sequentially with delay to ensure state management completes
                for (let i = 0; i < seq.chords.length; i++) {
                    const chord = seq.chords[i];
                    if (onAddChord) {
                        // Wrap in try-catch to handle any errors gracefully
                        try {
                            onAddChord(chord.type, chord.root, chord.inversion);
                            // Wait 100ms between additions to allow UI to update
                            // This gives users visual feedback as each chord is added
                            await new Promise(resolve => setTimeout(resolve, 100));
                        } catch (error) {
                            console.error('Error adding chord:', error);
                        }
                    }
                }

                // Visual feedback
                addAllBtn.textContent = `✓ Added ${seq.chords.length} chords!`;
                addAllBtn.style.backgroundColor = '#10b981';
                addAllBtn.style.opacity = '1';

                setTimeout(() => {
                    addAllBtn.textContent = '➕ Add All to Progression';
                    addAllBtn.style.backgroundColor = '#3b82f6';
                    addAllBtn.disabled = false;
                    addAllBtn.style.cursor = 'pointer';
                }, 1500);
            });

            buttonRow.appendChild(addAllBtn);

            card.appendChild(buttonRow);
            suggestionsContainer.appendChild(card);
            });
        }, 10); // Small delay to show loading screen
    };

    // Function to render suggestions
    const renderSuggestions = (style, mood, isContextMode = false) => {
        // Show loading splash immediately
        showLoadingSplash();

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

        // Get progression data for context-aware mode
        const progressionData = getProgressionData();
        const lookbackDepth = getProgressionLookback();

        if (isContextMode && progressionData.length > 0) {
            // Context-Aware Mode: Generate and display chord sequences
            renderSequenceSuggestions(style, mood, tensionDirection, key, progressionData, lookbackDepth);
        } else {
            // Current Chord Mode: Generate single chord suggestions
            renderSingleChordSuggestions(style, mood, tensionDirection, key);
        }
    };

    // Function to render single chord suggestions (original behavior)
    const renderSingleChordSuggestions = (style, mood, tensionDirection, key) => {
        // Use setTimeout to allow UI to update before heavy computation
        setTimeout(() => {
            // Generate comprehensive suggestions using 3D scoring system
            const recommendations = generateComprehensiveRecommendations(
                currentRoot,
                currentChordType,
                activeInversion,
                key,
                style,
                mood,
                tensionDirection
            );

            // Clear loading screen
            suggestionsContainer.innerHTML = '';

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
        }, 10); // Small delay to show loading screen
    };

    // Initial render
    renderSuggestions(currentStyle, currentMood, contextMode);

    // Add change listeners
    styleSelect.onchange = () => {
        renderSuggestions(styleSelect.value, moodSelect.value, contextMode);
    };

    moodSelect.onchange = () => {
        renderSuggestions(styleSelect.value, moodSelect.value, contextMode);
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
        renderSuggestions(style, mood, contextMode);
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
            renderSuggestions(currentStyle, currentMood, contextMode);
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
