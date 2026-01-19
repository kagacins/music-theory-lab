/**
 * BassMotionIndicators - Bass Line Motion Visualization
 *
 * Per Educational Enhancement Roadmap A3:
 * Small arrows between chord cards showing bass movement direction and distance.
 *
 * Arrow Types:
 * → Ascending step (half/whole tone = 1-2 semitones)
 * ← Descending step
 * ↗ Ascending skip (3rd-4th = 3-5 semitones)
 * ↘ Descending skip
 * ⇗ Ascending leap (5th+ = 6+ semitones)
 * ⇘ Descending leap
 * • Common tone (no movement = 0 semitones)
 *
 * This is a Layer 1 (Ambient) feature:
 * - Hidden in Focus mode
 * - Visible in Explore mode only (per roadmap matrix)
 * - Respects Experience Mode settings
 */

import { getExperienceMode } from '../state/globalState.js';
import { noteToMidi } from '../utils/noteUtils.js';

// ===========================================
// CONSTANTS
// ===========================================

/**
 * Motion classification based on semitone intervals
 * Following standard music theory terminology
 */
const MOTION_TYPES = {
    commonTone: {
        minSemitones: 0,
        maxSemitones: 0,
        label: 'same',
        description: 'Common tone',
        symbol: '•',
        color: '#6b7280',      // gray-500
        bgColor: 'bg-gray-100',
        direction: null
    },
    step: {
        minSemitones: 1,
        maxSemitones: 2,
        label: 'step',
        description: 'Stepwise motion',
        upSymbol: '→',
        downSymbol: '←',
        color: '#10b981',      // emerald-500 (smooth motion = good voice leading)
        bgColor: 'bg-emerald-50'
    },
    skip: {
        minSemitones: 3,
        maxSemitones: 5,
        label: 'skip',
        description: 'Skip (3rd-4th)',
        upSymbol: '↗',
        downSymbol: '↘',
        color: '#f59e0b',      // amber-500 (moderate jump)
        bgColor: 'bg-amber-50'
    },
    leap: {
        minSemitones: 6,
        maxSemitones: Infinity,
        label: 'leap',
        description: 'Leap (5th+)',
        upSymbol: '⇗',
        downSymbol: '⇘',
        color: '#ef4444',      // red-500 (large jump = dramatic)
        bgColor: 'bg-red-50'
    }
};

// ===========================================
// BASS MOTION INDICATOR CLASS
// ===========================================

export class BassMotionIndicators {
    constructor() {
        // Track active render contexts for re-rendering on mode change
        this._activeContexts = new Map();
        // Track hashes to avoid unnecessary re-renders
        this._containerHashes = new Map();

        // Listen for Experience Mode changes
        this._setupModeChangeListener();
    }

    /**
     * Set up listener for Experience Mode changes and chord updates
     */
    _setupModeChangeListener() {
        // Re-render when Experience Mode changes
        window.addEventListener('experienceModeChanged', () => {
            this._reRenderAllContexts();
        });

        // Re-render when chords are updated (root, type, inversion, octave changes)
        window.addEventListener('chordUpdated', () => {
            this._reRenderAllContexts();
        });

        // Re-render when progression data changes (add, remove, reorder)
        window.addEventListener('progressionDataChanged', () => {
            this._reRenderAllContexts();
        });
    }

    /**
     * Re-render all active contexts
     * Called when mode changes or chord data updates
     */
    _reRenderAllContexts() {
        this._activeContexts.forEach((context, containerId) => {
            const container = document.getElementById(containerId) || context.container;
            if (container && document.body.contains(container)) {
                // Invalidate cache to force re-render
                this._containerHashes.delete(containerId);
                // Get fresh progression data from compositionState
                const compState = window.getCompositionState?.();
                const freshProgressionData = compState?.exportToProgressionData?.() || context.progressionData;
                const freshKey = compState?.metadata?.key || context.key;
                this.render(context.container, freshProgressionData, freshKey, context.options);
            }
        });
    }

    /**
     * Check if bass motion indicators should be displayed
     * Per roadmap: Only visible in Explore mode
     * @returns {boolean}
     */
    shouldShowIndicators() {
        const mode = getExperienceMode?.() || 'guided';
        // Per A3 roadmap matrix: Bass motion arrows visible only in Explore mode
        return mode === 'explore';
    }

    /**
     * Get the bass note from a chord
     * With inversions, notes are sorted by pitch, so notes[0] is always the bass
     * BUT if notes are omitted, we need to find the first non-omitted note
     * @param {Object} chord - Chord object with notes array
     * @returns {string|null} Bass note with octave (e.g., "G3")
     */
    getBassNote(chord) {
        if (!chord) return null;

        // chord.notes is sorted by pitch (lowest first) due to inversion handling
        if (!chord.notes || chord.notes.length === 0) {
            return null;
        }

        // Get omitted notes (if any)
        const omittedNotes = chord.omittedNotes || [];

        // Find the first non-omitted note (which is the effective bass)
        for (const note of chord.notes) {
            if (!omittedNotes.includes(note)) {
                return note;
            }
        }

        // All notes are omitted? Return the first note anyway
        return chord.notes[0];
    }

    /**
     * Calculate bass motion between two chords
     * @param {Object} prevChord - Previous chord
     * @param {Object} nextChord - Next chord
     * @returns {Object} Motion info: { semitones, direction, type, symbol, color, label }
     */
    calculateBassMotion(prevChord, nextChord) {
        const prevBass = this.getBassNote(prevChord);
        const nextBass = this.getBassNote(nextChord);

        if (!prevBass || !nextBass) {
            return {
                semitones: 0,
                direction: null,
                type: 'unknown',
                symbol: '?',
                color: '#9ca3af',
                label: 'unknown',
                description: 'Unable to determine bass motion'
            };
        }

        // Convert to MIDI to get semitone difference (including octave)
        const prevMidi = noteToMidi(prevBass);
        const nextMidi = noteToMidi(nextBass);

        const semitoneDiff = nextMidi - prevMidi;
        const absDiff = Math.abs(semitoneDiff);

        // Determine direction
        let direction = null;
        if (semitoneDiff > 0) direction = 'up';
        else if (semitoneDiff < 0) direction = 'down';

        // Classify motion type
        let motionType = MOTION_TYPES.commonTone;
        let symbol = MOTION_TYPES.commonTone.symbol;

        if (absDiff === 0) {
            motionType = MOTION_TYPES.commonTone;
            symbol = motionType.symbol;
        } else if (absDiff <= 2) {
            motionType = MOTION_TYPES.step;
            symbol = direction === 'up' ? motionType.upSymbol : motionType.downSymbol;
        } else if (absDiff <= 5) {
            motionType = MOTION_TYPES.skip;
            symbol = direction === 'up' ? motionType.upSymbol : motionType.downSymbol;
        } else {
            motionType = MOTION_TYPES.leap;
            symbol = direction === 'up' ? motionType.upSymbol : motionType.downSymbol;
        }

        // Generate descriptive label
        let label = motionType.label;
        if (direction) {
            label = direction === 'up' ? `↑${absDiff}` : `↓${absDiff}`;
        }

        return {
            semitones: semitoneDiff,
            absSemitones: absDiff,
            direction,
            type: motionType.label,
            symbol,
            color: motionType.color,
            bgColor: motionType.bgColor,
            label,
            description: motionType.description,
            prevBass,
            nextBass
        };
    }

    /**
     * Create HTML for a single bass motion indicator
     * @param {Object} motion - Motion data from calculateBassMotion()
     * @param {number} index - Position index
     * @returns {string} HTML string
     */
    _createIndicatorHTML(motion, index) {
        // Build descriptive tooltip with direction and semitone count
        let tooltipText;
        if (motion.prevBass && motion.nextBass) {
            const directionWord = motion.direction === 'up' ? 'up' : motion.direction === 'down' ? 'down' : '';
            if (motion.absSemitones === 0) {
                tooltipText = `Bass stays on ${motion.prevBass} (common tone)`;
            } else {
                tooltipText = `Bass moves ${directionWord} ${motion.absSemitones} semitone${motion.absSemitones !== 1 ? 's' : ''}: ${motion.prevBass} → ${motion.nextBass} (${motion.type})`;
            }
        } else {
            tooltipText = motion.description;
        }

        // Use a custom tooltip div for more reliable display
        return `
            <div class="bass-motion-indicator flex-shrink-0 flex items-center justify-center relative group"
                 data-motion-index="${index}"
                 data-tooltip="${tooltipText}"
                 style="
                    width: 24px;
                    min-width: 24px;
                    height: 60px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    cursor: default;
                    pointer-events: auto;
                 ">
                <span style="
                    font-size: 18px;
                    font-weight: bold;
                    color: ${motion.color};
                    line-height: 1;
                    pointer-events: none;
                ">${motion.symbol}</span>
                <span style="
                    font-size: 9px;
                    color: #374151;
                    font-weight: 600;
                    margin-top: 2px;
                    white-space: nowrap;
                    pointer-events: none;
                ">${motion.label}</span>
                <!-- Custom tooltip that appears on hover -->
                <div class="bass-motion-tooltip absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1
                            bg-gray-800 text-white text-xs rounded shadow-lg whitespace-nowrap z-50
                            opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                     style="font-size: 10px;">
                    ${tooltipText}
                </div>
            </div>
        `;
    }

    /**
     * Generate a hash for progression data to detect changes
     * Includes omittedNotes since they affect the effective bass note
     * @param {Array} progressionData - Chord progression
     * @returns {string}
     */
    _generateHash(progressionData) {
        if (!progressionData || progressionData.length === 0) return '';
        return progressionData.map(c => {
            const notes = c.notes ? c.notes.join(',') : '';
            const omitted = c.omittedNotes ? c.omittedNotes.join(',') : '';
            return `${c.root}|${c.type}|${c.inversion || 0}|${notes}|${omitted}`;
        }).join(';');
    }

    /**
     * Render bass motion indicators between chord cards in a container
     * @param {HTMLElement} container - Container with chord cards
     * @param {Array} progressionData - Chord progression
     * @param {string} key - Current key
     * @param {Object} options - Render options
     */
    render(container, progressionData, key, options = {}) {
        if (!container) {
            return;
        }

        const containerId = container.id || 'default';

        // Store context for re-rendering on mode change
        this._activeContexts.set(containerId, { container, progressionData, key, options });

        // Check if we should show indicators
        if (!this.shouldShowIndicators()) {
            // Remove any existing indicators when mode is not Explore
            this.remove(container);
            this._containerHashes.delete(containerId);
            return;
        }

        // Need at least 2 chords to show motion
        if (!progressionData || progressionData.length < 2) {
            this.remove(container);
            this._containerHashes.delete(containerId);
            return;
        }

        // Check hash to avoid unnecessary DOM operations
        // IMPORTANT: Check hash BEFORE removing to prevent flickering on duplicate calls
        const hash = this._generateHash(progressionData);
        const lastHash = this._containerHashes.get(containerId);

        // If hash is same AND indicators already exist, skip re-render
        const existingIndicators = container.querySelectorAll('.bass-motion-indicator-wrapper');
        if (hash === lastHash && existingIndicators.length > 0) {
            return; // No changes needed
        }

        // Remove existing indicators before inserting new ones
        this.remove(container);
        this._containerHashes.set(containerId, hash);

        // Find all chord card wrappers in the container
        const cardWrappers = container.querySelectorAll('.chord-card-wrapper[data-chord-index]');
        if (cardWrappers.length < 2) return;

        // Handle both sectioned and flat layouts
        // In sectioned layout: cards are inside .section-cards-area
        // In flat layout: cards are directly in the scroll container

        // Insert indicators between chord cards
        // For same-section cards: insert AFTER each card
        // For cross-section cards: insert BEFORE the first card of the new section
        cardWrappers.forEach((wrapper, idx) => {
            if (idx >= progressionData.length - 1) return; // Skip last card

            const chordIdx = parseInt(wrapper.getAttribute('data-chord-index'), 10);
            const nextWrapper = cardWrappers[idx + 1];
            if (!nextWrapper) return;

            const nextChordIdx = parseInt(nextWrapper.getAttribute('data-chord-index'), 10);

            // Get chord data
            const chord = progressionData[chordIdx];
            const nextChord = progressionData[nextChordIdx];

            if (!chord || !nextChord) return;

            // Calculate motion
            const motion = this.calculateBassMotion(chord, nextChord);

            // Create indicator element
            const indicator = document.createElement('div');
            indicator.className = 'bass-motion-indicator-wrapper';
            indicator.innerHTML = this._createIndicatorHTML(motion, idx);

            // Check if cards are in the same parent container (same section)
            const sameSection = wrapper.parentElement === nextWrapper.parentElement;

            if (sameSection) {
                // Same section: insert AFTER current card
                wrapper.insertAdjacentElement('afterend', indicator);
            } else {
                // Cross-section: insert BEFORE the first card of the new section
                // This keeps the indicator within the new section's boundary
                nextWrapper.insertAdjacentElement('beforebegin', indicator);
            }
        });
    }

    /**
     * Remove all bass motion indicators from a container
     * @param {HTMLElement} container - Container to remove from
     */
    remove(container) {
        if (!container) return;
        const indicators = container.querySelectorAll('.bass-motion-indicator-wrapper');
        indicators.forEach(ind => ind.remove());
    }

    /**
     * Force a re-render by clearing the cache
     * @param {HTMLElement} [container] - Specific container to invalidate, or all if not provided
     */
    invalidate(container) {
        if (container) {
            const containerId = container.id || 'default';
            this._containerHashes.delete(containerId);
        } else {
            this._containerHashes.clear();
        }
    }
}

// ===========================================
// SINGLETON & EXPORTS
// ===========================================

let instance = null;

/**
 * Get or create the BassMotionIndicators singleton
 * @returns {BassMotionIndicators}
 */
export function getBassMotionIndicators() {
    if (!instance) {
        instance = new BassMotionIndicators();
    }
    return instance;
}

/**
 * Convenience function to render bass motion indicators
 * @param {HTMLElement} container - Container with chord cards
 * @param {Array} progressionData - Chord progression
 * @param {string} key - Current key
 * @param {Object} options - Render options
 */
export function renderBassMotionIndicators(container, progressionData, key, options = {}) {
    getBassMotionIndicators().render(container, progressionData, key, options);
}

/**
 * Remove bass motion indicators from a container
 * @param {HTMLElement} container - Container to remove from
 */
export function removeBassMotionIndicators(container) {
    getBassMotionIndicators().remove(container);
}

/**
 * Check if bass motion indicators should be displayed
 * @returns {boolean}
 */
export function shouldShowBassMotionIndicators() {
    return getBassMotionIndicators().shouldShowIndicators();
}

// Export constants for external use
export { MOTION_TYPES };

export default BassMotionIndicators;
