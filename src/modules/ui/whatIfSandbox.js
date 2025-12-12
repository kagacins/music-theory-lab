/**
 * "What If" Sandbox Mode
 *
 * Per INTERACTIVE_LEARNING_PLAN.md Section 2.2:
 * Lets users experiment safely with explanations, transforming
 * their progression in various ways to learn how different
 * approaches affect the sound.
 *
 * Features:
 * - Transform progression to different moods (sad, jazzy, etc.)
 * - Show explanation of each transformation
 * - Preview before applying
 * - One-click apply or revert
 */

import { getChordNotes, getLHNotes } from '../utils/noteUtils.js';
import { getProgressionData, getCurrentKey, setProgressionData } from '../state/trainerState.js';
import { CHORD_DEFINITIONS } from '../../data/music-data.js';
import { getPiano } from '../audio/audioEngine.js';

// ===========================================
// STATE
// ===========================================

let originalProgression = null;
let isPlaying = false;

// ===========================================
// TRANSFORMATION DEFINITIONS
// ===========================================

/**
 * Available transformations with their logic and explanations
 */
const TRANSFORMATIONS = {
    makeItSad: {
        id: 'makeItSad',
        label: 'Make it sad',
        icon: '😢',
        explanation: 'Changing major chords to minor creates a melancholy, emotional feel.',
        transform: (progression, key) => {
            return progression.map(chord => {
                if (chord.type === 'Major') {
                    return {
                        ...chord,
                        type: 'Minor',
                        notes: getChordNotes(chord.root, 'Minor')?.specificNotes || chord.notes,
                        simpleName: `${chord.root}m`
                    };
                }
                return chord;
            });
        }
    },

    addJazzColor: {
        id: 'addJazzColor',
        label: 'Add jazz color',
        icon: '🎷',
        explanation: '7th chords add sophistication and complexity. This is the sound of jazz!',
        transform: (progression, key) => {
            return progression.map(chord => {
                let newType = chord.type;
                let newNotes = chord.notes;
                let newName = chord.simpleName;

                // Major → Major 7th
                if (chord.type === 'Major') {
                    newType = 'Major 7th';
                    newNotes = getChordNotes(chord.root, 'Major 7th')?.specificNotes || chord.notes;
                    newName = `${chord.root}maj7`;
                }
                // Minor → Minor 7th
                else if (chord.type === 'Minor') {
                    newType = 'Minor 7th';
                    newNotes = getChordNotes(chord.root, 'Minor 7th')?.specificNotes || chord.notes;
                    newName = `${chord.root}m7`;
                }
                // Dominant chords stay as Dominant 7th or become it
                else if (chord.type === 'Dominant 7th') {
                    // Already jazzy, keep it
                }

                return {
                    ...chord,
                    type: newType,
                    notes: newNotes,
                    simpleName: newName
                };
            });
        }
    },

    useBorrowedChords: {
        id: 'useBorrowedChords',
        label: 'Use borrowed chords',
        icon: '🎭',
        explanation: 'Borrowing from parallel minor adds unexpected emotional shifts. The ♭VI and ♭VII add drama!',
        transform: (progression, key) => {
            const keyRoot = key?.replace('m', '') || 'C';

            // Map of borrowed chord substitutions
            const borrowedMap = {
                'C': { 'F': 'Ab', 'G': 'Bb' },  // IV → ♭VI, V → ♭VII
                'G': { 'C': 'Eb', 'D': 'F' },
                'D': { 'G': 'Bb', 'A': 'C' },
                'A': { 'D': 'F', 'E': 'G' },
                'E': { 'A': 'C', 'B': 'D' },
                'F': { 'Bb': 'Db', 'C': 'Eb' }
            };

            const substitutions = borrowedMap[keyRoot] || {};

            return progression.map((chord, index) => {
                // Only substitute IV (at index 2 in common progressions) or some chords
                if (substitutions[chord.root] && (index === 2 || Math.random() > 0.6)) {
                    const newRoot = substitutions[chord.root];
                    return {
                        ...chord,
                        root: newRoot,
                        type: 'Major',
                        notes: getChordNotes(newRoot, 'Major')?.specificNotes || chord.notes,
                        simpleName: newRoot,
                        roman: chord.roman ? `♭${chord.roman}` : undefined
                    };
                }
                return chord;
            });
        }
    },

    moreDramatic: {
        id: 'moreDramatic',
        label: 'Make it more dramatic',
        icon: '🎬',
        explanation: 'Adding passing chords and extending the progression creates more tension and drama.',
        transform: (progression, key) => {
            const keyRoot = key?.replace('m', '') || 'C';

            // For simplicity, we'll add a ii chord before V chords
            const result = [];

            // Scale degree mappings
            const iiChords = {
                'C': 'D', 'G': 'A', 'D': 'E', 'A': 'B', 'E': 'F#', 'F': 'G', 'Bb': 'C'
            };

            for (let i = 0; i < progression.length; i++) {
                const chord = progression[i];
                const nextChord = progression[i + 1];

                // If this is going to V (dominant), add ii before it
                if (nextChord &&
                    (nextChord.roman === 'V' || nextChord.roman === 'V7') &&
                    chord.roman !== 'ii' && chord.roman !== 'ii7') {

                    result.push(chord);

                    // Insert ii chord
                    const iiRoot = iiChords[keyRoot] || 'D';
                    result.push({
                        root: iiRoot,
                        type: 'Minor',
                        notes: getChordNotes(iiRoot, 'Minor')?.specificNotes || [],
                        simpleName: `${iiRoot}m`,
                        roman: 'ii',
                        beats: 2 // Half the duration
                    });
                } else {
                    result.push(chord);
                }
            }

            return result;
        }
    },

    simplify: {
        id: 'simplify',
        label: 'Simplify',
        icon: '✨',
        explanation: 'Removing extensions and using basic triads creates a cleaner, more straightforward sound.',
        transform: (progression, key) => {
            return progression.map(chord => {
                let newType = chord.type;
                let newNotes = chord.notes;
                let newName = chord.simpleName;

                // Convert 7th chords back to triads
                if (chord.type.includes('7th') || chord.type.includes('7')) {
                    if (chord.type.includes('Minor') || chord.type.includes('m')) {
                        newType = 'Minor';
                        newNotes = getChordNotes(chord.root, 'Minor')?.specificNotes || chord.notes;
                        newName = `${chord.root}m`;
                    } else {
                        newType = 'Major';
                        newNotes = getChordNotes(chord.root, 'Major')?.specificNotes || chord.notes;
                        newName = chord.root;
                    }
                }
                // Convert 9th, 11th, 13th to 7ths
                else if (chord.type.includes('9') || chord.type.includes('11') || chord.type.includes('13')) {
                    if (chord.type.includes('Minor')) {
                        newType = 'Minor 7th';
                        newNotes = getChordNotes(chord.root, 'Minor 7th')?.specificNotes || chord.notes;
                        newName = `${chord.root}m7`;
                    } else {
                        newType = 'Dominant 7th';
                        newNotes = getChordNotes(chord.root, 'Dominant 7th')?.specificNotes || chord.notes;
                        newName = `${chord.root}7`;
                    }
                }

                return {
                    ...chord,
                    type: newType,
                    notes: newNotes,
                    simpleName: newName,
                    inversion: 0 // Reset inversions for simplicity
                };
            });
        }
    },

    addSuspense: {
        id: 'addSuspense',
        label: 'Add suspense',
        icon: '🎪',
        explanation: 'Suspended chords delay the resolution, creating anticipation and tension.',
        transform: (progression, key) => {
            return progression.map((chord, index) => {
                // Add sus4 to some major chords (not all, for variety)
                if (chord.type === 'Major' && index % 2 === 0) {
                    return {
                        ...chord,
                        type: 'Sus4',
                        notes: getChordNotes(chord.root, 'Sus4')?.specificNotes || chord.notes,
                        simpleName: `${chord.root}sus4`
                    };
                }
                return chord;
            });
        }
    }
};

// ===========================================
// AUDIO PLAYBACK
// ===========================================

/**
 * Play a progression
 */
async function playProgression(progression, chordDuration = 0.8) {
    if (isPlaying) return;
    isPlaying = true;

    try {
        const piano = getPiano ? getPiano() : (window.getPiano ? window.getPiano() : null);
        if (!piano || typeof Tone === 'undefined') {
            isPlaying = false;
            return;
        }

        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        const now = Tone.now();
        progression.forEach((chord, index) => {
            const notes = chord.notes || getChordNotes(chord.root, chord.type)?.specificNotes || [];
            if (notes.length > 0) {
                piano.triggerAttackRelease(notes, chordDuration * 0.9, now + (index * chordDuration));
            }
        });

        await new Promise(resolve => setTimeout(resolve, progression.length * chordDuration * 1000 + 200));
    } catch (err) {

    } finally {
        isPlaying = false;
    }
}

// ===========================================
// UI FUNCTIONS
// ===========================================

/**
 * Get chord display name with symbol
 */
function getChordDisplayName(root, type) {
    if (!root) return '';
    const def = CHORD_DEFINITIONS[type];
    const symbol = def?.symbol || '';
    return `${root}${symbol}`;
}

/**
 * Format progression for display
 */
function formatProgressionDisplay(progression) {
    return progression.map(c => c.simpleName || getChordDisplayName(c.root, c.type)).join(' → ');
}

/**
 * Show the What If Sandbox modal
 */
export function showWhatIfSandbox() {
    const progression = getProgressionData();
    const key = getCurrentKey() || 'C';

    if (!progression || progression.length === 0) {
        alert('Please add some chords to your progression first!');
        return;
    }

    // Store original for revert
    originalProgression = JSON.parse(JSON.stringify(progression));

    // Remove existing modal
    const existingModal = document.getElementById('whatif-sandbox-
    if (existingModal) existingModal.remove();
    const existingOverlay = document.getElementById('whatif-sandbox-
    if (existingOverlay) existingOverlay.remove();

    // Create modal
    const modal = document.createElement('
    modal.id = 'whatif-sandbox-modal';
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        max-width: 650px;
        width: 94%;
        max-height: 85vh;
        overflow: hidden;
        z-index: 200000;
        display: flex;
        flex-direction: column;
    `;

    const transformationCards = Object.values(TRANSFORMATIONS).map(t => `
        <div class="transform-card" data-id="${t.id}" style="background: white; padding: 16px; border-radius: 12px; border: 2px solid #e5e7eb; cursor: pointer; transition: all 0.2s;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <span style="font-size: 24px;">${t.icon}</span>
                <span style="font-size: 16px; font-weight: 600; color: #1f2937;">${t.label}</span>
            </div>
            <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin: 0;">
                💡 ${t.explanation}
            </p>
        </div>
    `).join('');

    modal.innerHTML = `
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px 24px;">
            <button id="whatif-close-btn" style="position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.2); border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; color: white; font-size: 24px; display: flex; align-items: center; justify-content: center;">×</button>
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <span style="font-size: 28px;">🧪</span>
                <h2 style="margin: 0; font-size: 22px; font-weight: 700;">What If Lab</h2>
            </div>
            <p style="margin: 0; font-size: 14px; opacity: 0.9;">
                Experiment with your progression! Click any transformation to preview it.
            </p>
        </div>

        <!-- Current Progression -->
        <div style="padding: 16px 24px; background: #fef3c7; border-bottom: 1px solid #fcd34d;">
            <div style="font-size: 13px; color: #92400e; font-weight: 500; margin-bottom: 4px;">Your progression:</div>
            <div id="whatif-current-display" style="font-size: 16px; font-weight: 600; color: #78350f; font-family: monospace;">
                ${formatProgressionDisplay(progression)}
            </div>
        </div>

        <!-- Transformations -->
        <div style="padding: 20px 24px; overflow-y: auto; flex: 1;">
            <div style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;">What if you...</div>
            <div id="transformations-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
                ${transformationCards}
            </div>
        </div>

        <!-- Preview Area (hidden initially) -->
        <div id="whatif-preview-area" style="display: none; padding: 20px 24px; background: #f0fdf4; border-top: 2px solid #86efac;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <div>
                    <div style="font-size: 13px; color: #166534; font-weight: 500;">Preview: <span id="preview-transform-name"></span></div>
                    <div id="whatif-preview-display" style="font-size: 16px; font-weight: 600; color: #15803d; font-family: monospace;"></div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button id="preview-play-btn" style="display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">
                        ▶ Preview
                    </button>
                    <button id="preview-apply-btn" style="display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: #22c55e; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">
                        ✓ Apply
                    </button>
                    <button id="preview-cancel-btn" style="padding: 10px 16px; background: #f3f4f6; color: #374151; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;

    // Create overlay
    const overlay = document.createElement('
    overlay.id = 'whatif-sandbox-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 199999;
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    // State for preview
    let currentPreview = null;
    let previewProgression = null;

    // Event handlers
    const closeModal = () => {
        modal.remove();
        overlay.remove();
    };

    document.getElementById('whatif-close-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    // Transformation card clicks
    modal.querySelectorAll('.transform-card').forEach(card => {
        card.addEventListener('click', () => {
            const transformId = card.dataset.id;
            const transform = TRANSFORMATIONS[transformId];
            if (!transform) return;

            // Apply transformation to preview
            previewProgression = transform.transform(
                JSON.parse(JSON.stringify(originalProgression)),
            currentPreview = transform;

            // Update preview area
            document.getElementById('preview-transform-name').textContent = transform.label;
            document.getElementById('whatif-preview-display').textContent = formatProgressionDisplay(previewProgression);
            document.getElementById('whatif-preview-area').style.display = 'block';

            // Highlight selected card
            modal.querySelectorAll('.transform-card').forEach(c => {
                c.style.borderColor = c === card ? '#22c55e' : '#e5e7eb';
                c.style.background = c === card ? '#f0fdf4' : 'white';
            });
        });

        // Hover effects
        card.addEventListener('mouseenter', () => {
            if (card.style.borderColor !== 'rgb(34, 197, 94)') {
                card.style.borderColor = '#f59e0b';
                card.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.15)';
            }
        });
        card.addEventListener('mouseleave', () => {
            if (card.style.borderColor !== 'rgb(34, 197, 94)') {
                card.style.borderColor = '#e5e7eb';
                card.style.boxShadow = 'none';
            }
        });
    });

    // Preview play button
    document.getElementById('preview-play-btn').addEventListener('click', async () => {
        if (previewProgression) {
            await playProgression(previewProgression, 0.7);
        }
    });

    // Apply button
    document.getElementById('preview-apply-btn').addEventListener('click', () => {
        if (previewProgression) {
            setProgressionData(previewProgression);

            // Trigger UI refresh
            if (window.renderProgressionDisplay) {
                window.renderProgressionDisplay();
            }

            // Dispatch event
            document.dispatchEvent(new CustomEvent('progression-changed', {
                detail: { action: 'transform', transform: currentPreview?.id }
            }));

            closeModal();
        }
    });

    // Cancel button
    document.getElementById('preview-cancel-btn').addEventListener('click', () => {
        document.getElementById('whatif-preview-area').style.display = 'none';
        previewProgression = null;
        currentPreview = null;

        // Reset card highlighting
        modal.querySelectorAll('.transform-card').forEach(c => {
            c.style.borderColor = '#e5e7eb';
            c.style.background = 'white';
        });
    });

    // Escape key to close
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// ===========================================
// EXPORTS
// ===========================================

export {
    TRANSFORMATIONS,
    playProgression
};
