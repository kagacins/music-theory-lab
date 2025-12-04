/**
 * Chord Comparison Modal (A/B Comparison Tool)
 *
 * Per INTERACTIVE_LEARNING_PLAN.md Section 2.1 "Hear the Difference":
 * Allows users to compare their current progression with alternatives,
 * hearing the difference and understanding why each option works.
 *
 * Features:
 * - Compare current chord with alternatives
 * - Play each option to hear the difference
 * - Show explanation of why each alternative works
 * - Apply alternative with one click
 */

import { getChordNotes, getLHNotes } from '../utils/noteUtils.js';
import { getProgressionData, getCurrentKey, setProgressionData } from '../state/trainerState.js';
import { CHORD_DEFINITIONS } from '../../data/music-data.js';
import { getChordFunction, getTransition } from '../../data/theoryExplanations/chordFunctions.js';
import { getPiano } from '../audio/audioEngine.js';

// ===========================================
// STATE
// ===========================================

let currentComparisonIndex = null;
let isPlaying = false;

// ===========================================
// CHORD ALTERNATIVES DATABASE
// ===========================================

/**
 * Get alternative chords for a given position in the progression
 * Based on the previous chord and current chord context
 */
function getChordAlternatives(chordIndex, progression, key) {
    if (!progression || chordIndex < 0 || chordIndex >= progression.length) {
        return [];
    }

    const currentChord = progression[chordIndex];
    const prevChord = chordIndex > 0 ? progression[chordIndex - 1] : null;
    const nextChord = chordIndex < progression.length - 1 ? progression[chordIndex + 1] : null;

    const keyRoot = key?.replace('m', '') || 'C';
    const isMinorKey = key?.includes('m');

    // Scale degree mappings for common keys
    const majorScaleDegrees = {
        'C': { I: 'C', ii: 'D', iii: 'E', IV: 'F', V: 'G', vi: 'A', vii: 'B' },
        'G': { I: 'G', ii: 'A', iii: 'B', IV: 'C', V: 'D', vi: 'E', vii: 'F#' },
        'D': { I: 'D', ii: 'E', iii: 'F#', IV: 'G', V: 'A', vi: 'B', vii: 'C#' },
        'A': { I: 'A', ii: 'B', iii: 'C#', IV: 'D', V: 'E', vi: 'F#', vii: 'G#' },
        'E': { I: 'E', ii: 'F#', iii: 'G#', IV: 'A', V: 'B', vi: 'C#', vii: 'D#' },
        'F': { I: 'F', ii: 'G', iii: 'A', IV: 'Bb', V: 'C', vi: 'D', vii: 'E' },
        'Bb': { I: 'Bb', ii: 'C', iii: 'D', IV: 'Eb', V: 'F', vi: 'G', vii: 'A' }
    };

    const degrees = majorScaleDegrees[keyRoot] || majorScaleDegrees['C'];
    const alternatives = [];

    // Get current chord's roman numeral
    const currentRoman = currentChord.roman || '';
    const baseRoman = currentRoman.replace(/[0-9majø°]+$/gi, '');

    // Generate alternatives based on current chord function
    if (baseRoman === 'I' || baseRoman === 'i') {
        // Alternatives to tonic
        alternatives.push({
            numeral: 'vi',
            root: degrees.vi,
            type: 'Minor',
            explanation: 'The relative minor shares two notes with I, adding emotional depth while maintaining stability.',
            feeling: 'Bittersweet, emotional'
        });
        alternatives.push({
            numeral: 'iii',
            root: degrees.iii,
            type: 'Minor',
            explanation: 'The mediant creates a dreamy, floating quality - less stable but more mysterious.',
            feeling: 'Dreamy, mysterious'
        });
        alternatives.push({
            numeral: 'Imaj7',
            root: degrees.I,
            type: 'Major 7th',
            explanation: 'Adding the major 7th creates a sophisticated, jazzy home base.',
            feeling: 'Sophisticated, elegant'
        });
    }
    else if (baseRoman === 'V' || baseRoman === 'v') {
        // Alternatives to dominant
        alternatives.push({
            numeral: 'V7',
            root: degrees.V,
            type: 'Dominant 7th',
            explanation: 'Adding the 7th creates a tritone that pulls even harder toward resolution.',
            feeling: 'More tension, stronger pull'
        });
        alternatives.push({
            numeral: 'vii°',
            root: degrees.vii,
            type: 'Diminished',
            explanation: 'The diminished chord shares the same tritone as V7, creating intense tension.',
            feeling: 'Dark, dramatic tension'
        });
        alternatives.push({
            numeral: 'iii',
            root: degrees.iii,
            type: 'Minor',
            explanation: 'A much weaker pull - creates surprise by avoiding strong resolution.',
            feeling: 'Unexpected, floating'
        });
    }
    else if (baseRoman === 'IV') {
        // Alternatives to subdominant
        alternatives.push({
            numeral: 'ii',
            root: degrees.ii,
            type: 'Minor',
            explanation: 'The ii chord shares subdominant function but leads more smoothly to V.',
            feeling: 'Smoother, more sophisticated'
        });
        alternatives.push({
            numeral: 'ii7',
            root: degrees.ii,
            type: 'Minor 7th',
            explanation: 'The jazz bridge chord - creates the classic ii-V-I progression.',
            feeling: 'Jazzy, sophisticated'
        });
        alternatives.push({
            numeral: 'iv',
            root: degrees.IV,
            type: 'Minor',
            explanation: 'Borrowing from parallel minor adds unexpected emotional weight.',
            feeling: 'Dark, emotional, borrowed'
        });
        alternatives.push({
            numeral: 'IVmaj7',
            root: degrees.IV,
            type: 'Major 7th',
            explanation: 'The major 7th adds elegance while maintaining the journeying quality.',
            feeling: 'Elegant, dreamy'
        });
    }
    else if (baseRoman === 'ii') {
        // Alternatives to supertonic
        alternatives.push({
            numeral: 'IV',
            root: degrees.IV,
            type: 'Major',
            explanation: 'The IV chord is brighter and more open than ii, with similar function.',
            feeling: 'Brighter, more open'
        });
        alternatives.push({
            numeral: 'ii7',
            root: degrees.ii,
            type: 'Minor 7th',
            explanation: 'Adding the 7th creates smoother voice leading to V7.',
            feeling: 'Smoother, jazzier'
        });
    }
    else if (baseRoman === 'vi') {
        // Alternatives to submediant
        alternatives.push({
            numeral: 'IV',
            root: degrees.IV,
            type: 'Major',
            explanation: 'Moving to IV instead creates a brighter, more hopeful feel.',
            feeling: 'Brighter, hopeful'
        });
        alternatives.push({
            numeral: 'ii',
            root: degrees.ii,
            type: 'Minor',
            explanation: 'The ii chord continues minor quality but leads better toward V.',
            feeling: 'Forward motion, building'
        });
        alternatives.push({
            numeral: 'vi7',
            root: degrees.vi,
            type: 'Minor 7th',
            explanation: 'Adding the 7th creates depth for jazz and R&B progressions.',
            feeling: 'Deeper, more soulful'
        });
    }

    // Add context-specific alternatives based on previous chord
    if (prevChord) {
        const prevRoman = prevChord.roman || '';
        const prevBase = prevRoman.replace(/[0-9majø°]+$/gi, '');

        // If coming from V, suggest deceptive resolutions
        if (prevBase === 'V' || prevBase === 'v') {
            if (baseRoman !== 'vi') {
                alternatives.push({
                    numeral: 'vi',
                    root: degrees.vi,
                    type: 'Minor',
                    explanation: 'The deceptive cadence - you expect I but get vi. Emotional and surprising!',
                    feeling: 'Surprise, emotional continuation'
                });
            }
            if (baseRoman !== 'IV') {
                alternatives.push({
                    numeral: 'IV',
                    root: degrees.IV,
                    type: 'Major',
                    explanation: 'V to IV (retrogression) creates an unexpected but effective twist.',
                    feeling: 'Unexpected, rock-influenced'
                });
            }
        }
    }

    // Remove duplicates and the current chord
    const seen = new Set();
    return alternatives.filter(alt => {
        const key = `${alt.numeral}-${alt.root}-${alt.type}`;
        if (seen.has(key)) return false;
        if (alt.root === currentChord.root && alt.type === currentChord.type) return false;
        seen.add(key);
        return true;
    }).slice(0, 4); // Limit to 4 alternatives
}

// ===========================================
// AUDIO PLAYBACK
// ===========================================

/**
 * Play a sequence of chords
 */
async function playChordSequence(chords, chordDuration = 0.8) {
    if (isPlaying) return;
    isPlaying = true;

    try {
        const piano = getPiano ? getPiano() : (window.getPiano ? window.getPiano() : null);
        if (!piano || typeof Tone === 'undefined') {
            console.warn('[ChordComparison] Piano or Tone.js not available');
            isPlaying = false;
            return;
        }

        // Ensure audio context is started
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        const now = Tone.now();
        chords.forEach((chord, index) => {
            const chordInfo = getChordNotes(chord.root, chord.type);
            const notes = chordInfo?.specificNotes || [];
            if (notes.length > 0) {
                piano.triggerAttackRelease(notes, chordDuration * 0.9, now + (index * chordDuration));
            }
        });

        // Wait for sequence to finish
        await new Promise(resolve => setTimeout(resolve, chords.length * chordDuration * 1000 + 200));
    } catch (err) {
        console.error('[ChordComparison] Error playing sequence:', err);
    } finally {
        isPlaying = false;
    }
}

/**
 * Play a single chord
 */
async function playChord(root, type, duration = 1.2) {
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

        const chordInfo = getChordNotes(root, type);
        const notes = chordInfo?.specificNotes || [];
        if (notes.length > 0) {
            piano.triggerAttackRelease(notes, duration);
        }

        await new Promise(resolve => setTimeout(resolve, duration * 1000 + 100));
    } catch (err) {
        console.error('[ChordComparison] Error playing chord:', err);
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
 * Get function color for display
 */
function getFunctionColor(func) {
    const colors = {
        'Tonic': '#10b981',      // emerald-500
        'Dominant': '#ef4444',    // red-500
        'Subdominant': '#3b82f6', // blue-500
        'Borrowed': '#8b5cf6'     // purple-500
    };
    return colors[func] || '#6b7280';
}

/**
 * Show the chord comparison modal
 * @param {number} chordIndex - Index of chord to compare
 */
export function showChordComparisonModal(chordIndex) {
    const progression = getProgressionData();
    const key = getCurrentKey() || 'C';

    if (!progression || chordIndex < 0 || chordIndex >= progression.length) {
        console.warn('[ChordComparison] Invalid chord index:', chordIndex);
        return;
    }

    currentComparisonIndex = chordIndex;
    const currentChord = progression[chordIndex];
    const prevChord = chordIndex > 0 ? progression[chordIndex - 1] : null;
    const alternatives = getChordAlternatives(chordIndex, progression, key);

    // Remove existing modal
    const existingModal = document.getElementById('chord-comparison-modal');
    if (existingModal) existingModal.remove();
    const existingOverlay = document.getElementById('chord-comparison-overlay');
    if (existingOverlay) existingOverlay.remove();

    // Build progression context display
    const contextChords = [];
    if (prevChord) contextChords.push(prevChord);
    contextChords.push(currentChord);

    const contextDisplay = contextChords.map((c, i) => {
        const isTarget = i === contextChords.length - 1;
        const display = getChordDisplayName(c.root, c.type);
        return `<span class="${isTarget ? 'font-bold text-indigo-600' : 'text-gray-600'}">${display}</span>`;
    }).join(' → ');

    // Create modal HTML
    const modal = document.createElement('div');
    modal.id = 'chord-comparison-modal';
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        max-width: 600px;
        width: 94%;
        max-height: 85vh;
        overflow: hidden;
        z-index: 200000;
        display: flex;
        flex-direction: column;
    `;

    modal.innerHTML = `
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 20px 24px;">
            <button id="comparison-close-btn" style="position: absolute; top: 12px; right: 12px; background: rgba(255,255,255,0.2); border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; color: white; font-size: 24px; display: flex; align-items: center; justify-content: center;">×</button>
            <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700;">Compare Options</h2>
            <div style="font-size: 14px; opacity: 0.9;">
                Current: ${contextDisplay}
            </div>
        </div>

        <!-- Content -->
        <div style="padding: 20px 24px; overflow-y: auto; flex: 1;">
            <!-- Current Chord -->
            <div style="background: #f0fdf4; padding: 16px; border-radius: 12px; margin-bottom: 20px; border: 2px solid #86efac;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <div>
                        <div style="font-size: 18px; font-weight: 700; color: #166534;">
                            ${getChordDisplayName(currentChord.root, currentChord.type)}
                        </div>
                        <div style="font-size: 13px; color: #15803d;">Your current choice</div>
                    </div>
                    <button id="play-current-btn" style="display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: #22c55e; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500;">
                        <span>▶</span> Play current
                    </button>
                </div>
            </div>

            <!-- Divider -->
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                <div style="flex: 1; height: 1px; background: #e5e7eb;"></div>
                <span style="color: #6b7280; font-size: 13px; font-weight: 500;">Alternatives</span>
                <div style="flex: 1; height: 1px; background: #e5e7eb;"></div>
            </div>

            <!-- Alternatives -->
            <div id="alternatives-container" style="display: flex; flex-direction: column; gap: 12px;">
                ${alternatives.length > 0 ? alternatives.map((alt, idx) => `
                    <div class="alternative-card" data-idx="${idx}" style="background: white; padding: 16px; border-radius: 12px; border: 2px solid #e5e7eb; transition: all 0.2s;">
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                    <span style="font-size: 17px; font-weight: 700; color: #1f2937;">${getChordDisplayName(alt.root, alt.type)}</span>
                                    <span style="font-size: 12px; padding: 2px 8px; background: #f3f4f6; border-radius: 4px; color: #6b7280; font-weight: 500;">${alt.numeral}</span>
                                </div>
                                <p style="font-size: 13px; color: #4b5563; line-height: 1.5; margin: 0 0 8px 0;">
                                    💡 ${alt.explanation}
                                </p>
                                <div style="font-size: 12px; color: #9ca3af; font-style: italic;">
                                    Feeling: ${alt.feeling}
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <button class="play-alt-btn" data-idx="${idx}" style="display: flex; align-items: center; gap: 4px; padding: 8px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; white-space: nowrap;">
                                    ▶ Play this
                                </button>
                                <button class="apply-alt-btn" data-idx="${idx}" style="display: flex; align-items: center; gap: 4px; padding: 8px 12px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; white-space: nowrap;">
                                    ✓ Apply
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('') : `
                    <div style="text-align: center; padding: 32px; color: #6b7280;">
                        <svg style="width: 48px; height: 48px; margin: 0 auto 12px; opacity: 0.5;" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path>
                        </svg>
                        <p>No alternatives available for this chord position.</p>
                    </div>
                `}
            </div>
        </div>
    `;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'chord-comparison-overlay';
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

    // Store alternatives for event handlers
    modal._alternatives = alternatives;
    modal._currentChord = currentChord;
    modal._prevChord = prevChord;

    // Event handlers
    const closeModal = () => {
        modal.remove();
        overlay.remove();
    };

    document.getElementById('comparison-close-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    // Play current chord
    document.getElementById('play-current-btn').addEventListener('click', async () => {
        const chords = [];
        if (prevChord) chords.push({ root: prevChord.root, type: prevChord.type });
        chords.push({ root: currentChord.root, type: currentChord.type });
        await playChordSequence(chords, 0.9);
    });

    // Play alternative buttons
    modal.querySelectorAll('.play-alt-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx);
            const alt = alternatives[idx];
            if (!alt) return;

            const chords = [];
            if (prevChord) chords.push({ root: prevChord.root, type: prevChord.type });
            chords.push({ root: alt.root, type: alt.type });
            await playChordSequence(chords, 0.9);
        });
    });

    // Apply alternative buttons
    modal.querySelectorAll('.apply-alt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx);
            const alt = alternatives[idx];
            if (!alt) return;

            // Apply the alternative chord
            applyAlternativeChord(chordIndex, alt);
            closeModal();
        });
    });

    // Hover effects on cards
    modal.querySelectorAll('.alternative-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.borderColor = '#3b82f6';
            card.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.borderColor = '#e5e7eb';
            card.style.boxShadow = 'none';
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

/**
 * Apply an alternative chord to the progression
 */
function applyAlternativeChord(index, alternative) {
    const progression = getProgressionData();
    if (!progression || index < 0 || index >= progression.length) return;

    // Get current chord to preserve some properties
    const currentChord = progression[index];

    // Create new chord based on alternative
    const newChord = {
        ...currentChord,
        root: alternative.root,
        type: alternative.type,
        roman: alternative.numeral,
        simpleName: getChordDisplayName(alternative.root, alternative.type),
        inversion: 0, // Reset inversion for new chord
        notes: getChordNotes(alternative.root, alternative.type)?.specificNotes || []
    };

    // Update progression
    progression[index] = newChord;
    setProgressionData([...progression]);

    // Trigger UI refresh
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }

    // Dispatch event for other components
    document.dispatchEvent(new CustomEvent('progression-changed', {
        detail: { action: 'replace', index, chord: newChord }
    }));
}

// ===========================================
// EXPORTS
// ===========================================

export {
    getChordAlternatives,
    playChordSequence,
    playChord
};
