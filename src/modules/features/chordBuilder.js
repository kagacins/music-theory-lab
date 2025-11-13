/**
 * Chord Builder Feature Module
 *
 * Contains all chord builder tab functionality including:
 * - Chord playback and visualization
 * - Root note, chord type, and interval selection
 * - Inversion controls
 * - Octave shifting
 * - Voicing editor
 * - Arpeggio playback
 * - Add to progression
 * - Left hand accompaniment
 */

// Import state management
import {
    getBuilderRootIndex,
    setBuilderRootIndex,
    getBuilderChordType,
    setBuilderChordType,
    getBuilderInversion,
    setBuilderInversion,
    getBuilderOctaveShift,
    setBuilderOctaveShift,
    getBuilderChordNotes,
    setBuilderChordNotes,
    getBuilderSelectionMode,
    setBuilderSelectionMode,
    getBuilderIntervalType,
    setBuilderIntervalType,
    getBuilderOmittedNotes,
    setBuilderOmittedNotes,
    getBuilderLHOmittedNotes,
    setBuilderLHOmittedNotes
} from '../state/builderState.js';

import {
    getCurrentTab,
    getEnharmonicPreference,
    getNotationPreference,
    getIsSuggestionEngineOn
} from '../state/globalState.js';

import { getTrainerState, getCurrentKey } from '../state/trainerState.js';

// Import comprehensive chord recommendation engine (evaluates all roots, types, inversions)
import { generateComprehensiveRecommendations } from './comprehensiveChordRecommendations.js';

// Import chord explorer for detailed 3D visualization
import { showChordExplorerModal } from '../ui/chordExplorerModal.js';

// =========================================================================
// Helper Function: Create Tooltip for Button
// =========================================================================

/**
 * Creates a custom tooltip for a button that appears on hover
 * Uses fixed positioning to avoid overflow clipping issues
 * @param {HTMLElement} button - The button element to attach tooltip to
 * @param {string} tooltipText - The text to display in the tooltip
 * @param {string} chordType - (Optional) The chord type, used to show inversion options
 */
function createButtonTooltip(button, tooltipText, chordType = null) {
    if (!tooltipText || tooltipText.length === 0) return null;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'chord-button-tooltip';
    if (chordType) {
        tooltip.setAttribute('data-chord-type', chordType);
    }
    
    // Style it for fixed positioning (to avoid overflow clipping)
    tooltip.style.position = 'fixed';
    tooltip.style.backgroundColor = '#111827';
    tooltip.style.color = 'white';
    tooltip.style.fontSize = '12px';
    tooltip.style.fontWeight = '500';
    tooltip.style.borderRadius = '6px';
    tooltip.style.padding = '8px 12px';
    tooltip.style.pointerEvents = 'auto';
    tooltip.style.whiteSpace = 'normal';
    tooltip.style.wordWrap = 'break-word';
    tooltip.style.maxWidth = '320px';
    tooltip.style.textAlign = 'left';
    tooltip.style.lineHeight = '1.5';
    tooltip.style.zIndex = '99999';
    tooltip.style.opacity = '0';
    tooltip.style.visibility = 'hidden';
    tooltip.style.transition = 'opacity 0.15s ease-in-out, visibility 0.15s ease-in-out';
    tooltip.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
    tooltip.style.border = '1px solid #374151';
    
    // Style the first line (name) to be bold and slightly larger
    const lines = tooltipText.split('\n');
    if (lines.length > 1) {
        const nameLine = lines[0];
        const descriptionLines = lines.slice(1).join('\n').trim();
        let tooltipHTML = `<div style="font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #fbbf24;">${nameLine}</div><div style="font-weight: 400; font-size: 12px;">${descriptionLines}</div>`;
        
        // Add inversion buttons if this is a chord
        if (chordType && CHORD_DEFINITIONS[chordType]) {
            const chordDef = CHORD_DEFINITIONS[chordType];
            const maxInversion = chordDef.intervals.length - 1;
            tooltipHTML += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #4b5563;">
                <div style="font-size: 11px; font-weight: 600; margin-bottom: 4px; color: #60a5fa;">Inversions:</div>
                <div style="display: flex; gap: 4px; flex-wrap: wrap;" class="inversion-buttons-container">`;
            
            for (let i = 0; i <= maxInversion; i++) {
                const invName = INVERSION_NAMES[i] || `${i}`;
                tooltipHTML += `<button data-inversion="${i}" class="tooltip-inversion-btn" style="
                    padding: 4px 8px;
                    font-size: 11px;
                    background-color: #374151;
                    color: white;
                    border: 1px solid #4b5563;
                    border-radius: 3px;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-weight: 500;
                " onmouseover="if(!this.classList.contains('selected')) this.style.backgroundColor='#4b5563'" onmouseout="if(!this.classList.contains('selected')) this.style.backgroundColor='#374151'">${invName}</button>`;
            }
            
            tooltipHTML += `</div></div>`;
        }
        
        tooltip.innerHTML = tooltipHTML;
    } else {
        tooltip.textContent = tooltipText;
    }
    
    document.body.appendChild(tooltip);
    
    // Add event listeners to inversion buttons
    if (chordType) {
        const inversionButtons = tooltip.querySelectorAll('[data-inversion]');
        
        // Function to update button highlighting
        const updateButtonHighlight = (selectedIndex) => {
            inversionButtons.forEach(btn => {
                const btnIndex = parseInt(btn.dataset.inversion, 10);
                if (btnIndex === selectedIndex) {
                    btn.classList.add('selected');
                    btn.style.backgroundColor = '#fbbf24'; // Amber/gold for selected
                    btn.style.borderColor = '#f59e0b';
                    btn.style.color = '#111827';
                    btn.style.fontWeight = '600';
                } else {
                    btn.classList.remove('selected');
                    btn.style.backgroundColor = '#374151';
                    btn.style.borderColor = '#4b5563';
                    btn.style.color = 'white';
                    btn.style.fontWeight = '500';
                }
            });
        };
        
        inversionButtons.forEach(btn => {
            // Play while button is pressed/held
            btn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                const inversionIndex = parseInt(btn.dataset.inversion, 10);
                // First ensure the correct chord type is selected (without playing)
                selectBuilderChordType(chordType, false);
                // Then select the inversion and start playing
                selectBuilderInversion(inversionIndex, false);
                startBuilderChord();
                // Store the selected chord+inversion for suggestion generation
                window.lastTooltipChordSelection = { chordType, inversion: inversionIndex };
                // Update button highlighting
                updateButtonHighlight(inversionIndex);
                // Keep tooltip open for trying other inversions
            });
            
            // Stop playing when button is released
            btn.addEventListener('mouseup', (e) => {
                e.stopPropagation();
                stopBuilderChord();
            });
            
            // Stop playing if mouse leaves button while pressed
            btn.addEventListener('mouseleave', (e) => {
                e.stopPropagation();
                stopBuilderChord();
            });
            
            // Touch events for mobile/tablet
            btn.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const inversionIndex = parseInt(btn.dataset.inversion, 10);
                // First ensure the correct chord type is selected (without playing)
                selectBuilderChordType(chordType, false);
                // Then select the inversion and start playing
                selectBuilderInversion(inversionIndex, false);
                startBuilderChord();
                // Store the selected chord+inversion for suggestion generation
                window.lastTooltipChordSelection = { chordType, inversion: inversionIndex };
                // Update button highlighting
                updateButtonHighlight(inversionIndex);
            }, { passive: false });
            
            btn.addEventListener('touchend', (e) => {
                e.stopPropagation();
                e.preventDefault();
                stopBuilderChord();
            }, { passive: false });
            
            btn.addEventListener('touchcancel', (e) => {
                e.stopPropagation();
                e.preventDefault();
                stopBuilderChord();
            }, { passive: false });
        });
        
        // Initialize highlighting if there's a stored selection for this chord
        if (window.lastTooltipChordSelection && window.lastTooltipChordSelection.chordType === chordType) {
            updateButtonHighlight(window.lastTooltipChordSelection.inversion);
        }
    }
    
    // Add "Suggested Next Chords" button if this is a chord tooltip
    if (chordType && lines.length > 1) {
        const suggestionsBtn = document.createElement('button');
        suggestionsBtn.textContent = '💡 Suggested Next';
        suggestionsBtn.style.marginTop = '8px';
        suggestionsBtn.style.padding = '4px 8px';
        suggestionsBtn.style.fontSize = '10px';
        suggestionsBtn.style.backgroundColor = '#60a5fa';
        suggestionsBtn.style.color = 'white';
        suggestionsBtn.style.border = '1px solid #3b82f6';
        suggestionsBtn.style.borderRadius = '3px';
        suggestionsBtn.style.cursor = 'pointer';
        suggestionsBtn.style.width = '100%';
        suggestionsBtn.style.fontWeight = '600';
        suggestionsBtn.style.transition = 'all 0.2s';
        suggestionsBtn.onmouseover = () => suggestionsBtn.style.backgroundColor = '#3b82f6';
        suggestionsBtn.onmouseout = () => suggestionsBtn.style.backgroundColor = '#60a5fa';
        suggestionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const selectedInversion = window.lastTooltipChordSelection?.inversion || 0;
            showChordSuggestionsModal(chordType, selectedInversion);
        });
        tooltip.appendChild(suggestionsBtn);
    }
    
    // Track tooltip timeout for touch devices
    let tooltipTimeout = null;
    
    // Detect if device supports touch
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Mouse enter: show tooltip above button (with delay on touch devices)
    button.addEventListener('mouseenter', (e) => {
        // Check if button is being held (touch device)
        const isHeld = button.dataset.held === 'true';
        
        // Don't show tooltip if button is being held
        if (isHeld) {
            return;
        }
        
        // Clear any existing timeout
        if (tooltipTimeout) clearTimeout(tooltipTimeout);
        
        const showTooltip = () => {
            // Double-check button is not being held
            if (button.dataset.held !== 'true') {
                const rect = button.getBoundingClientRect();
                const tooltipHeight = chordType ? 200 : 80;
                tooltip.style.left = (rect.left + rect.width / 2) + 'px';
                tooltip.style.top = (rect.top - tooltipHeight - 12) + 'px';
                tooltip.style.transform = 'translateX(-50%)';
                tooltip.style.opacity = '1';
                tooltip.style.visibility = 'visible';
            }
        };
        
        // On touch devices, delay tooltip to allow playback to continue
        if (isTouchDevice) {
            tooltipTimeout = setTimeout(showTooltip, 500); // 500ms delay on touch devices
        } else {
            // Desktop: show immediately
            showTooltip();
        }
    });
    
    // Mouse leave: hide tooltip
    button.addEventListener('mouseleave', () => {
        // Clear any pending tooltip timeout
        if (tooltipTimeout) {
            clearTimeout(tooltipTimeout);
            tooltipTimeout = null;
        }
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
    });
    
    // Keep tooltip visible when hovering over it
    tooltip.addEventListener('mouseenter', () => {
        tooltip.style.opacity = '1';
        tooltip.style.visibility = 'visible';
    });
    
    tooltip.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
    });
    
    return tooltip;
}

/**
 * Creates a chord tooltip with inversion selection buttons
 * @param {HTMLElement} button - The button element to attach tooltip to
 * @param {string} chordName - Name of the chord
 * @param {string} chordDescription - Description of the chord
 * @param {string} chordType - Type of chord (for inversion lookup)
 */
function createChordButtonTooltip(button, chordName, chordDescription, chordType) {
    if (!chordName || !chordDescription) return;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'chord-button-tooltip-interactive';
    
    // Get number of inversions available for this chord
    const chordDef = CHORD_DEFINITIONS[chordType];
    const maxInversion = chordDef ? chordDef.intervals.length - 1 : 0;
    
    // Build HTML content with name, description, and inversion buttons
    let html = `<div style="font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #fbbf24;">${chordName}</div>`;
    html += `<div style="font-weight: 400; font-size: 12px; margin-bottom: 8px;">${chordDescription}</div>`;
    html += `<div style="font-weight: 500; font-size: 11px; margin-bottom: 4px; color: #d1d5db;">Inversions:</div>`;
    html += `<div style="display: flex; gap: 4px; flex-wrap: wrap;">`;
    
    for (let inv = 0; inv <= maxInversion; inv++) {
        const invName = INVERSION_NAMES[inv] || `Inv${inv}`;
        html += `<button class="inversion-button" data-inversion="${inv}" style="padding: 3px 8px; background-color: #374151; color: #d1d5db; border: 1px solid #4b5563; border-radius: 3px; font-size: 11px; cursor: pointer; transition: all 0.15s; white-space: nowrap;" onmouseover="this.style.backgroundColor='#4b5563'; this.style.color='#f3f4f6';" onmouseout="this.style.backgroundColor='#374151'; this.style.color='#d1d5db';">${invName}</button>`;
    }
    
    html += `</div>`;
    tooltip.innerHTML = html;
    
    // Style the container
    tooltip.style.position = 'fixed';
    tooltip.style.backgroundColor = '#111827';
    tooltip.style.color = 'white';
    tooltip.style.borderRadius = '6px';
    tooltip.style.padding = '8px 12px';
    tooltip.style.pointerEvents = 'auto'; // Allow interaction with buttons
    tooltip.style.maxWidth = '340px';
    tooltip.style.textAlign = 'left';
    tooltip.style.zIndex = '99999';
    tooltip.style.opacity = '0';
    tooltip.style.visibility = 'hidden';
    tooltip.style.transition = 'opacity 0.15s ease-in-out, visibility 0.15s ease-in-out';
    tooltip.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
    tooltip.style.border = '1px solid #374151';
    
    document.body.appendChild(tooltip);
    
    // Add click handlers to inversion buttons
    tooltip.querySelectorAll('.inversion-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const inversion = parseInt(btn.dataset.inversion, 10);
            selectBuilderInversion(inversion, true); // true = play audio
            
            // Update the display (which updates Chord Voicing section and inversions)
            updateBuilderDisplay();
            
            // Hide tooltip after selection
            tooltip.style.opacity = '0';
            tooltip.style.visibility = 'hidden';
        });
    });
    
    // Mouse enter: show tooltip above button
    button.addEventListener('mouseenter', () => {
        const rect = button.getBoundingClientRect();
        const tooltipHeight = 140; // Larger for inversion buttons
        
        tooltip.style.left = (rect.left + rect.width / 2) + 'px';
        tooltip.style.top = (rect.top - tooltipHeight - 12) + 'px';
        tooltip.style.transform = 'translateX(-50%)';
        
        tooltip.style.opacity = '1';
        tooltip.style.visibility = 'visible';
    });
    
    // Mouse leave: hide tooltip
    button.addEventListener('mouseleave', () => {
        setTimeout(() => {
            // Only hide if mouse is not over tooltip
            if (!tooltip.matches(':hover')) {
                tooltip.style.opacity = '0';
                tooltip.style.visibility = 'hidden';
            }
        }, 50);
    });
    
    // Keep tooltip visible when hovering over it
    tooltip.addEventListener('mouseenter', () => {
        tooltip.style.opacity = '1';
        tooltip.style.visibility = 'visible';
    });
    
    tooltip.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
    });
}

// =========================================================================
// Chord Suggestion Generation and Modal
// =========================================================================

/**
 * Generate chord suggestions using comprehensive 3D scoring system.
 *
 * Evaluates ALL possible next chords across three dimensions:
 * 1. Root Note (12 chromatic possibilities)
 * 2. Chord Type (Major, Minor, 7th variants, etc.)
 * 3. Inversion (Root, 1st, 2nd, etc.)
 *
 * Plus a 4th dimension: Tension Direction (resolve, maintain, build)
 *
 * Each (root, type, inversion) combination is scored based on:
 * - Voice leading quality (30%): bass movement, common tones, total movement, range, contrary motion
 * - Harmonic function (35%): tonic → subdominant → dominant relationships
 * - Style fit (20%): pop, jazz, classical, rock, indie preferences
 * - Mood fit (15%): bright, dark, jazzy, tense, calm, energetic
 *
 * Returns top 10 recommendations with different roots (not just variations on the same root).
 *
 * @param {string} currentChordType - Current chord type (e.g., 'Major', 'Minor 7th')
 * @param {number} currentInversion - Current inversion (0, 1, 2, etc.)
 * @param {string} rootNote - Current root note (e.g., 'C', 'D', 'F#')
 * @param {string} enhPref - Enharmonic preference (not used, kept for compatibility)
 * @param {string} notationPref - Notation preference (not used, kept for compatibility)
 * @param {string} style - Musical style ('balanced', 'pop', 'jazz', 'classical', 'rock', 'indie')
 * @param {string} mood - Intended mood ('bright', 'dark', 'jazzy', 'tense', 'calm', 'energetic')
 * @returns {Array<{root:string, type:string, inversion:number, reason:string, confidence:number}>}
 */
function generateChordSuggestions(currentChordType, currentInversion, rootNote, enhPref, notationPref, style = 'balanced', mood = 'bright') {
    // Get current musical key (defaults to C if not set)
    const key = getCurrentKey() || 'C';

    // Determine tension direction based on mood
    // - 'bright', 'calm' moods favor resolution
    // - 'tense', 'energetic' moods favor building tension
    // - Other moods maintain tension
    let tensionDirection = 'maintain';
    if (mood === 'bright' || mood === 'calm') {
        tensionDirection = 'resolve';
    } else if (mood === 'tense' || mood === 'energetic') {
        tensionDirection = 'build';
    }

    // Use comprehensive recommendation engine
    const recommendations = generateComprehensiveRecommendations(
        rootNote,
        currentChordType,
        currentInversion,
        key,
        style,
        mood,
        tensionDirection
    );

    // Transform to expected format (rename 'root' and 'type' to match existing code)
    return recommendations.map(rec => ({
        nextRoot: rec.root,        // NEW: Now includes different root notes!
        nextChord: rec.type,       // Chord type (was 'nextChord')
        nextInversion: rec.inversion,
        reason: rec.reason,
        confidence: rec.confidence
    }));
}

/**
 * Show modal with chord suggestions
 * @param {string} chordType - The chord type to suggest from
 * @param {number} inversion - The selected inversion
 */
function showChordSuggestionsModal(chordType, inversion) {
    // Remove existing modal if any
    const existingModal = document.getElementById('chord-suggestions-modal');
    if (existingModal) existingModal.remove();
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'chord-suggestions-modal';
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
    
    // Create modal content
    const modal = document.createElement('div');
    modal.style.backgroundColor = 'white';
    modal.style.borderRadius = '8px';
    modal.style.padding = '24px';
    modal.style.maxWidth = '850px';
    modal.style.maxHeight = '80vh';
    modal.style.overflowY = 'auto';
    modal.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1)';
    
    const inversionName = INVERSION_NAMES[inversion] || `Inversion ${inversion}`;
    
    // Title container with close button
    const titleContainer = document.createElement('div');
    titleContainer.style.display = 'flex';
    titleContainer.style.justifyContent = 'space-between';
    titleContainer.style.alignItems = 'flex-start';
    titleContainer.style.marginBottom = '16px';
    
    // Title
    const title = document.createElement('h2');
    title.textContent = `Suggested Next Chords After ${chordType} (${inversionName})`;
    title.style.margin = '0';
    title.style.fontSize = '18px';
    title.style.fontWeight = '600';
    title.style.color = '#111827';
    title.style.flex = '1';
    titleContainer.appendChild(title);
    
    // Close button
    const closeXBtn = document.createElement('button');
    closeXBtn.innerHTML = '×';
    closeXBtn.style.background = 'none';
    closeXBtn.style.border = 'none';
    closeXBtn.style.fontSize = '28px';
    closeXBtn.style.color = '#6b7280';
    closeXBtn.style.cursor = 'pointer';
    closeXBtn.style.padding = '0';
    closeXBtn.style.width = '32px';
    closeXBtn.style.height = '32px';
    closeXBtn.style.display = 'flex';
    closeXBtn.style.alignItems = 'center';
    closeXBtn.style.justifyContent = 'center';
    closeXBtn.style.borderRadius = '4px';
    closeXBtn.style.lineHeight = '1';
    closeXBtn.title = 'Close';
    closeXBtn.addEventListener('mouseenter', () => {
        closeXBtn.style.backgroundColor = '#f3f4f6';
        closeXBtn.style.color = '#111827';
    });
    closeXBtn.addEventListener('mouseleave', () => {
        closeXBtn.style.backgroundColor = 'transparent';
        closeXBtn.style.color = '#6b7280';
    });
    // Store close handler reference - will be updated after handlers are defined
    let closeXBtnHandler = () => overlay.remove();
    closeXBtn.addEventListener('click', closeXBtnHandler);
    titleContainer.appendChild(closeXBtn);
    
    modal.appendChild(titleContainer);
    
    // Resolve current root and preferences
    const currentNotesArray = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
    const rootNote = currentNotesArray[getBuilderRootIndex()];
    const enhPref = getEnharmonicPreference();
    const notationPref = getNotationPreference();
    
    // Style & Mood selectors with Show All button (sticky at top)
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
    const styleContainer = document.createElement('div');
    const styleLabel = document.createElement('label');
    styleLabel.textContent = 'Style:';
    styleLabel.style.fontSize = '11px';
    styleLabel.style.fontWeight = '600';
    styleLabel.style.color = '#374151';
    styleLabel.style.display = 'block';
    styleLabel.style.marginBottom = '4px';
    styleContainer.appendChild(styleLabel);

    const styleSelect = document.createElement('select');
    styleSelect.style.width = '160px';
    styleSelect.style.padding = '4px 6px';
    styleSelect.style.border = '1px solid #d1d5db';
    styleSelect.style.borderRadius = '4px';
    styleSelect.style.fontSize = '11px';
    styleSelect.style.backgroundColor = 'white';

    // Get saved preferences or defaults
    let currentStyle = localStorage.getItem('chord-suggestion-style') || 'balanced';
    let currentMood = localStorage.getItem('chord-suggestion-mood') || 'bright';
    // Track current inversion (can be changed by user)
    let activeInversion = inversion;

    const styles = [
        { value: 'balanced', label: 'Balanced Blend' },
        { value: 'pop', label: 'Top 40 / Pop' },
        { value: 'jazz', label: 'Jazz / Complex' },
        { value: 'classical', label: 'Classical / Traditional' },
        { value: 'rock', label: 'Rock / Power' },
        { value: 'indie', label: 'Indie / Alternative' }
    ];

    styles.forEach(s => {
        const option = document.createElement('option');
        option.value = s.value;
        option.textContent = s.label;
        if (s.value === currentStyle) option.selected = true;
        styleSelect.appendChild(option);
    });

    styleContainer.appendChild(styleSelect);
    controlsRow.appendChild(styleContainer);

    // Mood selector (compact)
    const moodContainer = document.createElement('div');
    const moodLabel = document.createElement('label');
    moodLabel.textContent = 'Mood:';
    moodLabel.style.fontSize = '11px';
    moodLabel.style.fontWeight = '600';
    moodLabel.style.color = '#374151';
    moodLabel.style.display = 'block';
    moodLabel.style.marginBottom = '4px';
    moodContainer.appendChild(moodLabel);

    const moodSelect = document.createElement('select');
    moodSelect.style.width = '160px';
    moodSelect.style.padding = '4px 6px';
    moodSelect.style.border = '1px solid #d1d5db';
    moodSelect.style.borderRadius = '4px';
    moodSelect.style.fontSize = '11px';
    moodSelect.style.backgroundColor = 'white';

    const moods = [
        { value: 'bright', label: '😊 Happy / Bright' },
        { value: 'dark', label: '😔 Melancholic / Dark' },
        { value: 'jazzy', label: '🎷 Jazzy / Complex' },
        { value: 'tense', label: '⚡ Tense / Dramatic' },
        { value: 'calm', label: '😌 Calm / Peaceful' },
        { value: 'energetic', label: '⚡ Energetic / Driving' }
    ];

    moods.forEach(m => {
        const option = document.createElement('option');
        option.value = m.value;
        option.textContent = m.label;
        if (m.value === currentMood) option.selected = true;
        moodSelect.appendChild(option);
    });

    moodContainer.appendChild(moodSelect);
    controlsRow.appendChild(moodContainer);

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
    showAllBtn.addEventListener('click', () => {
        const key = getCurrentKey() || 'C';
        let tensionDirection = 'maintain';
        if (currentMood === 'bright' || currentMood === 'calm') {
            tensionDirection = 'resolve';
        } else if (currentMood === 'tense' || currentMood === 'energetic') {
            tensionDirection = 'build';
        }

        showChordExplorerModal(
            rootNote,
            chordType,
            activeInversion, // Use active inversion
            key,
            currentStyle,
            currentMood,
            (type, root, inv) => {
                // Add chord callback
                if (window.addSpecificChordToProgression) {
                    const nextRootIndex = ALL_NOTES.indexOf(root);
                    if (nextRootIndex !== -1 && nextRootIndex !== getBuilderRootIndex()) {
                        selectBuilderRootNote(nextRootIndex, false);
                    }
                    window.addSpecificChordToProgression(type, inv, true);
                }
            },
            null, // play chord - TODO: implement
            null  // stop chord - TODO: implement
        );
    });
    showAllBtn.addEventListener('mouseenter', () => showAllBtn.style.backgroundColor = '#5568d3');
    showAllBtn.addEventListener('mouseleave', () => showAllBtn.style.backgroundColor = '#667eea');
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
    const chordDef = CHORD_DEFINITIONS[chordType];
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
                rootNote,
                chordType,
                inv,
                key,
                getBuilderOctaveShift ? getBuilderOctaveShift() : 0,
                enhPref,
                notationPref
            );
            heldNotes = res.specificNotes || [];
            const instrument = getInstrument && getInstrument();
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
            const instrument = getInstrument && getInstrument();
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
        invBtn.addEventListener('mouseleave', stopHeld);
        
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
            title.textContent = `Suggested Next Chords After ${chordType} (${newInversionName})`;
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
        invBtn.addEventListener('mouseleave', (e) => {
            stopHeld(e);
            if (parseInt(invBtn.dataset.inversion) !== activeInversion) {
                invBtn.style.backgroundColor = 'white';
            }
        });
        inversionButtonsContainer.appendChild(invBtn);
    }
    
    inversionRow.appendChild(inversionButtonsContainer);
    modal.appendChild(inversionRow);

    // Container for suggestions that will be regenerated on style/mood change
    const suggestionsContainer = document.createElement('div');
    modal.appendChild(suggestionsContainer);

    // Function to render suggestions based on style and mood
    const renderSuggestions = (style, mood) => {
        suggestionsContainer.innerHTML = '';
        
        // Save preferences to localStorage
        localStorage.setItem('chord-suggestion-style', style);
        localStorage.setItem('chord-suggestion-mood', mood);
        
        // Default baseline suggestion (small text)
        const defaultNote = document.createElement('div');
        defaultNote.style.fontSize = '11px';
        defaultNote.style.color = '#6b7280';
        defaultNote.style.marginBottom = '12px';
        defaultNote.textContent = 'Default: Major (Root) is a common, stable resolution.';
        suggestionsContainer.appendChild(defaultNote);
        
        // Get suggestions for current style and mood
        const suggestions = generateChordSuggestions(chordType, activeInversion, rootNote, enhPref, notationPref, style, mood);
        
        // Helper to create hold-to-play buttons
        const createHoldPlayButton = (label, cType, inv, chordRoot = rootNote) => {
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
            btn.addEventListener('mouseenter', () => { btn.style.backgroundColor = '#f3f4f6'; });
            btn.addEventListener('mouseleave', () => { btn.style.backgroundColor = '#f9fafb'; });
            let heldNotes = null;
            btn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                const res = getInvertedChordNotes(
                    chordRoot,
                    cType,
                    inv,
                    chordRoot,
                    getBuilderOctaveShift ? getBuilderOctaveShift() : 0,
                    enhPref,
                    notationPref
                );
                heldNotes = res.specificNotes || [];
                const instrument = getInstrument && getInstrument();
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
                const instrument = getInstrument && getInstrument();
                if (instrument && heldNotes && heldNotes.length > 0) {
                    const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                    if (isGuitar) {
                        heldNotes.forEach(n => {
                            try { instrument.triggerRelease(n, Tone.now()); } catch (_) {}
                        });
                    } else {
                        instrument.triggerRelease(heldNotes, Tone.now());
                    }
                }
                heldNotes = null;
            };
            btn.addEventListener('mouseup', stopHeld);
            btn.addEventListener('mouseleave', stopHeld);
            // Touch events for mobile/tablet
            btn.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const res = getInvertedChordNotes(
                    chordRoot,
                    cType,
                    inv,
                    chordRoot,
                    getBuilderOctaveShift ? getBuilderOctaveShift() : 0,
                    enhPref,
                    notationPref
                );
                heldNotes = res.specificNotes || [];
                const instrument = getInstrument && getInstrument();
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
            btn.addEventListener('touchend', (e) => {
                e.stopPropagation();
                e.preventDefault();
                stopHeld(e);
            }, { passive: false });
            btn.addEventListener('touchcancel', (e) => {
                e.stopPropagation();
                e.preventDefault();
                stopHeld(e);
            }, { passive: false });
            return btn;
        };

        // Display each suggestion
        suggestions.forEach((suggestion, index) => {
            const suggestionCard = document.createElement('div');
            suggestionCard.style.padding = '12px';
            suggestionCard.style.marginBottom = '12px';
            suggestionCard.style.backgroundColor = '#f3f4f6';
            suggestionCard.style.borderLeft = '4px solid #60a5fa';
            suggestionCard.style.borderRadius = '4px';
            suggestionCard.style.cursor = 'pointer';
            suggestionCard.style.transition = 'all 0.2s';
            
            suggestionCard.addEventListener('mouseenter', () => {
                suggestionCard.style.backgroundColor = '#e5e7eb';
                suggestionCard.style.borderLeftColor = '#3b82f6';
            });
            
            suggestionCard.addEventListener('mouseleave', () => {
                suggestionCard.style.backgroundColor = '#f3f4f6';
                suggestionCard.style.borderLeftColor = '#60a5fa';
            });
            
            // Chord header
            const chordHeader = document.createElement('div');
            chordHeader.style.fontWeight = '600';
            chordHeader.style.marginBottom = '4px';
            chordHeader.style.color = '#1f2937';
            chordHeader.style.display = 'flex';
            chordHeader.style.alignItems = 'center';
            chordHeader.style.gap = '6px';

            const invName = INVERSION_NAMES[suggestion.nextInversion] || `Inversion ${suggestion.nextInversion}`;
            const confidence = suggestion.confidence || 75;
            const stars = confidence >= 90 ? '⭐⭐⭐' : confidence >= 75 ? '⭐⭐' : '⭐';

            // NEW: Get next root note and chord symbol
            const nextRoot = suggestion.nextRoot || rootNote; // Fallback to current root if not specified
            const nextSymbol = (CHORD_DEFINITIONS[suggestion.nextChord]?.symbol || '');

            chordHeader.innerHTML = `
                <span>→ ${nextRoot}${nextSymbol} (${invName})</span>
                <span style="font-size: 10px;">${stars}</span>
            `;
            suggestionCard.appendChild(chordHeader);

            // Playback row (current vs next)
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
            const currentSymbol = (CHORD_DEFINITIONS[chordType]?.symbol || '');
            const currentLabel = `Current: ${rootNote}${currentSymbol} (${INVERSION_NAMES[inversion] || inversion})`;
            const nextLabel = `Next: ${nextRoot}${nextSymbol} (${INVERSION_NAMES[suggestion.nextInversion] || suggestion.nextInversion})`;
            playbackRow.appendChild(createHoldPlayButton(currentLabel, chordType, inversion, rootNote));
            playbackRow.appendChild(createHoldPlayButton(nextLabel, suggestion.nextChord, suggestion.nextInversion, nextRoot));
            
            // Add to Progression button
            const addToProgBtn = document.createElement('button');
            addToProgBtn.textContent = '➕ Add to Progression';
            addToProgBtn.style.padding = '6px 12px';
            addToProgBtn.style.fontSize = '11px';
            addToProgBtn.style.border = '1px solid #10b981';
            addToProgBtn.style.borderRadius = '4px';
            addToProgBtn.style.backgroundColor = '#10b981';
            addToProgBtn.style.color = 'white';
            addToProgBtn.style.cursor = 'pointer';
            addToProgBtn.style.transition = 'all 0.15s';
            addToProgBtn.style.fontWeight = '600';
            addToProgBtn.addEventListener('mouseenter', () => { 
                addToProgBtn.style.backgroundColor = '#059669';
                addToProgBtn.style.borderColor = '#059669';
            });
            addToProgBtn.addEventListener('mouseleave', () => { 
                addToProgBtn.style.backgroundColor = '#10b981';
                addToProgBtn.style.borderColor = '#10b981';
            });
            addToProgBtn.addEventListener('click', (e) => {
                e.stopPropagation();

                // First, select the new root note (if different from current)
                const nextRootIndex = ALL_NOTES.indexOf(nextRoot);
                if (nextRootIndex !== -1 && nextRootIndex !== getBuilderRootIndex()) {
                    selectBuilderRootNote(nextRootIndex, false); // Don't play audio during selection
                }

                // Then add to progression with the selected chord type and inversion
                if (window.addSpecificChordToProgression) {
                    window.addSpecificChordToProgression(suggestion.nextChord, suggestion.nextInversion, true);
                }
            });
            playbackRow.appendChild(addToProgBtn);

            suggestionCard.appendChild(playbackRow);

            // Reason
            const reason = document.createElement('div');
            reason.style.fontSize = '12px';
            reason.style.color = '#4b5563';
            reason.style.lineHeight = '1.4';
            reason.textContent = suggestion.reason;
            suggestionCard.appendChild(reason);

            // Click to select chord (updates Chord Builder to show this chord)
            suggestionCard.addEventListener('click', () => {
                // Select the new root note
                const nextRootIndex = ALL_NOTES.indexOf(nextRoot);
                if (nextRootIndex !== -1) {
                    selectBuilderRootNote(nextRootIndex, false);
                }

                // Select the chord type and inversion
                selectBuilderChordType(suggestion.nextChord, false);
                selectBuilderInversion(suggestion.nextInversion, true);

                // Close modal
                overlay.remove();
            });
            
            suggestionsContainer.appendChild(suggestionCard);
        });
    };
    
    // Initial render with saved preferences
    renderSuggestions(currentStyle, currentMood);

    // Listen for style and mood changes
    styleSelect.addEventListener('change', () => {
        renderSuggestions(styleSelect.value, moodSelect.value);
    });

    moodSelect.addEventListener('change', () => {
        renderSuggestions(styleSelect.value, moodSelect.value);
    });

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
            title.textContent = `Suggested Next Chords After ${chordType} (${newInversionName})`;
            // Re-render suggestions
            renderSuggestions(currentStyle, currentMood);
        }
    };
    document.addEventListener('chord-suggestion-inversion-changed', inversionChangeHandler);
    
    // Update close X button to clean up event listeners
    closeXBtn.removeEventListener('click', closeXBtnHandler);
    closeXBtnHandler = () => {
        document.removeEventListener('chord-suggestion-preference-changed', preferenceChangeHandler);
        document.removeEventListener('chord-suggestion-inversion-changed', inversionChangeHandler);
        overlay.remove();
    };
    closeXBtn.addEventListener('click', closeXBtnHandler);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.marginTop = '8px';
    closeBtn.style.padding = '8px 16px';
    closeBtn.style.backgroundColor = '#e5e7eb';
    closeBtn.style.border = '1px solid #d1d5db';
    closeBtn.style.borderRadius = '4px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontWeight = '600';
    closeBtn.style.width = '100%';
    closeBtn.addEventListener('click', () => {
        document.removeEventListener('chord-suggestion-preference-changed', preferenceChangeHandler);
        document.removeEventListener('chord-suggestion-inversion-changed', inversionChangeHandler);
        overlay.remove();
    });
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.backgroundColor = '#d1d5db');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.backgroundColor = '#e5e7eb');
    modal.appendChild(closeBtn);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.removeEventListener('chord-suggestion-preference-changed', preferenceChangeHandler);
            document.removeEventListener('chord-suggestion-inversion-changed', inversionChangeHandler);
            overlay.remove();
        }
    });
}

// =========================================================================
// Collapsible Panel Toggles (Chord Builder UI)
// =========================================================================

export function toggleChordSetupPanel() {
    const panel = document.getElementById('chord-setup-panel');
    const chevron = document.getElementById('chord-setup-chevron');
    if (!panel || !chevron) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }
    
    // Save panel state
    if (window.savePanelState) {
        window.savePanelState('chord-setup-panel', !isHidden);
    }
}

export function toggleChordLibraryPanel() {
    const panel = document.getElementById('chord-library-panel');
    const chevron = document.getElementById('chord-library-chevron');
    if (!panel || !chevron) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }
    
    // Save panel state
    if (window.savePanelState) {
        window.savePanelState('chord-library-panel', !isHidden);
    }
}

export function toggleChordIntervalsPanel() {
    const panel = document.getElementById('chord-intervals-panel');
    const chevron = document.getElementById('chord-intervals-chevron');
    if (!panel || !chevron) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }
    
    // Save panel state
    if (window.savePanelState) {
        window.savePanelState('chord-intervals-panel', !isHidden);
    }
}

// Import audio utilities
import {
    getPiano,
    getInstrument,
    getAudioIsReady,
    getAudioIsLoading,
    getCameraShutter,
    initAudio
} from '../audio/audioEngine.js';

import {
    getArpeggioSpeed,
    setArpeggioSpeed,
    ARPEGGIO_SPEEDS
} from '../audio/arpeggiator.js';

// Import note/chord utilities
import {
    noteToMidi,
    resolveEnharmonic,
    getNoteKeyId,
    getChordNotes,
    getInvertedChordNotes,
    getIntervalNotes,
    getLHNotes
} from '../utils/noteUtils.js';

// Import data definitions
import {
    SHARP_NOTES,
    FLAT_NOTES,
    ALL_NOTES,
    CHORD_DEFINITIONS,
    INTERVAL_DEFINITIONS,
    INVERSION_NAMES,
    CHORD_GROUPS,
    INTERVAL_GROUPS,
    MAJOR_SCALE_STEPS,
    ENHARMONIC_MAP,
    ROMAN_MAP_BASE
} from '../../data/music-data.js';

// Import UI utilities (to be defined when needed)
// import { clearHighlights, updateKeySignatureDisplay } from '../ui/displays.js';

// ============================================================================
// Chord Playback Functions
// ============================================================================

/**
 * Start playing the current builder chord or interval
 * Handles both right hand chord/interval and left hand accompaniment
 */
export function startBuilderChord() {
    initAudio();
    
    // Ensure audio context is running (required for Tone.js after user interaction)
    if (Tone && Tone.context.state !== 'running') {
        Tone.context.resume().catch(err => {
            console.warn("Could not resume audio context:", err);
        });
    }
    
    // Check if we're in fretboard mode (guitar doesn't need samples to load)
    const isFretboardMode = window.getIsFretboardModeOn ? window.getIsFretboardModeOn() : false;
    if (!isFretboardMode && !getAudioIsReady()) {
        // Piano needs samples to be loaded, but guitar synth is ready immediately
        return;
    }

    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];
    const baseOctave = 4 + getBuilderOctaveShift();

    if (getBuilderSelectionMode() === 'chord') {
        const chordResult = getInvertedChordNotes(
            rootNote,
            getBuilderChordType(),
            getBuilderInversion(),
            rootNote,
            getBuilderOctaveShift(),
            getEnharmonicPreference(),
            getNotationPreference()
        );

        const lhType = document.getElementById('builder-lh-type-select').value;
        const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
        const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
        const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, getBuilderChordType(), getEnharmonicPreference());
        const lhNotes = allLhNotes.filter(note => !getBuilderLHOmittedNotes().includes(note));

        // Filter out omitted notes
        const voicedNotes = chordResult.specificNotes.filter(note => !getBuilderOmittedNotes().includes(note));

        setBuilderChordNotes(voicedNotes);
        const instrument = getInstrument();
        if (voicedNotes.length > 0 && instrument) {
            // For PluckSynth (guitar), trigger each note individually with slight time offset
            // For Sampler (piano), we can pass the array
            const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
            if (isGuitar) {
                // For PluckSynth, trigger all notes at the same time (slightly in the future)
                // to ensure they all play together as a chord
                const baseTime = Tone.now() + 0.01; // Small buffer to ensure all notes are scheduled
                voicedNotes.forEach((note, index) => {
                    // Use very small increment (0.0001) to satisfy Tone.js requirement while keeping notes simultaneous
                    instrument.triggerAttack(note, baseTime + index * 0.0001);
                });
            } else {
                instrument.triggerAttack(voicedNotes, Tone.now());
            }
        }

        // Add playback highlight
        document.querySelectorAll('.active-builder').forEach(key => {
            key.classList.add('active-builder-playback');
        });

        // Play LH as a block chord and add to the notes to be released
        if (lhNotes.length > 0 && instrument) {
            const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
            if (isGuitar) {
                // For PluckSynth, trigger all notes at the same time (slightly in the future)
                // to ensure they all play together as a chord
                const baseTime = Tone.now() + 0.01; // Small buffer to ensure all notes are scheduled
                // Continue from where RH notes ended to avoid overlap
                const startIndex = voicedNotes.length;
                lhNotes.forEach((note, index) => {
                    // Use very small increment (0.0001) to satisfy Tone.js requirement while keeping notes simultaneous
                    instrument.triggerAttack(note, baseTime + (startIndex + index) * 0.0001);
                });
            } else {
                instrument.triggerAttack(lhNotes, Tone.now());
            }
            setBuilderChordNotes(getBuilderChordNotes().concat(lhNotes));
        }
    } else { // 'interval'
        const intervalResult = getIntervalNotes(rootNote, getBuilderIntervalType(), getBuilderOctaveShift(), getEnharmonicPreference());
        const voicedNotes = intervalResult.specificNotes.filter(note => !getBuilderOmittedNotes().includes(note));

        setBuilderChordNotes(voicedNotes);
        const instrument = getInstrument();
        if (voicedNotes.length > 0 && instrument) {
            // For PluckSynth (guitar), trigger each note individually with slight time offset
            // For Sampler (piano), we can pass the array
            const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
            if (isGuitar) {
                // For PluckSynth, trigger all notes at the same time (slightly in the future)
                // to ensure they all play together as a chord
                const baseTime = Tone.now() + 0.01; // Small buffer to ensure all notes are scheduled
                voicedNotes.forEach((note, index) => {
                    // Use very small increment (0.0001) to satisfy Tone.js requirement while keeping notes simultaneous
                    instrument.triggerAttack(note, baseTime + index * 0.0001);
                });
            } else {
                instrument.triggerAttack(voicedNotes, Tone.now());
            }
        }

        // Add playback highlight
        document.querySelectorAll('.active-builder').forEach(key => {
            key.classList.add('active-builder-playback');
        });

        // Also play LH notes for intervals
        const lhType = document.getElementById('builder-lh-type-select').value;
        const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
        const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
        const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, getBuilderChordType(), getEnharmonicPreference());
        const lhNotes = allLhNotes.filter(note => !getBuilderLHOmittedNotes().includes(note));

        if (lhNotes.length > 0 && instrument) {
            // For PluckSynth (guitar), trigger each note individually with slight time offset
            // For Sampler (piano), we can pass the array
            const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
            if (isGuitar) {
                const baseTime = Tone.now();
                // Continue from where RH notes ended to avoid overlap
                const startIndex = voicedNotes.length;
                lhNotes.forEach((note, index) => {
                    // Stagger each note by 0.001 seconds to avoid "start time must be strictly greater" error
                    instrument.triggerAttack(note, baseTime + (startIndex + index) * 0.001);
                });
            } else {
                instrument.triggerAttack(lhNotes, Tone.now());
            }
            setBuilderChordNotes(getBuilderChordNotes().concat(lhNotes));
        }
    }
}

/**
 * Stop playing the current builder chord
 * Releases all currently held notes
 */
export function stopBuilderChord() {
    const instrument = getInstrument();
    const builderChordNotes = getBuilderChordNotes();

    if (instrument && getAudioIsReady() && builderChordNotes.length > 0) {
        // For PluckSynth (guitar), release each note individually
        // For Sampler (piano), we can pass the array
        const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
        if (isGuitar) {
            builderChordNotes.forEach(note => {
                try {
                    instrument.triggerRelease(note, Tone.now());
                } catch (e) {
                    // Ignore individual note errors
                }
            });
        } else {
            instrument.triggerRelease(builderChordNotes, Tone.now());
        }
        setBuilderChordNotes([]);

        // Remove playback highlight
        document.querySelectorAll('.active-builder-playback').forEach(key => {
            key.classList.remove('active-builder-playback');
        });
    }
}

/**
 * Play a builder chord once for preview (with duration like Progression Builder)
 * @param {Array<string>} notes - Notes to play
 */
function playBuilderChordOnce(notes) {
    initAudio();
    if (!getAudioIsReady()) return;

    stopBuilderChord();
    if (window.stopTrainerChord) window.stopTrainerChord();

    const instrument = getInstrument();
    if (instrument) {
        instrument.triggerAttackRelease(notes, '0.5s');
    }

    // Add playback highlighting on top of existing builder highlights
    notes.forEach(note => {
        const keyId = getNoteKeyId(note);
        const keyElement = document.getElementById(keyId);
        if (keyElement) {
            keyElement.classList.add('active-builder-playback');
        }
    });

    // After playback ends, remove only playback highlighting and restore builder highlights
    Tone.Draw.schedule(() => {
        // Remove only playback highlighting
        document.querySelectorAll('.active-builder-playback').forEach(key => {
            key.classList.remove('active-builder-playback');
        });
        
        // Re-apply builder highlights to ensure they're correct
        // Get the current RH notes for highlighting (highlightBuilderNotes will add LH notes)
        const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];
        let rhNotes = [];
        
        if (getBuilderSelectionMode() === 'chord') {
            const chordResult = getInvertedChordNotes(
                rootNote,
                getBuilderChordType(),
                getBuilderInversion(),
                rootNote,
                getBuilderOctaveShift(),
                getEnharmonicPreference(),
                getNotationPreference()
            );
            rhNotes = chordResult.specificNotes;
        } else {
            const intervalResult = getIntervalNotes(rootNote, getBuilderIntervalType(), getBuilderOctaveShift(), getEnharmonicPreference());
            rhNotes = intervalResult.specificNotes;
        }
        
        // Re-highlight with current settings (this will include current LH notes)
        highlightBuilderNotes(rhNotes);
    }, Tone.now() + 0.5);
}

/**
 * Play current builder chord with duration (for LH/voicing changes)
 * Exported for use in HTML onchange handlers
 */
export function playBuilderChordWithDuration() {
    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];
    let allNotes = [];
    
    if (getBuilderSelectionMode() === 'chord') {
        const chordResult = getInvertedChordNotes(
            rootNote,
            getBuilderChordType(),
            getBuilderInversion(),
            rootNote,
            getBuilderOctaveShift(),
            getEnharmonicPreference(),
            getNotationPreference()
        );
        const voicedNotes = chordResult.specificNotes.filter(note => !getBuilderOmittedNotes().includes(note));
        allNotes = [...voicedNotes];
        
        const lhType = document.getElementById('builder-lh-type-select').value;
        const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
        const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
        const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, getBuilderChordType(), getEnharmonicPreference());
        const lhNotes = allLhNotes.filter(note => !getBuilderLHOmittedNotes().includes(note));
        allNotes = allNotes.concat(lhNotes);
    } else {
        const intervalResult = getIntervalNotes(rootNote, getBuilderIntervalType(), getBuilderOctaveShift(), getEnharmonicPreference());
        const voicedNotes = intervalResult.specificNotes.filter(note => !getBuilderOmittedNotes().includes(note));
        allNotes = [...voicedNotes];
        
        const lhType = document.getElementById('builder-lh-type-select').value;
        const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
        const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
        const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, getBuilderChordType(), getEnharmonicPreference());
        const lhNotes = allLhNotes.filter(note => !getBuilderLHOmittedNotes().includes(note));
        allNotes = allNotes.concat(lhNotes);
    }
    
    if (allNotes.length > 0) {
        playBuilderChordOnce(allNotes);
    }
}

// ============================================================================
// Display and Highlighting Functions
// ============================================================================

/**
 * Update the chord builder display with current selection
 * Shows chord/interval name, notes, and highlights on keyboard
 */
export function updateBuilderDisplay() {
    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];
    let result;
    let notesForHighlight;

    if (getBuilderSelectionMode() === 'chord') {
        result = getInvertedChordNotes(
            rootNote,
            getBuilderChordType(),
            getBuilderInversion(),
            rootNote,
            getBuilderOctaveShift(),
            getEnharmonicPreference(),
            getNotationPreference()
        );
        notesForHighlight = result.specificNotes;
        document.getElementById('builder-inversion-selector').style.opacity = 1;
        document.getElementById('builder-lh-type-select').disabled = false;
        document.getElementById('builder-lh-inversion-select').disabled = false;
        document.getElementById('builder-lh-octave-select').disabled = false;
    } else { // 'interval'
        result = getIntervalNotes(rootNote, getBuilderIntervalType(), getBuilderOctaveShift(), getEnharmonicPreference());
        notesForHighlight = result.specificNotes;
        document.getElementById('builder-inversion-selector').style.opacity = 0.3;
        document.getElementById('builder-lh-type-select').disabled = false;
        document.getElementById('builder-lh-inversion-select').disabled = false;
        document.getElementById('builder-lh-octave-select').disabled = false;
    }

    document.getElementById('builder-chord-name').textContent = result.name;
    document.getElementById('builder-chord-notes').textContent = result.specificNotes.join(' - ');

    // Store current notes for guitar fretboard
    window.currentBuilderNotes = notesForHighlight;
    // Store chord info for guitar fingerings
    if (getBuilderSelectionMode() === 'chord') {
        window.currentBuilderRootNote = rootNote;
        window.currentBuilderChordType = getBuilderChordType();
    } else {
        window.currentBuilderRootNote = null;
        window.currentBuilderChordType = null;
    }

    highlightBuilderNotes(notesForHighlight);
    updateInversionSelector();
    updateLHInversionSelector();

    // Update key signature display (function to be imported from UI module)
    if (window.updateKeySignatureDisplay) {
        window.updateKeySignatureDisplay(rootNote);
    }

    // Update guitar fretboard if fretboard mode is on
    if (window.updateGuitarFretboard) {
        window.updateGuitarFretboard();
    }

    // Helper function to play current chord
    const playCurrentChord = () => {
        const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];
        let allNotes = [];
        
        if (getBuilderSelectionMode() === 'chord') {
            const chordResult = getInvertedChordNotes(
                rootNote,
                getBuilderChordType(),
                getBuilderInversion(),
                rootNote,
                getBuilderOctaveShift(),
                getEnharmonicPreference(),
                getNotationPreference()
            );
            const voicedNotes = chordResult.specificNotes.filter(note => !getBuilderOmittedNotes().includes(note));
            allNotes = [...voicedNotes];
            
            const lhType = document.getElementById('builder-lh-type-select').value;
            const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
            const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
            const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, getBuilderChordType(), getEnharmonicPreference());
            const lhNotes = allLhNotes.filter(note => !getBuilderLHOmittedNotes().includes(note));
            allNotes = allNotes.concat(lhNotes);
        } else {
            const intervalResult = getIntervalNotes(rootNote, getBuilderIntervalType(), getBuilderOctaveShift(), getEnharmonicPreference());
            const voicedNotes = intervalResult.specificNotes.filter(note => !getBuilderOmittedNotes().includes(note));
            allNotes = [...voicedNotes];
            
            const lhType = document.getElementById('builder-lh-type-select').value;
            const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
            const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
            const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, getBuilderChordType(), getEnharmonicPreference());
            const lhNotes = allLhNotes.filter(note => !getBuilderLHOmittedNotes().includes(note));
            allNotes = allNotes.concat(lhNotes);
        }
        
        if (allNotes.length > 0) {
            playBuilderChordOnce(allNotes);
        }
    };

    // Render voicing editors
    renderVoicingEditor(
        notesForHighlight,
        'voicing-editor',
        'voicing-editor-container',
        getBuilderOmittedNotes(),
        (note, isOmitted) => {
            setBuilderOmittedNotes(
                isOmitted
                    ? [...getBuilderOmittedNotes(), note]
                    : getBuilderOmittedNotes().filter(n => n !== note)
            );
            updateBuilderDisplay();
            playCurrentChord();
        },
        () => {
            // Select all: clear omitted notes
            setBuilderOmittedNotes([]);
            updateBuilderDisplay();
            playCurrentChord();
        },
        () => {
            // Select none: omit all notes
            setBuilderOmittedNotes([...notesForHighlight]);
            updateBuilderDisplay();
            playCurrentChord();
        }
    );

    const allLhNotes = getLHNotes(
        rootNote,
        document.getElementById('builder-lh-type-select').value,
        parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0,
        rootNote,
        parseInt(document.getElementById('builder-lh-octave-select').value, 10),
        getBuilderChordType(),
        getEnharmonicPreference()
    );

    renderVoicingEditor(
        allLhNotes,
        'lh-voicing-editor',
        'lh-voicing-editor-container',
        getBuilderLHOmittedNotes(),
        (note, isOmitted) => {
            setBuilderLHOmittedNotes(
                isOmitted
                    ? [...getBuilderLHOmittedNotes(), note]
                    : getBuilderLHOmittedNotes().filter(n => n !== note)
            );
            updateBuilderDisplay();
            // Only play if LH Type is not "off"
            if (document.getElementById('builder-lh-type-select').value !== 'off') {
                playCurrentChord();
            }
        },
        () => {
            // Select all: clear omitted notes
            setBuilderLHOmittedNotes([]);
            updateBuilderDisplay();
            // Only play if LH Type is not "off"
            if (document.getElementById('builder-lh-type-select').value !== 'off') {
                playCurrentChord();
            }
        },
        () => {
            // Select none: omit all notes
            setBuilderLHOmittedNotes([...allLhNotes]);
            updateBuilderDisplay();
            // Only play if LH Type is not "off"
            if (document.getElementById('builder-lh-type-select').value !== 'off') {
                playCurrentChord();
            }
        }
    );
}

/**
 * Highlight builder notes on the keyboard
 * @param {Array<string>} specificNotes - Array of notes with octaves to highlight
 */
function highlightBuilderNotes(specificNotes) {
    // Clear highlights (function to be imported from UI module)
    if (window.clearHighlights) {
        window.clearHighlights();
    }

    if (!specificNotes || getCurrentTab() !== 'builder') return;

    let allNotes = [...specificNotes];

    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];
    const lhType = document.getElementById('builder-lh-type-select').value;
    const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
    const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;

    // Filter out any omitted notes from the right-hand part before highlighting
    allNotes = allNotes.filter(note => !getBuilderOmittedNotes().includes(note));

    if (getBuilderSelectionMode() === 'chord' || getBuilderSelectionMode() === 'interval') {
        const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, getBuilderChordType(), getEnharmonicPreference());
        const voicedLhNotes = allLhNotes.filter(note => !getBuilderLHOmittedNotes().includes(note));
        allNotes = allNotes.concat(voicedLhNotes);
    }

    allNotes.forEach(note => {
        const keyId = getNoteKeyId(note);
        const keyElement = document.getElementById(keyId);
        if (keyElement) keyElement.classList.add('active-builder');
    });
}

// ============================================================================
// Selection Functions
// ============================================================================

/**
 * Select a root note for the chord builder
 * @param {number} index - Index in the SHARP_NOTES/FLAT_NOTES array
 * @param {boolean} playAudio - Whether to play audio on selection
 */
export function selectBuilderRootNote(index, playAudio = true) {
    // Stop any existing playback before changing root note
    if (playAudio) {
        stopBuilderChord();
    }
    
    setBuilderRootIndex(index);
    // Update window.builderRootIndex for modules that access it
    if (typeof window !== 'undefined') {
        window.builderRootIndex = index;
    }
    if (playAudio) setBuilderOmittedNotes([]); // Reset omissions on root change
    if (playAudio) setBuilderLHOmittedNotes([]);
    updateButtonSelection('#builder-note-selector', 'index', index.toString(), 'bg-amber-600', 'text-white');
    
    // Get the root note name for key signature display
    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[index];
    
    // Update key signature display immediately
    if (window.updateKeySignatureDisplay) {
        window.updateKeySignatureDisplay(rootNote);
    }
    
    updateBuilderDisplay();

    // Update keyboard labels (function to be imported from UI module)
    // Always update labels to ensure Roman numerals are updated if enabled
    // Call directly after setting window.builderRootIndex to ensure it's read correctly
    if (window.updateKeyboardLabels) {
        window.updateKeyboardLabels();
    }

    updateChordTypeButtonCaptions();
    updateIntervalButtonCaptions();
    if (playAudio) startBuilderChord();
}

/**
 * Select a chord type for the chord builder
 * @param {string} chordType - Chord type from CHORD_DEFINITIONS
 * @param {boolean} playAudio - Whether to play audio on selection
 * @param {boolean} resetVoicing - Whether to reset voicing omissions
 */
export function selectBuilderChordType(chordType, playAudio = true, resetVoicing = true) {
    setBuilderSelectionMode('chord');
    setBuilderChordType(chordType);
    if (resetVoicing) setBuilderOmittedNotes([]); // Reset omissions on type change
    if (resetVoicing) setBuilderLHOmittedNotes([]);
    updateButtonSelection('#builder-interval-selector', 'intervalType', null, 'bg-emerald-600');
    updateButtonSelection('#builder-chord-type-selector', 'chordType', chordType, 'bg-teal-600', 'text-white');
    updateBuilderDisplay();
    updateChordSuggestions();
    updateChordTypeButtonCaptions(); // Redraw captions after selection
    if (playAudio) startBuilderChord();
}

/**
 * Select an interval type for the chord builder
 * @param {string} intervalType - Interval type from INTERVAL_DEFINITIONS
 * @param {boolean} playAudio - Whether to play audio on selection
 * @param {boolean} resetVoicing - Whether to reset voicing omissions
 */
export function selectBuilderInterval(intervalType, playAudio = true, resetVoicing = true) {
    setBuilderSelectionMode('interval');
    setBuilderIntervalType(intervalType);
    if (resetVoicing) setBuilderOmittedNotes([]); // Reset omissions on type change
    if (resetVoicing) setBuilderLHOmittedNotes([]);
    updateButtonSelection('#builder-chord-type-selector', 'chordType', null, 'bg-teal-600');
    updateButtonSelection('#builder-interval-selector', 'intervalType', intervalType, 'bg-emerald-600', 'text-white');
    updateBuilderDisplay();
    updateIntervalButtonCaptions(); // Redraw captions after selection
    if (playAudio) startBuilderChord();
}

/**
 * Select an inversion for the chord builder
 * @param {number} inversion - Inversion number (0 = root position)
 * @param {boolean} playAudio - Whether to play audio on selection
 * @param {boolean} resetVoicing - Whether to reset voicing omissions
 */
export function selectBuilderInversion(inversion, playAudio = true, resetVoicing = true) {
    setBuilderInversion(inversion);
    if (resetVoicing) setBuilderOmittedNotes([]); // Reset omissions on inversion change
    if (resetVoicing) setBuilderLHOmittedNotes([]);
    updateButtonSelection('#builder-inversion-selector', 'inversion', inversion.toString(), 'bg-amber-500', 'text-white');
    updateBuilderDisplay();
    if (playAudio) startBuilderChord();
}

/**
 * Update button selection styling
 * @param {string} selector - CSS selector for button container
 * @param {string} dataAttribute - Data attribute name
 * @param {string} value - Value to match for active state
 * @param {string} activeClass - CSS class for active state
 * @param {string} activeTextColor - CSS class for active text color
 */
export function updateButtonSelection(selector, dataAttribute, value, activeClass, activeTextColor = 'text-white') {
    document.querySelectorAll(`${selector} button`).forEach(btn => {
        // If value is null, deselect all buttons
        if (value === null) {
            btn.classList.remove(activeClass, 'text-white', 'text-gray-900', 'shadow-md', 'bg-amber-600', 'bg-amber-500', 'bg-teal-400', 'bg-teal-600', 'bg-lime-400', 'bg-emerald-600', 'hover:bg-amber-100', 'hover:bg-gray-300');
            btn.classList.add('bg-gray-200', 'text-gray-800', 'hover:bg-gray-300');
            return;
        }
        
        const isSelected = btn.dataset[dataAttribute] === value || btn.dataset[dataAttribute] === String(value);
        if (isSelected) {
            btn.classList.add(activeClass, activeTextColor, 'shadow-md');
            btn.classList.remove('bg-gray-200', 'text-gray-800', 'hover:bg-amber-100', 'hover:bg-gray-300');
        } else {
            // Explicitly remove all possible active classes
            btn.classList.remove(activeClass, 'text-white', 'text-gray-900', 'shadow-md', 'bg-amber-600', 'bg-amber-500', 'bg-teal-400', 'bg-teal-600', 'bg-lime-400', 'bg-emerald-600');
            // Add back the default classes
            btn.classList.remove('hover:bg-amber-100');
            btn.classList.add('bg-gray-200', 'text-gray-800', 'hover:bg-gray-300');
        }
    });
}

// ============================================================================
// Inversion and Octave Controls
// ============================================================================

/**
 * Update the inversion selector based on current chord type
 * Disables invalid inversions for the selected chord
 */
export function updateInversionSelector() {
    const isChordMode = getBuilderSelectionMode() === 'chord';
    const def = isChordMode ? CHORD_DEFINITIONS[getBuilderChordType()] : null;
    const maxInversion = def ? def.intervals.length - 1 : 0;

    document.querySelectorAll('#builder-inversion-selector button').forEach(btn => {
        const inv = parseInt(btn.dataset.inversion);
        const isDisabled = !isChordMode || inv > maxInversion;
        btn.disabled = isDisabled;
        btn.classList.toggle('opacity-50', isDisabled);
        btn.classList.toggle('cursor-not-allowed', isDisabled);
        btn.title = isDisabled ? 'Unavailable for this selection' : '';

        if (isChordMode && getBuilderInversion() > maxInversion) {
            selectBuilderInversion(0, false);
        }
    });
}

/**
 * Update the left hand inversion selector based on LH type
 */
export function updateLHInversionSelector() {
    const lhType = document.getElementById('builder-lh-type-select').value;
    const invSelector = document.getElementById('builder-lh-inversion-select');
    const currentVal = invSelector.value;
    invSelector.innerHTML = '';

    let intervals;
    if (lhType === 'Major' || lhType === 'Minor') {
        intervals = CHORD_DEFINITIONS[lhType].intervals;
    } else if (lhType === 'shell_maj7' || lhType === 'shell_min7') {
        intervals = [0, 4, 11]; // A 3-note chord
    } else if (lhType === 'shell_dom7') {
        intervals = [0, 4, 10]; // A 3-note chord
    } else if (lhType === 'Dominant 7th') {
        intervals = CHORD_DEFINITIONS['Dominant 7th'].intervals;
    } else if (lhType === 'spread') {
        intervals = [0, 7, 16]; // A 3-note chord (R-5-10)
    } else if (lhType === 'quartal') {
        intervals = [0, 5, 10]; // A 3-note chord
    } else {
        intervals = [0]; // For single notes or simple intervals
    }

    const maxInversion = Math.max(0, intervals.length - 1);

    INVERSION_NAMES.forEach((name, index) => {
        if (index <= maxInversion) {
            const option = new Option(name, index);
            invSelector.add(option);
        }
    });

    if (currentVal <= maxInversion) {
        invSelector.value = currentVal;
    } else {
        invSelector.value = '0';
    }
}

/**
 * Update the octave shift UI display
 */
export function updateBuilderOctaveUI() {
    const display = document.getElementById('builder-octave-display');
    const shift = getBuilderOctaveShift();
    display.textContent = `Oct: ${shift > 0 ? '+' : ''}${shift}`;
    document.getElementById('builder-octave-down').disabled = shift <= -3;
    document.getElementById('builder-octave-up').disabled = shift >= 3;
}

/**
 * Change the octave shift for the chord builder
 * @param {number} amount - Amount to shift (+1 or -1)
 */
export function changeBuilderOctave(amount) {
    let newShift = getBuilderOctaveShift() + amount;
    if (newShift < -3 || newShift > 3) return;
    setBuilderOctaveShift(newShift);
    updateBuilderOctaveUI();
    updateBuilderDisplay();
    startBuilderChord();
}

// ============================================================================
// Button Caption Functions
// ============================================================================

/**
 * Update chord type button captions based on notation preference
 * Shows either full name or symbol notation
 */
export function updateChordTypeButtonCaptions() {
    const currentNotes = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
    const rootNoteName = currentNotes[getBuilderRootIndex()];

    document.querySelectorAll('#builder-chord-type-selector .key-button-wrapper').forEach(container => {
        const mainButton = container.querySelector('button');
        if (!mainButton) return;

        const chordType = mainButton.dataset.chordType;
        const chordDef = CHORD_DEFINITIONS[chordType] || {};
        const symbolNotation = rootNoteName + (chordDef.symbol || '');
        const primaryText = getNotationPreference() === 'symbol' ? symbolNotation : chordType;
        const secondaryText = getNotationPreference() === 'symbol' ? chordType : symbolNotation;

        // Determine text color based on selection - make entire text white when selected
        const isSelected = mainButton.classList.contains('bg-teal-600');
        const primaryTextColor = isSelected ? 'text-white' : 'text-gray-800';
        const secondaryTextColor = isSelected ? 'text-white' : 'text-gray-500';

        mainButton.innerHTML = `<span class="block text-xs font-bold leading-tight pointer-events-none ${primaryTextColor}">${primaryText}</span><span class="block ${secondaryTextColor} pointer-events-none" style="font-size: 0.65rem; line-height: 0.9;">${secondaryText}</span>`;
    });
}

/**
 * Update interval button captions
 */
export function updateIntervalButtonCaptions() {
    document.querySelectorAll('#builder-interval-selector .key-button-wrapper').forEach(container => {
        const mainButton = container.querySelector('button');
        if (!mainButton) return;

        const intervalType = mainButton.dataset.intervalType;
        const intervalDef = INTERVAL_DEFINITIONS[intervalType] || {};
        const symbolNotation = intervalDef.symbol || '';
        const isSelected = mainButton.classList.contains('bg-emerald-600');
        const primaryTextColor = isSelected ? 'text-white' : 'text-gray-800';
        const secondaryTextColor = isSelected ? 'text-white' : 'text-gray-500';
        mainButton.innerHTML = `<span class="block text-sm pointer-events-none ${primaryTextColor}">${intervalType}</span><span class="block ${secondaryTextColor} text-xs pointer-events-none">${symbolNotation}</span>`;
    });
}

// ============================================================================
// Rendering Functions
// ============================================================================

/**
 * Render all chord builder selectors (root, type, inversion, intervals)
 */
export function renderBuilderSelectors() {
    const rootSelector = document.getElementById('builder-note-selector');
    const typeSelector = document.getElementById('builder-chord-type-selector');
    const invSelector = document.getElementById('builder-inversion-selector');
    const intervalSelector = document.getElementById('builder-interval-selector');

    const currentNotes = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    // Always re-render the root note selector to reflect enharmonic preference
    rootSelector.innerHTML = '';
    currentNotes.forEach((note, index) => {
        const button = document.createElement('button');
        button.textContent = note;
        button.dataset.index = index;
        button.onmousedown = () => selectBuilderRootNote(index, true);
        button.onmouseup = () => stopBuilderChord();
        button.onmouseleave = () => stopBuilderChord();
        // Touch events for mobile/tablet
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            selectBuilderRootNote(index, true);
        }, { passive: false });
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopBuilderChord();
        }, { passive: false });
        button.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            stopBuilderChord();
        }, { passive: false });
        button.className = `key-button px-1 py-2 font-semibold rounded-lg transition duration-150 transform hover:scale-105 text-xs bg-gray-200 text-gray-800 hover:bg-amber-100`;
        rootSelector.appendChild(button);
    });

    if (typeSelector.children.length === 0) {
        typeSelector.innerHTML = '';
        CHORD_GROUPS.forEach(group => {
            const groupContainer = document.createElement('div');
            groupContainer.className = 'border border-gray-200 rounded-lg p-2 flex flex-col';
            const title = document.createElement('h4');
            title.className = 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 text-center';
            title.textContent = group.title;
            groupContainer.appendChild(title);

            const buttonGrid = document.createElement('div');
            buttonGrid.className = 'grid grid-cols-1 gap-1.5';
            group.types.forEach(chordType => {
                if (CHORD_DEFINITIONS[chordType]) {
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'key-button-wrapper flex items-stretch rounded-lg shadow-sm overflow-hidden bg-gray-200 transition duration-150 transform hover:scale-105';
                    buttonContainer.style.position = 'relative'; // For absolute positioning of info icon

                    // Main button for block chord
                    const mainButton = document.createElement('button');
                    mainButton.className = 'flex-grow px-1.5 py-1.5 text-center text-sm font-medium text-gray-800 hover:bg-amber-100';
                    mainButton.dataset.chordType = chordType;
                    const chordDescription = CHORD_DEFINITIONS[chordType].description || '';
                    mainButton.title = chordDescription;
                    // Mouse events for desktop
                    mainButton.onmousedown = () => selectBuilderChordType(chordType, true);
                    mainButton.onmouseup = () => stopBuilderChord();
                    mainButton.onmouseleave = () => stopBuilderChord();
                    
                    // Touch events for mobile/tablet - prevent default to avoid tooltip interference
                    let touchStartTime = 0;
                    let touchHolding = false;
                    mainButton.addEventListener('touchstart', (e) => {
                        e.preventDefault(); // Prevent mouse events and tooltip
                        touchStartTime = Date.now();
                        touchHolding = true;
                        // Mark button as held to prevent tooltip from showing
                        mainButton.dataset.held = 'true';
                        selectBuilderChordType(chordType, true);
                    }, { passive: false });
                    
                    mainButton.addEventListener('touchend', (e) => {
                        e.preventDefault();
                        touchHolding = false;
                        stopBuilderChord();
                        // Remove held flag
                        mainButton.dataset.held = 'false';
                        // Only show tooltip if it was a quick tap (not a hold)
                        if (Date.now() - touchStartTime < 300) {
                            // Trigger tooltip after a short delay
                            setTimeout(() => {
                                if (!touchHolding && mainButton.dataset.held !== 'true') {
                                    const event = new MouseEvent('mouseenter', {
                                        bubbles: true,
                                        cancelable: true,
                                        view: window
                                    });
                                    mainButton.dispatchEvent(event);
                                }
                            }, 100);
                        }
                    }, { passive: false });
                    
                    mainButton.addEventListener('touchcancel', (e) => {
                        e.preventDefault();
                        touchHolding = false;
                        mainButton.dataset.held = 'false';
                        stopBuilderChord();
                    }, { passive: false });
                    
                    buttonContainer.appendChild(mainButton);
                    
                    // Create info icon button in lower left corner for mobile tooltip access
                    const infoIcon = document.createElement('button');
                    infoIcon.innerHTML = 'ℹ';
                    infoIcon.className = 'chord-info-icon';
                    infoIcon.style.position = 'absolute';
                    infoIcon.style.bottom = '1px';
                    infoIcon.style.left = '1px';
                    infoIcon.style.width = '12px';
                    infoIcon.style.height = '12px';
                    infoIcon.style.borderRadius = '50%';
                    infoIcon.style.backgroundColor = 'rgba(107, 114, 128, 0.5)';
                    infoIcon.style.color = 'rgba(255, 255, 255, 0.8)';
                    infoIcon.style.fontSize = '8px';
                    infoIcon.style.fontWeight = '600';
                    infoIcon.style.display = 'flex';
                    infoIcon.style.alignItems = 'center';
                    infoIcon.style.justifyContent = 'center';
                    infoIcon.style.border = 'none';
                    infoIcon.style.cursor = 'pointer';
                    infoIcon.style.zIndex = '10';
                    infoIcon.style.padding = '0';
                    infoIcon.style.lineHeight = '1';
                    infoIcon.style.transition = 'all 0.2s';
                    infoIcon.title = 'Show chord details';
                    infoIcon.addEventListener('mouseenter', () => {
                        infoIcon.style.backgroundColor = 'rgba(83, 122, 187, 0.6)';
                        infoIcon.style.color = 'white';
                        infoIcon.style.transform = 'scale(1.15)';
                    });
                    infoIcon.addEventListener('mouseleave', () => {
                        infoIcon.style.backgroundColor = 'rgba(107, 114, 128, 0.5)';
                        infoIcon.style.color = 'rgba(255, 255, 255, 0.8)';
                        infoIcon.style.transform = 'scale(1)';
                    });
                    // Prevent info icon clicks from triggering chord playback
                    infoIcon.addEventListener('mousedown', (e) => {
                        e.stopPropagation();
                    });
                    infoIcon.addEventListener('touchstart', (e) => {
                        e.stopPropagation();
                    }, { passive: false });
                    buttonContainer.appendChild(infoIcon);
                    
                    // Create tooltip for chord button with name and inversion options
                    const tooltipText = `${chordType}\n\n${chordDescription}`;
                    const tooltipElement = createButtonTooltip(mainButton, tooltipText, chordType);
                    
                    // Make info icon trigger tooltip on click/tap
                    const showTooltip = () => {
                        if (!tooltipElement) return;
                        const rect = mainButton.getBoundingClientRect();
                        const tooltipHeight = 200; // Same as in createButtonTooltip
                        tooltipElement.style.left = (rect.left + rect.width / 2) + 'px';
                        tooltipElement.style.top = (rect.top - tooltipHeight - 12) + 'px';
                        tooltipElement.style.transform = 'translateX(-50%)';
                        tooltipElement.style.opacity = '1';
                        tooltipElement.style.visibility = 'visible';
                    };
                    infoIcon.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        showTooltip();
                    });
                    infoIcon.addEventListener('touchend', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        showTooltip();
                    }, { passive: false });

                    // Container for arpeggio buttons (imported from arpeggiator module)
                    const arpContainer = document.createElement('div');
                    arpContainer.className = 'flex flex-col w-8 border-l border-gray-300';

                    // Arp Up button
                    const arpUp = document.createElement('button');
                    arpUp.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800 border-b border-gray-300';
                    arpUp.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path></svg>';
                    arpUp.title = 'Play Ascending Arpeggio';
                    arpUp.onclick = (e) => {
                        e.stopPropagation();
                        if (window.playArpeggio) window.playArpeggio('chord', chordType, 'up');
                    };
                    arpContainer.appendChild(arpUp);

                    // Arp Down button
                    const arpDown = document.createElement('button');
                    arpDown.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800';
                    arpDown.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
                    arpDown.title = 'Play Descending Arpeggio';
                    arpDown.onclick = (e) => {
                        e.stopPropagation();
                        if (window.playArpeggio) window.playArpeggio('chord', chordType, 'down');
                    };
                    arpContainer.appendChild(arpDown);

                    buttonContainer.appendChild(arpContainer);
                    buttonGrid.appendChild(buttonContainer);
                }
            });
            groupContainer.appendChild(buttonGrid);
            typeSelector.appendChild(groupContainer);
        });
    }

    if (invSelector.children.length === 0) {
        invSelector.innerHTML = '';
        INVERSION_NAMES.forEach((name, index) => {
            const button = document.createElement('button');
            button.textContent = name;
            button.dataset.inversion = index;
            button.onmousedown = () => selectBuilderInversion(index, true);
            button.onmouseup = () => stopBuilderChord();
            button.onmouseleave = () => stopBuilderChord();
            // Touch events for mobile/tablet
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                selectBuilderInversion(index, true);
            }, { passive: false });
            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                stopBuilderChord();
            }, { passive: false });
            button.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                stopBuilderChord();
            }, { passive: false });
            button.className = 'key-button px-3 py-1 font-medium rounded-lg text-sm transition duration-150 transform hover:scale-105 bg-gray-200 text-gray-800 hover:bg-amber-100';
            invSelector.appendChild(button);
        });
    }

    if (intervalSelector.children.length === 0) {
        intervalSelector.innerHTML = '';
        INTERVAL_GROUPS.forEach(group => {
            const groupContainer = document.createElement('div');
            groupContainer.className = 'border border-gray-200 rounded-lg p-3 flex flex-col';
            const title = document.createElement('h4');
            title.className = 'text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 text-center';
            title.textContent = group.title;
            groupContainer.appendChild(title);

            const buttonGrid = document.createElement('div');
            buttonGrid.className = 'grid grid-cols-1 gap-2';
            group.types.forEach(intervalType => {
                if (INTERVAL_DEFINITIONS[intervalType]) {
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'key-button-wrapper flex items-stretch rounded-lg shadow-sm overflow-hidden bg-gray-200 transition duration-150 transform hover:scale-105';

                    // Main button for block interval
                    const mainButton = document.createElement('button');
                    mainButton.className = 'flex-grow px-2 py-2 text-center font-medium text-gray-800 hover:bg-amber-100';
                    mainButton.dataset.intervalType = intervalType;
                    const intervalDescription = INTERVAL_DEFINITIONS[intervalType].description || '';
                    mainButton.title = intervalDescription;
                    mainButton.onmousedown = () => selectBuilderInterval(intervalType, true);
                    mainButton.onmouseup = () => stopBuilderChord();
                    mainButton.onmouseleave = () => stopBuilderChord();
                    // Touch events for mobile/tablet
                    mainButton.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        selectBuilderInterval(intervalType, true);
                    }, { passive: false });
                    mainButton.addEventListener('touchend', (e) => {
                        e.preventDefault();
                        stopBuilderChord();
                    }, { passive: false });
                    mainButton.addEventListener('touchcancel', (e) => {
                        e.preventDefault();
                        stopBuilderChord();
                    }, { passive: false });
                    buttonContainer.appendChild(mainButton);
                    
                    // Create tooltip for interval button with name included
                    const tooltipText = `${intervalType}\n\n${intervalDescription}`;
                    createButtonTooltip(mainButton, tooltipText);

                    // Container for arpeggio buttons
                    const arpContainer = document.createElement('div');
                    arpContainer.className = 'flex flex-col w-10 border-l border-gray-300';

                    // Arp Up button
                    const arpUp = document.createElement('button');
                    arpUp.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800 border-b border-gray-300';
                    arpUp.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path></svg>';
                    arpUp.title = 'Play Ascending Arpeggio';
                    arpUp.onclick = (e) => {
                        e.stopPropagation();
                        if (window.playArpeggio) window.playArpeggio('interval', intervalType, 'up');
                    };
                    arpContainer.appendChild(arpUp);

                    // Arp Down button
                    const arpDown = document.createElement('button');
                    arpDown.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800';
                    arpDown.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
                    arpDown.title = 'Play Descending Arpeggio';
                    arpDown.onclick = (e) => {
                        e.stopPropagation();
                        if (window.playArpeggio) window.playArpeggio('interval', intervalType, 'down');
                    };
                    arpContainer.appendChild(arpDown);

                    buttonContainer.appendChild(arpContainer);
                    buttonGrid.appendChild(buttonContainer);
                }
            });
            groupContainer.appendChild(buttonGrid);
            intervalSelector.appendChild(groupContainer);
        });
    }

    selectBuilderRootNote(getBuilderRootIndex(), false);
    selectBuilderChordType(getBuilderChordType(), false);
    selectBuilderInversion(getBuilderInversion(), false);
    updateChordTypeButtonCaptions();
    updateLHInversionSelector();
    updateIntervalButtonCaptions();
}

/**
 * Render voicing editor for note omission
 * @param {Array<string>} notes - Notes to display
 * @param {string} editorId - DOM element ID for editor
 * @param {string} containerId - DOM element ID for container
 * @param {Array<string>} omittedNotes - Currently omitted notes
 * @param {Function} onToggle - Callback when note is toggled
 * @param {Function} onSelectAll - Callback to select all notes
 * @param {Function} onSelectNone - Callback to select none notes
 */
export function renderVoicingEditor(notes, editorId, containerId, omittedNotes, onToggle, onSelectAll = null, onSelectNone = null) {
    const editor = document.getElementById(editorId);
    const editorContainer = document.getElementById(containerId);
    editor.innerHTML = '';

    if (!notes || notes.length === 0) {
        editorContainer.classList.add('hidden');
        return;
    }
    editorContainer.classList.remove('hidden');

    // Add "All" and "None" buttons if callbacks are provided
    if (onSelectAll && onSelectNone) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'flex gap-1 mb-2';
        
        const allButton = document.createElement('button');
        allButton.textContent = 'All';
        allButton.className = 'px-2 py-0.5 text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white rounded transition-colors';
        allButton.onclick = onSelectAll;
        allButton.title = 'Select all notes';
        
        const noneButton = document.createElement('button');
        noneButton.textContent = 'None';
        noneButton.className = 'px-2 py-0.5 text-xs font-semibold bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors';
        noneButton.onclick = onSelectNone;
        noneButton.title = 'Deselect all notes';
        
        buttonContainer.appendChild(allButton);
        buttonContainer.appendChild(noneButton);
        editor.appendChild(buttonContainer);
    }

    notes.forEach(note => {
        const wrapper = document.createElement('label');
        wrapper.className = 'flex items-center gap-2 cursor-pointer text-gray-700';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = note;
        checkbox.checked = !omittedNotes.includes(note);
        checkbox.className = 'w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500';

        checkbox.onchange = () => {
            onToggle(note, !checkbox.checked);
        };

        wrapper.appendChild(checkbox);
        wrapper.append(note);
        editor.appendChild(wrapper);
    });
}

// ============================================================================
// Progression Builder Integration
// ============================================================================

/**
 * Add the current builder chord to the progression
 * @param {boolean} switchToTrainer - Whether to switch to trainer tab after adding
 * @param {boolean} playShutterSound - Whether to play the camera shutter sound (default: true)
 */
export function addChordToProgression(switchToTrainer = false, playShutterSound = true) {
    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];

    // Play camera shutter sound effect (only if requested)
    if (playShutterSound && getAudioIsReady() && getCameraShutter()) {
        getCameraShutter().start();
    }

    const lhType = document.getElementById('builder-lh-type-select').value;
    const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
    const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
    const omittedNotes = [...getBuilderOmittedNotes()]; // Capture current voicing
    const lhOmittedNotes = [...getBuilderLHOmittedNotes()]; // Capture LH voicing
    const octaveShift = getBuilderOctaveShift(); // Capture current octave shift

    let newChordData;

    if (getBuilderSelectionMode() === 'interval') {
        const intervalType = getBuilderIntervalType();
        const result = getIntervalNotes(rootNote, intervalType, octaveShift, getEnharmonicPreference());
        newChordData = {
            roman: rootNote, // Use root note as the "numeral"
            name: result.name,
            simpleName: INTERVAL_DEFINITIONS[intervalType].symbol || intervalType,
            notes: result.specificNotes,
            root: rootNote,
            type: intervalType,
            inversion: 0, // Not applicable
            selectionMode: 'interval',
            omittedNotes: omittedNotes,
            octaveShift: octaveShift,
            lhOmittedNotes: lhOmittedNotes
        };
    } else { // It's a chord
        const chordType = getBuilderChordType();
        const inversion = getBuilderInversion();
        const trainerState = getTrainerState();
        const result = getInvertedChordNotes(
            rootNote,
            chordType,
            inversion,
            trainerState.currentKey,
            octaveShift,
            getEnharmonicPreference(),
            getNotationPreference()
        );
        newChordData = {
            name: result.name,
            simpleName: result.simpleName,
            notes: result.specificNotes,
            root: rootNote,
            type: chordType,
            inversion: inversion,
            selectionMode: 'chord',
            omittedNotes: omittedNotes,
            octaveShift: octaveShift
        };
    }

    const trainerState = getTrainerState();
    // Get the key without the 'm' suffix for index calculation
    let trainerKey = trainerState.currentKey || 'C';
    const isMinorKey = trainerKey && trainerKey.endsWith('m');
    if (isMinorKey) {
        trainerKey = trainerKey.replace(/m$/, '');
    }
    let trainerKeyRootIndex = ALL_NOTES.indexOf(trainerKey);
    if (trainerKeyRootIndex === -1) trainerKeyRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[trainerKey] || trainerKey);

    // Resolve the root note to its sharp equivalent
    let addedChordRootIndex = ALL_NOTES.indexOf(rootNote);
    if (addedChordRootIndex === -1) addedChordRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[rootNote]);
    if (addedChordRootIndex === -1) return; // Should not happen

    const interval = (addedChordRootIndex - trainerKeyRootIndex + 12) % 12;
    const scaleDegreeIndex = MAJOR_SCALE_STEPS.indexOf(interval);

    let romanNumeral = '?';
    if (scaleDegreeIndex !== -1) {
        if (newChordData.selectionMode === 'chord') {
            const romanKeys = Object.keys(ROMAN_MAP_BASE);
            const foundKey = romanKeys.find(key =>
                ROMAN_MAP_BASE[key].index === scaleDegreeIndex &&
                ROMAN_MAP_BASE[key].quality === newChordData.type
            );
            const fallbackKey = romanKeys.find(key => ROMAN_MAP_BASE[key].index === scaleDegreeIndex);
            romanNumeral = foundKey || fallbackKey || '?';
        } else {
            romanNumeral = rootNote; // Just use the note name for intervals
        }
    } else {
        romanNumeral = rootNote;
    }

    // Convert Roman numeral to minor case if the key is minor
    if (isMinorKey && romanNumeral && romanNumeral !== '?') {
        // Convert major Roman numerals to minor case
        const minorMap = {
            'I': 'i',
            'ii': 'ii°',
            'iii': 'III',
            'IV': 'iv',
            'V': 'v',
            'vi': 'VI',
            'vii°': 'VII'
        };
        romanNumeral = minorMap[romanNumeral] || romanNumeral;
    }

    newChordData.roman = romanNumeral;
    newChordData.lhType = lhType;
    newChordData.lhInversion = lhInversion;
    newChordData.lhOmittedNotes = lhOmittedNotes;
    newChordData.rhythmPattern = 'block'; // Default rhythm pattern
    newChordData.isVoicingExpanded = true; // Default to expanded when adding
    newChordData.lhOctaveShift = lhOctaveShift;

    // Add to trainer state using window function
    if (window.addToProgressionData) {
        window.addToProgressionData(newChordData);
    } else {
        // Fallback: manually add to progression
        const trainerState = getTrainerState();
        trainerState.progressionData.push(newChordData);
        if (newChordData.roman && !trainerState.progressionRomans.includes(newChordData.roman)) {
            trainerState.progressionRomans.push(newChordData.roman);
        }
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay();
        }
    }

    // Update smart recommendations panel
    if (window.updateRecommendations) {
        window.updateRecommendations();
    }

    if (switchToTrainer && window.switchTab) {
        window.switchTab('trainer');
    }
}

/**
 * Add a specific chord type and inversion to the progression without changing builder state
 * @param {string} chordType - The chord type to add
 * @param {number} inversion - The inversion to use
 * @param {boolean} playShutterSound - Whether to play the camera shutter sound (default: true)
 */
export function addSpecificChordToProgression(chordType, inversion, playShutterSound = true) {
    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];
    
    // Play camera shutter sound effect (only if requested)
    if (playShutterSound && getAudioIsReady() && getCameraShutter()) {
        getCameraShutter().start();
    }
    
    const lhType = document.getElementById('builder-lh-type-select').value;
    const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
    const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
    const omittedNotes = [...getBuilderOmittedNotes()]; // Capture current voicing
    const lhOmittedNotes = [...getBuilderLHOmittedNotes()]; // Capture LH voicing
    const octaveShift = getBuilderOctaveShift(); // Capture current octave shift
    
    const trainerState = getTrainerState();
    const result = getInvertedChordNotes(
        rootNote,
        chordType,
        inversion,
        trainerState.currentKey,
        octaveShift,
        getEnharmonicPreference(),
        getNotationPreference()
    );
    
    const newChordData = {
        name: result.name,
        simpleName: result.simpleName,
        notes: result.specificNotes,
        root: rootNote,
        type: chordType,
        inversion: inversion,
        selectionMode: 'chord',
        omittedNotes: omittedNotes,
        octaveShift: octaveShift
    };
    
    // Get the key without the 'm' suffix for index calculation
    let trainerKey = trainerState.currentKey || 'C';
    const isMinorKey = trainerKey && trainerKey.endsWith('m');
    if (isMinorKey) {
        trainerKey = trainerKey.replace(/m$/, '');
    }
    let trainerKeyRootIndex = ALL_NOTES.indexOf(trainerKey);
    if (trainerKeyRootIndex === -1) trainerKeyRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[trainerKey] || trainerKey);
    
    // Resolve the root note to its sharp equivalent
    let addedChordRootIndex = ALL_NOTES.indexOf(rootNote);
    if (addedChordRootIndex === -1) addedChordRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[rootNote]);
    if (addedChordRootIndex === -1) return; // Should not happen
    
    const interval = (addedChordRootIndex - trainerKeyRootIndex + 12) % 12;
    const scaleDegreeIndex = MAJOR_SCALE_STEPS.indexOf(interval);
    
    let romanNumeral = '?';
    if (scaleDegreeIndex !== -1) {
        const romanKeys = Object.keys(ROMAN_MAP_BASE);
        const foundKey = romanKeys.find(key =>
            ROMAN_MAP_BASE[key].index === scaleDegreeIndex &&
            ROMAN_MAP_BASE[key].quality === chordType
        );
        const fallbackKey = romanKeys.find(key => ROMAN_MAP_BASE[key].index === scaleDegreeIndex);
        romanNumeral = foundKey || fallbackKey || '?';
    } else {
        romanNumeral = rootNote;
    }
    
    // Convert Roman numeral to minor case if the key is minor
    if (isMinorKey && romanNumeral && romanNumeral !== '?') {
        // Convert major Roman numerals to minor case
        const minorMap = {
            'I': 'i',
            'ii': 'ii°',
            'iii': 'III',
            'IV': 'iv',
            'V': 'v',
            'vi': 'VI',
            'vii°': 'VII'
        };
        romanNumeral = minorMap[romanNumeral] || romanNumeral;
    }
    
    newChordData.roman = romanNumeral;
    newChordData.lhType = lhType;
    newChordData.lhInversion = lhInversion;
    newChordData.lhOmittedNotes = lhOmittedNotes;
    newChordData.rhythmPattern = 'block'; // Default rhythm pattern
    newChordData.isVoicingExpanded = true; // Default to expanded when adding
    newChordData.lhOctaveShift = lhOctaveShift;
    
    // Add to trainer state using window function
    if (window.addToProgressionData) {
        window.addToProgressionData(newChordData);
    } else {
        // Fallback: manually add to progression
        const trainerState = getTrainerState();
        trainerState.progressionData.push(newChordData);
        if (newChordData.roman && !trainerState.progressionRomans.includes(newChordData.roman)) {
            trainerState.progressionRomans.push(newChordData.roman);
        }
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay();
        }
    }
    
    // Update smart recommendations panel
    if (window.updateRecommendations) {
        window.updateRecommendations();
    }
}

/**
 * Capture a played chord from the keyboard (for recording mode)
 * @param {Array<string>} notes - Notes that were played
 * @param {string} type - Chord type (default 'Major')
 * @param {number} inversion - Inversion (default 0)
 */
export function capturePlayedChord(notes, type = 'Major', inversion = 0) {
    // Basic chord detection from played notes
    const rootNote = notes[0].slice(0, -1);
    const chordType = type;

    const romanNumeral = rootNote; // Use note name for recorded chords

    // Function to be imported from progressionBuilder module
    if (window.getProgressionChordNotes && window.addToProgressionData) {
        const trainerState = getTrainerState();
        const newChordData = window.getProgressionChordNotes(
            trainerState.currentKey,
            romanNumeral,
            chordType,
            inversion,
            trainerState.octaveShift
        );

        if (newChordData) {
            newChordData.lhSetting = 'off';
            newChordData.lhOctaveShift = -12;
            window.addToProgressionData(newChordData);

            if (window.renderProgressionDisplay) {
                window.renderProgressionDisplay();
            }
        }
    }
}

/**
 * Programmatically select a chord by root and type, then add it to the progression
 * Used for importing chords from external sources like song search
 * @param {string} root - Root note (e.g., "C", "F#", "Bb")
 * @param {string} type - Chord type (e.g., "major", "minor", "dominant7")
 */
export function selectBuilderChordBySymbol(root, type, playShutterSound = true, inversion = 0) {
    // Map common chord type names to internal type names (matching CHORD_DEFINITIONS keys exactly)
    const typeMap = {
        'major': 'Major',
        'minor': 'Minor',
        'diminished': 'Diminished',
        'augmented': 'Augmented',
        'sus2': 'Sus2',
        'sus4': 'Sus4',
        'major7': 'Major 7th',  // Note: CHORD_DEFINITIONS uses 'Major 7th' with space
        'minor7': 'Minor 7th',  // Note: CHORD_DEFINITIONS uses 'Minor 7th' with space
        'dominant7': 'Dominant 7th',  // Note: CHORD_DEFINITIONS uses 'Dominant 7th' with space
        'dominant9': 'Dominant 9th',  // Note: CHORD_DEFINITIONS uses 'Dominant 9th' with space
        'minor9': 'Minor 9th',  // Note: CHORD_DEFINITIONS uses 'Minor 9th' with space
        'major9': 'Major 9th'   // Note: CHORD_DEFINITIONS uses 'Major 9th' with space
    };
    
    const mappedType = typeMap[type.toLowerCase()] || 'Major';
    
    // Get note arrays based on enharmonic preference
    const noteArray = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
    
    // Find the root note index
    const rootIndex = noteArray.indexOf(root);
    if (rootIndex === -1) {
        console.warn(`Root note not found: ${root}`);
        return;
    }
    
    // Set the builder state
    setBuilderRootIndex(rootIndex);
    setBuilderChordType(mappedType);
    
    // Set inversion if provided (0 = root position, 1 = first inversion, 2 = second inversion, etc.)
    if (inversion !== undefined && inversion !== null) {
        setBuilderInversion(inversion);
    }
    
    // Update displays
    updateBuilderDisplay();
    
    // Add to progression (pass through playShutterSound parameter)
    addChordToProgression(false, playShutterSound);
}

// ============================================================================
// Suggestion Engine
// ============================================================================

/**
 * Update chord suggestions based on current selection
 * Highlights suggested next chords for voice leading
 */
function updateChordSuggestions() {
    document.querySelectorAll('.suggestion-highlight').forEach(el => {
        el.classList.remove('suggestion-highlight');
    });

    if (getBuilderSelectionMode() !== 'chord' || !getIsSuggestionEngineOn()) return;

    const currentRootIndex = getBuilderRootIndex();
    const currentChordType = getBuilderChordType();

    let suggestions = [];

    if (currentChordType === 'Major') {
        suggestions = [
            { step: 5, quality: 'Major', inversion: '2nd' },
            { step: 7, quality: 'Dominant 7th', inversion: '1st' },
            { step: 9, quality: 'Minor', inversion: '1st' }
        ];
    } else if (currentChordType === 'Minor') {
        suggestions = [
            { step: 5, quality: 'Minor', inversion: '2nd' },
            { step: 7, quality: 'Dominant 7th', inversion: '1st' }
        ];
    }

    suggestions.forEach(suggestion => {
        const targetRootIndex = (currentRootIndex + suggestion.step) % 12;
        const targetQuality = suggestion.quality;

        const rootButton = document.querySelector(`#builder-note-selector button[data-index="${targetRootIndex}"]`);
        if (rootButton) {
            rootButton.classList.add('suggestion-highlight');
        }

        const chordButton = document.querySelector(`#builder-chord-type-selector button[data-chord-type="${targetQuality}"]`);
        if (chordButton) {
            chordButton.classList.add('suggestion-highlight');
            const originalTitle = CHORD_DEFINITIONS[targetQuality]?.description || '';
            chordButton.title = `SUGGESTION: Try this chord next, using the ${suggestion.inversion} inversion for smooth voice leading.\n\n${originalTitle}`;
        }
    });
}
