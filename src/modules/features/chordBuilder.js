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
    setBuilderLHOmittedNotes,
    getChordLibraryMode,
    setChordLibraryMode,
    getLastDiatonicChord,
    setLastDiatonicChord,
    getScaleFilter,
    setScaleFilter
} from '../state/builderState.js';

import {
    getCurrentTab,
    getEnharmonicPreference,
    setEnharmonicPreference,
    getNotationPreference,
    getIsSuggestionEngineOn
} from '../state/globalState.js';

import { getTrainerState, getCurrentKey } from '../state/trainerState.js';

// Share chord card rendering (tooltips, inversion playback, presentation) with Composition Studio
// Updated to use refactored module structure (Phase 1 - 2025-12-26)
import { renderProgressionDisplayForBuilder } from './progressionBuilder/index.js';

// Import guided mode event dispatcher for lesson integration
import { dispatchBuilderEvent, isGuidedModeActive } from '../ui/lessonGuidedMode.js';

// Import comprehensive chord recommendation engine (evaluates all roots, types, inversions)
import { generateComprehensiveRecommendations } from './comprehensiveChordRecommendations.js';

// Import roman numeral utilities for proper borrowed chord handling
import { noteToRomanNumeral } from '../utils/romanNumerals.js';

// Import chord explorer for detailed 3D visualization
import { showChordExplorerModal } from '../ui/chordExplorerModal.js';

// Import unified recommendation modal
import { showUnifiedRecommendationModal } from '../ui/recommendations/UnifiedRecommendationModal/index.js';

// =========================================================================
// Helper Function: Generate Context-Aware Chord Description
// =========================================================================

/**
 * Generates a context-aware chord description based on the selected root note
 * @param {string} chordType - The chord type (e.g., 'Dominant 7th')
 * @param {string} rootNote - The selected root note (e.g., 'C')
 * @param {string} baseDescription - The base description from CHORD_DEFINITIONS
 * @returns {string} Enhanced description with context-specific resolution information
 */
function getContextAwareChordDescription(chordType, rootNote, baseDescription) {
    let contextInfo = '';

    // Add context-specific information for dominant 7th chords
    if (chordType === 'Dominant 7th') {
        // A dominant 7th chord built on a root wants to resolve to a target a perfect 4th up (or perfect 5th down)
        // For example: C7 → F, G7 → C, D7 → G
        const targetNote = getTargetResolution(rootNote);
        if (targetNote) {
            contextInfo = `\n\nWith the currently selected root of ${rootNote}, this ${rootNote}7 chord naturally wants to resolve to ${targetNote} (${targetNote} major or ${targetNote} minor). This is because a dominant seventh chord is built on the fifth scale degree (the dominant) of its tonic key.`;
        }
    }

    // Dominant 9th - similar resolution to dominant 7th
    else if (chordType === 'Dominant 9th') {
        const targetNote = getTargetResolution(rootNote);
        if (targetNote) {
            contextInfo = `\n\nWith ${rootNote} as the root, this ${rootNote}9 chord resolves to ${targetNote} (${targetNote} major or ${targetNote} minor), functioning as a V9 chord. The added 9th creates a richer, jazzier sound while maintaining the strong dominant function.`;
        }
    }

    // Altered dominant chords (7b5, 7#5, 7b9, 7#9)
    else if (chordType === '7b5' || chordType === '7#5' || chordType === '7b9' || chordType === '7#9') {
        const targetNote = getTargetResolution(rootNote);
        if (targetNote) {
            const alteration = chordType.includes('b5') ? 'flatted 5th' : chordType.includes('#5') ? 'sharped 5th' : chordType.includes('b9') ? 'flatted 9th' : 'sharped 9th';
            contextInfo = `\n\nWith ${rootNote} as the root, this ${rootNote}${chordType.replace('Dominant ', '').replace('th', '')} chord creates heightened tension through the ${alteration}, making the resolution to ${targetNote} even stronger. Commonly used in jazz and blues for dramatic effect.`;
        }
    }

    // Augmented 7th
    else if (chordType === 'Augmented 7th') {
        const targetNote = getTargetResolution(rootNote);
        if (targetNote) {
            contextInfo = `\n\nWith ${rootNote} as the root, this ${rootNote}aug7 chord has an augmented 5th that creates ambiguity and tension, resolving strongly to ${targetNote}. The raised 5th can move up or down, providing flexible voice leading options.`;
        }
    }

    // Diminished 7th
    else if (chordType === 'Diminished 7th') {
        const targetNote = getNearestHalfStepUp(rootNote);
        if (targetNote) {
            contextInfo = `\n\nWith ${rootNote} as the root, this ${rootNote}dim7 chord typically resolves up by a half step to ${targetNote} (${targetNote} major or ${targetNote} minor). Due to its symmetrical structure, diminished 7th chords can resolve to any chord whose root is a half step above any of its notes.`;
        }
    }

    // Half-Diminished 7th
    else if (chordType === 'Half-Diminished 7th') {
        const dominantNote = getNearestHalfStepDown(rootNote);
        const targetNote = getTargetResolution(dominantNote);
        if (dominantNote && targetNote) {
            contextInfo = `\n\nWith ${rootNote} as the root, this ${rootNote}m7♭5 chord commonly functions as a ii° chord in minor keys, typically resolving to ${dominantNote}7 (the dominant) which then resolves to ${targetNote} (the tonic). It's essential in minor key ii-V-i progressions.`;
        }
    }

    // Minor 7th
    else if (chordType === 'Minor 7th') {
        const targetNote = getTargetResolution(rootNote);
        if (targetNote) {
            contextInfo = `\n\nWith ${rootNote} as the root, ${rootNote}m7 often functions as a ii chord in jazz progressions, leading to ${targetNote}7 (the V chord). This creates the classic ii-V progression that's fundamental to jazz harmony.`;
        }
    }

    // Major 7th
    else if (chordType === 'Major 7th') {
        contextInfo = `\n\nWith ${rootNote} as the root, ${rootNote}maj7 creates a stable, restful quality. It's commonly used as a I chord (tonic) or IV chord (subdominant) in major keys, and doesn't require resolution like dominant chords do.`;
    }

    // Minor-Major 7th
    else if (chordType === 'Minor-Major 7th') {
        contextInfo = `\n\nWith ${rootNote} as the root, ${rootNote}m(maj7) combines the darkness of a minor triad with the tension of a major 7th. Often used as a passing chord in minor keys when the melody moves from the root to the major 7th, creating a cinematic, mysterious sound.`;
    }

    // Suspended chords (sus2, sus4)
    else if (chordType === 'Sus2' || chordType === 'Sus4') {
        const interval = (chordType === 'Sus2') ? '2nd' : '4th';
        const resolveInterval = '3rd';
        contextInfo = `\n\nWith ${rootNote} as the root, ${rootNote}sus${interval === '2nd' ? '2' : '4'} creates an unresolved, floating quality. It typically resolves when the ${interval} moves to the ${resolveInterval}, creating either ${rootNote} major or ${rootNote} minor. This creates a satisfying sense of arrival.`;
    }

    // Diminished triad
    else if (chordType === 'Diminished') {
        const targetNote = getNearestHalfStepUp(rootNote);
        if (targetNote) {
            contextInfo = `\n\nWith ${rootNote} as the root, ${rootNote}dim often functions as a passing chord or as vii° in a key, creating strong tension that typically resolves up by a half step to ${targetNote}. Its unstable sound demands resolution.`;
        }
    }

    // Augmented triad
    else if (chordType === 'Augmented') {
        const targetNote = getNearestHalfStepUp(rootNote);
        if (targetNote) {
            contextInfo = `\n\nWith ${rootNote} as the root, ${rootNote}aug has a symmetrical structure where each note is 4 semitones apart. The raised 5th creates tension and ambiguity, often resolving when the augmented 5th moves up by half step or the root moves to another chord.`;
        }
    }

    // Extended chords (9th, 11th, 13th)
    else if (chordType === 'Major 9th') {
        contextInfo = `\n\nWith ${rootNote} as the root, ${rootNote}maj9 stacks lush harmony by combining a major 7th with a 9th. Commonly used in jazz as a more colorful alternative to a simple major chord, creating a sophisticated, open sound.`;
    }

    else if (chordType === 'Minor 9th') {
        const targetNote = getTargetResolution(rootNote);
        if (targetNote) {
            contextInfo = `\n\nWith ${rootNote} as the root, ${rootNote}m9 is often used as a ii9 chord leading to ${targetNote}7 in jazz. The added 9th enriches the minor 7th chord with more color and warmth, perfect for creating smooth, soulful progressions.`;
        }
    }

    else if (chordType === 'Dominant 11th') {
        const targetNote = getTargetResolution(rootNote);
        if (targetNote) {
            contextInfo = `\n\nWith ${rootNote} as the root, ${rootNote}11 adds a suspended quality to the dominant 7th with the 11th (which is a 4th plus an octave). Often resolves to ${targetNote}, with the 11th creating additional tension that wants to resolve downward.`;
        }
    }

    else if (chordType === 'Minor 11th') {
        contextInfo = `\n\nWith ${rootNote} as the root, ${rootNote}m11 creates a rich, complex minor sonority. The 11th (perfect 4th plus an octave) blends naturally with the minor quality, often used in modal jazz or as a colorful ii chord.`;
    }

    else if (chordType === 'Dominant 13th') {
        const targetNote = getTargetResolution(rootNote);
        if (targetNote) {
            contextInfo = `\n\nWith ${rootNote} as the root, ${rootNote}13 is one of the richest dominant chords, stacking notes up to the 13th (a 6th plus an octave). Typically resolves to ${targetNote}, used in big band jazz and sophisticated harmony.`;
        }
    }

    // 6th chords
    else if (chordType === 'Major 6th') {
        contextInfo = `\n\nWith ${rootNote} as the root, ${rootNote}6 adds a sweet, vintage quality. Often used instead of maj7 in jazz standards, particularly as a stable tonic chord. The 6th provides color without the strong pull of a 7th.`;
    }

    else if (chordType === 'Minor 6th') {
        contextInfo = `\n\nWith ${rootNote} as the root, ${rootNote}m6 creates a bittersweet, sophisticated sound. Common in Latin and Brazilian music, and often used as a i6 chord in minor keys, providing a stable yet colorful tonic sound.`;
    }

    else if (chordType === '6/9') {
        contextInfo = `\n\nWith ${rootNote} as the root, ${rootNote}6/9 combines the 6th and 9th for a lush, static sound. Popular in jazz as an ending chord (I6/9), it's colorful but stable, not requiring resolution. Often used in place of major 7th chords for a brighter sound.`;
    }

    // Add9
    else if (chordType === 'Add9') {
        contextInfo = `\n\nWith ${rootNote} as the root, ${rootNote}add9 adds the 9th directly to a major triad without adding a 7th. Common in pop and rock music, it adds color and openness while maintaining the straightforward quality of a major chord.`;
    }

    return baseDescription + contextInfo;
}

/**
 * Get the target resolution for a dominant chord (perfect 4th up from root)
 * @param {string} rootNote - The root note (e.g., 'C', 'G#')
 * @returns {string} The target resolution note
 */
function getTargetResolution(rootNote) {
    // Map each note to its target (perfect 4th up, or perfect 5th down)
    const resolutionMap = {
        'C': 'F', 'C#': 'F#', 'Db': 'Gb',
        'D': 'G', 'D#': 'G#', 'Eb': 'Ab',
        'E': 'A',
        'F': 'Bb', 'F#': 'B', 'Gb': 'Cb',
        'G': 'C', 'G#': 'C#', 'Ab': 'Db',
        'A': 'D', 'A#': 'D#', 'Bb': 'Eb',
        'B': 'E', 'Cb': 'Fb'
    };

    return resolutionMap[rootNote] || null;
}

/**
 * Get the note a half step up from the given root
 * @param {string} rootNote - The root note
 * @returns {string} The note a half step up
 */
function getNearestHalfStepUp(rootNote) {
    const noteIndex = ALL_NOTES.indexOf(rootNote);
    if (noteIndex === -1) {
        // Try flat notes
        const flatIndex = FLAT_NOTES.indexOf(rootNote);
        if (flatIndex === -1) return null;
        const nextIndex = (flatIndex + 1) % 12;
        return FLAT_NOTES[nextIndex];
    }
    const nextIndex = (noteIndex + 1) % 12;
    return ALL_NOTES[nextIndex];
}

/**
 * Get the note a half step down from the given root
 * @param {string} rootNote - The root note
 * @returns {string} The note a half step down
 */
function getNearestHalfStepDown(rootNote) {
    const noteIndex = ALL_NOTES.indexOf(rootNote);
    if (noteIndex === -1) {
        // Try flat notes
        const flatIndex = FLAT_NOTES.indexOf(rootNote);
        if (flatIndex === -1) return null;
        const prevIndex = (flatIndex - 1 + 12) % 12;
        return FLAT_NOTES[prevIndex];
    }
    const prevIndex = (noteIndex - 1 + 12) % 12;
    return ALL_NOTES[prevIndex];
}

// =========================================================================
// Helper Function: Create Tooltip for Button
// =========================================================================

/**
 * Creates a custom tooltip for a button that appears on hover
 * Uses fixed positioning to avoid overflow clipping issues
 * @param {HTMLElement} button - The button element to attach tooltip to
 * @param {string} tooltipText - The text to display in the tooltip
 * @param {string} chordType - (Optional) The chord type, used to show inversion options
 * @param {string} chordRoot - (Optional) The chord root for diatonic mode, used to play the correct chord
 * @param {string} intervalType - (Optional) The interval type, used to show "Add Interval" button
 */
function createButtonTooltip(button, tooltipText, chordType = null, chordRoot = null, intervalType = null) {
    if (!tooltipText || tooltipText.length === 0) return null;

    const tooltip = document.createElement('div');
    tooltip.className = 'chord-button-tooltip';
    if (chordType) {
        tooltip.setAttribute('data-chord-type', chordType);
    }
    if (chordRoot) {
        tooltip.setAttribute('data-chord-root', chordRoot);
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
    
    // Add close button for touch devices
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '4px';
    closeBtn.style.right = '4px';
    closeBtn.style.width = '20px';
    closeBtn.style.height = '20px';
    closeBtn.style.borderRadius = '50%';
    closeBtn.style.backgroundColor = 'rgba(55, 65, 81, 0.8)';
    closeBtn.style.color = 'white';
    closeBtn.style.fontSize = '16px';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.style.border = 'none';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '0';
    closeBtn.style.lineHeight = '1';
    closeBtn.style.transition = 'all 0.2s';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.backgroundColor = 'rgba(75, 85, 99, 1)';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.backgroundColor = 'rgba(55, 65, 81, 0.8)';
    });
    let hideTooltip = () => {
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
    };
    
    // Store reference for close button
    const setupCloseButton = () => {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hideTooltip();
        });
        closeBtn.addEventListener('touchend', (e) => {
            e.stopPropagation();
            e.preventDefault();
            hideTooltip();
        }, { passive: false });
    };
    
    // Style the first line (name) to be bold and slightly larger
    const lines = tooltipText.split('\n');
    if (lines.length > 1) {
        const nameLine = lines[0];
        const descriptionLines = lines.slice(1).join('\n').trim();
        let tooltipHTML = `<div style="font-weight: 600; font-size: 13px; margin-bottom: 4px; color: #fbbf24; padding-right: 24px;">${nameLine}</div><div style="font-weight: 400; font-size: 12px;">${descriptionLines}</div>`;
        
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
    
    // Add close button to tooltip (positioned absolutely within the fixed tooltip)
    tooltip.appendChild(closeBtn);
    
    document.body.appendChild(tooltip);

    // Smart positioning function that prefers above but falls back to below
    const positionTooltip = () => {
        // Check if tooltips are disabled for this type
        if (chordType && window.chordTooltipsEnabled === false) return;
        if (!chordType && window.intervalTooltipsEnabled === false) return;

        const rect = button.getBoundingClientRect();
        const estimatedHeight = chordType ? 250 : 100; // Estimate with extra padding
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        const gap = 12; // Gap between button and tooltip

        // Make tooltip temporarily visible to measure actual height
        tooltip.style.visibility = 'hidden';
        tooltip.style.opacity = '0';
        tooltip.style.display = 'block';
        const actualHeight = tooltip.offsetHeight;

        // Prefer showing above if there's enough space
        if (spaceAbove >= actualHeight + gap) {
            // Show above
            tooltip.style.left = (rect.left + rect.width / 2) + 'px';
            tooltip.style.top = (rect.top - actualHeight - gap) + 'px';
            tooltip.style.transform = 'translateX(-50%)';
        } else if (spaceBelow >= actualHeight + gap) {
            // Show below if not enough space above
            tooltip.style.left = (rect.left + rect.width / 2) + 'px';
            tooltip.style.top = (rect.bottom + gap) + 'px';
            tooltip.style.transform = 'translateX(-50%)';
        } else {
            // Show above anyway if neither has enough space, but adjust to fit
            const topPosition = Math.max(gap, rect.top - actualHeight - gap);
            tooltip.style.left = (rect.left + rect.width / 2) + 'px';
            tooltip.style.top = topPosition + 'px';
            tooltip.style.transform = 'translateX(-50%)';
        }

        // Now make it visible with animation
        tooltip.style.visibility = 'visible';
        tooltip.style.opacity = '1';
    };

    // Add tap-outside-to-close functionality for touch devices
    const isTouchDeviceForTooltip = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDeviceForTooltip) {
        const handleOutsideTap = (e) => {
            // Check if the tap is outside the tooltip
            if (tooltip.style.visibility === 'visible' &&
                tooltip.style.opacity === '1' &&
                !tooltip.contains(e.target) &&
                !button.contains(e.target)) {
                hideTooltip();
                document.removeEventListener('touchend', handleOutsideTap);
                document.removeEventListener('click', handleOutsideTap);
            }
        };

        // Store reference to hide function for cleanup
        const originalHide = hideTooltip;
        tooltip.hideTooltip = () => {
            originalHide();
            document.removeEventListener('touchend', handleOutsideTap);
            document.removeEventListener('click', handleOutsideTap);
        };

        // Override hideTooltip to also remove listeners
        hideTooltip = () => {
            originalHide();
            document.removeEventListener('touchend', handleOutsideTap);
            document.removeEventListener('click', handleOutsideTap);
        };

        // Add listeners when tooltip is shown
        const originalShow = () => {
            positionTooltip();

            // Add outside tap listeners after a short delay to avoid immediate close
            setTimeout(() => {
                document.addEventListener('touchend', handleOutsideTap, { passive: true });
                document.addEventListener('click', handleOutsideTap, { passive: true });
            }, 100);
        };

        // Store original show function
        tooltip.showTooltip = originalShow;
    } else {
        // For non-touch devices, store the positioning function
        tooltip.positionTooltip = positionTooltip;
    }
    
    // Setup close button after hideTooltip is potentially overridden
    setupCloseButton();
    
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
        
        // Get the note array for index lookup
        const currentNotes = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        // Get chord root index if specified (for diatonic mode)
        const chordRootIndex = chordRoot ? currentNotes.indexOf(chordRoot) : -1;

        inversionButtons.forEach(btn => {
            // Play while button is pressed/held
            btn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                const inversionIndex = parseInt(btn.dataset.inversion, 10);

                // If we have a specific chord root (diatonic mode), temporarily set it
                const originalRoot = getBuilderRootIndex();
                if (chordRootIndex !== -1) {
                    setBuilderRootIndex(chordRootIndex);
                }

                // First ensure the correct chord type is selected (without playing)
                selectBuilderChordType(chordType, false);
                // Then select the inversion and start playing
                selectBuilderInversion(inversionIndex, false);
                startBuilderChord();

                // Restore original root if we changed it (for diatonic mode)
                if (chordRootIndex !== -1) {
                    setBuilderRootIndex(originalRoot);
                }

                // Store the selected chord+inversion+root for suggestion generation and adding
                window.lastTooltipChordSelection = { chordType, inversion: inversionIndex, chordRoot: chordRoot || null };
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

                // If we have a specific chord root (diatonic mode), temporarily set it
                const originalRoot = getBuilderRootIndex();
                if (chordRootIndex !== -1) {
                    setBuilderRootIndex(chordRootIndex);
                }

                // First ensure the correct chord type is selected (without playing)
                selectBuilderChordType(chordType, false);
                // Then select the inversion and start playing
                selectBuilderInversion(inversionIndex, false);
                startBuilderChord();

                // Restore original root if we changed it (for diatonic mode)
                if (chordRootIndex !== -1) {
                    setBuilderRootIndex(originalRoot);
                }

                // Store the selected chord+inversion+root for suggestion generation and adding
                window.lastTooltipChordSelection = { chordType, inversion: inversionIndex, chordRoot: chordRoot || null };
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
    
    // Add "Add Chord" and "Suggested Next" buttons side-by-side if this is a chord tooltip
    if (chordType && lines.length > 1) {
        // Create a flex container for the buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '6px';
        buttonContainer.style.marginTop = '8px';
        buttonContainer.style.width = '100%';
        
        // Create "Add Chord" button
        const addChordBtn = document.createElement('button');
        addChordBtn.textContent = 'Add Chord';
        addChordBtn.style.padding = '4px 8px';
        addChordBtn.style.fontSize = '10px';
        addChordBtn.style.backgroundColor = '#6366f1'; // indigo-500
        addChordBtn.style.color = 'white';
        addChordBtn.style.border = '1px solid #4f46e5'; // indigo-600
        addChordBtn.style.borderRadius = '3px';
        addChordBtn.style.cursor = 'pointer';
        addChordBtn.style.flex = '1';
        addChordBtn.style.fontWeight = '600';
        addChordBtn.style.transition = 'all 0.2s';
        addChordBtn.onmouseover = () => addChordBtn.style.backgroundColor = '#4f46e5'; // indigo-600
        addChordBtn.onmouseout = () => addChordBtn.style.backgroundColor = '#6366f1'; // indigo-500
        addChordBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Get the selected inversion from tooltip interaction, or default to 0
            // Only use lastTooltipChordSelection if it matches the current chord type
            const selectedInversion = (window.lastTooltipChordSelection?.chordType === chordType) 
                ? window.lastTooltipChordSelection.inversion 
                : 0;
            
            // Get the note array for index lookup
            const currentNotes = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
            // Get chord root index if specified (for diatonic mode)
            const chordRootIndex = chordRoot ? currentNotes.indexOf(chordRoot) : -1;
            
            // Set the chord type and inversion before adding
            const originalRoot = getBuilderRootIndex();
            if (chordRootIndex !== -1) {
                setBuilderRootIndex(chordRootIndex);
            }
            
            // Ensure the correct chord type is selected
            selectBuilderChordType(chordType, false);
            // Select the inversion
            selectBuilderInversion(selectedInversion, false);
            
            // Restore original root if we changed it (for diatonic mode)
            if (chordRootIndex !== -1) {
                setBuilderRootIndex(originalRoot);
            }
            
            // Add the chord to progression (same as floating control panel button)
            if (window.addChordToProgression) {
                window.addChordToProgression(false);
            }
            
            // Hide tooltip after adding
            hideTooltip();
        });
        buttonContainer.appendChild(addChordBtn);
        
        // Create "Suggested Next" button
        const suggestionsBtn = document.createElement('button');
        suggestionsBtn.textContent = '💡 Suggested Next';
        suggestionsBtn.style.padding = '4px 8px';
        suggestionsBtn.style.fontSize = '10px';
        suggestionsBtn.style.backgroundColor = '#60a5fa';
        suggestionsBtn.style.color = 'white';
        suggestionsBtn.style.border = '1px solid #3b82f6';
        suggestionsBtn.style.borderRadius = '3px';
        suggestionsBtn.style.cursor = 'pointer';
        suggestionsBtn.style.flex = '1';
        suggestionsBtn.style.fontWeight = '600';
        suggestionsBtn.style.transition = 'all 0.2s';
        suggestionsBtn.onmouseover = () => suggestionsBtn.style.backgroundColor = '#3b82f6';
        suggestionsBtn.onmouseout = () => suggestionsBtn.style.backgroundColor = '#60a5fa';
        suggestionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const selectedInversion = window.lastTooltipChordSelection?.inversion || 0;
            showChordSuggestionsModal(chordType, selectedInversion);
        });
        buttonContainer.appendChild(suggestionsBtn);
        
        // Append the container to the tooltip
        tooltip.appendChild(buttonContainer);
    }

    // Add "Add Interval" button if this is an interval tooltip
    if (intervalType && lines.length > 1) {
        // Create a container for the button
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '6px';
        buttonContainer.style.marginTop = '8px';
        buttonContainer.style.width = '100%';

        // Create "Add Interval" button
        const addIntervalBtn = document.createElement('button');
        addIntervalBtn.textContent = 'Add Interval';
        addIntervalBtn.style.padding = '4px 8px';
        addIntervalBtn.style.fontSize = '10px';
        addIntervalBtn.style.backgroundColor = '#6366f1'; // indigo-500
        addIntervalBtn.style.color = 'white';
        addIntervalBtn.style.border = '1px solid #4f46e5'; // indigo-600
        addIntervalBtn.style.borderRadius = '3px';
        addIntervalBtn.style.cursor = 'pointer';
        addIntervalBtn.style.flex = '1';
        addIntervalBtn.style.fontWeight = '600';
        addIntervalBtn.style.transition = 'all 0.2s';
        addIntervalBtn.onmouseover = () => addIntervalBtn.style.backgroundColor = '#4f46e5'; // indigo-600
        addIntervalBtn.onmouseout = () => addIntervalBtn.style.backgroundColor = '#6366f1'; // indigo-500
        addIntervalBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            // Select the interval in the builder
            selectBuilderInterval(intervalType, false);

            // Add to progression (addChordToProgression already handles intervals)
            if (window.addChordToProgression) {
                window.addChordToProgression(false);
            }

            // Hide tooltip after adding
            hideTooltip();
        });
        buttonContainer.appendChild(addIntervalBtn);

        // Append the container to the tooltip
        tooltip.appendChild(buttonContainer);
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
                // Use the stored showTooltip function if available (for touch devices with tap-outside-to-close)
                if (tooltip.showTooltip) {
                    tooltip.showTooltip();
                } else if (tooltip.positionTooltip) {
                    // Use smart positioning for non-touch devices
                    tooltip.positionTooltip();
                } else {
                    // Fallback (shouldn't normally reach here)
                    const rect = button.getBoundingClientRect();
                    const tooltipHeight = chordType ? 200 : 80;
                    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
                    tooltip.style.top = (rect.top - tooltipHeight - 12) + 'px';
                    tooltip.style.transform = 'translateX(-50%)';
                    tooltip.style.opacity = '1';
                    tooltip.style.visibility = 'visible';
                }
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

    // Check if rhythm awareness is enabled (Phase 5)
    const rhythmAwarenessEnabled = localStorage.getItem('chord-suggestion-rhythm-awareness') !== 'false';

    // Build rhythmInfo for duration suggestions
    let rhythmInfo = null;
    if (rhythmAwarenessEnabled && window.getCompositionState) {
        const compositionState = window.getCompositionState();
        rhythmInfo = {
            enabled: true,
            compositionState: compositionState,
            insertAfterIndex: compositionState?.getInsertAfterIndex?.() ?? null
        };
    }

    // Use comprehensive recommendation engine
    const recommendations = generateComprehensiveRecommendations(
        rootNote,
        currentChordType,
        currentInversion,
        key,
        style,
        mood,
        tensionDirection,
        10,                // limit
        [],               // progressionData
        false,            // contextMode
        4,                // lookbackDepth
        null,             // customWeights
        true,             // useEnhancedScoring
        null,             // sectionInfo
        null,             // tensionArcInfo
        rhythmInfo        // rhythmInfo for duration suggestions
    );

    // Transform to expected format (rename 'root' and 'type' to match existing code)
    return recommendations.map(rec => ({
        nextRoot: rec.root,        // NEW: Now includes different root notes!
        nextChord: rec.type,       // Chord type (was 'nextChord')
        nextInversion: rec.inversion,
        reason: rec.reason,
        confidence: rec.confidence,
        // Duration fields (Phase 5)
        suggestedDuration: rec.suggestedDuration,
        durationConfidence: rec.durationConfidence,
        durationReason: rec.durationReason,
        durationAlternatives: rec.durationAlternatives
    }));
}

/**
 * Show modal with chord suggestions
 * Delegates to the unified recommendation modal
 * @param {string} chordType - The chord type to suggest from
 * @param {number} inversion - The selected inversion
 */
function showChordSuggestionsModal(chordType, inversion) {
    // Get current root note from builder
    const currentNotesArray = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
    const rootNote = currentNotesArray[getBuilderRootIndex()];

    // Delegate to unified recommendation modal
    showUnifiedRecommendationModal({
        currentChordType: chordType,
        currentRoot: rootNote,
        currentInversion: inversion,
        onAddChord: (type, root, inv, beats) => {
            // Add chord callback - update builder and add to progression
            if (window.addSpecificChordToProgression) {
                const nextRootIndex = ALL_NOTES.indexOf(root);
                if (nextRootIndex !== -1 && nextRootIndex !== getBuilderRootIndex()) {
                    selectBuilderRootNote(nextRootIndex, false);
                }
                window.addSpecificChordToProgression(type, inv, true, beats);
            }
        },
        onPlayChord: null, // TODO: implement hold-to-play
        onStopChord: null, // TODO: implement stop
        initialTab: 'chord',
        initialView: 'quick'
    });
}

// =========================================================================
// Collapsible Panel Toggles (Chord Builder UI)
// =========================================================================

export function toggleChordSetupPanel(event = null) {
    // Don't allow panel toggling during guided mode (scroll is locked)
    if (isGuidedModeActive()) return;

    // If event is provided, check if click was in the right 25% zone (collapse zone)
    if (event && event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        const clickX = event.clientX;
        const rightZoneStart = rect.right - (rect.width * 0.25);

        // If click was NOT in the right zone, don't toggle (unless clicking chevron)
        const clickedChevron = event.target.closest('[id$="-chevron"]') ||
                               event.target.closest('.chevron-icon') ||
                               event.target.closest('svg[class*="rotate"]');

        if (clickX < rightZoneStart && !clickedChevron) {
            return;
        }
    }

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

export function toggleChordLibraryPanel(event = null) {
    // Don't allow panel toggling during guided mode (scroll is locked)
    if (isGuidedModeActive()) return;

    // If event is provided, check if click was in the right 25% zone (collapse zone)
    if (event && event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        const clickX = event.clientX;
        const rightZoneStart = rect.right - (rect.width * 0.25);

        // If click was NOT in the right zone, don't toggle (unless clicking chevron)
        const clickedChevron = event.target.closest('[id$="-chevron"]') ||
                               event.target.closest('.chevron-icon') ||
                               event.target.closest('svg[class*="rotate"]');

        if (clickX < rightZoneStart && !clickedChevron) {
            return;
        }
    }

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

export function toggleChordLibraryMode(isDiatonic) {
    const mode = isDiatonic ? 'diatonic' : 'chromatic';
    setChordLibraryMode(mode);
    // Clear diatonic chord tracking when switching to chromatic
    if (!isDiatonic) {
        setLastDiatonicChord(null);
    }
    renderBuilderSelectors();
    updateBuilderDisplay();
}

/**
 * Set the scale filter for the chord library
 * @param {string|null} scaleName - Scale name from SCALE_DEFINITIONS (e.g., 'Major Pentatonic') or null to disable
 */
/**
 * Determine the appropriate enharmonic preference for a given root note and scale
 * - Flat keys (Bb, Eb, Ab, Db, Gb, Cb, F) → 'flat'
 * - Sharp keys (G, D, A, E, B, F#, C#) → 'sharp'
 * - C with minor/flat scales → 'flat' (C minor uses Eb, Ab, Bb)
 * - C with major/sharp scales → 'sharp'
 * @param {string} rootNote - The root note to analyze
 * @param {string} scaleName - Optional scale name to consider
 * @returns {'sharp'|'flat'} The recommended enharmonic preference
 */
function getEnharmonicPreferenceForScale(rootNote, scaleName = null) {
    // Keys that use flats in their key signature
    const flatKeys = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
    // Keys that use sharps
    const sharpKeys = ['G', 'D', 'A', 'E', 'B', 'F#', 'C#'];

    // Normalize the root note (handle enharmonic equivalents)
    const normalizedRoot = rootNote.replace('♭', 'b').replace('♯', '#');

    // Check if root contains a flat - use flats
    if (normalizedRoot.includes('b')) {
        return 'flat';
    }
    // Check if root contains a sharp - use sharps
    if (normalizedRoot.includes('#')) {
        return 'sharp';
    }
    // For natural notes, check the key signature tradition
    if (flatKeys.includes(normalizedRoot)) {
        return 'flat';
    }
    if (sharpKeys.includes(normalizedRoot)) {
        return 'sharp';
    }

    // For C (neutral key), determine based on scale type
    // Minor scales and modes with flats should use flat notation
    if (normalizedRoot === 'C' && scaleName) {
        const scaleNameLower = scaleName.toLowerCase();
        // Scales that imply flat accidentals
        const flatScalePatterns = [
            'minor', 'aeolian', 'dorian', 'phrygian', 'locrian',
            'blues', 'harmonic minor', 'melodic minor'
        ];
        for (const pattern of flatScalePatterns) {
            if (scaleNameLower.includes(pattern)) {
                return 'flat';
            }
        }
    }

    // Default (C Major, Lydian, etc.) uses sharps
    return 'sharp';
}

export function setScaleFilterMode(scaleName) {
    setScaleFilter(scaleName);

    // Auto-update enharmonic preference based on selected scale root AND scale type
    // Get the current root note and determine appropriate enharmonic spelling
    if (scaleName) {
        const currentNotes = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootNoteName = currentNotes[getBuilderRootIndex()];

        // Determine the appropriate enharmonic preference for this root + scale combination
        const recommendedPreference = getEnharmonicPreferenceForScale(rootNoteName, scaleName);

        // Only update if different to avoid unnecessary re-renders
        if (getEnharmonicPreference() !== recommendedPreference) {
            setEnharmonicPreference(recommendedPreference);

            // Update the enharmonic toggle checkbox in the UI if it exists
            const enharmonicToggle = document.getElementById('enharmonic-toggle');
            if (enharmonicToggle) {
                enharmonicToggle.checked = recommendedPreference === 'flat';
            }

            // Update the global window variable for other modules
            if (typeof window !== 'undefined') {
                window.enharmonicPreference = recommendedPreference;
            }
        }
    }

    renderBuilderSelectors();
    updateBuilderDisplay();
}

/**
 * Get available scales for the filter dropdown
 * @returns {Array} Array of scale names sorted alphabetically
 */
export function getAvailableScales() {
    return Object.keys(SCALE_DEFINITIONS).sort();
}


/**
 * Get the pitch classes of a scale starting from a given root
 * Uses the existing noteToPitchClass helper defined later in this file.
 * @param {string} scaleName - Scale name from SCALE_DEFINITIONS
 * @param {string} rootNote - Root note of the scale
 * @returns {Set<number>} Set of pitch classes (0-11) in the scale
 */
function getScalePitchClasses(scaleName, rootNote) {
    const scaleDef = SCALE_DEFINITIONS[scaleName];
    if (!scaleDef) return new Set();

    const rootPitchClass = noteToPitchClass(rootNote);
    if (rootPitchClass === null || rootPitchClass === undefined) return new Set();

    const pitchClasses = new Set();
    scaleDef.intervals.forEach(interval => {
        pitchClasses.add((rootPitchClass + interval) % 12);
    });
    return pitchClasses;
}

/**
 * Check if all notes of a chord are contained within a scale
 * @param {string} chordType - Chord type from CHORD_DEFINITIONS
 * @param {string} chordRoot - Root note of the chord
 * @param {string} scaleName - Scale name from SCALE_DEFINITIONS
 * @param {string} scaleRoot - Root note of the scale
 * @returns {boolean} True if all chord notes are in the scale
 */
export function isChordInScale(chordType, chordRoot, scaleName, scaleRoot) {
    const chordDef = CHORD_DEFINITIONS[chordType];
    if (!chordDef || !chordDef.intervals) return false;

    const scalePitchClasses = getScalePitchClasses(scaleName, scaleRoot);
    if (scalePitchClasses.size === 0) return false;

    const chordRootPitchClass = noteToPitchClass(chordRoot);
    if (chordRootPitchClass === null || chordRootPitchClass === undefined) return false;

    // Check if all chord intervals (converted to pitch classes) are in the scale
    for (const interval of chordDef.intervals) {
        const pitchClass = (chordRootPitchClass + interval) % 12;
        if (!scalePitchClasses.has(pitchClass)) {
            return false;
        }
    }
    return true;
}

export function toggleChordIntervalsPanel(event = null) {
    // Don't allow panel toggling during guided mode (scroll is locked)
    if (isGuidedModeActive()) return;

    // If event is provided, check if click was in the right 25% zone (collapse zone)
    if (event && event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        const clickX = event.clientX;
        const rightZoneStart = rect.right - (rect.width * 0.25);

        // If click was NOT in the right zone, don't toggle (unless clicking chevron)
        const clickedChevron = event.target.closest('[id$="-chevron"]') ||
                               event.target.closest('.chevron-icon') ||
                               event.target.closest('svg[class*="rotate"]');

        if (clickX < rightZoneStart && !clickedChevron) {
            return;
        }
    }

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

// =========================================================================
// Current Chord Progression Panel (Chord Builder)
// =========================================================================

// Track whether to show detailed or simplified cards in Chord Builder
let builderDetailedView = false;

/**
 * Toggle the Current Chord Progression panel in Chord Builder
 */
export function toggleBuilderProgressionPanel(event = null) {
    // Don't allow panel toggling during guided mode (scroll is locked)
    if (isGuidedModeActive()) return;

    // If event is provided, check if click was in the right 25% zone (collapse zone)
    if (event && event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        const clickX = event.clientX;
        const rightZoneStart = rect.right - (rect.width * 0.25);

        // If click was NOT in the right zone, don't toggle (unless clicking chevron)
        const clickedChevron = event.target.closest('[id$="-chevron"]') ||
                               event.target.closest('.chevron-icon') ||
                               event.target.closest('svg[class*="rotate"]');

        if (clickX < rightZoneStart && !clickedChevron) {
            return;
        }
    }

    const panel = document.getElementById('builder-progression-panel');
    const chevron = document.getElementById('builder-progression-chevron');
    if (!panel || !chevron) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        chevron.classList.add('rotate-180');
        // Render the chord cards when opening
        renderBuilderProgressionCards();
    } else {
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }

    // Save panel state
    if (window.savePanelState) {
        window.savePanelState('builder-progression-panel', !isHidden);
    }
}

/**
 * Toggle between simplified and detailed card views
 */
export function toggleBuilderCardView(detailed) {
    builderDetailedView = detailed;
    renderBuilderProgressionCards();
}

// =========================================================================
// Chord Identifier Panel
// =========================================================================

/**
 * Toggle the Chord Identifier panel
 */
export function toggleChordIdentifierPanel(event = null) {
    // Don't allow panel toggling during guided mode (scroll is locked)
    if (isGuidedModeActive()) return;

    // If event is provided, check if click was in the right 25% zone (collapse zone)
    if (event && event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        const clickX = event.clientX;
        const rightZoneStart = rect.right - (rect.width * 0.25);

        // If click was NOT in the right zone, don't toggle (unless clicking chevron)
        const clickedChevron = event.target.closest('[id$="-chevron"]') ||
                               event.target.closest('.chevron-icon') ||
                               event.target.closest('svg[class*="rotate"]');

        if (clickX < rightZoneStart && !clickedChevron) {
            return;
        }
    }

    const panel = document.getElementById('chord-identifier-panel');
    const chevron = document.getElementById('chord-identifier-chevron');
    if (!panel || !chevron) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        chevron.classList.add('rotate-180');
        // Initialize quick note buttons when panel opens
        initChordIdentifierQuickButtons();
    } else {
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }

    // Save panel state
    if (window.savePanelState) {
        window.savePanelState('chord-identifier-panel', !isHidden);
    }
}

/**
 * Initialize quick note buttons for the chord identifier
 */
function initChordIdentifierQuickButtons() {
    const container = document.getElementById('chord-identifier-note-buttons');

    // Ensure standard keyboard shortcuts work in chord identifier input (Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z)
    // This must run every time the panel is opened, so it's outside the early return
    const input = document.getElementById('chord-identifier-input');
    if (input && !input._keyboardShortcutsEnabled) {
        input._keyboardShortcutsEnabled = true;
        input.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase())) {
                e.stopPropagation();
            }
        });
    }

    // Only initialize buttons once
    if (!container || container.hasChildNodes()) return;

    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    notes.forEach(note => {
        const btn = document.createElement('button');
        btn.className = 'px-2 py-1 text-xs bg-gray-200 hover:bg-violet-500 hover:text-white text-gray-700 rounded transition-colors';
        btn.textContent = note;
        btn.onclick = () => addNoteToIdentifierInput(note);
        container.appendChild(btn);
    });
}

/**
 * Add a note to the chord identifier input
 */
export function addNoteToIdentifierInput(note) {
    const input = document.getElementById('chord-identifier-input');
    if (!input) return;

    const currentValue = input.value.trim();
    if (currentValue) {
        input.value = currentValue + ' ' + note;
    } else {
        input.value = note;
    }
}

/**
 * Clear the chord identifier input and results
 */
export function clearChordIdentifier() {
    const input = document.getElementById('chord-identifier-input');
    const resultsContainer = document.getElementById('chord-identifier-matches');
    const noResultsEl = document.getElementById('chord-identifier-no-results');

    if (input) input.value = '';
    if (resultsContainer) resultsContainer.innerHTML = '';
    if (noResultsEl) noResultsEl.classList.add('hidden');
}

/**
 * Parse note input string into an array of note names (without octaves)
 * Supports delimiters: space, comma, hyphen, colon
 */
function parseNoteInput(inputStr) {
    if (!inputStr || typeof inputStr !== 'string') return [];

    // Replace all delimiters with space, then split
    const normalized = inputStr
        .replace(/[,\-:]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    // Normalize note names (strip octave numbers, uppercase first letter)
    const notes = normalized.map(n => {
        // Remove any octave number at the end
        const noteOnly = n.replace(/\d+$/, '');
        // Capitalize first letter, rest lowercase
        return noteOnly.charAt(0).toUpperCase() + noteOnly.slice(1).toLowerCase();
    });

    // Remove duplicates
    return [...new Set(notes)];
}

/**
 * Convert a note to its pitch class (0-11)
 */
function noteToPitchClass(note) {
    const noteMap = {
        'C': 0, 'C#': 1, 'Db': 1,
        'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'Fb': 4, 'E#': 5,
        'F': 5, 'F#': 6, 'Gb': 6,
        'G': 7, 'G#': 8, 'Ab': 8,
        'A': 9, 'A#': 10, 'Bb': 10,
        'B': 11, 'Cb': 11, 'B#': 0
    };
    return noteMap[note] ?? null;
}

/**
 * Convert pitch class to note name
 */
function pitchClassToNote(pc, preferSharps = true) {
    const sharpNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    return preferSharps ? sharpNotes[pc] : flatNotes[pc];
}

/**
 * Get intervals from a set of pitch classes relative to a root
 */
function getIntervalsFromRoot(rootPc, pitchClasses) {
    return pitchClasses.map(pc => (pc - rootPc + 12) % 12).sort((a, b) => a - b);
}

/**
 * Identify chords that match the given notes
 */
export function identifyChordFromInput() {
    const input = document.getElementById('chord-identifier-input');
    const resultsWrapper = document.getElementById('chord-identifier-results');
    const resultsContainer = document.getElementById('chord-identifier-matches');
    const noResultsEl = document.getElementById('chord-identifier-no-results');

    if (!input || !resultsContainer) return;

    const notes = parseNoteInput(input.value);

    if (notes.length < 2) {
        if (resultsWrapper) resultsWrapper.classList.add('hidden');
        if (noResultsEl) noResultsEl.classList.remove('hidden');
        noResultsEl.innerHTML = `
            <svg class="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p class="text-sm">Please enter at least 2 notes.</p>
            <p class="text-xs mt-1">Try: C E G or C, E, G</p>
        `;
        return;
    }

    // Convert notes to pitch classes
    const pitchClasses = notes.map(noteToPitchClass).filter(pc => pc !== null);

    if (pitchClasses.length < 2) {
        if (resultsWrapper) resultsWrapper.classList.add('hidden');
        if (noResultsEl) {
            noResultsEl.classList.remove('hidden');
            noResultsEl.innerHTML = `
                <svg class="w-10 h-10 mx-auto mb-2 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <p class="text-sm text-red-500">Could not parse the notes.</p>
                <p class="text-xs mt-1">Use format like: C E G</p>
            `;
        }
        return;
    }

    // Find matching chords
    const matches = findMatchingChords(pitchClasses, notes);

    if (matches.length === 0) {
        if (resultsWrapper) resultsWrapper.classList.add('hidden');
        resultsContainer.innerHTML = '';
        if (noResultsEl) {
            noResultsEl.classList.remove('hidden');
            noResultsEl.innerHTML = `
                <svg class="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-sm">No matching chords found for these notes.</p>
                <p class="text-xs mt-1">Try adding or removing notes.</p>
            `;
        }
        return;
    }

    // Show results, hide no-results
    if (noResultsEl) noResultsEl.classList.add('hidden');
    if (resultsWrapper) resultsWrapper.classList.remove('hidden');

    // Render results
    resultsContainer.innerHTML = matches.map(match => `
        <div class="bg-violet-50 rounded-lg p-3 border border-violet-200 hover:border-violet-400 transition-colors">
            <div class="flex items-center justify-between mb-1">
                <span class="text-lg font-bold text-violet-900">${match.symbol}</span>
                <span class="text-xs px-2 py-0.5 ${match.matchType === 'Exact' ? 'bg-green-500 text-white' : match.matchType === 'Extended' ? 'bg-blue-500 text-white' : 'bg-yellow-400 text-yellow-900'} rounded">${match.matchType}</span>
            </div>
            <div class="text-xs text-gray-600">${match.fullName}</div>
            ${match.missingNotes.length > 0 ? `<div class="text-xs text-orange-600 mt-1">Missing: ${match.missingNotes.join(', ')}</div>` : ''}
            ${match.extraNotes.length > 0 ? `<div class="text-xs text-blue-600 mt-1">Extra: ${match.extraNotes.join(', ')}</div>` : ''}
            <div class="mt-2 flex gap-2">
                <button onmousedown="window.playChordPreview && window.playChordPreview('${match.root}', '${match.type}', ${match.inversion})"
                        onmouseup="window.stopChordPreview && window.stopChordPreview()"
                        onmouseleave="window.stopChordPreview && window.stopChordPreview()"
                        ontouchstart="window.playChordPreview && window.playChordPreview('${match.root}', '${match.type}', ${match.inversion})"
                        ontouchend="window.stopChordPreview && window.stopChordPreview()"
                        class="px-2 py-1 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded flex items-center gap-1 select-none">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
                    Play
                </button>
                <button onclick="window.addChordToProgressionByParams && window.addChordToProgressionByParams('${match.type}', '${match.root}', ${match.inversion}, 0)"
                        class="px-2 py-1 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded flex items-center gap-1">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>
                    Add to Progression
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Find chords that match the given pitch classes
 * Also detects inversions based on the bass note (first note in input)
 */
function findMatchingChords(inputPitchClasses, inputNotes) {
    const matches = [];

    // Define chord intervals for matching
    const chordIntervals = {
        'Major': [0, 4, 7],
        'Minor': [0, 3, 7],
        'Diminished': [0, 3, 6],
        'Augmented': [0, 4, 8],
        'Sus2': [0, 2, 7],
        'Sus4': [0, 5, 7],
        'Dominant 7th': [0, 4, 7, 10],
        'Major 7th': [0, 4, 7, 11],
        'Minor 7th': [0, 3, 7, 10],
        'Minor-Major 7th': [0, 3, 7, 11],
        'Diminished 7th': [0, 3, 6, 9],
        'Half-Diminished 7th': [0, 3, 6, 10],
        'Augmented 7th': [0, 4, 8, 10],
        'Major 6th': [0, 4, 7, 9],
        'Minor 6th': [0, 3, 7, 9],
        'Add9': [0, 4, 7, 14],
        'Major 9th': [0, 4, 7, 11, 14],
        'Dominant 9th': [0, 4, 7, 10, 14],
        'Minor 9th': [0, 3, 7, 10, 14],
        '6/9': [0, 4, 7, 9, 14],
        '7b5': [0, 4, 6, 10],
        '7#5': [0, 4, 8, 10],
        '7b9': [0, 4, 7, 10, 13],
        '7#9': [0, 4, 7, 10, 15],
        'Power Chord': [0, 7]
    };

    // Chord symbols for display
    const chordSymbols = {
        'Major': '', 'Minor': 'm', 'Diminished': 'dim', 'Augmented': 'aug',
        'Sus2': 'sus2', 'Sus4': 'sus4',
        'Dominant 7th': '7', 'Major 7th': 'maj7', 'Minor 7th': 'm7',
        'Minor-Major 7th': 'm(maj7)', 'Diminished 7th': 'dim7',
        'Half-Diminished 7th': 'm7b5', 'Augmented 7th': 'aug7',
        'Major 6th': '6', 'Minor 6th': 'm6', 'Add9': 'add9',
        'Major 9th': 'maj9', 'Dominant 9th': '9', 'Minor 9th': 'm9',
        '6/9': '6/9', '7b5': '7b5', '7#5': '7#5', '7b9': '7b9', '7#9': '7#9',
        'Power Chord': '5'
    };

    const inputSet = new Set(inputPitchClasses);

    // Get bass note (first note in input) for inversion detection
    const bassNotePc = inputPitchClasses.length > 0 ? inputPitchClasses[0] : null;

    // Try each pitch class as potential root
    for (let rootPc = 0; rootPc < 12; rootPc++) {
        const rootNote = pitchClassToNote(rootPc);

        // Try each chord type
        for (const [chordType, intervals] of Object.entries(chordIntervals)) {
            const chordPitchClasses = intervals.map(i => (rootPc + (i % 12)) % 12);
            const chordSet = new Set(chordPitchClasses);

            // Check for exact match
            const isExactMatch = inputSet.size === chordSet.size &&
                [...inputSet].every(pc => chordSet.has(pc));

            // Check for subset (input notes are part of the chord)
            const isSubset = [...inputSet].every(pc => chordSet.has(pc)) && inputSet.size < chordSet.size;

            // Check for superset (chord notes are part of input, with extras)
            const isSuperset = [...chordSet].every(pc => inputSet.has(pc)) && inputSet.size > chordSet.size;

            if (isExactMatch || isSubset || isSuperset) {
                const missingNotes = [...chordSet]
                    .filter(pc => !inputSet.has(pc))
                    .map(pc => pitchClassToNote(pc));

                const extraNotes = [...inputSet]
                    .filter(pc => !chordSet.has(pc))
                    .map(pc => pitchClassToNote(pc));

                // Detect inversion based on bass note
                let inversion = 0;
                let bassNote = null;
                if (bassNotePc !== null && chordSet.has(bassNotePc)) {
                    // Find which chord tone the bass note is
                    const bassInterval = (bassNotePc - rootPc + 12) % 12;
                    const chordToneIndex = intervals.findIndex(i => (i % 12) === bassInterval);
                    if (chordToneIndex > 0) {
                        inversion = chordToneIndex;
                        // Spell bass note correctly based on chord type
                        // Minor chords and flat-based chords should use flats
                        const useFlatSpelling = chordType.includes('Minor') ||
                                                chordType.includes('Diminished') ||
                                                chordType.includes('Half-Diminished') ||
                                                rootNote.includes('b');
                        bassNote = pitchClassToNote(bassNotePc, !useFlatSpelling);
                    }
                }

                // Determine if root should use flats based on chord type
                const useFlatsForRoot = chordType.includes('Minor') ||
                                        chordType.includes('Diminished') ||
                                        chordType.includes('Half-Diminished');
                const displayRoot = pitchClassToNote(rootPc, !useFlatsForRoot);

                // Build symbol with slash notation for inversions
                const baseSymbol = displayRoot + (chordSymbols[chordType] || '');
                const symbol = inversion > 0 && bassNote ? `${baseSymbol}/${bassNote}` : baseSymbol;

                // Build full name with inversion info
                const inversionNames = ['Root Position', '1st Inversion', '2nd Inversion', '3rd Inversion', '4th Inversion'];
                const inversionName = inversion > 0 ? ` (${inversionNames[inversion] || `${inversion}th Inv.`})` : '';
                const fullName = `${displayRoot} ${chordType}${inversionName}`;

                matches.push({
                    root: displayRoot,
                    type: chordType,
                    inversion: inversion,
                    bassNote: bassNote,
                    symbol: symbol,
                    fullName: fullName,
                    matchType: isExactMatch ? 'Exact' : isSubset ? 'Partial' : 'Extended',
                    missingNotes,
                    extraNotes,
                    score: isExactMatch ? 100 : isSuperset ? 80 : 60 - missingNotes.length * 10
                });
            }
        }
    }

    // Sort by score (exact matches first, then by fewer missing notes)
    matches.sort((a, b) => b.score - a.score);

    // Limit results
    return matches.slice(0, 12);
}

/**
 * Set the chord builder to show a specific chord
 */
export function setBuilderChord(root, type) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const rootIndex = notes.indexOf(root);

    if (rootIndex >= 0) {
        setBuilderRootIndex(rootIndex);
        setBuilderChordType(type);
        setBuilderSelectionMode('chord');

        // Update display
        updateBuilderDisplay();
        renderBuilderSelectors();
    }
}

// Track currently playing chord preview notes for release
let chordPreviewNotes = [];

/**
 * Play a chord preview (for Chord Identifier results)
 * Uses click-and-hold behavior like chord library buttons
 * @param {string} root - Root note (e.g., 'C', 'F#')
 * @param {string} type - Chord type (e.g., 'Major', 'Minor 7th')
 * @param {number} inversion - Chord inversion (0, 1, 2, 3)
 */
export function playChordPreview(root, type, inversion = 0) {
    // Check if audio system is available
    if (typeof window.getPiano !== 'function' || typeof window.initAudio !== 'function') {
        console.warn('Audio system not available');
        return;
    }

    // Initialize audio if needed
    window.initAudio();
    if (typeof window.getAudioIsReady === 'function' && !window.getAudioIsReady()) {
        console.warn('Audio not ready');
        return;
    }

    const piano = window.getPiano();
    if (!piano) {
        console.warn('Piano not available');
        return;
    }

    // Stop any currently playing preview first
    stopChordPreview();

    // Get current key for enharmonic resolution
    const key = getCurrentKey() || 'C';

    // Get chord notes with inversion
    const chordData = getInvertedChordNotes(root, type, inversion, key, 0);

    if (chordData && chordData.specificNotes && chordData.specificNotes.length > 0) {
        chordPreviewNotes = [...chordData.specificNotes];

        // Play chord (attack only - release on mouseup/mouseleave)
        chordPreviewNotes.forEach(note => {
            piano.triggerAttack(note, Tone.now());
        });

        // Highlight notes on virtual keyboard
        chordPreviewNotes.forEach(note => {
            const keyId = getNoteKeyId(note);
            const keyElement = document.getElementById(keyId);
            if (keyElement) {
                keyElement.classList.add('active-builder-playback');
            }
        });
    }
}

/**
 * Stop the chord preview (release all notes)
 * Called on mouseup/mouseleave
 */
export function stopChordPreview() {
    if (chordPreviewNotes.length === 0) return;

    const piano = window.getPiano?.();
    if (piano) {
        chordPreviewNotes.forEach(note => {
            try {
                piano.triggerRelease(note, Tone.now());
            } catch (e) {
                // Ignore release errors
            }
        });
    }

    // Clear keyboard highlighting
    chordPreviewNotes.forEach(note => {
        const keyId = getNoteKeyId(note);
        const keyElement = document.getElementById(keyId);
        if (keyElement) {
            keyElement.classList.remove('active-builder-playback');
        }
    });

    chordPreviewNotes = [];
}

/**
 * Render chord cards in the Chord Builder's Current Chord Progression panel
 * Uses the same cards as Progression Builder for consistency
 */
export function renderBuilderProgressionCards() {
    const container = document.getElementById('builder-progression-visualization');
    const emptyState = document.getElementById('builder-progression-empty');
    const countBadge = document.getElementById('builder-progression-count');

    if (!container) return;

    // Get progression data from trainer state
    const trainerState = getTrainerState();
    const progressionData = trainerState?.progressionData || [];
    const key = trainerState?.currentKey || 'C';

    // Update count badge
    if (countBadge) {
        countBadge.textContent = progressionData.length;
    }

    // Show empty state or cards
    if (progressionData.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    // Hide empty state, show cards
    if (emptyState) emptyState.classList.add('hidden');
    container.classList.remove('hidden');

    // Clear existing cards
    container.innerHTML = '';

    // Use the shared card renderer (same tooltips + inversion playback as Composition Studio)
    if (renderProgressionDisplayForBuilder) {
        renderProgressionDisplayForBuilder(container, progressionData, key, {
            showActionButtons: false, // No add/clear buttons - those are in the chord library
            isBuilderTab: true,
            detailed: builderDetailedView
        });
    } else {
        // Fallback: render simple cards manually
        progressionData.forEach((chord, index) => {
            const card = createSimpleBuilderChordCard(chord, index, key);
            container.appendChild(card);
        });
    }
}

/**
 * Create a simple chord card for the Builder tab (fallback)
 */
function createSimpleBuilderChordCard(chord, index, key) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chord-card-wrapper';
    wrapper.setAttribute('data-chord-index', index);

    const chordSymbol = chord.simpleName || chord.root || 'C';
    const roman = chord.roman || '';

    wrapper.innerHTML = `
        <div class="simplified-card bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-700 rounded-xl overflow-hidden hover:border-indigo-500 transition-all shadow-lg p-2" style="min-height: 70px;">
            <div class="flex flex-col items-center justify-center h-full">
                <div class="text-base font-bold text-white">${chordSymbol}</div>
                <div class="text-xs text-purple-400 font-bold">${roman}</div>
                <div class="text-[9px] text-gray-400 mt-0.5">Pos: ${index + 1}</div>
            </div>
        </div>
    `;

    // Add click to play functionality
    wrapper.addEventListener('click', () => {
        if (window.startProgressionChord) {
            window.startProgressionChord(index);
        }
    });

    return wrapper;
}

/**
 * Update the Chord Builder progression panel when progression changes
 * Called from progressionBuilder when chords are added/removed/modified
 */
export function updateBuilderProgressionPanel() {
    const panel = document.getElementById('builder-progression-panel');
    const countBadge = document.getElementById('builder-progression-count');

    // Update count badge even if panel is hidden
    const trainerState = getTrainerState();
    const progressionData = trainerState?.progressionData || [];

    if (countBadge) {
        countBadge.textContent = progressionData.length;
    }

    // Always update header toggle for section view (even if panel is collapsed)
    updateBuilderHeaderToggle();

    // Only re-render cards if panel is visible
    if (panel && !panel.classList.contains('hidden')) {
        renderBuilderProgressionCards();
    }
}

/**
 * Update the Chord Lab header toggle based on sections
 * Called when sections or progression changes
 */
function updateBuilderHeaderToggle() {
    const headerToggle = document.getElementById('builder-header-section-view-toggle');
    if (!headerToggle) return;

    // Check if we have sections
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    const sections = compositionState ? compositionState.getSections() : [];
    const hasSections = sections.length > 0;

    if (hasSections) {
        // Show toggle and populate it
        headerToggle.className = 'flex items-center gap-1 ml-2';
        // Only rebuild if not already populated or if sections changed
        if (headerToggle.children.length === 0 || !headerToggle.querySelector('.compact-builder-view-btn')) {
            headerToggle.innerHTML = '';
            if (window.createCompactBuilderViewModeToggle) {
                headerToggle.appendChild(window.createCompactBuilderViewModeToggle());
            }
        }
    } else {
        // Hide toggle
        headerToggle.innerHTML = '';
        headerToggle.className = 'hidden ml-2';
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
    ROMAN_MAP_BASE,
    generateDiatonicChords,
    generateScaleDiatonicChords,
    SCALE_DEFINITIONS,
    SCALE_CATEGORIES
} from '../../data/music-data.js';

// Import UI utilities (to be defined when needed)
// (Removed dead import: clearHighlights, updateKeySignatureDisplay - functions not used)

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
    // Base octave is 3 for LH chord voicing, adjusted by octave shift
    const baseOctave = 3 + getBuilderOctaveShift();

    if (getBuilderSelectionMode() === 'chord') {
        const chordResult = getInvertedChordNotes(
            rootNote,
            getBuilderChordType(),
            getBuilderInversion(),
            rootNote,
            getBuilderOctaveShift() * 12, // Convert whole octaves to semitones
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
        const intervalResult = getIntervalNotes(rootNote, getBuilderIntervalType(), getBuilderOctaveShift() * 12, getEnharmonicPreference()); // Convert whole octaves to semitones
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

    // Dispatch event for guided lesson mode (after chord is played)
    if (isGuidedModeActive()) {
        const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];
        const chordType = getBuilderSelectionMode() === 'chord' ? getBuilderChordType() : getBuilderIntervalType();
        dispatchBuilderEvent('builderChordPlayed', {
            root: rootNote,
            type: chordType,
            inversion: getBuilderInversion(),
            mode: getBuilderSelectionMode()
        });
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
                getBuilderOctaveShift() * 12, // Convert whole octaves to semitones
                getEnharmonicPreference(),
                getNotationPreference()
            );
            rhNotes = chordResult.specificNotes;
        } else {
            const intervalResult = getIntervalNotes(rootNote, getBuilderIntervalType(), getBuilderOctaveShift() * 12, getEnharmonicPreference()); // Convert whole octaves to semitones
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
            getBuilderOctaveShift() * 12, // Convert whole octaves to semitones
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
        const intervalResult = getIntervalNotes(rootNote, getBuilderIntervalType(), getBuilderOctaveShift() * 12, getEnharmonicPreference()); // Convert whole octaves to semitones
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
    const currentNotes = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    // In diatonic mode, use the last played diatonic chord's root; otherwise use builder root
    const chordLibraryMode = getChordLibraryMode();
    const lastDiatonic = getLastDiatonicChord();
    let rootNote;
    let chordType;

    if (chordLibraryMode === 'diatonic' && lastDiatonic) {
        rootNote = lastDiatonic.root;
        chordType = lastDiatonic.type;
    } else {
        rootNote = currentNotes[getBuilderRootIndex()];
        chordType = getBuilderChordType();
    }

    let result;
    let notesForHighlight;

    if (getBuilderSelectionMode() === 'chord') {
        result = getInvertedChordNotes(
            rootNote,
            chordType,
            getBuilderInversion(),
            rootNote,
            getBuilderOctaveShift() * 12, // Convert whole octaves to semitones
            getEnharmonicPreference(),
            getNotationPreference()
        );
        notesForHighlight = result.specificNotes;
        document.getElementById('builder-inversion-selector').style.opacity = 1;
        document.getElementById('builder-lh-type-select').disabled = false;
        document.getElementById('builder-lh-inversion-select').disabled = false;
        document.getElementById('builder-lh-octave-select').disabled = false;
    } else { // 'interval'
        result = getIntervalNotes(rootNote, getBuilderIntervalType(), getBuilderOctaveShift() * 12, getEnharmonicPreference()); // Convert whole octaves to semitones
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
                getBuilderOctaveShift() * 12, // Convert whole octaves to semitones
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
            const intervalResult = getIntervalNotes(rootNote, getBuilderIntervalType(), getBuilderOctaveShift() * 12, getEnharmonicPreference()); // Convert whole octaves to semitones
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
        },
        { externalButtonsContainerId: 'rh-voicing-buttons' }
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

    // Allow highlighting for both classic Chord Lab ('builder') and new Chord Lab ('chordlab-new')
    const currentTab = getCurrentTab();
    if (!specificNotes || (currentTab !== 'builder' && currentTab !== 'chordlab-new')) return;

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

    // Dispatch event so listeners (like FullScreenChordLabEditor) can update
    window.dispatchEvent(new CustomEvent('builderUpdated'));
}

// ============================================================================
// Selection Functions
// ============================================================================

// Flag to prevent infinite loop when re-rendering in diatonic mode
let isRenderingDiatonicChords = false;

/**
 * Select a root note for the chord builder
 * @param {number} index - Index in the SHARP_NOTES/FLAT_NOTES array
 * @param {boolean} playAudio - Whether to play audio on selection
 */
export function selectBuilderRootNote(index, playAudio = true) {
    // Prevent infinite loop - if we're already rendering, don't trigger another render
    if (isRenderingDiatonicChords) {
        return;
    }

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

    // Auto-update enharmonic preference based on new root + current scale
    const currentScaleFilter = getScaleFilter();
    if (currentScaleFilter) {
        // Get root note using BOTH note arrays to determine correct spelling
        const sharpRoot = SHARP_NOTES[index];
        const flatRoot = FLAT_NOTES[index];
        // Use the current preference to get the root, then determine new preference
        const currentRoot = getEnharmonicPreference() === 'sharp' ? sharpRoot : flatRoot;
        const recommendedPreference = getEnharmonicPreferenceForScale(currentRoot, currentScaleFilter);

        if (getEnharmonicPreference() !== recommendedPreference) {
            setEnharmonicPreference(recommendedPreference);

            // Update the enharmonic toggle checkbox in the UI if it exists
            const enharmonicToggle = document.getElementById('enharmonic-toggle');
            if (enharmonicToggle) {
                enharmonicToggle.checked = recommendedPreference === 'flat';
            }

            // Update the global window variable for other modules
            if (typeof window !== 'undefined') {
                window.enharmonicPreference = recommendedPreference;
            }
        }
    }

    updateButtonSelection('#builder-note-selector', 'index', index.toString(), 'bg-amber-600', 'text-white');

    // Get the root note name for key signature display (after preference may have changed)
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

    // In diatonic mode, re-render the chord selector to show new diatonic chords
    const chordLibraryMode = getChordLibraryMode();
    if (chordLibraryMode === 'diatonic') {
        // Remember the last selected chord type so we can highlight it in the new key
        const lastDiatonic = getLastDiatonicChord();
        const lastChordType = lastDiatonic ? lastDiatonic.type : null;

        // Update lastDiatonicChord to the equivalent chord in the new key
        if (lastChordType) {
            const currentNotes = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
            const newRootNote = currentNotes[index];
            setLastDiatonicChord({ root: newRootNote, type: lastChordType });
        } else {
            setLastDiatonicChord(null);
        }

        // Set flag to prevent infinite loop, then re-render
        isRenderingDiatonicChords = true;
        renderBuilderSelectors();
        isRenderingDiatonicChords = false;

        // Restore root note button highlighting after render
        updateButtonSelection('#builder-note-selector', 'index', index.toString(), 'bg-amber-600', 'text-white');
    } else {
        // In chromatic mode, just update captions
        updateChordTypeButtonCaptions();
        updateChordTypeButtonTooltips(); // Update tooltips with new root context
    }

    updateIntervalButtonCaptions();
    if (playAudio) startBuilderChord();

    // Dispatch event for guided lesson mode
    if (isGuidedModeActive()) {
        dispatchBuilderEvent('builderRootSelected', { root: rootNote, index });
    }
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
    if (resetVoicing) {
        setBuilderOmittedNotes([]); // Reset omissions on type change
        setBuilderLHOmittedNotes([]);
        setBuilderInversion(0); // Reset to root position on type change
    }
    updateButtonSelection('#builder-interval-selector', 'intervalType', null, 'bg-emerald-600');
    updateButtonSelection('#builder-chord-type-selector', 'chordType', chordType, 'bg-teal-600', 'text-white');
    updateBuilderDisplay();
    updateChordSuggestions();
    updateChordTypeButtonCaptions(); // Redraw captions after selection
    if (playAudio) startBuilderChord();

    // Dispatch event for guided lesson mode
    if (isGuidedModeActive()) {
        dispatchBuilderEvent('builderTypeSelected', { chordType });
    }
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

    // Dispatch event for guided lesson mode
    if (isGuidedModeActive()) {
        dispatchBuilderEvent('builderInversionSelected', { inversion });
    }
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

        // Skip diatonic mode buttons - they have their own labels
        if (mainButton.dataset.diatonicMode === 'true') return;

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
 * Update chord type button tooltips to reflect the currently selected root note
 */
export function updateChordTypeButtonTooltips() {
    const currentNotes = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
    const rootNoteName = currentNotes[getBuilderRootIndex()];

    document.querySelectorAll('#builder-chord-type-selector .key-button-wrapper').forEach(container => {
        const mainButton = container.querySelector('button');
        if (!mainButton) return;

        // Skip diatonic mode buttons - they have their own tooltips
        if (mainButton.dataset.diatonicMode === 'true') return;

        const chordType = mainButton.dataset.chordType;
        if (!CHORD_DEFINITIONS[chordType]) return;

        const baseDescription = CHORD_DEFINITIONS[chordType].description;
        const contextAwareDescription = getContextAwareChordDescription(chordType, rootNoteName, baseDescription);

        // Find and update the custom tooltip if it exists
        const tooltipElements = document.querySelectorAll('.chord-button-tooltip');
        tooltipElements.forEach(tooltip => {
            if (tooltip.getAttribute('data-chord-type') === chordType) {
                // Update the tooltip content
                const tooltipText = `${chordType}\n\n${contextAwareDescription}`;
                const lines = tooltipText.split('\n');
                if (lines.length > 1) {
                    const nameLine = lines[0];
                    const descriptionLines = lines.slice(1).join('\n').trim();
                    const contentDiv = tooltip.querySelector('div:not([style*="margin-top"])');
                    if (contentDiv) {
                        // Find the description div (second div child)
                        const descDiv = contentDiv.nextElementSibling;
                        if (descDiv) {
                            descDiv.innerHTML = descriptionLines.replace(/\n/g, '<br>');
                        }
                    }
                }
            }
        });
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
        // Match chord button sizing: text-xs for primary, 0.65rem for secondary
        mainButton.innerHTML = `<span class="block text-xs font-bold leading-tight pointer-events-none ${primaryTextColor}">${intervalType}</span><span class="block ${secondaryTextColor} pointer-events-none" style="font-size: 0.65rem; line-height: 0.9;">${symbolNotation}</span>`;
    });
}

// ============================================================================
// Rendering Functions
// ============================================================================

/**
 * Update diatonic button highlighting without re-rendering
 */
function updateDiatonicButtonHighlighting() {
    const lastDiatonic = getLastDiatonicChord();
    const currentType = getBuilderChordType();

    if (!lastDiatonic) return;

    // Update all diatonic mode buttons
    document.querySelectorAll('#builder-chord-type-selector .key-button-wrapper').forEach(container => {
        const mainButton = container.querySelector('button');
        if (!mainButton || mainButton.dataset.diatonicMode !== 'true') return;

        const chordRoot = mainButton.dataset.chordRoot;
        const chordType = mainButton.dataset.chordType;
        const roman = mainButton.dataset.roman || '';

        const isExactMatch = (chordRoot === lastDiatonic.root && chordType === lastDiatonic.type);
        const isTypeMatch = (chordType === currentType && !isExactMatch);

        // Update button classes
        if (isExactMatch) {
            mainButton.className = 'flex-grow px-1.5 py-1.5 text-center text-sm font-medium bg-teal-600 text-white hover:bg-teal-700';
        } else if (isTypeMatch) {
            mainButton.className = 'flex-grow px-1.5 py-1.5 text-center text-sm font-medium bg-teal-200 text-gray-800 hover:bg-teal-300';
        } else {
            mainButton.className = 'flex-grow px-1.5 py-1.5 text-center text-sm font-medium text-gray-800 hover:bg-amber-100';
        }

        // Update text colors
        const chordSymbol = CHORD_DEFINITIONS[chordType]?.symbol || '';
        const textColor = isExactMatch ? 'text-white' : 'text-gray-800';
        const secondaryColor = isExactMatch ? 'text-white' : 'text-gray-500';
        mainButton.innerHTML = `<span class="block text-xs font-bold leading-tight pointer-events-none ${textColor}">${chordType}</span><span class="block ${secondaryColor} pointer-events-none" style="font-size: 0.65rem; line-height: 0.9;">${chordRoot}${chordSymbol} - ${roman}</span>`;
    });
}

/**
 * Render all chord builder selectors (root, type, inversion, intervals)
 */
export function renderBuilderSelectors() {
    const rootSelector = document.getElementById('builder-note-selector');
    const typeSelector = document.getElementById('builder-chord-type-selector');
    const invSelector = document.getElementById('builder-inversion-selector');
    const intervalSelector = document.getElementById('builder-interval-selector');

    const currentNotes = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    // Populate scale filter dropdown if not already populated (organized by category)
    const scaleDropdown = document.getElementById('scale-filter-dropdown');
    if (scaleDropdown && scaleDropdown.options.length <= 1) {
        // Group scales by category
        const scalesByCategory = {};
        Object.entries(SCALE_DEFINITIONS).forEach(([scaleName, scaleDef]) => {
            const category = scaleDef.category || 'other';
            if (!scalesByCategory[category]) {
                scalesByCategory[category] = [];
            }
            scalesByCategory[category].push(scaleName);
        });

        // Define category order for display
        const categoryOrder = ['basic', 'modes', 'minor-variants', 'symmetric', 'bebop', 'exotic', 'jazz'];

        // Add optgroups for each category
        categoryOrder.forEach(categoryKey => {
            const scales = scalesByCategory[categoryKey];
            if (scales && scales.length > 0) {
                const categoryInfo = SCALE_CATEGORIES[categoryKey];
                const optgroup = document.createElement('optgroup');
                optgroup.label = `${categoryInfo?.icon || ''} ${categoryInfo?.name || categoryKey}`.trim();
                // Apply dark text styling for optgroup (browser support varies)
                optgroup.style.color = '#1f2937';
                optgroup.style.fontWeight = 'bold';
                optgroup.style.background = '#f3f4f6';

                // Sort scales within category alphabetically
                scales.sort().forEach(scaleName => {
                    const option = document.createElement('option');
                    option.value = scaleName;
                    option.textContent = scaleName;
                    // Use inline styles for reliable dark text in dropdown
                    option.style.color = '#374151';
                    option.style.background = 'white';
                    optgroup.appendChild(option);
                });

                scaleDropdown.appendChild(optgroup);
            }
        });
    }
    // Update dropdown selection to match current state
    if (scaleDropdown) {
        const currentScaleFilter = getScaleFilter();
        scaleDropdown.value = currentScaleFilter || '';
    }

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

    // Always re-render chord type selector to handle mode changes
    typeSelector.innerHTML = '';

    const chordLibraryMode = getChordLibraryMode();
    const rootNoteName = currentNotes[getBuilderRootIndex()];

    // Update header based on mode and scale filter
    const headerElement = document.getElementById('chord-library-header');
    const currentScaleFilter = getScaleFilter();
    if (headerElement) {
        if (chordLibraryMode === 'diatonic' && currentScaleFilter) {
            // Scale-aware diatonic mode: show "Diatonic to C Natural Minor" etc.
            headerElement.textContent = `Browse Chord Families - Diatonic to ${rootNoteName} ${currentScaleFilter}`;
        } else if (chordLibraryMode === 'diatonic') {
            // Standard diatonic mode (Major scale)
            headerElement.textContent = `Browse Chord Families - Diatonic to ${rootNoteName} Major`;
        } else if (currentScaleFilter) {
            // Chromatic mode with scale filter
            headerElement.textContent = `Browse Chord Families - ${rootNoteName} ${currentScaleFilter}`;
        } else {
            headerElement.textContent = 'Browse Chord Families';
        }
    }

    if (chordLibraryMode === 'diatonic') {
        // Render diatonic chords based on the selected root note and optional scale
        let diatonicChords;
        if (currentScaleFilter && SCALE_DEFINITIONS[currentScaleFilter]) {
            // Scale-aware diatonic mode: generate chords from the selected scale
            diatonicChords = generateScaleDiatonicChords(rootNoteName, currentScaleFilter, currentNotes);
        } else {
            // Standard diatonic mode: use Major scale (original behavior)
            diatonicChords = window.generateDiatonicChords ? window.generateDiatonicChords(rootNoteName, currentNotes) : [];
        }

        diatonicChords.forEach(group => {
            const groupContainer = document.createElement('div');
            groupContainer.className = 'border border-gray-200 rounded-lg p-2 flex flex-col';
            const title = document.createElement('h4');
            title.className = 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 text-center';
            title.textContent = group.title;
            groupContainer.appendChild(title);

            const buttonGrid = document.createElement('div');
            buttonGrid.className = 'grid grid-cols-1 gap-1.5';

            group.chords.forEach(chord => {
                if (CHORD_DEFINITIONS[chord.type]) {
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'key-button-wrapper flex items-stretch rounded-lg shadow-sm overflow-hidden bg-gray-200 transition duration-150 transform hover:scale-105';
                    buttonContainer.style.position = 'relative';

                    // Main button with chord info
                    const mainButton = document.createElement('button');
                    mainButton.dataset.chordType = chord.type;
                    mainButton.dataset.chordRoot = chord.root;
                    mainButton.dataset.roman = chord.roman;
                    mainButton.dataset.diatonicMode = 'true'; // Mark as diatonic mode button

                    const chordRootIndex = currentNotes.indexOf(chord.root);

                    // Check if this exact chord (root + type) is currently selected in diatonic mode
                    const lastDiatonic = getLastDiatonicChord();
                    const currentType = getBuilderChordType();
                    const isExactMatch = lastDiatonic && (chord.root === lastDiatonic.root && chord.type === lastDiatonic.type);
                    const isTypeMatch = (chord.type === currentType && !isExactMatch);

                    // Apply different styling for exact match vs type match
                    if (isExactMatch) {
                        // Exact match: teal background (primary selection)
                        mainButton.className = 'flex-grow px-1.5 py-1.5 text-center text-sm font-medium bg-teal-600 text-white hover:bg-teal-700';
                    } else if (isTypeMatch) {
                        // Same type but different root: lighter teal (secondary highlight)
                        mainButton.className = 'flex-grow px-1.5 py-1.5 text-center text-sm font-medium bg-teal-200 text-gray-800 hover:bg-teal-300';
                    } else {
                        // Not selected: default styling
                        mainButton.className = 'flex-grow px-1.5 py-1.5 text-center text-sm font-medium text-gray-800 hover:bg-amber-100';
                    }

                    // Display to match chromatic mode: chord type on top (bold), root+symbol and roman below
                    const chordSymbol = CHORD_DEFINITIONS[chord.type].symbol || '';
                    const textColor = isExactMatch ? 'text-white' : 'text-gray-800';
                    const secondaryColor = isExactMatch ? 'text-white' : 'text-gray-500';
                    mainButton.innerHTML = `<span class="block text-xs font-bold leading-tight pointer-events-none ${textColor}">${chord.type}</span><span class="block ${secondaryColor} pointer-events-none" style="font-size: 0.65rem; line-height: 0.9;">${chord.root}${chordSymbol} - ${chord.roman}</span>`;

                    // Mouse events for desktop - play the specific diatonic chord without changing root
                    mainButton.onmousedown = () => {
                        // Save this as the last played diatonic chord for highlighting
                        setLastDiatonicChord({ root: chord.root, type: chord.type });
                        // Temporarily set root to this chord's root, play, then restore
                        const originalRoot = getBuilderRootIndex();
                        setBuilderRootIndex(chordRootIndex);
                        selectBuilderChordType(chord.type, true);
                        setBuilderRootIndex(originalRoot); // Restore original root immediately
                        // Update highlighting after a brief delay
                        setTimeout(() => updateDiatonicButtonHighlighting(), 50);
                    };
                    mainButton.onmouseup = () => stopBuilderChord();
                    mainButton.onmouseleave = () => stopBuilderChord();

                    // Touch events for mobile/tablet
                    let touchStartTime = 0;
                    let touchHolding = false;
                    mainButton.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        touchStartTime = Date.now();
                        touchHolding = true;
                        mainButton.dataset.held = 'true';
                        // Save this as the last played diatonic chord for highlighting
                        setLastDiatonicChord({ root: chord.root, type: chord.type });
                        // Temporarily set root to this chord's root, play, then restore
                        const originalRoot = getBuilderRootIndex();
                        setBuilderRootIndex(chordRootIndex);
                        selectBuilderChordType(chord.type, true);
                        setBuilderRootIndex(originalRoot); // Restore original root immediately
                        // Update highlighting after a brief delay
                        setTimeout(() => updateDiatonicButtonHighlighting(), 50);
                    }, { passive: false });

                    mainButton.addEventListener('touchend', (e) => {
                        e.preventDefault();
                        touchHolding = false;
                        stopBuilderChord();
                        mainButton.dataset.held = 'false';
                        if (Date.now() - touchStartTime < 300) {
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

                    // Info icon
                    const infoIcon = document.createElement('button');
                    infoIcon.innerHTML = 'ℹ';
                    infoIcon.className = 'chord-info-icon';
                    infoIcon.style.cssText = 'position:absolute;bottom:1px;left:1px;width:12px;height:12px;border-radius:50%;background-color:rgba(107,114,128,0.5);color:rgba(255,255,255,0.8);font-size:8px;font-weight:600;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;z-index:10;padding:0;line-height:1;transition:all 0.2s';
                    infoIcon.addEventListener('mouseenter', () => {
                        infoIcon.style.backgroundColor = 'rgba(83,122,187,0.6)';
                        infoIcon.style.color = 'white';
                        infoIcon.style.transform = 'scale(1.15)';
                    });
                    infoIcon.addEventListener('mouseleave', () => {
                        infoIcon.style.backgroundColor = 'rgba(107,114,128,0.5)';
                        infoIcon.style.color = 'rgba(255,255,255,0.8)';
                        infoIcon.style.transform = 'scale(1)';
                    });
                    infoIcon.addEventListener('mousedown', (e) => e.stopPropagation());
                    infoIcon.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });
                    buttonContainer.appendChild(infoIcon);

                    // Create tooltip (pass chord.root for diatonic mode to use correct root when playing)
                    const chordDescription = CHORD_DEFINITIONS[chord.type].description || '';
                    const contextAwareDescription = getContextAwareChordDescription(chord.type, chord.root, chordDescription);
                    const tooltipText = `${chord.root}${chordSymbol} - ${chord.type} (${chord.roman})\n\n${contextAwareDescription}`;
                    const tooltipElement = createButtonTooltip(mainButton, tooltipText, chord.type, chord.root);

                    const showTooltip = () => {
                        if (!tooltipElement) return;
                        if (tooltipElement.showTooltip) {
                            tooltipElement.showTooltip();
                        } else {
                            const rect = mainButton.getBoundingClientRect();
                            const tooltipHeight = 200;
                            tooltipElement.style.left = (rect.left + rect.width / 2) + 'px';
                            tooltipElement.style.top = (rect.top - tooltipHeight - 12) + 'px';
                            tooltipElement.style.transform = 'translateX(-50%)';
                            tooltipElement.style.opacity = '1';
                            tooltipElement.style.visibility = 'visible';
                        }
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

                    // Arpeggio buttons
                    const arpContainer = document.createElement('div');
                    arpContainer.className = 'flex flex-col w-8 border-l border-gray-300';

                    const arpUp = document.createElement('button');
                    arpUp.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800 border-b border-gray-300';
                    arpUp.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path></svg>';
                    arpUp.onclick = (e) => {
                        e.stopPropagation();
                        // Temporarily set root to this chord's root for arpeggio, then restore
                        const originalRoot = getBuilderRootIndex();
                        setBuilderRootIndex(chordRootIndex);
                        if (window.playArpeggio) window.playArpeggio('chord', chord.type, 'up');
                        setBuilderRootIndex(originalRoot);
                    };
                    arpContainer.appendChild(arpUp);

                    const arpDown = document.createElement('button');
                    arpDown.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800';
                    arpDown.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
                    arpDown.onclick = (e) => {
                        e.stopPropagation();
                        // Temporarily set root to this chord's root for arpeggio, then restore
                        const originalRoot = getBuilderRootIndex();
                        setBuilderRootIndex(chordRootIndex);
                        if (window.playArpeggio) window.playArpeggio('chord', chord.type, 'down');
                        setBuilderRootIndex(originalRoot);
                    };
                    arpContainer.appendChild(arpDown);

                    buttonContainer.appendChild(arpContainer);
                    buttonGrid.appendChild(buttonContainer);
                }
            });
            groupContainer.appendChild(buttonGrid);
            typeSelector.appendChild(groupContainer);
        });
    } else {
        // Chromatic mode - show all chords (optionally filtered by scale)
        const scaleFilter = getScaleFilter();
        const scaleRoot = rootNoteName; // Use current selected root as scale root

        CHORD_GROUPS.forEach(group => {
            // Filter chord types by scale if a scale filter is active
            const filteredTypes = scaleFilter
                ? group.types.filter(chordType =>
                    CHORD_DEFINITIONS[chordType] && isChordInScale(chordType, rootNoteName, scaleFilter, scaleRoot)
                )
                : group.types;

            // Skip empty groups when filtering
            if (scaleFilter && filteredTypes.length === 0) return;

            const groupContainer = document.createElement('div');
            groupContainer.className = 'border border-gray-200 rounded-lg p-2 flex flex-col';
            const title = document.createElement('h4');
            title.className = 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 text-center';
            title.textContent = scaleFilter ? `${group.title} (${filteredTypes.length})` : group.title;
            groupContainer.appendChild(title);

            const buttonGrid = document.createElement('div');
            buttonGrid.className = 'grid grid-cols-1 gap-1.5';
            filteredTypes.forEach(chordType => {
                if (CHORD_DEFINITIONS[chordType]) {
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'key-button-wrapper flex items-stretch rounded-lg shadow-sm overflow-hidden bg-gray-200 transition duration-150 transform hover:scale-105';
                    buttonContainer.style.position = 'relative'; // For absolute positioning of info icon

                    // Main button for block chord
                    const mainButton = document.createElement('button');
                    mainButton.className = 'flex-grow px-1.5 py-1.5 text-center text-sm font-medium text-gray-800 hover:bg-amber-100';
                    mainButton.dataset.chordType = chordType;
                    const chordDescription = CHORD_DEFINITIONS[chordType].description || '';
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
                    
                    // Create tooltip for chord button with name and context-aware description
                    const rootNoteName = currentNotes[getBuilderRootIndex()];
                    const contextAwareDescription = getContextAwareChordDescription(chordType, rootNoteName, chordDescription);
                    const tooltipText = `${chordType}\n\n${contextAwareDescription}`;
                    const tooltipElement = createButtonTooltip(mainButton, tooltipText, chordType);
                    
                    // Make info icon trigger tooltip on click/tap
                    const showTooltip = () => {
                        if (!tooltipElement) return;
                        // Use the stored showTooltip function if available (for touch devices)
                        if (tooltipElement.showTooltip) {
                            tooltipElement.showTooltip();
                        } else {
                            // Fallback for desktop
                            const rect = mainButton.getBoundingClientRect();
                            const tooltipHeight = 200; // Same as in createButtonTooltip
                            tooltipElement.style.left = (rect.left + rect.width / 2) + 'px';
                            tooltipElement.style.top = (rect.top - tooltipHeight - 12) + 'px';
                            tooltipElement.style.transform = 'translateX(-50%)';
                            tooltipElement.style.opacity = '1';
                            tooltipElement.style.visibility = 'visible';
                        }
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
                    arpUp.onclick = (e) => {
                        e.stopPropagation();
                        if (window.playArpeggio) window.playArpeggio('chord', chordType, 'up');
                    };
                    arpContainer.appendChild(arpUp);

                    // Arp Down button
                    const arpDown = document.createElement('button');
                    arpDown.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800';
                    arpDown.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
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
            groupContainer.className = 'border border-gray-200 rounded-lg p-2 flex flex-col';
            const title = document.createElement('h4');
            title.className = 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 text-center';
            title.textContent = group.title;
            groupContainer.appendChild(title);

            const buttonGrid = document.createElement('div');
            buttonGrid.className = 'grid grid-cols-1 gap-1.5';
            group.types.forEach(intervalType => {
                if (INTERVAL_DEFINITIONS[intervalType]) {
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'key-button-wrapper flex items-stretch rounded-lg shadow-sm overflow-hidden bg-gray-200 transition duration-150 transform hover:scale-105';

                    // Main button for block interval
                    const mainButton = document.createElement('button');
                    mainButton.className = 'flex-grow px-1.5 py-1.5 text-center text-sm font-medium text-gray-800 hover:bg-amber-100';
                    mainButton.dataset.intervalType = intervalType;
                    const intervalDescription = INTERVAL_DEFINITIONS[intervalType].description || '';
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
                    
                    // Create tooltip for interval button with name included and "Add Interval" button
                    const tooltipText = `${intervalType}\n\n${intervalDescription}`;
                    createButtonTooltip(mainButton, tooltipText, null, null, intervalType);

                    // Container for arpeggio buttons
                    const arpContainer = document.createElement('div');
                    arpContainer.className = 'flex flex-col w-10 border-l border-gray-300';

                    // Arp Up button
                    const arpUp = document.createElement('button');
                    arpUp.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800 border-b border-gray-300';
                    arpUp.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path></svg>';
                    arpUp.onclick = (e) => {
                        e.stopPropagation();
                        if (window.playArpeggio) window.playArpeggio('interval', intervalType, 'up');
                    };
                    arpContainer.appendChild(arpUp);

                    // Arp Down button
                    const arpDown = document.createElement('button');
                    arpDown.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800';
                    arpDown.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
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
 * @param {Object} options - Additional options
 * @param {string} options.externalButtonsContainerId - If provided, wire up buttons in this external container instead of rendering them inline
 */
export function renderVoicingEditor(notes, editorId, containerId, omittedNotes, onToggle, onSelectAll = null, onSelectNone = null, options = {}) {
    const editor = document.getElementById(editorId);
    const editorContainer = document.getElementById(containerId);
    // Optional parent section container to show/hide entire section
    const parentSection = options.parentSectionId ? document.getElementById(options.parentSectionId) : null;
    editor.innerHTML = '';

    if (!notes || notes.length === 0) {
        editorContainer.classList.add('hidden');
        if (parentSection) parentSection.classList.add('hidden');
        // Also hide external buttons container if provided
        if (options.externalButtonsContainerId) {
            const extBtns = document.getElementById(options.externalButtonsContainerId);
            if (extBtns) extBtns.classList.add('hidden');
        }
        return;
    }
    editorContainer.classList.remove('hidden');
    if (parentSection) parentSection.classList.remove('hidden');

    // Handle external buttons (in header)
    if (options.externalButtonsContainerId && onSelectAll && onSelectNone) {
        const extBtnsContainer = document.getElementById(options.externalButtonsContainerId);
        if (extBtnsContainer) {
            extBtnsContainer.classList.remove('hidden');
            // Wire up the All and None buttons
            const allBtn = extBtnsContainer.querySelector('[id$="-select-all"]');
            const noneBtn = extBtnsContainer.querySelector('[id$="-select-none"]');
            if (allBtn) {
                allBtn.onclick = onSelectAll;
            }
            if (noneBtn) {
                noneBtn.onclick = onSelectNone;
            }
        }
    }
    // Only render inline buttons if no external container provided
    else if (onSelectAll && onSelectNone) {
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
 * @param {boolean} switchToCompositionStudio - Whether to switch to Composition Studio tab after adding
 * @param {boolean} playShutterSound - Whether to play the camera shutter sound (default: true)
 * @param {boolean} fromRecommendation - Whether adding from recommendations (sets LH to 'off')
 */
export function addChordToProgression(switchToCompositionStudio = false, playShutterSound = true, fromRecommendation = false) {
    // Determine the root note - in diatonic mode, use the selected diatonic chord's root
    const chordLibraryMode = getChordLibraryMode();
    const lastDiatonic = getLastDiatonicChord();
    let rootNote;

    if (chordLibraryMode === 'diatonic' && lastDiatonic && lastDiatonic.root) {
        // In diatonic mode, use the diatonic chord's actual root (e.g., D for Dm)
        rootNote = lastDiatonic.root;
    } else {
        // In chromatic mode or no diatonic selection, use the builder root index
        rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];
    }

    // Play camera shutter sound effect (only if requested and buffer is loaded)
    if (playShutterSound && getAudioIsReady() && getCameraShutter()) {
        const shutter = getCameraShutter();
        // Only play if the buffer is loaded (Tone.Player has a loaded property)
        if (shutter.loaded) {
            shutter.start();
        }
    }

    // LH accompaniment is no longer part of chord cards - always set to 'off'
    const lhType = 'off';
    const lhInversion = 0;
    const lhOctaveShift = 0;
    const omittedNotes = [...getBuilderOmittedNotes()]; // Capture current voicing
    console.log('[addChordToProgression] omittedNotes from builder:', omittedNotes);
    const lhOmittedNotes = []; // LH no longer used in chord cards
    const octaveShift = getBuilderOctaveShift() * 12; // Convert whole octaves to semitones

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
        // In diatonic mode, also use the diatonic chord's type
        const chordType = (chordLibraryMode === 'diatonic' && lastDiatonic && lastDiatonic.type)
            ? lastDiatonic.type
            : getBuilderChordType();
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
    if (newChordData.selectionMode === 'chord') {
        // Use noteToRomanNumeral for proper handling of borrowed chords (bVII, bVI, etc.)
        const calculatedRoman = noteToRomanNumeral(rootNote, trainerState.currentKey, newChordData.type);
        if (calculatedRoman) {
            romanNumeral = calculatedRoman;
        } else if (scaleDegreeIndex !== -1) {
            // Fallback to diatonic lookup
            const romanKeys = Object.keys(ROMAN_MAP_BASE);
            const foundKey = romanKeys.find(key =>
                ROMAN_MAP_BASE[key].index === scaleDegreeIndex &&
                ROMAN_MAP_BASE[key].quality === newChordData.type
            );
            const fallbackKey = romanKeys.find(key => ROMAN_MAP_BASE[key].index === scaleDegreeIndex);
            romanNumeral = foundKey || fallbackKey || '?';
        }
    } else {
        romanNumeral = rootNote; // Just use the note name for intervals
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
    // Always append at end (don't use position-based insertion from selection)
    if (window.addToProgressionData) {
        window.addToProgressionData(newChordData, { appendToEnd: true });
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

    // Check for wireframe sections with available slots and assign the new chord
    // This ensures chords fill wireframe sections before creating pseudo groups
    const compositionState = window.getCompositionState?.();
    if (compositionState) {
        const insertedIndex = trainerState.progressionData.length - 1;
        const allSections = compositionState.getSections?.() || [];

        // Find the first section with available slots (chordIndices.length < expectedChordCount)
        const sectionWithSlot = allSections.find(section => {
            const currentCount = section.chordIndices?.length || 0;
            const expectedCount = section.expectedChordCount || 4;
            return currentCount < expectedCount;
        });

        if (sectionWithSlot && insertedIndex >= 0) {
            try {
                compositionState.addChordToSection(insertedIndex, sectionWithSlot.id);
                // Re-render to show the chord in the section
                if (window.renderProgressionDisplay) {
                    window.renderProgressionDisplay('melody-progression-visualization', true);
                }
            } catch (e) {
                // Silently fail - chord will remain ungrouped
            }
        }
    }

    // Update smart recommendations panel
    if (window.updateRecommendations) {
        window.updateRecommendations();
    }

    if (switchToCompositionStudio && window.switchTab) {
        window.switchTab('melody');
    }
}

/**
 * Add a specific chord type and inversion to the progression without changing builder state
 * @param {string} chordType - The chord type to add
 * @param {number} inversion - The inversion to use
 * @param {boolean} playShutterSound - Whether to play the camera shutter sound (default: true)
 * @param {string} overrideRoot - (Optional) Override root note for diatonic mode
 * @param {number} beats - (Optional) Duration in beats for this chord (Phase 5 rhythmic awareness)
 * @param {Object} options - (Optional) Additional options { skipRender: boolean }
 */
export function addSpecificChordToProgression(chordType, inversion, playShutterSound = true, overrideRoot = null, beats = null, options = {}) {
    // Use override root if provided, otherwise check tooltip selection, then fall back to builder root
    let rootNote;
    if (overrideRoot) {
        rootNote = overrideRoot;
    } else if (window.lastTooltipChordSelection?.chordRoot && window.lastTooltipChordSelection?.chordType === chordType) {
        // Use the stored diatonic chord root if it matches the chord type being added
        rootNote = window.lastTooltipChordSelection.chordRoot;
    } else {
        rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];
    }
    
    // Play camera shutter sound effect (only if requested and buffer is loaded)
    if (playShutterSound && getAudioIsReady() && getCameraShutter()) {
        const shutter = getCameraShutter();
        // Only play if the buffer is loaded (Tone.Player has a loaded property)
        if (shutter.loaded) {
            shutter.start();
        }
    }

    // LH accompaniment is no longer part of chord cards - always set to 'off'
    const lhType = 'off';
    const lhInversion = 0;
    const lhOctaveShift = 0;
    const omittedNotes = [...getBuilderOmittedNotes()]; // Capture current voicing
    const lhOmittedNotes = []; // LH no longer used in chord cards

    // Allow octave override for imported chords (e.g., from song analysis)
    // options.octaveShift is in semitones (e.g., -12 for one octave down)
    const octaveShift = options.octaveShift !== undefined
        ? options.octaveShift
        : getBuilderOctaveShift() * 12; // Convert whole octaves to semitones

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

    // Set beats if provided (Phase 5 rhythmic awareness)
    if (beats !== null && beats > 0) {
        newChordData.beats = beats;
    }

    // Add to trainer state using window function
    // This function is used by the Unified Recommendations Modal which NEEDS position-based insertion
    // Do NOT add appendToEnd here - only addChordToProgression (Chord Lab) should append to end
    if (window.addToProgressionData) {
        window.addToProgressionData(newChordData, { skipRender: options.skipRender });

        // Skip rendering if in batch mode
        if (!options.skipRender) {
            // Explicitly re-render melody notation to ensure it updates immediately
            // (addToProgressionData calls renderMelodyNotationIfNeeded, but we want to ensure it happens)
            setTimeout(() => {
                const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
                if (interactiveCanvas) {
                    // Sync progression to composition state before rendering
                    if (window.syncProgressionToMelodyComposer && window.getCompositionState) {
                        window.syncProgressionToMelodyComposer();
                    }

                    if (window.refreshNotationFromProgression) {
                        window.refreshNotationFromProgression();
                    }
                }
            }, 100);
        }
    } else {
        // Fallback: manually add to progression
        const trainerState = getTrainerState();
        trainerState.progressionData.push(newChordData);
        if (newChordData.roman && !trainerState.progressionRomans.includes(newChordData.roman)) {
            trainerState.progressionRomans.push(newChordData.roman);
        }

        // Skip rendering if in batch mode
        if (!options.skipRender) {
            if (window.renderProgressionDisplay) {
                window.renderProgressionDisplay('progression-visualization', true);
            }

            // Re-render melody notation if needed (same logic as addToProgressionData)
            const currentTab = window.getCurrentTab ? window.getCurrentTab() : 'builder';
            const isMelodyTab = currentTab === 'melody';
            const freeModeControls = document.getElementById('free-mode-controls');
            const isFreeModeActive = freeModeControls && !freeModeControls.classList.contains('hidden');

            if (isMelodyTab || isFreeModeActive) {
                // Sync progression to composition state before rendering
                if (window.syncProgressionToMelodyComposer && window.getCompositionState) {
                    window.syncProgressionToMelodyComposer();
                }

                const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
                if (interactiveCanvas) {
                    setTimeout(() => {
                        if (window.refreshNotationFromProgression) {
                            window.refreshNotationFromProgression();
                        }
                    }, 50);
                }
            }
        }
    }

    // Check for wireframe sections with available slots and assign the new chord
    // This ensures chords fill wireframe sections before creating pseudo groups
    if (!options.skipRender) {
        const compositionState = window.getCompositionState?.();
        if (compositionState) {
            const trainerState = getTrainerState();
            const insertedIndex = trainerState.progressionData.length - 1;
            const allSections = compositionState.getSections?.() || [];

            // Find the first section with available slots (chordIndices.length < expectedChordCount)
            const sectionWithSlot = allSections.find(section => {
                const currentCount = section.chordIndices?.length || 0;
                const expectedCount = section.expectedChordCount || 4;
                return currentCount < expectedCount;
            });

            if (sectionWithSlot && insertedIndex >= 0) {
                try {
                    compositionState.addChordToSection(insertedIndex, sectionWithSlot.id);
                    // Re-render to show the chord in the section
                    if (window.renderProgressionDisplay) {
                        window.renderProgressionDisplay('melody-progression-visualization', true);
                    }
                } catch (e) {
                    // Silently fail - chord will remain ungrouped
                }
            }
        }
    }

    // Update smart recommendations panel (skip if in batch mode)
    if (window.updateRecommendations && !options.skipRender) {
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
            newChordData.lhOctaveShift = 0; // Base octave is now 2 for LH
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

/**
 * Update a chord at a specific index in the progression
 * Used for applying chord suggestions (e.g., A -> A7)
 * @param {number} index - Index in the progression to update
 * @param {string} root - New root note (e.g., "C", "F#", "Bb")
 * @param {string} type - New chord type (e.g., "major", "minor", "dominant7")
 */
export function updateChordAtIndex(index, root, type) {
    const trainerState = window.getTrainerState ? window.getTrainerState() : null;
    if (!trainerState || !trainerState.progressionData) {
        console.warn('[ChordBuilder] No progression data available');
        return false;
    }

    if (index < 0 || index >= trainerState.progressionData.length) {
        console.warn(`[ChordBuilder] Invalid index: ${index}`);
        return false;
    }

    // Map common chord type names to internal type names
    const typeMap = {
        'major': 'Major',
        'minor': 'Minor',
        'diminished': 'Diminished',
        'augmented': 'Augmented',
        'sus2': 'Sus2',
        'sus4': 'Sus4',
        'major7': 'Major 7th',
        'minor7': 'Minor 7th',
        'dominant7': 'Dominant 7th',
        'dominant9': 'Dominant 9th',
        'minor9': 'Minor 9th',
        'major9': 'Major 9th'
    };

    const mappedType = typeMap[type.toLowerCase()] || 'Major';

    // Get note arrays based on enharmonic preference
    const noteArray = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    // Find the root note index
    const rootIndex = noteArray.indexOf(root);
    if (rootIndex === -1) {
        console.warn(`[ChordBuilder] Root note not found: ${root}`);
        return false;
    }

    // Get the current chord at this index
    const chord = trainerState.progressionData[index];

    // Update the chord properties
    chord.root = root;
    chord.type = mappedType;

    // Get chord definition for new type
    const chordDef = CHORD_DEFINITIONS[mappedType];
    if (chordDef) {
        // Calculate new notes based on root and type
        const intervals = chordDef.intervals;
        const newNotes = intervals.map(interval => {
            const noteIndex = (rootIndex + interval) % 12;
            return noteArray[noteIndex];
        });

        chord.notes = newNotes;
        chord.simpleName = `${root}${chordDef.symbol || ''}`;
        chord.name = `${root} ${mappedType}`;
    }

    // Update display name for chord card
    if (chord.displayName !== undefined) {
        chord.displayName = chord.simpleName || chord.name;
    }

    console.log(`[ChordBuilder] Updated chord at index ${index}: ${chord.simpleName || chord.name}`);

    // Trigger re-render
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }

    return true;
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

// ============================================================================
// Note Toggle Functions (for Full-Screen Chord Lab)
// ============================================================================

/**
 * Toggle a right-hand note in/out of the chord (omit/include)
 * Plays a brief chord preview (0.5s) after toggling
 * @param {string} note - The note to toggle (e.g., 'C4', 'E4')
 */
export function toggleBuilderNote(note) {
    const omitted = getBuilderOmittedNotes();
    const isCurrentlyOmitted = omitted.includes(note);

    if (isCurrentlyOmitted) {
        // Include the note (remove from omitted list)
        setBuilderOmittedNotes(omitted.filter(n => n !== note));
    } else {
        // Omit the note (add to omitted list)
        setBuilderOmittedNotes([...omitted, note]);
    }

    updateBuilderDisplay();
    playBuilderChordWithDuration(); // Brief 0.5s playback
}

/**
 * Toggle a left-hand note in/out of the chord (omit/include)
 * Plays a brief chord preview (0.5s) after toggling (if LH is active)
 * @param {string} note - The note to toggle (e.g., 'C2', 'G2')
 */
export function toggleBuilderLHNote(note) {
    const omitted = getBuilderLHOmittedNotes();
    const isCurrentlyOmitted = omitted.includes(note);

    if (isCurrentlyOmitted) {
        // Include the note (remove from omitted list)
        setBuilderLHOmittedNotes(omitted.filter(n => n !== note));
    } else {
        // Omit the note (add to omitted list)
        setBuilderLHOmittedNotes([...omitted, note]);
    }

    updateBuilderDisplay();

    // Only play if LH is not "off"
    const lhType = document.getElementById('builder-lh-type-select')?.value;
    if (lhType && lhType !== 'off') {
        playBuilderChordWithDuration(); // Brief 0.5s playback
    }
}
