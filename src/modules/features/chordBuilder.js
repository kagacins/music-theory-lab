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
    setLastDiatonicChord
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
    else if (chordType === 'Suspended 2nd' || chordType === 'Suspended 4th') {
        const interval = chordType.includes('2nd') ? '2nd' : '4th';
        const resolveInterval = chordType.includes('2nd') ? '3rd' : '3rd';
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
 */
function createButtonTooltip(button, tooltipText, chordType = null, chordRoot = null) {
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
    inversionLabel.textContent = 'Change Chord Inversion:';
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
        
        // Touch events for mobile/tablet
        invBtn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // Update highlighting immediately when playback starts
            updateButtonHighlighting();
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
        }, { passive: false });
        
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
        invBtn.addEventListener('mouseleave', stopHeld);
        
        invBtn.addEventListener('click', () => {
            activeInversion = inv;
            // Highlighting already updated on mousedown, just update state and re-render
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
        // Update sidebar display
        if (window.updateStyleMoodDisplay) {
            window.updateStyleMoodDisplay(styleSelect.value, moodSelect.value);
        }
    });

    moodSelect.addEventListener('change', () => {
        renderSuggestions(styleSelect.value, moodSelect.value);
        // Update sidebar display
        if (window.updateStyleMoodDisplay) {
            window.updateStyleMoodDisplay(styleSelect.value, moodSelect.value);
        }
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
        // Update sidebar display
        if (window.updateStyleMoodDisplay) {
            window.updateStyleMoodDisplay(style, mood);
        }
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

// =========================================================================
// Current Chord Progression Panel (Chord Builder)
// =========================================================================

// Track whether to show detailed or simplified cards in Chord Builder
let builderDetailedView = false;

/**
 * Toggle the Current Chord Progression panel in Chord Builder
 */
export function toggleBuilderProgressionPanel() {
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

    // Use progressionBuilder's renderProgressionDisplay function
    // by delegating to the same function that renders for trainer and melody tabs
    if (window.renderProgressionDisplayForBuilder) {
        window.renderProgressionDisplayForBuilder(container, progressionData, key, {
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

    // Only re-render if panel is visible
    if (panel && !panel.classList.contains('hidden')) {
        renderBuilderProgressionCards();
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
    generateDiatonicChords
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
        mainButton.innerHTML = `<span class="block text-sm pointer-events-none ${primaryTextColor}">${intervalType}</span><span class="block ${secondaryTextColor} text-xs pointer-events-none">${symbolNotation}</span>`;
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

    // Update header based on mode
    const headerElement = document.getElementById('chord-library-header');
    if (headerElement) {
        if (chordLibraryMode === 'diatonic') {
            headerElement.textContent = `Browse Chord Families - Diatonic to ${rootNoteName}`;
        } else {
            headerElement.textContent = 'Browse Chord Families';
        }
    }

    if (chordLibraryMode === 'diatonic') {
        // Render diatonic chords based on the selected root note
        const diatonicChords = window.generateDiatonicChords ? window.generateDiatonicChords(rootNoteName, currentNotes) : [];

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
        // Chromatic mode - show all chords
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
 * @param {boolean} fromRecommendation - Whether adding from recommendations (sets LH to 'off')
 */
export function addChordToProgression(switchToTrainer = false, playShutterSound = true, fromRecommendation = false) {
    const rootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[getBuilderRootIndex()];

    // Play camera shutter sound effect (only if requested)
    if (playShutterSound && getAudioIsReady() && getCameraShutter()) {
        getCameraShutter().start();
    }

    // When adding from recommendations, default LH pattern to 'off'
    const lhType = fromRecommendation ? 'off' : document.getElementById('builder-lh-type-select').value;
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
 * @param {string} overrideRoot - (Optional) Override root note for diatonic mode
 */
export function addSpecificChordToProgression(chordType, inversion, playShutterSound = true, overrideRoot = null) {
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
    } else {
        // Fallback: manually add to progression
        const trainerState = getTrainerState();
        trainerState.progressionData.push(newChordData);
        if (newChordData.roman && !trainerState.progressionRomans.includes(newChordData.roman)) {
            trainerState.progressionRomans.push(newChordData.roman);
        }
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('progression-visualization', true);
            window.renderProgressionDisplay('melody-progression-visualization', false);
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
        'sus2': 'Suspended 2nd',
        'sus4': 'Suspended 4th',
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
