/**
 * Interactive Tutorial System
 *
 * Provides guided, hands-on learning experiences that integrate lessons
 * with interactive tools like the keyboard, chord builder, etc.
 *
 * Features:
 * - Spotlight overlays that highlight UI elements
 * - Step-by-step guided walkthroughs
 * - Real-time validation of user actions
 * - Embedded mini-keyboard within lessons
 * - Progress feedback (success/error messages)
 */

import { getPiano, getAudioIsReady } from '../audio/audioEngine.js';
import { getNoteKeyId, getChordNotes } from '../utils/noteUtils.js';
import { startGuidedMode, endGuidedMode } from './lessonGuidedMode.js';

// ===========================================
// STATE
// ===========================================

let currentTutorial = null;
let currentStepIndex = 0;
let tutorialOverlay = null;
let miniKeyboardContainer = null;
let stepValidationCallback = null;
let isAwaitingAction = false;
let tutorialContainerRef = null; // Store reference to the tutorial container

// Track user actions for validation
let lastPlayedNote = null;
let lastPlayedNotes = [];
let lastSelectedRoot = null;
let lastSelectedChordType = null;

// Enharmonic equivalents map for note comparison
const ENHARMONIC_MAP = {
    'C#': 'Db', 'Db': 'C#',
    'D#': 'Eb', 'Eb': 'D#',
    'F#': 'Gb', 'Gb': 'F#',
    'G#': 'Ab', 'Ab': 'G#',
    'A#': 'Bb', 'Bb': 'A#'
};

/**
 * Check if two notes are enharmonically equivalent (same pitch)
 * @param {string} note1 - First note (e.g., "D#4" or "Eb4")
 * @param {string} note2 - Second note
 * @returns {boolean} True if notes are the same pitch
 */
function areNotesEnharmonicEqual(note1, note2) {
    if (!note1 || !note2) return false;
    if (note1 === note2) return true;

    // Extract base note and octave
    const base1 = note1.replace(/[0-9]/g, '');
    const octave1 = note1.replace(/[^0-9]/g, '');
    const base2 = note2.replace(/[0-9]/g, '');
    const octave2 = note2.replace(/[^0-9]/g, '');

    // Octaves must match
    if (octave1 !== octave2) return false;

    // Check direct match or enharmonic equivalent
    return base1 === base2 || ENHARMONIC_MAP[base1] === base2;
}

/**
 * Check if a note is in an array (with enharmonic equivalence)
 * @param {string} note - Note to find (e.g., "D#4")
 * @param {Array<string>} noteArray - Array of notes to search
 * @returns {boolean} True if note (or its enharmonic equivalent) is in the array
 */
function isNoteInArray(note, noteArray) {
    if (!note || !noteArray || noteArray.length === 0) return false;
    return noteArray.some(arrayNote => areNotesEnharmonicEqual(note, arrayNote));
}

// ===========================================
// TUTORIAL STEP TYPES
// ===========================================

/**
 * Tutorial step configuration
 *
 * Types:
 * - 'info': Display information with continue button
 * - 'play_note': Wait for user to play specific note on mini-keyboard
 * - 'play_notes': Wait for user to play sequence of notes
 * - 'spotlight_click': Highlight element and wait for click
 * - 'builder_action': Guide user through chord builder
 * - 'free_explore': Let user play freely with validation
 */

// ===========================================
// MINI-KEYBOARD FOR LESSONS
// ===========================================

/**
 * Create an embedded mini-keyboard for use within lessons
 * @param {HTMLElement} container - Container to render keyboard into
 * @param {Object} options - Configuration options
 */
export function createMiniKeyboard(container, options = {}) {
    const {
        octaves = 2,
        startNote = 'C4',
        highlightNotes = [],
        onNotePlay = null,
        showLabels = true,
        targetNotes = [],
        allowAnyNote = true,
        height = 140 // Taller for better playability
    } = options;

    // Parse starting MIDI note
    const startMidi = Tone.Frequency(startNote).toMidi();
    const totalKeys = octaves * 12 + 1;

    // Create keyboard container with modern styling matching the main keyboard
    const keyboardEl = document.createElement('div');
    keyboardEl.className = 'mini-keyboard modern-keyboard';
    keyboardEl.style.cssText = `
        position: relative;
        display: flex;
        height: ${height}px;
        border: 2px solid rgba(0, 0, 0, 0.15);
        border-radius: 12px;
        box-shadow:
            inset 0 2px 8px rgba(0, 0, 0, 0.1),
            0 8px 32px rgba(0, 0, 0, 0.15),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
        background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
        user-select: none;
        touch-action: none;
        overflow: hidden;
    `;

    const keys = [];
    let whiteKeyCount = 0;

    // First pass: count white keys
    for (let i = 0; i < totalKeys; i++) {
        const midi = startMidi + i;
        const noteName = Tone.Midi(midi).toNote();
        const isBlack = noteName.includes('#');
        if (!isBlack) whiteKeyCount++;
    }

    const whiteKeyWidth = 100 / whiteKeyCount;
    const blackKeyWidth = whiteKeyWidth * 0.65;

    // Create keys
    let currentWhiteIndex = 0;
    for (let i = 0; i < totalKeys; i++) {
        const midi = startMidi + i;
        const noteName = Tone.Midi(midi).toNote();
        const baseName = noteName.replace(/[0-9]/g, '');
        const isBlack = noteName.includes('#');

        const keyEl = document.createElement('div');
        keyEl.dataset.note = noteName;
        keyEl.dataset.midi = midi;

        const isTarget = isNoteInArray(noteName, targetNotes);
        const isHighlighted = isNoteInArray(noteName, highlightNotes);

        if (isBlack) {
            // Modern black key styling
            keyEl.className = `mini-key mini-black-key ${isTarget ? 'target-key' : ''} ${isHighlighted ? 'highlighted-key' : ''}`;
            keyEl.style.cssText = `
                position: absolute;
                width: ${blackKeyWidth}%;
                height: 60%;
                left: ${(currentWhiteIndex * whiteKeyWidth) - (blackKeyWidth / 2)}%;
                background: ${isHighlighted
                    ? 'linear-gradient(180deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%)'
                    : 'linear-gradient(180deg, #1a1a1a 0%, #000000 50%, #0a0a0a 100%)'};
                border: 1px solid rgba(0, 0, 0, 0.8);
                border-top: 1px solid rgba(100, 100, 100, 0.3);
                border-radius: 0 0 6px 6px;
                z-index: 2;
                cursor: pointer;
                box-shadow:
                    inset 0 1px 0 rgba(255, 255, 255, 0.1),
                    inset 0 -2px 4px rgba(0, 0, 0, 0.8),
                    0 4px 8px rgba(0, 0, 0, 0.4),
                    0 2px 4px rgba(0, 0, 0, 0.3);
                transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
                ${isTarget ? 'box-shadow: inset 0 0 0 2px #fbbf24, 0 4px 8px rgba(0, 0, 0, 0.4);' : ''}
            `;
        } else {
            // Modern white key styling
            keyEl.className = `mini-key mini-white-key ${isTarget ? 'target-key' : ''} ${isHighlighted ? 'highlighted-key' : ''}`;
            keyEl.style.cssText = `
                position: relative;
                width: ${whiteKeyWidth}%;
                height: 100%;
                flex-shrink: 0;
                background: ${isHighlighted
                    ? 'linear-gradient(180deg, #c7d2fe 0%, #a5b4fc 50%, #818cf8 100%)'
                    : 'linear-gradient(180deg, #ffffff 0%, #f8f9fa 50%, #f1f3f5 100%)'};
                border: 1px solid rgba(0, 0, 0, 0.1);
                border-top: 2px solid rgba(255, 255, 255, 0.8);
                border-bottom: 1px solid rgba(0, 0, 0, 0.2);
                border-radius: 0 0 8px 8px;
                z-index: 1;
                cursor: pointer;
                box-shadow:
                    inset 0 1px 0 rgba(255, 255, 255, 0.9),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.05),
                    0 2px 4px rgba(0, 0, 0, 0.1),
                    0 1px 2px rgba(0, 0, 0, 0.05);
                transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
                display: flex;
                align-items: flex-end;
                justify-content: center;
                padding-bottom: 6px;
                ${isTarget ? 'box-shadow: inset 0 0 0 2px #fbbf24, 0 2px 4px rgba(0, 0, 0, 0.1);' : ''}
            `;

            // Add label for C notes
            if (showLabels && baseName === 'C') {
                const label = document.createElement('span');
                label.style.cssText = `
                    font-size: 11px;
                    font-weight: 600;
                    color: ${isHighlighted ? '#3730a3' : '#6b7280'};
                    pointer-events: none;
                `;
                label.textContent = noteName;
                keyEl.appendChild(label);
            }

            currentWhiteIndex++;
        }

        // Store original styles for reset
        const originalBg = keyEl.style.background;
        const originalTransform = keyEl.style.transform;

        // Event handlers
        const playNote = async (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Visual feedback - pressed state
            if (isBlack) {
                keyEl.style.background = 'linear-gradient(180deg, #4f46e5 0%, #4338ca 50%, #3730a3 100%)';
                keyEl.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.9), 0 1px 2px rgba(0, 0, 0, 0.3)';
            } else {
                keyEl.style.background = 'linear-gradient(180deg, #a5b4fc 0%, #818cf8 50%, #6366f1 100%)';
                keyEl.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.1)';
            }

            // Play audio
            const piano = getPiano ? getPiano() : (window.getPiano ? window.getPiano() : null);
            if (piano && typeof Tone !== 'undefined') {
                if (Tone.context.state !== 'running') {
                    await Tone.start();
                }
                piano.triggerAttackRelease(noteName, '8n');
            }

            // Track the played note
            lastPlayedNote = noteName;
            lastPlayedNotes.push(noteName);

            // Callback
            if (onNotePlay) {
                onNotePlay(noteName, baseName, midi);
            }

            // Check if this is a target note
            if (isTarget && stepValidationCallback) {
                stepValidationCallback({ type: 'note_played', note: noteName, baseName });
            }

            // Reset visual after delay
            setTimeout(() => {
                keyEl.style.background = originalBg;
                if (isBlack) {
                    keyEl.style.boxShadow = isTarget
                        ? 'inset 0 0 0 2px #fbbf24, 0 4px 8px rgba(0, 0, 0, 0.4)'
                        : 'inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 -2px 4px rgba(0, 0, 0, 0.8), 0 4px 8px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)';
                } else {
                    keyEl.style.boxShadow = isTarget
                        ? 'inset 0 0 0 2px #fbbf24, 0 2px 4px rgba(0, 0, 0, 0.1)'
                        : 'inset 0 1px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 0 rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05)';
                }
            }, 150);
        };

        keyEl.addEventListener('mousedown', playNote);
        keyEl.addEventListener('touchstart', playNote, { passive: false });

        keyboardEl.appendChild(keyEl);
        keys.push({ element: keyEl, noteName, baseName, isBlack, originalBg });
    }

    container.innerHTML = '';
    container.appendChild(keyboardEl);

    miniKeyboardContainer = container;

    return {
        element: keyboardEl,
        keys,
        highlightNote: (note, color = '#fbbf24') => {
            keys.forEach(k => {
                if (k.noteName === note || k.baseName === note) {
                    k.element.style.boxShadow = `inset 0 0 0 3px ${color}`;
                }
            });
        },
        clearHighlights: () => {
            keys.forEach(k => {
                k.element.style.boxShadow = '';
            });
        },
        destroy: () => {
            container.innerHTML = '';
            miniKeyboardContainer = null;
        }
    };
}

// ===========================================
// SPOTLIGHT OVERLAY SYSTEM
// ===========================================

/**
 * Create a spotlight overlay that highlights a specific element
 * @param {HTMLElement|string} target - Element or selector to spotlight
 * @param {Object} options - Configuration options
 */
export function createSpotlight(target, options = {}) {
    const {
        message = '',
        position = 'bottom', // top, bottom, left, right
        showArrow = true,
        onNext = null,
        onSkip = null,
        allowClickThrough = false,
        pulseTarget = true
    } = options;

    // Get target element
    const targetEl = typeof target === 'string' ? document.querySelector(target) : target;
    if (!targetEl) {
        console.warn('[Tutorial] Target element not found:', target);
        return null;
    }

    // Remove existing spotlight
    removeSpotlight();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'tutorial-spotlight-overlay';
    overlay.className = 'fixed inset-0 z-[99998] pointer-events-none';
    overlay.style.cssText = `
        background: rgba(0, 0, 0, 0.7);
        transition: opacity 0.3s ease;
    `;

    // Get target bounds
    const rect = targetEl.getBoundingClientRect();
    const padding = 8;

    // Create spotlight cutout using clip-path
    const cutoutLeft = rect.left - padding;
    const cutoutTop = rect.top - padding;
    const cutoutRight = rect.right + padding;
    const cutoutBottom = rect.bottom + padding;

    overlay.style.clipPath = `polygon(
        0% 0%,
        0% 100%,
        ${cutoutLeft}px 100%,
        ${cutoutLeft}px ${cutoutTop}px,
        ${cutoutRight}px ${cutoutTop}px,
        ${cutoutRight}px ${cutoutBottom}px,
        ${cutoutLeft}px ${cutoutBottom}px,
        ${cutoutLeft}px 100%,
        100% 100%,
        100% 0%
    )`;

    // Add pulse effect to target
    if (pulseTarget) {
        targetEl.classList.add('tutorial-spotlight-pulse');
    }

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'fixed z-[99999] bg-white rounded-xl shadow-2xl p-4 max-w-sm pointer-events-auto';
    tooltip.style.cssText = `
        animation: tutorialFadeIn 0.3s ease;
    `;

    // Position tooltip
    const tooltipMargin = 16;
    switch (position) {
        case 'top':
            tooltip.style.left = `${rect.left + rect.width / 2}px`;
            tooltip.style.bottom = `${window.innerHeight - rect.top + tooltipMargin}px`;
            tooltip.style.transform = 'translateX(-50%)';
            break;
        case 'bottom':
            tooltip.style.left = `${rect.left + rect.width / 2}px`;
            tooltip.style.top = `${rect.bottom + tooltipMargin}px`;
            tooltip.style.transform = 'translateX(-50%)';
            break;
        case 'left':
            tooltip.style.right = `${window.innerWidth - rect.left + tooltipMargin}px`;
            tooltip.style.top = `${rect.top + rect.height / 2}px`;
            tooltip.style.transform = 'translateY(-50%)';
            break;
        case 'right':
            tooltip.style.left = `${rect.right + tooltipMargin}px`;
            tooltip.style.top = `${rect.top + rect.height / 2}px`;
            tooltip.style.transform = 'translateY(-50%)';
            break;
    }

    tooltip.innerHTML = `
        <div class="flex items-start gap-3">
            ${showArrow ? `
                <div class="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                    <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                    </svg>
                </div>
            ` : ''}
            <div class="flex-1">
                <p class="text-gray-800 font-medium leading-relaxed">${message}</p>
            </div>
        </div>
        <div class="flex justify-between items-center mt-4 pt-3 border-t border-gray-200">
            ${onSkip ? `
                <button class="tutorial-skip-btn text-sm text-gray-500 hover:text-gray-700 transition">
                    Skip Tutorial
                </button>
            ` : '<div></div>'}
            ${onNext ? `
                <button class="tutorial-next-btn px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition shadow-md">
                    Got it!
                </button>
            ` : ''}
        </div>
    `;

    // Make target clickable if allowed
    if (allowClickThrough) {
        overlay.style.pointerEvents = 'none';
    } else {
        // Add click handler to overlay to prevent accidental clicks
        overlay.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    }

    // Button handlers
    tooltip.querySelector('.tutorial-next-btn')?.addEventListener('click', () => {
        removeSpotlight();
        if (onNext) onNext();
    });

    tooltip.querySelector('.tutorial-skip-btn')?.addEventListener('click', () => {
        removeSpotlight();
        if (onSkip) onSkip();
    });

    document.body.appendChild(overlay);
    document.body.appendChild(tooltip);
    tutorialOverlay = { overlay, tooltip, targetEl };

    // Scroll target into view if needed
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    return {
        remove: removeSpotlight,
        updateMessage: (newMessage) => {
            const msgEl = tooltip.querySelector('p');
            if (msgEl) msgEl.textContent = newMessage;
        }
    };
}

/**
 * Remove the current spotlight overlay
 */
export function removeSpotlight() {
    if (tutorialOverlay) {
        tutorialOverlay.targetEl?.classList.remove('tutorial-spotlight-pulse');
        tutorialOverlay.overlay?.remove();
        tutorialOverlay.tooltip?.remove();
        tutorialOverlay = null;
    }
    // Also remove any lingering overlays
    document.getElementById('tutorial-spotlight-overlay')?.remove();
    document.querySelectorAll('.tutorial-spotlight-tooltip').forEach(el => el.remove());
}

// ===========================================
// TUTORIAL RUNNER
// ===========================================

/**
 * Define a tutorial with steps
 * @param {Object} config - Tutorial configuration
 */
export function defineTutorial(config) {
    return {
        id: config.id,
        title: config.title,
        lessonId: config.lessonId,
        steps: config.steps,
        onComplete: config.onComplete || (() => {}),
        onSkip: config.onSkip || (() => {})
    };
}

/**
 * Start a tutorial
 * @param {Object} tutorial - Tutorial configuration
 * @param {HTMLElement} container - Container element for embedded content
 */
export async function startTutorial(tutorial, container) {
    currentTutorial = tutorial;
    currentStepIndex = 0;
    lastPlayedNotes = [];
    isAwaitingAction = true;
    tutorialContainerRef = container; // Store reference

    await runStep(tutorial.steps[0], container);
}

/**
 * Run a single tutorial step
 */
async function runStep(step, container) {
    if (!step) {
        completeTutorial();
        return;
    }

    switch (step.type) {
        case 'info':
            await runInfoStep(step, container);
            break;
        case 'play_note':
            await runPlayNoteStep(step, container);
            break;
        case 'play_sequence':
            await runPlaySequenceStep(step, container);
            break;
        case 'spotlight':
            await runSpotlightStep(step, container);
            break;
        case 'builder_action':
            await runBuilderActionStep(step, container);
            break;
        case 'free_explore':
            await runFreeExploreStep(step, container);
            break;
        case 'guided_builder':
            await runGuidedBuilderStep(step, container);
            break;
        default:
            console.warn('[Tutorial] Unknown step type:', step.type);
            nextStep(container);
    }
}

/**
 * Info step - display message with continue button
 */
async function runInfoStep(step, container) {
    const stepEl = document.createElement('div');
    stepEl.className = 'tutorial-step bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 mb-4 border-2 border-indigo-200 shadow-lg';
    stepEl.innerHTML = `
        <div class="flex items-start gap-4">
            <div class="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <span class="text-2xl">${step.icon || '💡'}</span>
            </div>
            <div class="flex-1">
                <h4 class="text-lg font-bold text-indigo-900 mb-2">${step.title || 'Quick Tip'}</h4>
                <p class="text-gray-700 leading-relaxed">${step.message}</p>
            </div>
        </div>
        <div class="flex justify-end mt-4">
            <button class="tutorial-continue-btn px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition shadow-md">
                ${step.buttonText || 'Continue'} →
            </button>
        </div>
    `;

    container.appendChild(stepEl);
    stepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    stepEl.querySelector('.tutorial-continue-btn').addEventListener('click', () => {
        stepEl.remove();
        nextStep(container);
    });
}

/**
 * Play note step - show keyboard and wait for correct note
 */
async function runPlayNoteStep(step, container) {
    const stepEl = document.createElement('div');
    stepEl.className = 'tutorial-step bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 mb-4 border-2 border-green-200 shadow-lg';
    stepEl.innerHTML = `
        <div class="flex items-start gap-4 mb-4">
            <div class="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <span class="text-2xl">🎹</span>
            </div>
            <div class="flex-1">
                <h4 class="text-lg font-bold text-green-900 mb-2">${step.title || 'Try it!'}</h4>
                <p class="text-gray-700 leading-relaxed">${step.instruction}</p>
                ${step.hint ? `<p class="text-green-700 text-sm mt-2 italic">Hint: ${step.hint}</p>` : ''}
            </div>
        </div>
        <div id="tutorial-mini-keyboard" class="mb-4"></div>
        <div id="tutorial-feedback" class="hidden"></div>
    `;

    container.appendChild(stepEl);
    stepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Create mini keyboard
    const keyboardContainer = stepEl.querySelector('#tutorial-mini-keyboard');
    const feedbackEl = stepEl.querySelector('#tutorial-feedback');
    const targetNote = step.targetNote;
    const targetBaseName = targetNote.replace(/[0-9]/g, '');

    const keyboard = createMiniKeyboard(keyboardContainer, {
        octaves: step.octaves || 2,
        startNote: step.startNote || 'C4',
        targetNotes: [targetNote, targetBaseName],
        highlightNotes: step.highlightNotes || [],
        showLabels: true,
        onNotePlay: (noteName, baseName) => {
            // Check if correct note (with enharmonic equivalence)
            const isCorrect = areNotesEnharmonicEqual(noteName, targetNote);

            if (isCorrect) {
                feedbackEl.className = 'bg-green-100 border border-green-300 rounded-lg p-3 flex items-center gap-2';
                feedbackEl.innerHTML = `
                    <span class="text-2xl">🎉</span>
                    <span class="text-green-800 font-semibold">${step.successMessage || 'Perfect! That\'s the right note!'}</span>
                `;
                feedbackEl.classList.remove('hidden');

                setTimeout(() => {
                    stepEl.remove();
                    nextStep(container);
                }, 1500);
            } else {
                feedbackEl.className = 'bg-amber-100 border border-amber-300 rounded-lg p-3 flex items-center gap-2';
                feedbackEl.innerHTML = `
                    <span class="text-2xl">🤔</span>
                    <span class="text-amber-800 font-medium">That was ${baseName} - try to find ${targetBaseName}!</span>
                `;
                feedbackEl.classList.remove('hidden');
            }
        }
    });
}

/**
 * Play sequence step - wait for user to play multiple notes in order
 */
async function runPlaySequenceStep(step, container) {
    const stepEl = document.createElement('div');
    stepEl.className = 'tutorial-step bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-6 mb-4 border-2 border-purple-200 shadow-lg';

    const targetNotes = step.targetNotes;
    let currentNoteIndex = 0;

    stepEl.innerHTML = `
        <div class="flex items-start gap-4 mb-4">
            <div class="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <span class="text-2xl">🎵</span>
            </div>
            <div class="flex-1">
                <h4 class="text-lg font-bold text-purple-900 mb-2">${step.title || 'Play the sequence'}</h4>
                <p class="text-gray-700 leading-relaxed">${step.instruction}</p>
            </div>
        </div>
        <div id="tutorial-sequence-progress" class="flex gap-2 mb-4 flex-wrap">
            ${targetNotes.map((n, i) => `
                <div class="sequence-note px-3 py-1 rounded-lg text-sm font-semibold ${i === 0 ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-600'}" data-index="${i}">
                    ${n.replace(/[0-9]/g, '')}
                </div>
            `).join('')}
        </div>
        <div id="tutorial-mini-keyboard" class="mb-4"></div>
        <div id="tutorial-feedback" class="hidden"></div>
    `;

    container.appendChild(stepEl);
    stepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const keyboardContainer = stepEl.querySelector('#tutorial-mini-keyboard');
    const feedbackEl = stepEl.querySelector('#tutorial-feedback');
    const progressNotes = stepEl.querySelectorAll('.sequence-note');

    const updateProgress = () => {
        progressNotes.forEach((el, i) => {
            if (i < currentNoteIndex) {
                el.className = 'sequence-note px-3 py-1 rounded-lg text-sm font-semibold bg-green-500 text-white';
                el.innerHTML += ' ✓';
            } else if (i === currentNoteIndex) {
                el.className = 'sequence-note px-3 py-1 rounded-lg text-sm font-semibold bg-purple-600 text-white animate-pulse';
            }
        });
    };

    createMiniKeyboard(keyboardContainer, {
        octaves: step.octaves || 2,
        startNote: step.startNote || 'C4',
        targetNotes: [targetNotes[currentNoteIndex]],
        showLabels: true,
        onNotePlay: (noteName, baseName) => {
            const expectedNote = targetNotes[currentNoteIndex];
            const expectedBase = expectedNote.replace(/[0-9]/g, '');
            // Use enharmonic comparison to handle D#/Eb, etc.
            const isCorrect = areNotesEnharmonicEqual(noteName, expectedNote);

            if (isCorrect) {
                currentNoteIndex++;
                updateProgress();

                if (currentNoteIndex >= targetNotes.length) {
                    feedbackEl.className = 'bg-green-100 border border-green-300 rounded-lg p-3 flex items-center gap-2';
                    feedbackEl.innerHTML = `
                        <span class="text-2xl">🎉</span>
                        <span class="text-green-800 font-semibold">${step.successMessage || 'Excellent! You played the whole sequence!'}</span>
                    `;
                    feedbackEl.classList.remove('hidden');

                    setTimeout(() => {
                        stepEl.remove();
                        nextStep(container);
                    }, 2000);
                } else {
                    feedbackEl.className = 'bg-green-100 border border-green-300 rounded-lg p-2';
                    feedbackEl.innerHTML = `<span class="text-green-700">✓ ${baseName} - Keep going!</span>`;
                    feedbackEl.classList.remove('hidden');
                }
            } else {
                feedbackEl.className = 'bg-amber-100 border border-amber-300 rounded-lg p-2';
                feedbackEl.innerHTML = `<span class="text-amber-700">Try ${expectedBase} next</span>`;
                feedbackEl.classList.remove('hidden');
            }
        }
    });
}

/**
 * Spotlight step - highlight element and show message
 */
async function runSpotlightStep(step, container) {
    const spotlight = createSpotlight(step.target, {
        message: step.message,
        position: step.position || 'bottom',
        showArrow: true,
        allowClickThrough: step.allowClick || false,
        onNext: () => nextStep(container),
        onSkip: () => skipTutorial()
    });

    if (step.waitForClick) {
        const targetEl = document.querySelector(step.target);
        if (targetEl) {
            const handler = () => {
                targetEl.removeEventListener('click', handler);
                removeSpotlight();
                nextStep(container);
            };
            targetEl.addEventListener('click', handler);
        }
    }
}

/**
 * Builder action step - guide through chord builder
 */
async function runBuilderActionStep(step, container) {
    // This would integrate with the chord builder
    // For now, show as spotlight on the builder tab
    const stepEl = document.createElement('div');
    stepEl.className = 'tutorial-step bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 mb-4 border-2 border-orange-200 shadow-lg';
    stepEl.innerHTML = `
        <div class="flex items-start gap-4">
            <div class="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <span class="text-2xl">🔧</span>
            </div>
            <div class="flex-1">
                <h4 class="text-lg font-bold text-orange-900 mb-2">${step.title || 'Try in Chord Builder'}</h4>
                <p class="text-gray-700 leading-relaxed mb-4">${step.instruction}</p>
                <button class="open-builder-btn px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition shadow-md mr-2">
                    Open Chord Builder
                </button>
                <button class="tutorial-continue-btn px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition">
                    I'll do it later →
                </button>
            </div>
        </div>
    `;

    container.appendChild(stepEl);

    stepEl.querySelector('.open-builder-btn').addEventListener('click', () => {
        window.switchTab?.('builder');
        stepEl.remove();

        // Show spotlight on the builder after tab switch
        setTimeout(() => {
            if (step.spotlightTarget) {
                createSpotlight(step.spotlightTarget, {
                    message: step.spotlightMessage || step.instruction,
                    onNext: () => nextStep(container),
                    onSkip: () => skipTutorial()
                });
            } else {
                nextStep(container);
            }
        }, 500);
    });

    stepEl.querySelector('.tutorial-continue-btn').addEventListener('click', () => {
        stepEl.remove();
        nextStep(container);
    });
}

/**
 * Free explore step - let user experiment
 */
async function runFreeExploreStep(step, container) {
    const stepEl = document.createElement('div');
    stepEl.className = 'tutorial-step bg-gradient-to-r from-cyan-50 to-teal-50 rounded-xl p-6 mb-4 border-2 border-cyan-200 shadow-lg';
    stepEl.innerHTML = `
        <div class="flex items-start gap-4 mb-4">
            <div class="flex-shrink-0 w-12 h-12 bg-cyan-100 rounded-full flex items-center justify-center">
                <span class="text-2xl">🎨</span>
            </div>
            <div class="flex-1">
                <h4 class="text-lg font-bold text-cyan-900 mb-2">${step.title || 'Free Exploration'}</h4>
                <p class="text-gray-700 leading-relaxed">${step.instruction}</p>
            </div>
        </div>
        <div id="tutorial-mini-keyboard" class="mb-4"></div>
        <div class="flex justify-end">
            <button class="tutorial-done-btn px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition shadow-md">
                I'm done exploring →
            </button>
        </div>
    `;

    container.appendChild(stepEl);
    stepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    createMiniKeyboard(stepEl.querySelector('#tutorial-mini-keyboard'), {
        octaves: step.octaves || 3,
        startNote: step.startNote || 'C3',
        highlightNotes: step.highlightNotes || [],
        showLabels: true
    });

    stepEl.querySelector('.tutorial-done-btn').addEventListener('click', () => {
        stepEl.remove();
        nextStep(container);
    });
}

/**
 * Guided builder step - takes user to Chord Lab with guided steps
 */
async function runGuidedBuilderStep(step, container) {
    const stepEl = document.createElement('div');
    stepEl.className = 'tutorial-step bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6 mb-4 border-2 border-amber-300 shadow-lg';
    stepEl.innerHTML = `
        <div class="flex items-start gap-4 mb-4">
            <div class="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <span class="text-2xl">🎛️</span>
            </div>
            <div class="flex-1">
                <h4 class="text-lg font-bold text-amber-900 mb-2">${step.title || 'Hands-on Exercise'}</h4>
                <p class="text-gray-700 leading-relaxed">${step.instruction}</p>
            </div>
        </div>
        <div class="flex gap-3">
            <button class="start-guided-btn px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition shadow-md flex items-center gap-2">
                <span>Go to Chord Lab</span>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                </svg>
            </button>
            <button class="skip-guided-btn px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition text-sm">
                Skip this step
            </button>
        </div>
    `;

    container.appendChild(stepEl);
    stepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Start guided mode button
    stepEl.querySelector('.start-guided-btn').addEventListener('click', () => {
        stepEl.remove();

        // Start the guided mode with the builder steps
        startGuidedMode({
            lessonId: currentTutorial?.lessonId,
            lessonTitle: step.title || currentTutorial?.title,
            targetTab: step.targetTab || 'builder',
            steps: step.guidedSteps || [],
            onComplete: (actionHistory) => {
                // Continue to next step after returning
                nextStep(container);
            },
            onCancel: () => {
                // Still continue to next step
                nextStep(container);
            }
        });
    });

    // Skip button
    stepEl.querySelector('.skip-guided-btn').addEventListener('click', () => {
        stepEl.remove();
        nextStep(container);
    });
}

/**
 * Move to next step
 */
function nextStep(container) {
    if (!currentTutorial) return;

    currentStepIndex++;
    if (currentStepIndex < currentTutorial.steps.length) {
        runStep(currentTutorial.steps[currentStepIndex], container);
    } else {
        completeTutorial();
    }
}

/**
 * Complete the tutorial
 */
function completeTutorial() {
    const container = tutorialContainerRef;
    const tutorial = currentTutorial;

    if (tutorial?.onComplete) {
        tutorial.onComplete();
    }

    // Show a completion message with a practice keyboard
    if (container) {
        // Get keyboard config based on tutorial
        const keyboardConfigs = {
            'what-is-a-note': { octaves: 2, startNote: 'C4', highlightNotes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },
            'sharps-flats': { octaves: 2, startNote: 'C4', highlightNotes: ['C#', 'D#', 'F#', 'G#', 'A#'] },
            'octaves-whole-steps': { octaves: 3, startNote: 'C3', highlightNotes: ['C'] },
            'intro-to-scales': { octaves: 2, startNote: 'C4', highlightNotes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },
            'understanding-intervals': { octaves: 2, startNote: 'C4', highlightNotes: [] },
            'what-is-a-chord': { octaves: 2, startNote: 'C4', highlightNotes: ['C', 'E', 'G'] }
        };

        const config = keyboardConfigs[tutorial?.id] || { octaves: 2, startNote: 'C4' };

        const completionEl = document.createElement('div');
        completionEl.className = 'tutorial-completion bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-6 border-2 border-emerald-300 shadow-lg';
        completionEl.innerHTML = `
            <div class="flex items-start gap-4 mb-4">
                <div class="flex-shrink-0 w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span class="text-3xl">🎉</span>
                </div>
                <div class="flex-1">
                    <h4 class="text-xl font-bold text-emerald-900 mb-2">Tutorial Complete!</h4>
                    <p class="text-emerald-800">Great job! You've completed this interactive lesson. Feel free to keep practicing with the keyboard below, or move on to the exercises and quiz.</p>
                </div>
            </div>
            <div id="tutorial-completion-keyboard" class="mb-4"></div>
            <p class="text-sm text-emerald-700 text-center italic">Keep practicing - try playing what you learned!</p>
        `;

        container.innerHTML = '';
        container.appendChild(completionEl);

        // Create the practice keyboard
        const keyboardContainer = completionEl.querySelector('#tutorial-completion-keyboard');
        if (keyboardContainer) {
            createMiniKeyboard(keyboardContainer, {
                ...config,
                showLabels: true,
                height: 150,
                onNotePlay: (noteName, baseName) => {
                }
            });
        }
    }

    currentTutorial = null;
    currentStepIndex = 0;
    isAwaitingAction = false;
    tutorialContainerRef = null;
}

/**
 * Skip the tutorial
 */
function skipTutorial() {
    removeSpotlight();

    const container = tutorialContainerRef;
    const tutorial = currentTutorial;

    if (tutorial?.onSkip) {
        tutorial.onSkip();
    }

    // Show a keyboard for practice even if skipped
    if (container) {
        const keyboardConfigs = {
            'what-is-a-note': { octaves: 2, startNote: 'C4', highlightNotes: ['C'] },
            'sharps-flats': { octaves: 2, startNote: 'C4', highlightNotes: ['C#', 'D#', 'F#', 'G#', 'A#'] },
            'octaves-whole-steps': { octaves: 3, startNote: 'C3', highlightNotes: ['C'] },
            'intro-to-scales': { octaves: 2, startNote: 'C4', highlightNotes: [] },
            'understanding-intervals': { octaves: 2, startNote: 'C4', highlightNotes: [] },
            'what-is-a-chord': { octaves: 2, startNote: 'C4', highlightNotes: ['C', 'E', 'G'] }
        };

        const config = keyboardConfigs[tutorial?.id] || { octaves: 2, startNote: 'C4' };

        const skippedEl = document.createElement('div');
        skippedEl.className = 'tutorial-skipped bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-6 border-2 border-gray-300 shadow-lg';
        skippedEl.innerHTML = `
            <div class="flex items-start gap-4 mb-4">
                <div class="flex-shrink-0 w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                    <span class="text-3xl">🎹</span>
                </div>
                <div class="flex-1">
                    <h4 class="text-xl font-bold text-gray-900 mb-2">Practice Mode</h4>
                    <p class="text-gray-700">Tutorial skipped. Use the keyboard below to practice on your own, or check out the exercises below.</p>
                </div>
            </div>
            <div id="tutorial-skipped-keyboard" class="mb-4"></div>
        `;

        container.innerHTML = '';
        container.appendChild(skippedEl);

        const keyboardContainer = skippedEl.querySelector('#tutorial-skipped-keyboard');
        if (keyboardContainer) {
            createMiniKeyboard(keyboardContainer, {
                ...config,
                showLabels: true,
                height: 150
            });
        }
    }

    currentTutorial = null;
    currentStepIndex = 0;
    isAwaitingAction = false;
    tutorialContainerRef = null;
}

// ===========================================
// PREDEFINED TUTORIALS
// ===========================================

/**
 * "What is a Note" interactive tutorial
 */
export const whatIsANoteTutorial = defineTutorial({
    id: 'what-is-a-note',
    title: 'What is a Note?',
    lessonId: 'lesson-what-is-note',
    steps: [
        {
            type: 'info',
            icon: '🎹',
            title: 'Let\'s Learn Notes!',
            message: 'In this interactive lesson, you\'ll learn about musical notes by actually playing them. Ready to get hands-on?',
            buttonText: 'Let\'s go!'
        },
        {
            type: 'info',
            icon: '📝',
            title: 'Notes are Named A through G',
            message: 'Musicians use only 7 letter names for notes: A, B, C, D, E, F, G. After G, we start over at A. It\'s like days of the week - after Sunday comes Monday!'
        },
        {
            type: 'play_note',
            title: 'Find Middle C',
            instruction: 'Middle C is the most important note to know. Click on C on the keyboard below!',
            hint: 'C is labeled on the keyboard. It\'s the white key to the left of the two black keys.',
            targetNote: 'C4',
            octaves: 2,
            startNote: 'C4',
            successMessage: 'Perfect! You found Middle C! This is C4 - the C in the 4th octave.'
        },
        {
            type: 'play_note',
            title: 'Now Find D',
            instruction: 'D is the next note after C. Click on D!',
            hint: 'D is the white key right next to C, between the two black keys.',
            targetNote: 'D4',
            octaves: 2,
            startNote: 'C4',
            highlightNotes: ['C4'],
            successMessage: 'Great! D sounds a bit higher than C.'
        },
        {
            type: 'play_sequence',
            title: 'Play C, D, E',
            instruction: 'Now play these three notes in order: C, D, E. This is the start of the "Do-Re-Mi" scale!',
            targetNotes: ['C4', 'D4', 'E4'],
            octaves: 2,
            startNote: 'C4',
            successMessage: 'Excellent! You just played "Do-Re-Mi"!'
        },
        {
            type: 'free_explore',
            title: 'Explore All the Notes',
            instruction: 'Play around with the keyboard! Try to find and play all 7 natural notes: C, D, E, F, G, A, B. Notice how they sound higher as you go up.',
            octaves: 2,
            startNote: 'C4',
            highlightNotes: ['C', 'D', 'E', 'F', 'G', 'A', 'B']
        },
        {
            type: 'play_sequence',
            title: 'Play the Full Scale',
            instruction: 'Now play the complete C major scale: C, D, E, F, G, A, B, and back to C!',
            targetNotes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
            octaves: 2,
            startNote: 'C4',
            successMessage: 'Amazing! You just played the C Major Scale - the most famous scale in music!'
        },
        {
            type: 'info',
            icon: '🎉',
            title: 'Congratulations!',
            message: 'You\'ve learned the 7 natural notes and played your first scale! These notes are the foundation of all Western music. Ready to continue to the quiz?',
            buttonText: 'Continue to Quiz'
        }
    ],
    onComplete: () => {
    }
});

/**
 * "Sharps, Flats & Half Steps" interactive tutorial
 */
export const sharpsFlatsTutorial = defineTutorial({
    id: 'sharps-flats',
    title: 'Sharps, Flats & Half Steps',
    lessonId: 'lesson-sharps-flats',
    steps: [
        {
            type: 'info',
            icon: '♯♭',
            title: 'Let\'s Explore the Black Keys!',
            message: 'You know the 7 white keys. Now let\'s discover the 5 black keys - they\'re the notes "in between" and have two names each!',
            buttonText: 'Let\'s explore!'
        },
        {
            type: 'play_note',
            title: 'First, Find C',
            instruction: 'Let\'s start with C as our reference point. Play C!',
            hint: 'C is the white key to the left of the two black keys.',
            targetNote: 'C4',
            octaves: 2,
            startNote: 'C4',
            successMessage: 'Good! Now we\'ll find the black key next to it.'
        },
        {
            type: 'play_note',
            title: 'Find C# (C Sharp)',
            instruction: 'Now play the black key right next to C. This is C# (C sharp) - one half step higher!',
            hint: 'It\'s the black key immediately to the RIGHT of C.',
            targetNote: 'C#4',
            octaves: 2,
            startNote: 'C4',
            highlightNotes: ['C4'],
            successMessage: 'That\'s C#! A sharp (#) raises a note by one half step - the smallest step in music.'
        },
        {
            type: 'play_sequence',
            title: 'Half Step Pattern: C to C#',
            instruction: 'Play C, then C# to hear the half step. It\'s a tiny but noticeable change!',
            targetNotes: ['C4', 'C#4'],
            octaves: 2,
            startNote: 'C4',
            successMessage: 'That tiny step is a half step - the building block of all intervals!'
        },
        {
            type: 'play_note',
            title: 'The Same Key, Different Name',
            instruction: 'Now here\'s something cool: that same black key can be called Db (D flat)! Play D, then the black key below it.',
            hint: 'A flat (b) lowers a note. So Db is one half step BELOW D - the same key as C#!',
            targetNote: 'D4',
            octaves: 2,
            startNote: 'C4',
            successMessage: 'C# and Db are the SAME KEY! This is called an "enharmonic equivalent."'
        },
        {
            type: 'play_sequence',
            title: 'Play the Chromatic Scale',
            instruction: 'Now play ALL 12 notes from C to C: C, C#, D, D#, E, F, F#, G, G#, A, A#, B, C!',
            targetNotes: ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5'],
            octaves: 2,
            startNote: 'C4',
            successMessage: 'Amazing! You just played the chromatic scale - all 12 notes in order!'
        },
        {
            type: 'info',
            icon: '💡',
            title: 'Did You Notice?',
            message: 'E to F and B to C are half steps with NO black key between them! These are the only two places where white keys are next-door neighbors.'
        },
        {
            type: 'play_sequence',
            title: 'The "Jaws" Theme',
            instruction: 'Play the famous "Jaws" theme: E, F, E, F. This half step creates tension!',
            targetNotes: ['E4', 'F4', 'E4', 'F4'],
            octaves: 2,
            startNote: 'C4',
            successMessage: 'Dun dun... dun dun... That tension comes from the half step!'
        },
        {
            type: 'info',
            icon: '🎉',
            title: 'You\'ve Got It!',
            message: 'Sharp (#) = one half step UP, Flat (b) = one half step DOWN. Black keys have two names (C#/Db, etc.). There are 12 unique notes total!',
            buttonText: 'Continue to Quiz'
        }
    ],
    onComplete: () => {
    }
});

/**
 * "Octaves & Whole Steps" interactive tutorial
 */
export const octavesTutorial = defineTutorial({
    id: 'octaves-whole-steps',
    title: 'Octaves & Whole Steps',
    lessonId: 'lesson-octaves',
    steps: [
        {
            type: 'info',
            icon: '🔄',
            title: 'Notes Repeat!',
            message: 'You\'ve learned there are 12 unique notes. But a piano has 88 keys! That\'s because notes REPEAT in higher and lower versions. Let\'s explore octaves and the different step sizes!',
            buttonText: 'Let\'s explore!'
        },
        // OCTAVES FIRST
        {
            type: 'play_note',
            title: 'Find Middle C',
            instruction: 'Play the C on the left side of the keyboard (C4 - middle C).',
            hint: 'It\'s labeled "C4" - the C in the 4th octave.',
            targetNote: 'C4',
            octaves: 3,
            startNote: 'C3',
            successMessage: 'That\'s middle C (C4) - the most famous note on the piano!'
        },
        {
            type: 'play_note',
            title: 'Now Find the Higher C',
            instruction: 'Play the C on the right side - it\'s one octave higher (C5).',
            hint: 'Look for the next C to the right. It sounds the same but higher!',
            targetNote: 'C5',
            octaves: 3,
            startNote: 'C3',
            highlightNotes: ['C4'],
            successMessage: 'C4 and C5 are the SAME note, just one octave apart! They sound like "the same but different."'
        },
        {
            type: 'play_sequence',
            title: 'Hear the Octave Leap',
            instruction: 'Play C4, then C5 to hear the octave leap. This is the opening interval in "Somewhere Over the Rainbow"!',
            targetNotes: ['C4', 'C5'],
            octaves: 3,
            startNote: 'C3',
            successMessage: 'That\'s an octave! The higher note vibrates exactly twice as fast as the lower one.'
        },
        // WHOLE STEPS NEXT
        {
            type: 'info',
            icon: '📏',
            title: 'Now: Whole Steps',
            message: 'An octave is 12 half steps. But there\'s a bigger step too: the WHOLE step. A whole step SKIPS one key (2 half steps). Most white keys are a whole step apart!'
        },
        {
            type: 'play_sequence',
            title: 'Whole Step: C to D',
            instruction: 'Play C, then D. Notice we skip over C# - this is a WHOLE step.',
            targetNotes: ['C4', 'D4'],
            octaves: 3,
            startNote: 'C3',
            successMessage: 'C to D is a whole step - we skipped C# between them!'
        },
        {
            type: 'play_sequence',
            title: 'Another Whole Step: D to E',
            instruction: 'Play D, then E. Another whole step - we skip D#.',
            targetNotes: ['D4', 'E4'],
            octaves: 3,
            startNote: 'C3',
            successMessage: 'D to E is also a whole step! Most neighboring white keys are a whole step apart.'
        },
        {
            type: 'play_sequence',
            title: 'More Whole Steps: F to G, G to A, A to B',
            instruction: 'Play F, G, A, B. These are all whole steps apart!',
            targetNotes: ['F4', 'G4', 'A4', 'B4'],
            octaves: 3,
            startNote: 'C3',
            successMessage: 'F-G, G-A, and A-B are all whole steps. But wait - what about E-F and B-C?'
        },
        // HALF STEPS LAST (the exceptions)
        {
            type: 'info',
            icon: '⚠️',
            title: 'The Two Exceptions',
            message: 'Most white keys are a whole step apart, but TWO pairs are only a HALF step apart: E-F and B-C. There\'s no black key between them!'
        },
        {
            type: 'play_sequence',
            title: 'Half Step: E to F',
            instruction: 'Play E, then F. There\'s NO black key between them - this is only a HALF step!',
            targetNotes: ['E4', 'F4'],
            octaves: 3,
            startNote: 'C3',
            successMessage: 'E to F is a half step - they\'re right next to each other with no key between!'
        },
        {
            type: 'play_sequence',
            title: 'Half Step: B to C',
            instruction: 'Play B, then C. This is the other place where white keys are only a half step apart!',
            targetNotes: ['B4', 'C5'],
            octaves: 3,
            startNote: 'C3',
            successMessage: 'B to C is also a half step! Remember: E-F and B-C are the only natural half steps.'
        },
        // PUT IT ALL TOGETHER
        {
            type: 'play_sequence',
            title: 'The Step Pattern',
            instruction: 'Play the scale C-D-E-F-G-A-B-C and feel which steps are bigger (whole) and smaller (half).',
            targetNotes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
            octaves: 3,
            startNote: 'C3',
            successMessage: 'The pattern is W-W-H-W-W-W-H! This is the major scale pattern you\'ll learn next!'
        },
        {
            type: 'info',
            icon: '🎉',
            title: 'You\'ve Got It!',
            message: 'An octave = 12 half steps (same note, different height). A whole step = 2 half steps (skip one key). E-F and B-C are the only natural half steps between white keys!',
            buttonText: 'Continue to Quiz'
        }
    ],
    onComplete: () => {
    }
});

/**
 * "Introduction to Scales" interactive tutorial
 */
export const scalesTutorial = defineTutorial({
    id: 'intro-to-scales',
    title: 'Introduction to Scales',
    lessonId: 'lesson-scales',
    steps: [
        {
            type: 'info',
            icon: '🎼',
            title: 'Let\'s Build a Scale!',
            message: 'A scale is a set of notes in order that creates a specific mood. The most important scale is the MAJOR scale - it sounds happy and resolved. Let\'s build one!',
            buttonText: 'Let\'s build a scale!'
        },
        {
            type: 'info',
            icon: '📝',
            title: 'The Magic Formula',
            message: 'The major scale follows this pattern of steps: W-W-H-W-W-W-H (Whole-Whole-Half-Whole-Whole-Whole-Half). Let\'s apply it starting from C!'
        },
        {
            type: 'play_note',
            title: 'Step 1: Start with C (Do)',
            instruction: 'Play C - this is "Do", the home base of our C major scale.',
            hint: 'C is the white key to the left of the two black keys.',
            targetNote: 'C4',
            octaves: 2,
            startNote: 'C4',
            successMessage: 'Do! This is our "home" note - the scale wants to come back here.'
        },
        {
            type: 'play_note',
            title: 'Step 2: Whole Step to D (Re)',
            instruction: 'Go up a WHOLE step to D. That\'s "Re"!',
            hint: 'Skip over C# to reach D.',
            targetNote: 'D4',
            octaves: 2,
            startNote: 'C4',
            highlightNotes: ['C4'],
            successMessage: 'Re! C to D is a whole step.'
        },
        {
            type: 'play_note',
            title: 'Step 3: Whole Step to E (Mi)',
            instruction: 'Another WHOLE step up to E. That\'s "Mi"!',
            hint: 'Skip over D# to reach E.',
            targetNote: 'E4',
            octaves: 2,
            startNote: 'C4',
            highlightNotes: ['C4', 'D4'],
            successMessage: 'Mi! D to E is also a whole step.'
        },
        {
            type: 'play_note',
            title: 'Step 4: Half Step to F (Fa)',
            instruction: 'Now just a HALF step to F. That\'s "Fa"! (No black key between E and F!)',
            hint: 'E to F is naturally a half step - they\'re neighbors.',
            targetNote: 'F4',
            octaves: 2,
            startNote: 'C4',
            highlightNotes: ['C4', 'D4', 'E4'],
            successMessage: 'Fa! E to F is a half step - this is where the pattern changes!'
        },
        {
            type: 'play_sequence',
            title: 'Steps 5-8: Complete the Scale',
            instruction: 'Now finish with G (So), A (La), B (Ti), and back to C (Do)!',
            targetNotes: ['G4', 'A4', 'B4', 'C5'],
            octaves: 2,
            startNote: 'C4',
            highlightNotes: ['C4', 'D4', 'E4', 'F4'],
            successMessage: 'So-La-Ti-Do! G-A and A-B are whole steps, B-C is a half step, and we\'re home!'
        },
        {
            type: 'play_sequence',
            title: 'Play the Complete Scale',
            instruction: 'Now play the entire C major scale: C-D-E-F-G-A-B-C. This is "Do-Re-Mi-Fa-So-La-Ti-Do"!',
            targetNotes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
            octaves: 2,
            startNote: 'C4',
            successMessage: 'Beautiful! You just played the C major scale - the foundation of most Western music!'
        },
        {
            type: 'free_explore',
            title: 'Make Some Music!',
            instruction: 'Now improvise! Play any white keys in any order - since they\'re all in C major, they\'ll sound good together. Try making up a simple melody!',
            octaves: 2,
            startNote: 'C4',
            highlightNotes: ['C', 'D', 'E', 'F', 'G', 'A', 'B']
        },
        {
            type: 'info',
            icon: '🎉',
            title: 'Scale Master!',
            message: 'You built the C major scale! The pattern W-W-H-W-W-W-H works from ANY starting note. C major is special because it uses only white keys. This scale is the basis for countless songs!',
            buttonText: 'Continue to Quiz'
        }
    ],
    onComplete: () => {
    }
});

/**
 * "Understanding Intervals" interactive tutorial
 */
export const intervalsTutorial = defineTutorial({
    id: 'understanding-intervals',
    title: 'Understanding Intervals',
    lessonId: 'lesson-intervals',
    steps: [
        {
            type: 'info',
            icon: '↔️',
            title: 'The Space Between Notes',
            message: 'An INTERVAL is the distance between two notes. Intervals are the DNA of music - they create melody and harmony. Each interval has its own unique sound and feeling!',
            buttonText: 'Let\'s learn intervals!'
        },
        {
            type: 'info',
            icon: '🔢',
            title: 'How to Name Intervals',
            message: 'Count the letters from one note to another (including both): C to E = C(1), D(2), E(3) = a "3rd". The number of half steps determines if it\'s major, minor, or perfect.'
        },
        {
            type: 'play_sequence',
            title: 'The Major 3rd (Happy Sound)',
            instruction: 'Play C, then E. This is a MAJOR 3rd - 4 half steps. It sounds bright and happy!',
            targetNotes: ['C4', 'E4'],
            octaves: 2,
            startNote: 'C4',
            successMessage: 'That\'s a major 3rd! This is the "happy" interval - it\'s the heart of every major chord.'
        },
        {
            type: 'play_sequence',
            title: 'The Minor 3rd (Sad Sound)',
            instruction: 'Now play C, then Eb (the black key between D and E). This is a MINOR 3rd - 3 half steps. Hear the difference?',
            targetNotes: ['C4', 'Eb4'],
            octaves: 2,
            startNote: 'C4',
            successMessage: 'That\'s a minor 3rd! It sounds sad and emotional - the heart of every minor chord.'
        },
        {
            type: 'play_sequence',
            title: 'Compare: Major vs Minor 3rd',
            instruction: 'Play C-E (major 3rd), then C-Eb (minor 3rd). Really hear the mood difference!',
            targetNotes: ['C4', 'E4', 'C4', 'Eb4'],
            octaves: 2,
            startNote: 'C4',
            successMessage: 'Same distance (a 3rd), but one half step difference creates completely different emotions!'
        },
        {
            type: 'play_sequence',
            title: 'The Perfect 5th (Power!)',
            instruction: 'Play C, then G. This is a PERFECT 5th - 7 half steps. It sounds powerful and open!',
            targetNotes: ['C4', 'G4'],
            octaves: 2,
            startNote: 'C4',
            successMessage: 'That\'s a perfect 5th! Think "Star Wars" fanfare. It\'s called "perfect" because it sounds so pure and stable.'
        },
        {
            type: 'play_sequence',
            title: 'The Minor 2nd (Tension!)',
            instruction: 'Play E, then F. This is a MINOR 2nd - just 1 half step. Maximum tension!',
            targetNotes: ['E4', 'F4'],
            octaves: 2,
            startNote: 'C4',
            successMessage: 'That\'s a minor 2nd - the "Jaws" interval! Half steps create tension and suspense.'
        },
        {
            type: 'play_sequence',
            title: 'The Perfect 4th (Here Comes the Bride)',
            instruction: 'Play C, then F. This is a PERFECT 4th - 5 half steps. It\'s the first interval in "Here Comes the Bride"!',
            targetNotes: ['C4', 'F4'],
            octaves: 2,
            startNote: 'C4',
            successMessage: 'That\'s a perfect 4th! "Here comes the bride..." - you know this sound!'
        },
        {
            type: 'play_sequence',
            title: 'The Octave (Same But Different)',
            instruction: 'Play C, then the higher C. This is an OCTAVE - 12 half steps. Same note, different height!',
            targetNotes: ['C4', 'C5'],
            octaves: 2,
            startNote: 'C4',
            successMessage: 'That\'s an octave! "Somewhere over the rainbow..." starts with this leap.'
        },
        {
            type: 'free_explore',
            title: 'Interval Explorer',
            instruction: 'Experiment! Pick any note and try to find its major 3rd (4 half steps up), minor 3rd (3 half steps), and perfect 5th (7 half steps). Train your ear!',
            octaves: 2,
            startNote: 'C4'
        },
        {
            type: 'info',
            icon: '🎉',
            title: 'Interval Master!',
            message: 'You now know the key intervals! Major 3rd = happy (4 half steps), Minor 3rd = sad (3 half steps), Perfect 5th = powerful (7 half steps). These intervals are the building blocks of chords - which we\'ll learn next!',
            buttonText: 'Continue to Quiz'
        }
    ],
    onComplete: () => {
    }
});

/**
 * "What is a Chord" interactive tutorial
 * This tutorial has TWO parts:
 * 1. Interactive Piano Tutorial - play the chord notes on embedded keyboard
 * 2. Guided Chord Lab Exercise - build chords in the full Chord Lab
 */
export const whatIsAChordTutorial = defineTutorial({
    id: 'what-is-a-chord',
    title: 'What is a Chord?',
    lessonId: 'lesson-what-is-chord',
    steps: [
        // PART 1: Interactive Piano Tutorial (embedded keyboard)
        {
            type: 'info',
            icon: '🎵',
            title: 'From Notes to Harmony!',
            message: 'You\'ve learned about individual notes. Now let\'s discover what happens when you play MULTIPLE notes at the same time - this creates a CHORD!',
            buttonText: 'Let\'s build chords!'
        },
        {
            type: 'play_sequence',
            title: 'The Three Notes of a Chord',
            instruction: 'Play these three notes one at a time: C, E, G. These are the building blocks of a C major chord!',
            targetNotes: ['C4', 'E4', 'G4'],
            octaves: 2,
            startNote: 'C4',
            successMessage: 'Those three notes together form the C Major chord - the most common chord in music!'
        },
        {
            type: 'info',
            icon: '📐',
            title: 'The Formula: 1-3-5',
            message: 'A basic chord uses the 1st, 3rd, and 5th notes of a scale. From C: C(1), D(2), E(3), F(4), G(5). So C-E-G! This pattern works for ANY root note.'
        },
        {
            type: 'play_sequence',
            title: 'Now Try C Minor',
            instruction: 'Play C, then Eb (the black key between D and E), then G. This is C MINOR - hear how it sounds sadder?',
            targetNotes: ['C4', 'Eb4', 'G4'],
            octaves: 2,
            startNote: 'C4',
            successMessage: 'That\'s C Minor! The only difference from C Major is the middle note (E vs Eb) - one half step changes everything!'
        },
        {
            type: 'info',
            icon: '🎉',
            title: 'You Know the Basics!',
            message: 'Major chords (C-E-G) sound happy. Minor chords (C-Eb-G) sound sad. Now let\'s explore the full Chord Lab where you can build ANY chord!',
            buttonText: 'Continue to Chord Lab'
        },
        // PART 2: Guided Chord Lab Exercise
        {
            type: 'guided_builder',
            title: 'Build Chords in the Chord Lab!',
            instruction: 'Now let\'s use the full Chord Lab to build chords. We\'ll guide you through each step with highlights and explanations!',
            targetTab: 'builder',
            guidedSteps: [
                // Step 1: Intro to the interface
                {
                    instruction: 'Welcome to the Chord Lab! This is where you build and explore chords. Let\'s start by selecting the ROOT note - the foundation of our chord.',
                    spotlight: '#builder-note-selector',
                    callout: 'The ROOT note is the "home base" of a chord. All other notes are measured from here.',
                    validation: null, // Info step, no validation
                    successMessage: null
                },
                // Step 2: Select C as root
                {
                    instruction: 'Click on "C" to select it as our root note. C is the most common starting point for learning chords!',
                    spotlight: '#builder-note-selector',
                    targetElement: '#builder-note-selector',
                    validation: { type: 'root_selected', value: 'C' },
                    successMessage: 'C is now our root note!'
                },
                // Step 3: Point out the chord type selector
                {
                    instruction: 'Now look at the Chord Type selector. This determines the "flavor" of the chord - Major (happy) or Minor (sad) and many more!',
                    spotlight: '#builder-chord-type-selector',
                    callout: 'Major and Minor are the two most important chord types. They\'re the building blocks of nearly all music!',
                    validation: null,
                    successMessage: null
                },
                // Step 4: Select Major
                {
                    instruction: 'Click on "Major" to build a C Major chord. Major chords have a bright, happy sound.',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    validation: { type: 'type_selected', value: 'Major' },
                    successMessage: 'C Major selected!'
                },
                // Step 5: Point out keyboard highlighting
                {
                    instruction: 'Look at the piano keyboard below! Notice how the keys C, E, and G are highlighted in ORANGE. These are the three notes that make up the C Major chord.',
                    callout: 'The keyboard always shows you which notes are in your current chord. Orange = chord tones!',
                    validation: null,
                    successMessage: null
                },
                // Step 6: Play the chord
                {
                    instruction: 'Now click any of the highlighted keys to hear the C Major chord. Listen to how bright and happy it sounds!',
                    callout: 'You can also use the Play button, or just press any highlighted key to hear the chord.',
                    validation: { type: 'chord_played' },
                    successMessage: 'Beautiful! That\'s the sound of a Major chord - bright and happy!'
                },
                // Step 7: Switch to Minor
                {
                    instruction: 'Now let\'s hear the difference! Click on "Minor" in the chord type selector.',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    validation: { type: 'type_selected', value: 'Minor' },
                    successMessage: 'C Minor selected!'
                },
                // Step 8: Notice the keyboard change
                {
                    instruction: 'Look at the keyboard again! Notice that the E has moved down to Eb (E flat) - the black key. That ONE note change creates a completely different mood.',
                    callout: 'Major to Minor: the 3rd note moves down by one half step (E → Eb). This small change has a big emotional impact!',
                    validation: null,
                    successMessage: null
                },
                // Step 9: Play Minor chord
                {
                    instruction: 'Play the C Minor chord by clicking the highlighted keys. Hear how it sounds sadder and more emotional!',
                    validation: { type: 'chord_played' },
                    successMessage: 'That\'s a Minor chord! Notice the emotional difference from Major.'
                },
                // Step 10: Introduce Arpeggio
                {
                    instruction: 'Now let\'s try something fun! An ARPEGGIO plays the chord notes one at a time instead of all together. Look at each chord type button - you\'ll see small UP (▲) and DOWN (▼) arrows on the right side.',
                    callout: 'Arpeggio = "broken chord". Instead of playing all notes at once, you hear them roll up or down. Very useful for melodies and guitar strumming!',
                    validation: null,
                    successMessage: null
                },
                // Step 11: Try arpeggio
                {
                    instruction: 'Click the UP arrow (▲) on the "Major" button to play an ascending arpeggio, then try the DOWN arrow (▼) for a descending arpeggio. Notice how the keyboard highlights each note as it plays!',
                    callout: 'Tip: Each chord type button has its own arpeggio arrows. Try different chord types to hear how their arpeggios sound!',
                    validation: { type: 'chord_played' },
                    successMessage: 'Great! Arpeggios are a beautiful way to play chords. Guitarists and pianists use them all the time!'
                },
                // Step 13: Explore on your own
                {
                    instruction: 'Great job! Now try building a different chord - select a new root note (like G or D) and hear how Major and Minor sound on different roots!',
                    callout: 'Every root note can have Major and Minor versions. Try G Major → G Minor, or D Major → D Minor. The emotion stays the same!',
                    validation: { type: 'chord_played' },
                    successMessage: '🎉 Congratulations! You now understand the basics of chords and can build them yourself!'
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

/**
 * "Major vs Minor" interactive tutorial
 * This tutorial focuses on the guided Chord Lab exercise to help users
 * feel the emotional difference between major and minor triads.
 */
export const majorVsMinorTutorial = defineTutorial({
    id: 'major-vs-minor',
    title: 'Major vs Minor',
    lessonId: 'lesson-major-vs-minor',
    steps: [
        // Guided Chord Lab Exercise
        {
            type: 'guided_builder',
            title: 'Feel the Major vs Minor Difference!',
            instruction: 'Let\'s use the Chord Lab to experience the emotional difference between major and minor triads. We\'ll guide you through building both and hearing the dramatic shift caused by just one note.',
            targetTab: 'builder',
            guidedSteps: [
                // Step 1: Introduction
                {
                    instruction: 'Welcome! In this exercise, you\'ll build both a major and minor triad on the same root note (D) to feel how one half-step changes everything.',
                    callout: 'Remember: Major triads sound bright and happy. Minor triads sound dark and emotional. The only difference is the 3rd note!',
                    validation: null,
                    successMessage: null
                },
                // Step 2: Select D as root
                {
                    instruction: 'First, let\'s select D as our root note. Click on "D" in the note selector.',
                    spotlight: '#builder-note-selector',
                    targetElement: '#builder-note-selector',
                    validation: { type: 'root_selected', value: 'D' },
                    successMessage: 'D is now our root note!'
                },
                // Step 3: Make sure Major is selected
                {
                    instruction: 'Now make sure "Major" is selected as the chord type. D Major will give us a bright, happy sound.',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    callout: 'D Major Triad = D - F# - A. The F# is the "major 3rd" - 4 half-steps above D.',
                    validation: { type: 'type_selected', value: 'Major' },
                    successMessage: 'D Major selected!'
                },
                // Step 4: Notice the keyboard highlighting
                {
                    instruction: 'Look at the keyboard below! Notice that D, F#, and A are highlighted. These three notes make up the D Major triad.',
                    callout: 'The F# (the black key between F and G) is the "major 3rd" - it\'s what gives this chord its happy sound.',
                    validation: null,
                    successMessage: null
                },
                // Step 5: Play D Major
                {
                    instruction: 'Now play the D Major chord by clicking any highlighted key or pressing the Play button. Listen to the bright, uplifting mood!',
                    callout: 'This happy sound comes from the F# - the major 3rd. It\'s 4 half-steps above D.',
                    validation: { type: 'chord_played' },
                    successMessage: 'Beautiful! That\'s the bright, happy sound of a major triad!'
                },
                // Step 6: Now change to Minor
                {
                    instruction: 'Now let\'s hear the emotional shift! Click on "Minor" in the chord type selector. Keep the root as D.',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    callout: 'D Minor Triad = D - F - A. Notice we\'re changing F# to F (natural) - just ONE half-step lower!',
                    validation: { type: 'type_selected', value: 'Minor' },
                    successMessage: 'D Minor selected!'
                },
                // Step 7: Notice the keyboard change
                {
                    instruction: 'Look at the keyboard again! The F# has changed to F (natural - the white key). That ONE half-step change transforms the entire emotional character of the chord.',
                    callout: 'The "minor 3rd" (F) is only 3 half-steps above D, compared to 4 half-steps for the "major 3rd" (F#). That tiny difference is HUGE emotionally!',
                    validation: null,
                    successMessage: null
                },
                // Step 8: Play D Minor
                {
                    instruction: 'Play the D Minor chord now. Listen carefully - it\'s the same root (D) and fifth (A), but the mood is completely different!',
                    callout: 'The F# dropped to F - just one half-step, but a completely different feeling! This is the power of the 3rd.',
                    validation: { type: 'chord_played' },
                    successMessage: 'You felt it! That darker, more emotional quality is the sound of a minor triad.'
                },
                // Step 9: Quick comparison
                {
                    instruction: 'Let\'s do a quick A/B comparison. Switch back to Major, play it, then switch to Minor and play again. Really feel that emotional shift!',
                    callout: 'Try playing Major then Minor a few times. Your ear will start to instantly recognize the difference!',
                    validation: { type: 'chord_played' },
                    successMessage: 'The difference is unmistakable once you hear it side by side!'
                },
                // Step 10: Try another root (E)
                {
                    instruction: 'Now try a different root note! Select "E" to build E Major and E Minor. The same emotional pattern works for EVERY root note.',
                    spotlight: '#builder-note-selector',
                    targetElement: '#builder-note-selector',
                    callout: 'E Major = E - G# - B (happy). E Minor = E - G - B (sad). Same pattern - the 3rd changes!',
                    validation: { type: 'root_selected', value: 'E' },
                    successMessage: 'E selected! Now try both Major and Minor to hear the same emotional shift.'
                },
                // Step 11: Explore on your own
                {
                    instruction: 'Great job! Now explore on your own. Try different root notes and switch between Major and Minor. Every root note follows the same pattern - Major = happy, Minor = sad. That one half-step difference is universal!',
                    callout: 'Tip: Try G Major → G Minor, or A Major → A Minor. The emotional shift is always the same, just on different pitches!',
                    validation: { type: 'chord_played' },
                    successMessage: '🎉 Congratulations! You now understand the fundamental difference between major and minor triads. That ONE note - the 3rd - determines whether a chord sounds happy or sad!',
                    allowFreeExplore: true
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

/**
 * "Chord Inversions" interactive tutorial
 * This tutorial focuses on the guided Chord Lab exercise to help users
 * understand how inversions rearrange chord notes and change the chord's character.
 */
export const chordInversionsTutorial = defineTutorial({
    id: 'chord-inversions',
    title: 'Chord Inversions',
    lessonId: 'lesson-inversions',
    steps: [
        // Guided Chord Lab Exercise
        {
            type: 'guided_builder',
            title: 'Explore Chord Inversions!',
            instruction: 'Let\'s use the Chord Lab to discover how rearranging the same notes creates completely different feelings. We\'ll explore root position, first inversion, and second inversion of the same chord.',
            targetTab: 'builder',
            guidedSteps: [
                // Step 1: Introduction
                {
                    instruction: 'Welcome! An inversion changes which note is in the bass (bottom) while keeping the same chord notes. This dramatically changes how the chord feels - from stable to floating to tense.',
                    callout: 'C Major has 3 notes: C-E-G. We can put any of these on the bottom! Root Position (C), First Inversion (E), or Second Inversion (G).',
                    validation: null,
                    successMessage: null
                },
                // Step 2: Point out Chord Setup panel
                {
                    instruction: 'First, make sure the "Chord Setup" panel is expanded. This is where you\'ll find all the chord building controls.',
                    spotlight: '#chord-setup-panel',
                    targetElement: '#chord-setup-panel',
                    callout: 'The Chord Setup panel contains the root note selector, chord voicing options (including inversions), and chord type selector.',
                    validation: null,
                    successMessage: null
                },
                // Step 3: Point out the Chord Voicing section and inversion selector
                {
                    instruction: 'Look at the "Chord Voicing" section (column 2). This is where you\'ll find the Inversion selector! The buttons are: "Root" (root position), "1st" (first inversion), and "2nd" (second inversion).',
                    spotlight: '#builder-inversion-selector',
                    targetElement: '#builder-inversion-selector',
                    callout: 'Root = root note in bass (most stable). 1st = 3rd in bass (lighter feel). 2nd = 5th in bass (most tension).',
                    validation: null,
                    successMessage: null
                },
                // Step 4: Select C as root
                {
                    instruction: 'Let\'s start by building a C Major chord. Select "C" as the root note.',
                    spotlight: '#builder-note-selector',
                    targetElement: '#builder-note-selector',
                    validation: { type: 'root_selected', value: 'C' },
                    successMessage: 'C is now our root note!'
                },
                // Step 5: Make sure Major is selected
                {
                    instruction: 'Now make sure "Major" is selected as the chord type.',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    validation: { type: 'type_selected', value: 'Major' },
                    successMessage: 'C Major selected!'
                },
                // Step 6: Point out inversion selector is in Chord Voicing (scroll helper)
                {
                    instruction: 'Now look back up at the "Chord Voicing" section. The Inversion selector buttons are highlighted. Click "Root" to ensure we\'re in Root Position.',
                    spotlight: '#builder-inversion-selector',
                    targetElement: '#builder-inversion-selector',
                    callout: 'Root Position = C - E - G (C is in the bass). This is the most stable, grounded sound.',
                    validation: { type: 'inversion_selected', value: 0 },
                    successMessage: 'Root Position selected!'
                },
                // Step 7: Play Root Position
                {
                    instruction: 'Play the C Major chord in Root Position again by clicking a highlighted key, the inversion button, or the "Play Chord" button. Notice how solid and grounded it feels!',
                    callout: 'Root Position is like standing with both feet firmly planted. The C in the bass gives maximum stability - the most "resolved" feeling.',
                    validation: { type: 'chord_played' },
                    successMessage: 'That solid, grounded sound is Root Position!'
                },
                // Step 8: Change to First Inversion
                {
                    instruction: 'Now click "1st" in the Inversion selector to change to First Inversion. Watch how the keyboard highlighting shifts!',
                    spotlight: '#builder-inversion-selector',
                    targetElement: '#builder-inversion-selector',
                    callout: 'First Inversion = E - G - C (E is now in the bass). Same notes, just rearranged!',
                    validation: { type: 'inversion_selected', value: 1 },
                    successMessage: 'First Inversion selected!'
                },
                // Step 9: Play First Inversion
                {
                    instruction: 'Play the First Inversion again by clicking a highlighted key, the inversion button, or the "Play Chord" button. Notice how it feels lighter and more flowing!',
                    callout: 'First Inversion is great for "passing chords" - chords that connect two other chords smoothly. It wants to move somewhere!',
                    validation: { type: 'chord_played' },
                    successMessage: 'That lighter, flowing feeling is First Inversion!'
                },
                // Step 10: Change to Second Inversion
                {
                    instruction: 'Finally, click "2nd" in the Inversion selector to change to Second Inversion.',
                    spotlight: '#builder-inversion-selector',
                    targetElement: '#builder-inversion-selector',
                    callout: 'Second Inversion = G - C - E (G is now in the bass). This creates the most tension!',
                    validation: { type: 'inversion_selected', value: 2 },
                    successMessage: 'Second Inversion selected!'
                },
                // Step 11: Play Second Inversion
                {
                    instruction: 'Play the Second Inversion again by clicking a highlighted key, the inversion button, or the "Play Chord" button. Feel the tension?',
                    callout: 'Second Inversion sounds suspended and wants to resolve - often to root position of the same or next chord. It creates anticipation!',
                    validation: { type: 'chord_played' },
                    successMessage: 'That suspended, tense feeling is Second Inversion!'
                },
                // Step 12: Quick A/B comparison
                {
                    instruction: 'Now cycle through all three inversions (Root → 1st → 2nd → Root) and play each one. Really feel how the same three notes create three different characters!',
                    spotlight: '#builder-inversion-selector',
                    targetElement: '#builder-inversion-selector',
                    callout: 'Try this: Root (stable) → 1st (lighter) → 2nd (tense) → Root (ahh, home again!)',
                    validation: { type: 'chord_played' },
                    successMessage: 'You can hear it clearly now - same notes, completely different feelings!'
                },
                // Step 13: Introduce Chord Library quick inversion tooltips
                {
                    instruction: 'Bonus tip! In the Chord Library panel below, hover over any chord button. A tooltip appears with quick inversion buttons - you can try different inversions directly from the tooltip without changing the main selector!',
                    spotlight: '#chord-library-panel',
                    targetElement: '#chord-library-panel',
                    callout: 'The chord tooltip shows "Root", "1st", "2nd" buttons. Click and hold any to instantly hear that inversion. Great for quick A/B comparisons!',
                    validation: null,
                    successMessage: null
                },
                // Step 14: Free exploration
                {
                    instruction: 'Great job! Now explore on your own. Try inversions with different chords (G Major, F Major, A Minor). Notice that EVERY chord has the same three characters: stable root position, light first inversion, tense second inversion.',
                    callout: 'Pro tip: When playing progressions, use inversions to keep your bass line moving smoothly by steps instead of jumping around!',
                    validation: { type: 'chord_played' },
                    successMessage: '🎉 Congratulations! You\'ve mastered chord inversions! The same chord can have three different personalities depending on which note is in the bass.',
                    allowFreeExplore: true
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

// ===========================================
// CSS STYLES (injected dynamically)
// ===========================================

const tutorialStyles = `
@keyframes tutorialFadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes tutorialPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7); }
    50% { box-shadow: 0 0 0 8px rgba(99, 102, 241, 0); }
}

.tutorial-spotlight-pulse {
    animation: tutorialPulse 1.5s infinite;
    position: relative;
    z-index: 99997;
}

.tutorial-step {
    animation: tutorialFadeIn 0.3s ease;
}

.mini-key:hover {
    filter: brightness(0.95);
}

.mini-key:active {
    filter: brightness(0.9);
}
`;

// Inject styles
if (!document.getElementById('tutorial-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'tutorial-styles';
    styleEl.textContent = tutorialStyles;
    document.head.appendChild(styleEl);
}

/**
 * "Your First Progression" interactive tutorial
 * This tutorial introduces the Progression Workshop and guides users
 * through building their first I-IV-V-I progression in C (C-F-G-C).
 */
export const firstProgressionTutorial = defineTutorial({
    id: 'first-progression',
    title: 'Your First Progression',
    lessonId: 'lesson-first-progression',
    steps: [
        // Guided Progression Workshop Exercise
        {
            type: 'guided_builder',
            title: 'Build Your First Chord Progression!',
            instruction: 'Let\'s use the Progression Workshop to build the most important progression in all of Western music: I-IV-V-I. In the key of C, that\'s C-F-G-C.',
            targetTab: 'trainer',
            guidedSteps: [
                // Step 1: Introduction
                {
                    instruction: 'Welcome to the Progression Workshop! This is where you build sequences of chords that work together to create musical stories. We\'ll build the classic I-IV-V-I progression.',
                    callout: 'I-IV-V-I means: Home (I) → Traveling (IV) → Tension (V) → Home again (I). In the key of C: C-F-G-C. This pattern is used in thousands of songs!',
                    validation: null,
                    successMessage: null
                },
                // Step 2: Show the Progression Setup panel
                {
                    instruction: 'This is the Progression Setup panel. Here you can set the key for your progression and access other tools.',
                    spotlight: '#melody-progression-setup-panel',
                    targetElement: '#melody-progression-setup-panel',
                    callout: 'We\'ll be working in the key of C Major - the most common key for learning progressions. No sharps or flats to worry about!',
                    validation: null,
                    successMessage: null
                },
                // Step 3: Show the Progression Visualization panel
                {
                    instruction: 'This is where your progression will appear as you build it. Right now it\'s empty - let\'s add some chords!',
                    spotlight: '#chord-progression-card-panel',
                    targetElement: '#chord-progression-card-panel',
                    callout: 'Each chord you add will appear as a "card" here. You can click on cards to select them, drag to reorder, and more!',
                    validation: null,
                    successMessage: null
                },
                // Step 4: Show Quick Add Chord form
                {
                    instruction: 'Look at the Quick Add Chord form above. This is the fastest way to add chords to your progression. Let\'s use it to add our first chord.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'You can select a root note, chord type, and inversion, then click "Add" to add the chord to your progression.',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        // Open the Quick Add form if it's hidden
                        const form = document.getElementById('quick-add-chord-form-melody');
                        if (form && form.classList.contains('hidden')) {
                            if (window.toggleQuickAddChordForm) {
                                window.toggleQuickAddChordForm('quick-add-chord-form-melody');
                            }
                        }
                    }
                },
                // Step 5: Add C Major (the I chord)
                {
                    instruction: 'Now add a C Major chord - this is the "I" chord (the home chord). Select "C" as the root and "Major" as the type, then click "Add".',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'C Major is the "home base" of the key of C. Every I-IV-V-I progression starts and ends here.',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'The I chord is added! You can see it appear in the progression area.'
                },
                // Step 6: Add F Major (the IV chord)
                {
                    instruction: 'Now add an F Major chord - this is the "IV" chord (the traveling chord). Select "F" as the root and "Major" as the type.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'F is the 4th note in the C Major scale, so F Major is the IV chord. It gives a feeling of "going somewhere."',
                    validation: { type: 'progression_chord_added', value: 'F Major' },
                    successMessage: 'The IV chord is added! The journey begins.'
                },
                // Step 7: Add G Major (the V chord)
                {
                    instruction: 'Add a G Major chord - this is the "V" chord (the tension chord). Select "G" as the root and "Major" as the type.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'G is the 5th note in C Major, so G Major is the V chord. It creates tension that wants to resolve back to home (C).',
                    validation: { type: 'progression_chord_added', value: 'G Major' },
                    successMessage: 'The V chord is added! Feel that tension building!'
                },
                // Step 8: Add C Major again (return to I)
                {
                    instruction: 'Finally, add another C Major chord to complete the progression. This brings us back "home" and creates a satisfying resolution.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Ending on the I chord gives a sense of completion. Without this final C, the progression would feel unfinished!',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Perfect! You\'ve built a complete I-IV-V-I progression: C-F-G-C!'
                },
                // Step 9: Look at the progression
                {
                    instruction: 'Look at your progression! You\'ve built C - F - G - C. Notice how the Roman numerals show I - IV - V - I below each chord.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    callout: 'Roman numerals are universal - they work in ANY key. The I-IV-V-I pattern sounds the same whether in C, G, D, or any other key!',
                    validation: null,
                    successMessage: null
                },
                // Step 10: Play the progression
                {
                    instruction: 'Now for the best part - play your progression! Click the Play button in the action bar at the top of the screen.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'Listen to the journey: Home (C) → Traveling (F) → Tension (G) → Home again (C). This is the foundation of Western music!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'You did it! That satisfying resolution at the end is why this progression is in thousands of songs!'
                },
                // Step 11: Mention Chord Lab integration
                {
                    instruction: 'Tip: You can also add chords from the Chord Lab! Go to Chord Lab, select any chord, and click "Add Chord" or "Add & Go" to add it to your progression.',
                    callout: 'The Quick Add form is great for fast entry. The Chord Lab gives you more control - you can hear chords first, try inversions, and see the notes on the keyboard before adding.',
                    validation: null,
                    successMessage: null
                },
                // Step 12: Completion
                {
                    instruction: 'Congratulations! You just built and played the most important progression in music history. This same I-IV-V-I pattern is in "Twist and Shout," "La Bamba," "Wild Thing," and countless other songs!',
                    callout: 'Try this: Change the key and build I-IV-V-I again. In G, that\'s G-C-D-G. In D, that\'s D-G-A-D. Same pattern, different pitches - same great sound!',
                    validation: null,
                    successMessage: '🎉 You\'ve mastered the fundamentals of chord progressions! Keep experimenting and building!',
                    allowFreeExplore: true
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

// ===========================================
// LESSON 12: The Most Popular Progression Tutorial
// ===========================================

/**
 * Popular Progression Tutorial (I-V-vi-IV)
 * This tutorial teaches building the famous C-G-Am-F progression,
 * first without voice leading, then WITH voice leading to hear the difference.
 */
export const popularProgressionTutorial = defineTutorial({
    id: 'popular-progression',
    title: 'The Most Popular Progression',
    lessonId: 'lesson-popular-progression',
    steps: [
        // Guided Progression Workshop Exercise
        {
            type: 'guided_builder',
            title: 'Build the Hit Progression - Then Make It Smooth!',
            instruction: 'Let\'s build the I-V-vi-IV progression (C-G-Am-F) - the most used progression in pop music. First we\'ll build it simply, then apply voice leading!',
            targetTab: 'trainer',
            guidedSteps: [
                // PART 1: Build without voice leading
                // Step 1: Introduction
                {
                    instruction: 'Welcome! We\'re building I-V-vi-IV (C-G-Am-F) - the progression behind "Let It Be," "With or Without You," "No Woman No Cry," and hundreds more hits!',
                    callout: 'First, we\'ll build it with all root-position chords. Then we\'ll apply voice leading to make it sound professional!',
                    validation: null,
                    successMessage: null
                },
                // Step 2: Show Quick Add form
                {
                    instruction: 'We\'ll use the Quick Add form. For Part 1, keep all inversions at "Root" - we\'ll add inversions later.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Part 1: Build with root position chords to hear the basic progression.',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        const form = document.getElementById('quick-add-chord-form-melody');
                        if (form && form.classList.contains('hidden')) {
                            if (window.toggleQuickAddChordForm) {
                                window.toggleQuickAddChordForm('quick-add-chord-form-melody');
                            }
                        }
                    }
                },
                // Step 3: Add C Major
                {
                    instruction: 'Add C Major (the I chord) - root position. This is "home."',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'C Major is the tonic - the home base that everything revolves around.',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'C added!'
                },
                // Step 4: Add G Major
                {
                    instruction: 'Add G Major (the V chord) - keep it in root position.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'G is the dominant - it creates lift and energy.',
                    validation: { type: 'progression_chord_added', value: 'G Major' },
                    successMessage: 'G added!'
                },
                // Step 5: Add Am
                {
                    instruction: 'Add A Minor (the vi chord) - this is the emotional heart!',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Am is the relative minor - it adds vulnerability and depth to the progression.',
                    validation: { type: 'progression_chord_added', value: 'A Minor' },
                    successMessage: 'Am added - feel that emotion!'
                },
                // Step 6: Add F Major
                {
                    instruction: 'Add F Major (the IV chord) to complete the progression.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'F is the subdominant - it brings warmth and sets up the loop back to C.',
                    validation: { type: 'progression_chord_added', value: 'F Major' },
                    successMessage: 'F added! You\'ve built I-V-vi-IV!'
                },
                // Step 7: Play Part 1
                {
                    instruction: 'Play your progression! Listen to the basic sound - it works, but notice how the bass jumps around (C→G→A→F).',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'This sounds good, but the bass line has big jumps. After hearing this, we\'ll apply voice leading to smooth it out!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'Sounds familiar right? Now let\'s make it SMOOTH with voice leading!'
                },
                // PART 2: Apply voice leading
                // Step 8: Introduction to Part 2
                {
                    instruction: 'Part 2: Now let\'s apply voice leading! We\'ll adjust the G, Am, and F chords using inversions and octave shifts for a smoother bass line.',
                    callout: 'Goal: Create a bass line that moves by small steps instead of big jumps. We learned this in Voice Leading!',
                    validation: null,
                    successMessage: null
                },
                // Step 9: Expand G chord
                {
                    instruction: 'Click on the G chord (2nd card) to select it, then click the expand button (↓) to see more options.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    callout: 'We\'ll change G to 1st inversion (G/B) so the bass goes C→B instead of C→G.',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        if (window.highlightChordCard) {
                            window.highlightChordCard(1);
                        }
                    }
                },
                // Step 10: Change G inversion
                {
                    instruction: 'In the expanded G card, change the Inversion to "1st" and set Octave Shift to "-1 octave (-12)". This puts B below the first C.',
                    callout: 'G in 1st inversion (G/B) puts B in the bass. Dropping an octave ensures B is BELOW C for smooth motion.',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        if (window.expandChordCard) {
                            window.expandChordCard(1);
                        }
                    }
                },
                // Step 11: Expand Am chord
                {
                    instruction: 'Now click on the Am chord (3rd card) and expand it.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    callout: 'We\'ll use Am in 2nd inversion (Am/E) or keep root and adjust octave for smooth bass from B.',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        if (window.highlightChordCard) {
                            window.highlightChordCard(2);
                        }
                    }
                },
                // Step 12: Change Am
                {
                    instruction: 'For Am, try keeping it in root position but set Octave Shift to "-1 octave (-12)". The bass goes B→A (just one step down!).',
                    callout: 'Bass line so far: C → B (half step down) → A (whole step down). Much smoother than C→G→A!',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        if (window.expandChordCard) {
                            window.expandChordCard(2);
                        }
                    }
                },
                // Step 13: Expand F chord
                {
                    instruction: 'Finally, click on the F chord (4th card) and expand it.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    callout: 'F will complete our smooth bass line.',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        if (window.highlightChordCard) {
                            window.highlightChordCard(3);
                        }
                    }
                },
                // Step 14: Change F
                {
                    instruction: 'For F, set Octave Shift to "-1 octave (-12)". The bass goes A→F (a third down), then F→C (up a fifth) to loop.',
                    callout: 'Final bass line: C→B→A→F→C. Each step is smaller than the original C→G→A→F→C!',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        if (window.expandChordCard) {
                            window.expandChordCard(3);
                        }
                    }
                },
                // Step 15: Play the voice-led version
                {
                    instruction: 'Now play your voice-led progression! Compare the smoothness to Part 1 - the bass flows instead of jumping!',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'Listen to that smooth bass line! This is how professional recordings sound.',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'Hear the difference? That\'s professional voice leading!'
                },
                // Step 16: Summary
                {
                    instruction: 'You\'ve just learned to build the world\'s most popular progression AND make it sound professional with voice leading!',
                    callout: 'Key insight: The same chords can sound amateur or professional depending on inversions and octave choices. Your ears are now trained!',
                    validation: null,
                    successMessage: null
                },
                // Step 17: Completion
                {
                    instruction: 'Try the different rotations in Experiment mode: vi-IV-I-V (sensitive), IV-I-V-vi (anthem). Apply voice leading to each!',
                    callout: 'Challenge: Build the "sensitive" rotation (Am-F-C-G) with smooth voice leading. Can you make the bass walk smoothly?',
                    validation: null,
                    successMessage: 'You\'ve mastered I-V-vi-IV with voice leading! Go write a hit song!',
                    allowFreeExplore: true
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

// ===========================================
// LESSON 11: Voice Leading Tutorial
// ===========================================

/**
 * Voice Leading Tutorial
 * This tutorial teaches smooth chord movement using inversions
 * to create better voice leading in the Progression Workshop.
 */
export const voiceLeadingTutorial = defineTutorial({
    id: 'voice-leading',
    title: 'Voice Leading: Smooth Chord Movement',
    lessonId: 'lesson-voice-leading',
    steps: [
        // Guided Progression Workshop Exercise
        {
            type: 'guided_builder',
            title: 'Build a Smooth-Flowing Progression!',
            instruction: 'Let\'s build the same I-IV-V-I progression, but this time using inversions AND octave adjustments for beautiful voice leading. You\'ll hear the difference!',
            targetTab: 'trainer',
            guidedSteps: [
                // Step 1: Introduction
                {
                    instruction: 'Welcome! You\'ve built chord progressions before. Now let\'s make them SMOOTH. The secret? Voice leading - choosing inversions AND octave positions so notes move as little as possible.',
                    callout: 'Voice leading is like good conversation - each voice (note) takes its turn to move, and no one jumps around unnecessarily.',
                    validation: null,
                    successMessage: null
                },
                // Step 2: Show the Quick Add form
                {
                    instruction: 'We\'ll use the Quick Add form, paying attention to the INVERSION selector. Then we\'ll fine-tune with octave adjustments in the chord cards.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'The inversion dropdown shows: Root (default), 1st (middle note in bass), 2nd (top note in bass). Each creates different voice leading.',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        const form = document.getElementById('quick-add-chord-form-melody');
                        if (form && form.classList.contains('hidden')) {
                            if (window.toggleQuickAddChordForm) {
                                window.toggleQuickAddChordForm('quick-add-chord-form-melody');
                            }
                        }
                    }
                },
                // Step 3: Add C Major (root position - our starting point)
                {
                    instruction: 'Start with C Major in ROOT position. Select C, Major, keep inversion at "Root", then click Add.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'C in root position (C-E-G) puts C in the bass. Our goal: keep the bass line moving by small steps!',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'C Major added! Now for the F chord...'
                },
                // Step 4: Add F Major with 2nd inversion
                {
                    instruction: 'Add F Major with 2ND INVERSION. Select F, Major, change inversion to "2nd", then Add.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'F in 2nd inversion (C-F-A) keeps C in the bass - a "common tone" with the previous chord!',
                    validation: { type: 'progression_chord_added', value: 'F Major' },
                    successMessage: 'F Major added! Bass stayed on C - perfect voice leading so far.'
                },
                // Step 5: Add G Major with 1st inversion
                {
                    instruction: 'Add G Major with 1ST INVERSION. Select G, Major, change inversion to "1st", then Add.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'G in 1st inversion puts B in the bass. B is just one half-step below C - perfect for stepping back home!',
                    validation: { type: 'progression_chord_added', value: 'G Major' },
                    successMessage: 'G Major added! But wait - we need to adjust the octave for truly smooth voice leading...'
                },
                // Step 6: Add C Major to complete
                {
                    instruction: 'Complete with C Major in root position. Then we\'ll hear what it sounds like!',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Almost there! After adding this C, let\'s hear the progression BEFORE making octave adjustments.',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Progression complete! Now let\'s hear how it sounds with just inversions (no octave tweaks yet).'
                },
                // Step 7: Play WITHOUT octave adjustments to hear the "jumpy" bass
                {
                    instruction: 'Press Auto Play to hear your progression. Listen to the bass line - notice how it jumps around a bit? The inversions help, but we can do better!',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'The bass goes: C (low) → C (high!) → B (high) → C (low). That\'s still a bit jumpy. Let\'s fix it with octave adjustments!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'Hear those jumps? The F and G bass notes are too high. Let\'s drop them an octave for smoother motion.'
                },
                // Step 8: Look at the progression and explain octave issue
                {
                    instruction: 'The inversions are set, but the octave positions need adjustment. We need both F and G dropped an octave for truly smooth voice leading.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'The fix: Drop F and G by one octave so the bass walks smoothly: C→C(same)→B(step down)→C(step up).',
                    validation: null,
                    successMessage: null
                },
                // Step 9: Expand and adjust the F chord
                {
                    instruction: 'Let\'s adjust the F chord first. Click the 2nd chord card (F Major) to select it, then find the expand button (↓).',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'Each chord card can be expanded to reveal octave controls. We\'ll drop F by one octave so its bass C matches the first chord\'s C.',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        // Highlight the F chord card (index 1)
                        if (window.highlightChordCard) {
                            window.highlightChordCard(1);
                        }
                    }
                },
                // Step 10: Set F's octave shift
                {
                    instruction: 'In the expanded F card, find "Octave Shift" and set it to "-1 octave (-12)". This drops F so its bass C matches the first chord.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'Now F\'s bass note (C) will be at the SAME pitch as the first C chord. That\'s a perfect common tone - no movement at all!',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        // Expand the F chord card (index 1)
                        if (window.expandChordCard) {
                            window.expandChordCard(1);
                        }
                    }
                },
                // Step 11: Expand and adjust the G chord
                {
                    instruction: 'Now let\'s adjust the G chord. Click the 3rd chord card (G Major) and expand it.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'We\'ll also drop G by one octave so its bass B is BELOW the C, not above it.',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        // Highlight the G chord card (index 2)
                        if (window.highlightChordCard) {
                            window.highlightChordCard(2);
                        }
                    }
                },
                // Step 12: Set G's octave shift
                {
                    instruction: 'In the expanded G card, set "Octave Shift" to "-1 octave (-12)". This puts B BELOW the previous C for smooth stepwise motion.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'Now the bass line will be: C → C (same!) → B (half-step down) → C (half-step up). That\'s professional voice leading!',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        // Expand the G chord card (index 2)
                        if (window.expandChordCard) {
                            window.expandChordCard(2);
                        }
                    }
                },
                // Step 13: Play and listen to the SMOOTH version
                {
                    instruction: 'Now play your progression again with Auto Play! Compare it to before - listen to how the bass line NOW smoothly walks: C→C(same)→B(step down)→C(step up).',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'With both F and G dropped an octave, the bass stays in a tight range. Compare this to the jumpy version you heard earlier!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'Hear that smooth bass line? Much better than the jumpy version! That\'s the magic of voice leading with proper octave placement!'
                },
                // Step 14: Summary
                {
                    instruction: 'You\'ve learned two-level voice leading: 1) Choose inversions to put the right notes in the bass, 2) Adjust octaves so the bass moves by small steps in the right direction.',
                    callout: 'Pro tip: The app\'s recommended inversions are a starting point. Use octave shifts to fine-tune the voice leading to your ears!',
                    validation: null,
                    successMessage: null
                },
                // Step 14: Completion
                {
                    instruction: 'Congratulations! You now understand professional voice leading. This technique is used by Bach, the Beatles, and every great composer. Explore freely!',
                    callout: 'Challenge: Try building I-vi-IV-V and create a smooth walking bass using inversions and octave shifts!',
                    validation: null,
                    successMessage: 'You\'ve mastered voice leading fundamentals! Keep experimenting.',
                    allowFreeExplore: true
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

// ===========================================
// LESSON: Adding Emotion with Minor Chords Tutorial
// ===========================================

/**
 * Adding Emotion with Minor Chords Tutorial
 * Teaches how to use ii, iii, and vi minor chords intentionally
 * to craft specific emotional journeys in progressions.
 */
export const addingEmotionTutorial = defineTutorial({
    id: 'adding-emotion',
    title: 'Adding Emotion with Minor Chords',
    lessonId: 'lesson-adding-emotion',
    steps: [
        // Guided Progression Workshop Exercise
        {
            type: 'guided_builder',
            title: 'Craft Emotional Progressions with Minor Chords!',
            instruction: 'Learn to use the three naturally minor chords (ii, iii, vi) to create different emotional moods in your progressions.',
            targetTab: 'trainer',
            guidedSteps: [
                // Step 1: Introduction
                {
                    instruction: 'Welcome! In any major key, three chords are naturally minor: ii, iii, and vi. Each one adds a different emotional flavor to your progressions.',
                    callout: 'In the key of C: ii = Dm (thoughtful), iii = Em (mysterious), vi = Am (emotional). Let\'s explore each one!',
                    validation: null,
                    successMessage: null
                },
                // Step 2: Show the Quick Add form
                {
                    instruction: 'We\'ll use the Quick Add form to build progressions that showcase each minor chord\'s unique character.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'First, we\'ll build the "thoughtful" progression using the ii chord (Dm). The ii-V-I pattern is incredibly smooth!',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        const form = document.getElementById('quick-add-chord-form-melody');
                        if (form && form.classList.contains('hidden')) {
                            if (window.toggleQuickAddChordForm) {
                                window.toggleQuickAddChordForm('quick-add-chord-form-melody');
                            }
                        }
                    }
                },
                // Step 3: Add C Major (the I chord - home base)
                {
                    instruction: 'Start with C Major - our home chord. Select "C" as the root and "Major" as the type, then click "Add".',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Every emotional journey starts from home. C Major gives us a stable foundation.',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Home base established! Now let\'s add the thoughtful ii chord.'
                },
                // Step 4: Add D minor (the ii chord)
                {
                    instruction: 'Now add D minor - the "ii" chord. Select "D" as the root and "Minor" as the type.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Dm is the "pre-tension" chord. It creates a thoughtful, preparing feeling - like taking a deep breath before the big moment.',
                    validation: { type: 'progression_chord_added', value: 'D Minor' },
                    successMessage: 'The ii chord is in! Feel that thoughtful, contemplative mood.'
                },
                // Step 5: Add G Major (the V chord)
                {
                    instruction: 'Add G Major - the V chord that the ii naturally leads to. Select "G" as the root and "Major" as the type.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'The ii-V movement is jazz\'s most important pattern! Dm → G creates smooth, sophisticated tension.',
                    validation: { type: 'progression_chord_added', value: 'G Major' },
                    successMessage: 'Perfect ii-V! Now resolve back home.'
                },
                // Step 6: Add C Major (resolve)
                {
                    instruction: 'Complete with C Major to resolve the progression. This gives us C - Dm - G - C.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'The complete ii-V-I pattern: thoughtful preparation (Dm) → tension (G) → resolution (C). Very smooth!',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'The "thoughtful" progression is complete!'
                },
                // Step 7: Play the thoughtful progression
                {
                    instruction: 'Play your progression! Listen to how the Dm creates a moment of contemplation before G\'s tension resolves to C.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'The ii chord (Dm) doesn\'t feel "sad" - it feels thoughtful, like you\'re about to say something important.',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'Hear that smooth, jazz-influenced sound? That\'s the power of ii-V-I!'
                },
                // Step 8: Clear for next progression
                {
                    instruction: 'Now let\'s explore the emotional vi chord! Click "Clear All" to start fresh.',
                    spotlight: '#action-clear-progression',
                    targetElement: '#action-clear-progression',
                    callout: 'The vi chord (Am) carries the most emotional weight in any major key. It\'s the "relative minor" of C.',
                    validation: { type: 'progression_cleared' },
                    successMessage: 'Ready for the emotional journey!'
                },
                // Step 9: Build emotional progression - C
                {
                    instruction: 'Let\'s build the deeper emotional progression: C - Am - Dm - G - C. Start with C Major.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'This progression uses BOTH vi (Am) and ii (Dm) for maximum emotional impact!',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Starting point set!'
                },
                // Step 10: Add A minor (the vi chord)
                {
                    instruction: 'Add A minor - the powerful "vi" chord. Select "A" as the root and "Minor" as the type.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Am is the emotional heart of C major. It\'s the "Can\'t Help Falling in Love" chord - pure vulnerability.',
                    validation: { type: 'progression_chord_added', value: 'A Minor' },
                    successMessage: 'Feel that emotional shift! The vi chord changes everything.'
                },
                // Step 11: Add D minor
                {
                    instruction: 'Add D minor to deepen the journey. Two minor chords in a row creates a powerful emotional arc.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Going from vi (Am) to ii (Dm) - we\'re stacking emotions! This creates a really moving progression.',
                    validation: { type: 'progression_chord_added', value: 'D Minor' },
                    successMessage: 'Double minor! The emotional weight is building.'
                },
                // Step 12: Add G Major
                {
                    instruction: 'Add G Major for tension before the final resolution.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'After two minor chords, the V chord (G) lifts us up and prepares for the satisfying return home.',
                    validation: { type: 'progression_chord_added', value: 'G Major' },
                    successMessage: 'The tension is set!'
                },
                // Step 13: Add final C Major
                {
                    instruction: 'Complete with C Major for the full emotional arc: C - Am - Dm - G - C.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Five chords, complete emotional journey: home → vulnerability → contemplation → tension → resolution.',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'The emotional progression is complete!'
                },
                // Step 14: Play the emotional progression (BEFORE voice leading)
                {
                    instruction: 'Play this progression first WITHOUT voice leading. Listen to the bass - it jumps around quite a bit!',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'The emotion is there, but the bass line is jumpy: C → A → D → G → C. Let\'s make it smoother with voice leading!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'Hear those jumps? Now let\'s apply voice leading to make it even more beautiful.'
                },
                // Step 15: Introduce voice leading
                {
                    instruction: 'Now let\'s combine your minor chord knowledge with voice leading! We\'ll use inversions and octave adjustments to create a smooth bass line.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'Good voice leading + emotional minor chords = professional-sounding progressions. Let\'s optimize each chord!',
                    validation: null,
                    successMessage: null
                },
                // Step 16: Expand Am chord card
                {
                    instruction: 'Click on the Am chord card (2nd chord) to select it, then expand it to see the inversion and octave controls.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'We\'ll put Am in 1st inversion so its bass note (E) is closer to C. Then we\'ll adjust the octave.',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        if (window.highlightChordCard) {
                            window.highlightChordCard(1);
                        }
                    }
                },
                // Step 17: Set Am inversion and octave
                {
                    instruction: 'In the expanded Am card, set the inversion to "1st" (E in bass). This puts E closer to C for smoother motion.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'Am in 1st inversion: E-A-C. The bass moves C → E (just a third) instead of C → A (a bigger jump).',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        if (window.expandChordCard) {
                            window.expandChordCard(1);
                        }
                    }
                },
                // Step 18: Expand Dm chord card
                {
                    instruction: 'Now expand the Dm chord card (3rd chord). We\'ll use 1st inversion here too.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'Dm in 1st inversion puts F in the bass. E → F is just a half step - perfect voice leading!',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        if (window.highlightChordCard) {
                            window.highlightChordCard(2);
                        }
                    }
                },
                // Step 19: Set Dm inversion
                {
                    instruction: 'Set Dm to "1st" inversion (F in bass). Also set its octave shift to "-1" to keep the bass in a smooth range.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'Dm/F with octave shift -1: The bass walks E → F (half step down when we drop the octave). Silky smooth!',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        if (window.expandChordCard) {
                            window.expandChordCard(2);
                        }
                    }
                },
                // Step 20: Expand G chord card
                {
                    instruction: 'Expand the G chord card (4th chord). We\'ll adjust this one too.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'G in 2nd inversion puts D in the bass. F → D is a smooth step down.',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        if (window.highlightChordCard) {
                            window.highlightChordCard(3);
                        }
                    }
                },
                // Step 21: Set G inversion and octave
                {
                    instruction: 'Set G to "2nd" inversion (D in bass) and octave shift to "-1" to keep the bass line walking downward.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'The bass line is now: C → E → F → D → C. Much smoother than jumping around!',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        if (window.expandChordCard) {
                            window.expandChordCard(3);
                        }
                    }
                },
                // Step 22: Play the voice-led version
                {
                    instruction: 'Now play your voice-led emotional progression! Compare it to the jumpy version you heard before.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'Same chords, same emotion, but now with a smooth walking bass: C → E → F → D → C. This is professional-level arranging!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'Hear the difference? The emotion is still there, but now it flows beautifully!'
                },
                // Step 23: Summary
                {
                    instruction: 'You\'ve combined two powerful techniques: emotional minor chords AND smooth voice leading. This is how the pros do it!',
                    callout: 'The ii chord is thoughtful, the vi chord is emotional, and voice leading makes everything flow. You now have serious arranging skills!',
                    validation: null,
                    successMessage: null
                },
                // Step 24: Completion with free explore
                {
                    instruction: 'Congratulations! You can now craft emotional progressions with professional voice leading. Experiment with different combinations!',
                    callout: 'Challenge: Try the mysterious iii chord (Em) in a progression and apply voice leading. Every chord can be optimized!',
                    validation: null,
                    successMessage: 'You\'ve mastered emotional chords + voice leading! Keep experimenting.',
                    allowFreeExplore: true
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

// ===========================================
// INTERMEDIATE LESSON TUTORIALS
// ===========================================

/**
 * "The Power of 7th Chords" Tutorial
 * Guides users through building and hearing the four types of 7th chords
 * and the jazz ii-V-I progression.
 */
export const seventhChordsTutorial = defineTutorial({
    id: 'seventh-chords',
    title: 'The Power of 7th Chords',
    lessonId: 'lesson-seventh-chords',
    steps: [
        {
            type: 'guided_builder',
            title: 'Build and Compare 7th Chords!',
            instruction: 'Let\'s explore the four types of 7th chords and build the famous jazz ii-V-I progression.',
            targetTab: 'builder',
            guidedSteps: [
                // Step 1: Introduction
                {
                    instruction: 'Welcome! 7th chords add a fourth note to triads, creating richer, more sophisticated harmony. Let\'s explore all four types!',
                    callout: 'The four 7th chord types: Major 7 (dreamy), Dominant 7 (tense), Minor 7 (smooth), Half-diminished (mysterious).',
                    validation: null,
                    successMessage: null
                },
                // Step 2: Select C as root
                {
                    instruction: 'Let\'s start by building a Cmaj7 chord. Select "C" as the root note.',
                    spotlight: '#builder-note-selector',
                    targetElement: '#builder-note-selector',
                    callout: 'We\'ll build all four 7th chord types on C so you can hear how the same root creates completely different moods.',
                    validation: { type: 'root_selected', value: 'C' },
                    successMessage: 'C selected!'
                },
                // Step 3: Select Major 7
                {
                    instruction: 'Now select "Major 7" as the chord type. This is the dreamy, sophisticated sound.',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    callout: 'Cmaj7 = C-E-G-B. The major 7th (B) is just a half step below the root, creating a floating, romantic sound.',
                    validation: { type: 'type_selected', value: 'Major 7' },
                    successMessage: 'Major 7 selected!'
                },
                // Step 4: Play Cmaj7
                {
                    instruction: 'Play the Cmaj7 chord. Listen to that dreamy, lush quality!',
                    callout: 'This is the sound of jazz ballads and bossa nova. Cmaj7 can end a song - it\'s stable yet colorful.',
                    validation: { type: 'chord_played' },
                    successMessage: 'Beautiful! That floating quality is the major 7th sound.'
                },
                // Step 5: Switch to Dominant 7
                {
                    instruction: 'Now switch to "Dominant 7" - the most important chord type in music!',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    callout: 'C7 = C-E-G-Bb. Just one note different from Cmaj7 (Bb instead of B), but completely different character!',
                    validation: { type: 'type_selected', value: 'Dominant 7' },
                    successMessage: 'Dominant 7 selected!'
                },
                // Step 6: Play C7
                {
                    instruction: 'Play the C7 chord. Feel the tension - this chord wants to resolve!',
                    callout: 'C7 contains a tritone (E-Bb) - the most unstable interval. This is why dominant 7ths create such urgency.',
                    validation: { type: 'chord_played' },
                    successMessage: 'That tension is the tritone! C7 wants to resolve to F.'
                },
                // Step 7: Switch to Minor 7
                {
                    instruction: 'Now try "Minor 7" - the smooth, jazzy minor sound.',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    callout: 'Cm7 = C-Eb-G-Bb. This softens the harshness of a minor chord, making it more sophisticated.',
                    validation: { type: 'type_selected', value: 'Minor 7' },
                    successMessage: 'Minor 7 selected!'
                },
                // Step 8: Play Cm7
                {
                    instruction: 'Play the Cm7 chord. Hear how smooth and mellow it is!',
                    callout: 'Jazz musicians almost always use m7 instead of plain minor. It\'s the "cool jazz" sound.',
                    validation: { type: 'chord_played' },
                    successMessage: 'That mellow quality is why jazz loves the minor 7th!'
                },
                // Step 9: Switch to Half-Diminished
                {
                    instruction: 'Finally, try "Half Dim 7" (m7♭5) - the dark, mysterious chord.',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    callout: 'Cm7♭5 = C-Eb-Gb-Bb. The diminished 5th (Gb) adds an extra layer of tension and darkness.',
                    validation: { type: 'type_selected', value: 'Half Dim 7' },
                    successMessage: 'Half-diminished selected!'
                },
                // Step 10: Play Cm7b5
                {
                    instruction: 'Play the Cm7♭5 chord. This questioning, suspenseful sound is unique!',
                    callout: 'The half-diminished chord appears naturally on the 7th degree of major keys. It\'s the "ii" chord in minor key ii-V-i.',
                    validation: { type: 'chord_played' },
                    successMessage: 'That dark, mysterious quality is the half-diminished sound!'
                },
                // Step 11: Now build ii-V-I
                {
                    instruction: 'Now let\'s build the most important progression in jazz: ii-V-I! Switch to the Progression Workshop.',
                    callout: 'In C major: ii = Dm7, V = G7, I = Cmaj7. This progression is the foundation of jazz harmony.',
                    validation: null,
                    successMessage: null
                },
                // Step 12: Go to trainer tab
                {
                    instruction: 'Click "Go to Progression Workshop" or switch to the Trainer tab to build the ii-V-I.',
                    targetTab: 'trainer',
                    callout: 'We\'ll build Dm7 → G7 → Cmaj7 - the smooth, sophisticated sound of jazz.',
                    validation: null,
                    successMessage: null
                }
            ]
        },
        // Part 2: Build ii-V-I in Progression Workshop
        {
            type: 'guided_builder',
            title: 'Build the Jazz ii-V-I Progression',
            instruction: 'Now let\'s build the classic jazz ii-V-I: Dm7 → G7 → Cmaj7.',
            targetTab: 'trainer',
            guidedSteps: [
                // Step 1: Clear and start fresh
                {
                    instruction: 'Let\'s build the most important jazz progression: ii-V-I. Use the Quick Add form.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'ii-V-I in C: Dm7 (preparation) → G7 (tension) → Cmaj7 (resolution). Pure jazz magic!',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        const form = document.getElementById('quick-add-chord-form-melody');
                        if (form && form.classList.contains('hidden')) {
                            if (window.toggleQuickAddChordForm) {
                                window.toggleQuickAddChordForm('quick-add-chord-form-melody');
                            }
                        }
                    }
                },
                // Step 2: Add Dm7
                {
                    instruction: 'Add D Minor 7 - the "ii" chord. Select "D" as root and "Minor 7" as type.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Dm7 is the preparation chord. It creates a smooth, contemplative feeling before the tension.',
                    validation: { type: 'progression_chord_added', value: 'D Minor 7' },
                    successMessage: 'The ii chord is in! Smooth preparation.'
                },
                // Step 3: Add G7
                {
                    instruction: 'Add G Dominant 7 - the "V" chord. Select "G" as root and "Dominant 7" as type.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'G7 contains the tritone (B-F) that creates maximum tension, pulling strongly to C.',
                    validation: { type: 'progression_chord_added', value: 'G Dominant 7' },
                    successMessage: 'The V7 chord adds the tension! Feel that pull toward C.'
                },
                // Step 4: Add Cmaj7
                {
                    instruction: 'Complete with C Major 7 - the "I" chord. Select "C" as root and "Major 7" as type.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Cmaj7 is the destination. The tritone resolves (B→C, F→E), creating deep satisfaction.',
                    validation: { type: 'progression_chord_added', value: 'C Major 7' },
                    successMessage: 'The I chord completes the journey!'
                },
                // Step 5: Play the ii-V-I
                {
                    instruction: 'Play your ii-V-I progression! This is the sound of jazz.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'Dm7 → G7 → Cmaj7. Preparation → Tension → Resolution. Learn this in all 12 keys!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'You just played the foundation of jazz harmony!'
                },
                // Step 6: Completion
                {
                    instruction: 'Congratulations! You\'ve mastered 7th chords and the ii-V-I progression. This is the building block of jazz!',
                    callout: 'Practice: Try ii-V-I in other keys. G: Am7-D7-Gmaj7. F: Gm7-C7-Fmaj7. The pattern is universal!',
                    validation: null,
                    successMessage: 'You\'ve unlocked jazz harmony! Keep exploring.',
                    allowFreeExplore: true
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

/**
 * "Secondary Dominants" Tutorial
 * Teaches how to find and use secondary dominants (V/x chords)
 * to create extra tension and color in progressions.
 */
export const secondaryDominantsTutorial = defineTutorial({
    id: 'secondary-dominants',
    title: 'Secondary Dominants',
    lessonId: 'lesson-secondary-dominants',
    steps: [
        {
            type: 'guided_builder',
            title: 'Master Secondary Dominants!',
            instruction: 'Learn to create extra tension by using the V chord of any chord in the key.',
            targetTab: 'trainer',
            guidedSteps: [
                // Step 1: Introduction
                {
                    instruction: 'Secondary dominants are like giving ANY chord its own "red carpet introduction." Let\'s explore the most common ones!',
                    callout: 'V/V is the secondary dominant of the V chord. In C major, that\'s D7 (the V of G). It makes arriving at G more dramatic!',
                    validation: null,
                    successMessage: null
                },
                // Step 2: Show Quick Add form
                {
                    instruction: 'We\'ll use the Quick Add form to build progressions that showcase secondary dominants.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'First, we\'ll build C → D7 → G → C to hear V/V (D7 leading to G).',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        const form = document.getElementById('quick-add-chord-form-melody');
                        if (form && form.classList.contains('hidden')) {
                            if (window.toggleQuickAddChordForm) {
                                window.toggleQuickAddChordForm('quick-add-chord-form-melody');
                            }
                        }
                    }
                },
                // Step 3: Add C Major
                {
                    instruction: 'Start with C Major - our home base.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Home established!'
                },
                // Step 4: Add D7 (V/V)
                {
                    instruction: 'Now add D Dominant 7 - this is V/V! Select "D" as root and "Dominant 7" as type.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'D7 is the V chord OF G. It contains the tritone F#-C that resolves to G. D7 is not in C major, but it works because it leads to G!',
                    validation: { type: 'progression_chord_added', value: 'D Dominant 7' },
                    successMessage: 'V/V is in! Notice the F# - that\'s not in C major, but it adds color!'
                },
                // Step 5: Add G Major
                {
                    instruction: 'Add G Major - the target of our secondary dominant.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'D7 → G gives G a dramatic arrival. Without D7, C → G is nice. With D7, it\'s dramatic!',
                    validation: { type: 'progression_chord_added', value: 'G Major' },
                    successMessage: 'G arrives with fanfare thanks to D7!'
                },
                // Step 6: Add final C
                {
                    instruction: 'Complete with C Major for the full journey.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Progression complete!'
                },
                // Step 7: Play V/V progression
                {
                    instruction: 'Play the progression! Listen to how D7 creates extra drama before G.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'C → D7 → G → C. That D7 gives G a "royal entrance." This is V/V in action!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'Hear how D7 makes G\'s arrival more dramatic!'
                },
                // Step 8: Clear for next example
                {
                    instruction: 'Now let\'s try V/vi - creating drama before the emotional Am chord. Click "Clear All".',
                    spotlight: '#action-clear-progression',
                    targetElement: '#action-clear-progression',
                    callout: 'V/vi in C major is E7. E7 → Am gives the vi chord a powerful introduction!',
                    validation: { type: 'progression_cleared' },
                    successMessage: 'Ready for V/vi!'
                },
                // Step 9: Build V/vi progression
                {
                    instruction: 'Add C Major to start.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Home base!'
                },
                // Step 10: Add E7
                {
                    instruction: 'Add E Dominant 7 - this is V/vi! Select "E" as root and "Dominant 7" as type.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'E7 contains G# - not in C major! But this "borrowed" note creates a powerful pull to Am.',
                    validation: { type: 'progression_chord_added', value: 'E Dominant 7' },
                    successMessage: 'V/vi is in! That G# adds spice.'
                },
                // Step 11: Add Am
                {
                    instruction: 'Add A Minor - the emotional target of our secondary dominant.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'E7 → Am is incredibly powerful. The G# resolves up to A, creating an emotional punch!',
                    validation: { type: 'progression_chord_added', value: 'A Minor' },
                    successMessage: 'Am arrives with emotional weight!'
                },
                // Step 12: Add G and C
                {
                    instruction: 'Add G Major and then C Major to complete.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'G Major' },
                    successMessage: 'Almost there!'
                },
                // Step 13: Add final C
                {
                    instruction: 'Complete with C Major.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Complete!'
                },
                // Step 14: Play V/vi progression
                {
                    instruction: 'Play this progression! E7 → Am is one of the most emotional moments in music.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'C → E7 → Am → G → C. That E7 creates a moment of drama before the emotional Am.',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'The E7 intensifies the emotional Am!'
                },
                // Step 15: Completion
                {
                    instruction: 'You\'ve learned V/V and V/vi - the two most common secondary dominants. Any chord can have its own V chord!',
                    callout: 'Try V/ii (A7 → Dm) and V/IV (C7 → F). Each secondary dominant adds drama to its target chord.',
                    validation: null,
                    successMessage: 'You now understand secondary dominants!',
                    allowFreeExplore: true
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

/**
 * "Borrowed Chords" Tutorial
 * Teaches modal interchange - borrowing chords from the parallel minor
 * to add emotional color to major key progressions.
 */
export const borrowedChordsTutorial = defineTutorial({
    id: 'borrowed-chords',
    title: 'Borrowed Chords',
    lessonId: 'lesson-borrowed-chords',
    steps: [
        {
            type: 'guided_builder',
            title: 'Add Color with Borrowed Chords!',
            instruction: 'Learn to "borrow" chords from C minor to add emotional depth to C major progressions.',
            targetTab: 'trainer',
            guidedSteps: [
                // Step 1: Introduction
                {
                    instruction: 'Borrowed chords come from the parallel minor key. In C major, we can borrow from C minor to add "blue notes" and emotional color!',
                    callout: 'The most common borrowed chords: ♭VII (Bb - epic rock), iv (Fm - devastating emotion), ♭VI (Ab - wonder/surprise).',
                    validation: null,
                    successMessage: null
                },
                // Step 2: Show Quick Add form
                {
                    instruction: 'Let\'s build a rock progression using the ♭VII chord (Bb).',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'C → Bb → F → C. The Bb is borrowed from C minor - it adds that epic rock quality!',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        const form = document.getElementById('quick-add-chord-form-melody');
                        if (form && form.classList.contains('hidden')) {
                            if (window.toggleQuickAddChordForm) {
                                window.toggleQuickAddChordForm('quick-add-chord-form-melody');
                            }
                        }
                    }
                },
                // Step 3: Add C Major
                {
                    instruction: 'Start with C Major - our home in the major key.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Home established in C major!'
                },
                // Step 4: Add Bb Major (♭VII)
                {
                    instruction: 'Add Bb Major - the ♭VII borrowed chord! Select "Bb" as root and "Major" as type.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Bb is NOT in C major (C major has B natural). We\'re borrowing it from C minor for that rock/epic quality!',
                    validation: { type: 'progression_chord_added', value: 'Bb Major' },
                    successMessage: '♭VII is in! This is the rock anthem sound.'
                },
                // Step 5: Add F Major
                {
                    instruction: 'Add F Major - the IV chord.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Bb → F is a very smooth motion. The ♭VII often moves to IV or I.',
                    validation: { type: 'progression_chord_added', value: 'F Major' },
                    successMessage: 'The IV chord completes the rock sound!'
                },
                // Step 6: Add final C
                {
                    instruction: 'Complete with C Major.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Rock progression complete!'
                },
                // Step 7: Play ♭VII progression
                {
                    instruction: 'Play the progression! Listen to that epic, powerful ♭VII sound.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'C → Bb → F → C. This is the sound of rock anthems and movie climaxes!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'That epic quality comes from the borrowed Bb!'
                },
                // Step 8: Clear for iv example
                {
                    instruction: 'Now let\'s try the most emotional borrowed chord: iv (Fm). Click "Clear All".',
                    spotlight: '#action-clear-progression',
                    targetElement: '#action-clear-progression',
                    callout: 'The iv chord (Fm instead of F) contains Ab, which adds devastating emotion. Think "Creep" by Radiohead!',
                    validation: { type: 'progression_cleared' },
                    successMessage: 'Ready for the emotional iv chord!'
                },
                // Step 9: Build iv progression
                {
                    instruction: 'Add C Major to start.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Home!'
                },
                // Step 10: Add F Major first
                {
                    instruction: 'Add F Major - the normal IV chord.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'We\'ll play F Major, then F minor to hear the dramatic difference.',
                    validation: { type: 'progression_chord_added', value: 'F Major' },
                    successMessage: 'Normal IV in place.'
                },
                // Step 11: Add F minor (iv)
                {
                    instruction: 'Now add F Minor - the borrowed iv chord! Select "F" as root and "Minor" as type.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Fm contains Ab - the "♭6" from C minor. This is one of the most emotional sounds in music!',
                    validation: { type: 'progression_chord_added', value: 'F Minor' },
                    successMessage: 'The emotional iv is in!'
                },
                // Step 12: Add final C
                {
                    instruction: 'Complete with C Major.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Complete!'
                },
                // Step 13: Play iv progression
                {
                    instruction: 'Play it! Listen to how Fm hits differently than F.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'C → F → Fm → C. That moment when F becomes Fm is pure emotion. The Ab is devastating!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'Feel that emotional weight when F becomes Fm!'
                },
                // Step 14: Clear for ♭VI example
                {
                    instruction: 'One more: ♭VI (Ab) adds wonder and surprise. Click "Clear All".',
                    spotlight: '#action-clear-progression',
                    targetElement: '#action-clear-progression',
                    validation: { type: 'progression_cleared' },
                    successMessage: 'Ready for ♭VI!'
                },
                // Step 15: Build ♭VI-♭VII-I
                {
                    instruction: 'Let\'s build the cinematic ♭VI-♭VII-I: Ab → Bb → C. Start with C Major.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Starting point!'
                },
                // Step 16: Add Ab (♭VI)
                {
                    instruction: 'Add Ab Major - the ♭VI chord. Select "Ab" as root and "Major" as type.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Ab is the ♭VI - it creates a feeling of wonder or bittersweetness. Very cinematic!',
                    validation: { type: 'progression_chord_added', value: 'Ab Major' },
                    successMessage: '♭VI adds that sense of wonder!'
                },
                // Step 17: Add Bb (♭VII)
                {
                    instruction: 'Add Bb Major - the ♭VII chord.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: '♭VI → ♭VII together creates a powerful sweeping motion toward home.',
                    validation: { type: 'progression_chord_added', value: 'Bb Major' },
                    successMessage: '♭VII building momentum!'
                },
                // Step 18: Add final C
                {
                    instruction: 'Complete with C Major for the triumphant resolution.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Epic finish!'
                },
                // Step 19: Play cinematic progression
                {
                    instruction: 'Play it! This is pure film score material.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'C → Ab → Bb → C. Both ♭VI and ♭VII borrowed together. This is the sound of movie climaxes!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'That sweeping, cinematic sound comes from chaining borrowed chords!'
                },
                // Step 20: Completion
                {
                    instruction: 'You\'ve mastered borrowed chords! ♭VII for rock power, iv for raw emotion, ♭VI for wonder.',
                    callout: 'Try ♭III (Eb in C) for alt-rock color. Mix and match borrowed chords to create your signature sound!',
                    validation: null,
                    successMessage: 'You now have borrowed chords in your toolkit!',
                    allowFreeExplore: true
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

/**
 * "Creating Tension and Release" Tutorial
 * Teaches how to deliberately create and resolve musical tension
 * through dominant function, suspensions, and deceptive cadences.
 */
export const tensionReleaseTutorial = defineTutorial({
    id: 'tension-release',
    title: 'Creating Tension and Release',
    lessonId: 'lesson-tension-release',
    steps: [
        {
            type: 'guided_builder',
            title: 'Master Musical Tension and Release!',
            instruction: 'Learn to create tension and delay or fulfill its resolution for maximum emotional impact.',
            targetTab: 'trainer',
            guidedSteps: [
                // Step 1: Introduction
                {
                    instruction: 'All great music manipulates tension and release. Tension makes you lean forward; release makes you sigh with satisfaction. Let\'s explore both!',
                    callout: 'The V7 chord creates maximum tension. Resolving to I is release. But the magic is in HOW you get there!',
                    validation: null,
                    successMessage: null
                },
                // Step 2: Basic V-I resolution first
                {
                    instruction: 'First, let\'s hear the basic V-I resolution - the most fundamental tension/release in music.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'G7 → C is pure tension → resolution. The tritone in G7 (B-F) resolves to the stability of C.',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        const form = document.getElementById('quick-add-chord-form-melody');
                        if (form && form.classList.contains('hidden')) {
                            if (window.toggleQuickAddChordForm) {
                                window.toggleQuickAddChordForm('quick-add-chord-form-melody');
                            }
                        }
                    }
                },
                // Step 3: Add G7
                {
                    instruction: 'Add G Dominant 7 - the tension chord.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'G Dominant 7' },
                    successMessage: 'G7 - maximum tension!'
                },
                // Step 4: Add C
                {
                    instruction: 'Add C Major - the release.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'The resolution!'
                },
                // Step 5: Play V-I
                {
                    instruction: 'Play this fundamental cadence. Feel the tension melt into release.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'G7 → C. The B wants to go up to C, the F wants to go down to E. Maximum satisfaction!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'That "ahhh" feeling is tension releasing!'
                },
                // Step 6: Now delay the resolution
                {
                    instruction: 'Now let\'s DELAY the resolution for more impact. Click "Clear All".',
                    spotlight: '#action-clear-progression',
                    targetElement: '#action-clear-progression',
                    callout: 'Great music doesn\'t always resolve immediately. Delaying resolution builds anticipation!',
                    validation: { type: 'progression_cleared' },
                    successMessage: 'Ready to build delayed tension!'
                },
                // Step 7: Build delayed resolution
                {
                    instruction: 'Start with C Major.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Home first!'
                },
                // Step 8: Add Am
                {
                    instruction: 'Add A Minor - building momentum.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'A Minor' },
                    successMessage: 'Emotional motion!'
                },
                // Step 9: Add G7
                {
                    instruction: 'Add G7 - creating tension.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'G Dominant 7' },
                    successMessage: 'Tension builds!'
                },
                // Step 10: Add F (delay!)
                {
                    instruction: 'Now instead of going to C, add F Major! This DELAYS the resolution.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'F after G7 is surprising! The ear expects C but gets F. This builds even more anticipation.',
                    validation: { type: 'progression_chord_added', value: 'F Major' },
                    successMessage: 'Delayed! The tension extends.'
                },
                // Step 11: Add final C
                {
                    instruction: 'Now resolve to C Major. After the delay, the resolution is even sweeter!',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Finally home!'
                },
                // Step 12: Play delayed resolution
                {
                    instruction: 'Play it! The F after G7 delays the expected resolution, making C\'s arrival more powerful.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'C → Am → G7 → F → C. That G7 → F is a "fake out" that makes the final C even more satisfying!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'Delayed gratification makes the resolution sweeter!'
                },
                // Step 13: Clear for deceptive cadence
                {
                    instruction: 'Now let\'s try the "deceptive cadence" - V7 going to vi instead of I. Click "Clear All".',
                    spotlight: '#action-clear-progression',
                    targetElement: '#action-clear-progression',
                    callout: 'G7 → Am instead of G7 → C is a plot twist! The ear expects one thing and gets another.',
                    validation: { type: 'progression_cleared' },
                    successMessage: 'Ready for the deceptive cadence!'
                },
                // Step 14: Build deceptive cadence
                {
                    instruction: 'Build C → F → G7 → Am → G7 → C.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'First G7 → Am is deceptive. Second G7 → C resolves for real!',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'Starting the journey!'
                },
                // Step 15-19: Complete the progression
                {
                    instruction: 'Add F Major.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'F Major' },
                    successMessage: 'Building!'
                },
                {
                    instruction: 'Add G7 - here comes the tension!',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'G Dominant 7' },
                    successMessage: 'Tension set!'
                },
                {
                    instruction: 'Now the twist: Add A Minor instead of C! This is the deceptive cadence.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'G7 → Am is surprising and emotional. Am shares notes with C, so it\'s not jarring, just unexpected!',
                    validation: { type: 'progression_chord_added', value: 'A Minor' },
                    successMessage: 'The deception! Expected C, got Am.'
                },
                {
                    instruction: 'Add G7 again for another try at resolution.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'G Dominant 7' },
                    successMessage: 'Tension returns!'
                },
                {
                    instruction: 'Finally resolve properly to C Major.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'True resolution at last!'
                },
                // Step 20: Play deceptive cadence
                {
                    instruction: 'Play it! Listen to how the first G7 → Am surprises you, making the real resolution more satisfying.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'The deceptive cadence is used in countless emotional songs - it\'s a harmonic "plot twist"!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'You felt the deception and the eventual resolution!'
                },
                // Step 21: Completion
                {
                    instruction: 'You now understand tension and release! Delay it, deceive with it, or deliver it - the choice creates emotion.',
                    callout: 'Try stacking tension: secondary dominants + suspensions + delays = maximum impact before resolution!',
                    validation: null,
                    successMessage: 'You\'ve mastered the art of tension and release!',
                    allowFreeExplore: true
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

/**
 * "The Melody-Chord Relationship" Tutorial
 * Teaches chord tones vs non-chord tones and how melodies
 * interact with underlying harmony.
 */
export const melodyChordTutorial = defineTutorial({
    id: 'melody-chord',
    title: 'The Melody-Chord Relationship',
    lessonId: 'lesson-melody-chord',
    steps: [
        {
            type: 'guided_builder',
            title: 'Understand Melody and Harmony Together!',
            instruction: 'Learn how melodies relate to chords through chord tones and guide tones.',
            targetTab: 'builder',
            guidedSteps: [
                // Step 1: Introduction
                {
                    instruction: 'When a melody note is part of the current chord, it sounds stable. When it\'s not, it creates tension. Let\'s explore this relationship!',
                    callout: 'Chord tones (1-3-5-7) are stable landing points. Non-chord tones (passing tones, suspensions) create movement.',
                    validation: null,
                    successMessage: null
                },
                // Step 2: Build C Major 7 to see chord tones
                {
                    instruction: 'Let\'s build a Cmaj7 chord to see its chord tones. Select "C" as root.',
                    spotlight: '#builder-note-selector',
                    targetElement: '#builder-note-selector',
                    callout: 'Cmaj7 has four chord tones: C (root), E (3rd), G (5th), B (7th). These are stable melody notes over this chord.',
                    validation: { type: 'root_selected', value: 'C' },
                    successMessage: 'C selected!'
                },
                // Step 3: Select Major 7
                {
                    instruction: 'Select "Major 7" as the chord type.',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    callout: 'The highlighted keys on the keyboard are the chord tones - stable melody notes!',
                    validation: { type: 'type_selected', value: 'Major 7' },
                    successMessage: 'Cmaj7 built!'
                },
                // Step 4: Point out chord tones on keyboard
                {
                    instruction: 'Look at the keyboard! C, E, G, and B are highlighted. A melody singing these notes over Cmaj7 will sound stable and "correct".',
                    callout: 'C = root (most stable), E = 3rd (defines major/minor), G = 5th (supports), B = 7th (adds color).',
                    validation: null,
                    successMessage: null
                },
                // Step 5: Play the chord
                {
                    instruction: 'Play the chord and imagine a melody on E (the 3rd). It would sound smooth and consonant.',
                    callout: 'The 3rd of a chord is often the most beautiful melody note - it defines the chord\'s character.',
                    validation: { type: 'chord_played' },
                    successMessage: 'Those four notes are your safe melody landing spots!'
                },
                // Step 6: Now try Dm7
                {
                    instruction: 'Now let\'s see how chord tones change with different chords. Select "D" as root.',
                    spotlight: '#builder-note-selector',
                    targetElement: '#builder-note-selector',
                    callout: 'When the chord changes, the "stable" melody notes change too. A good melody follows this!',
                    validation: { type: 'root_selected', value: 'D' },
                    successMessage: 'D selected!'
                },
                // Step 7: Select Minor 7
                {
                    instruction: 'Select "Minor 7" - we\'re building Dm7.',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    callout: 'Dm7 = D, F, A, C. Notice: C was the root of Cmaj7, but now C is the 7th of Dm7!',
                    validation: { type: 'type_selected', value: 'Minor 7' },
                    successMessage: 'Dm7 built!'
                },
                // Step 8: Play Dm7
                {
                    instruction: 'Play Dm7. Notice the highlighted keys changed - D, F, A, C are now the stable notes.',
                    callout: 'A melody note of C works over both Cmaj7 AND Dm7, but for different reasons - root vs 7th.',
                    validation: { type: 'chord_played' },
                    successMessage: 'Different chord = different stable notes!'
                },
                // Step 9: Introduce guide tones
                {
                    instruction: 'In jazz, the 3rd and 7th of each chord are called "guide tones" - they define the chord and lead smoothly to the next.',
                    callout: 'Cmaj7: E and B (3rd and 7th). Dm7: F and C (3rd and 7th). Notice how F and E are close, C and B are close!',
                    validation: null,
                    successMessage: null
                },
                // Step 10: Now go to trainer to build progression
                {
                    instruction: 'Let\'s see guide tones in action over a ii-V-I progression!',
                    callout: 'We\'ll build Dm7 → G7 → Cmaj7 and trace how the 3rds and 7ths move smoothly.',
                    validation: null,
                    successMessage: null
                }
            ]
        },
        // Part 2: Guide tones in a progression
        {
            type: 'guided_builder',
            title: 'See Guide Tones Move Through a Progression',
            instruction: 'Build a ii-V-I and understand how guide tones create smooth melodic motion.',
            targetTab: 'trainer',
            guidedSteps: [
                // Step 1: Introduction to guide tones in progression
                {
                    instruction: 'We\'ll build ii-V-I (Dm7-G7-Cmaj7) and trace the guide tones: 3rd and 7th of each chord.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Dm7: 3rd=F, 7th=C. G7: 3rd=B, 7th=F. Cmaj7: 3rd=E, 7th=B. Watch how close these notes are!',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        const form = document.getElementById('quick-add-chord-form-melody');
                        if (form && form.classList.contains('hidden')) {
                            if (window.toggleQuickAddChordForm) {
                                window.toggleQuickAddChordForm('quick-add-chord-form-melody');
                            }
                        }
                    }
                },
                // Step 2: Add Dm7
                {
                    instruction: 'Add D Minor 7.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Dm7 guide tones: F (3rd) and C (7th). These define the chord\'s character.',
                    validation: { type: 'progression_chord_added', value: 'D Minor 7' },
                    successMessage: 'Dm7: F and C are the guide tones!'
                },
                // Step 3: Add G7
                {
                    instruction: 'Add G Dominant 7.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'G7 guide tones: B (3rd) and F (7th). Notice: F stays! C moves down to B.',
                    validation: { type: 'progression_chord_added', value: 'G Dominant 7' },
                    successMessage: 'G7: B and F are the guide tones!'
                },
                // Step 4: Add Cmaj7
                {
                    instruction: 'Add C Major 7.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Cmaj7 guide tones: E (3rd) and B (7th). F resolves to E! B stays!',
                    validation: { type: 'progression_chord_added', value: 'C Major 7' },
                    successMessage: 'Cmaj7: E and B are the guide tones!'
                },
                // Step 5: Play and trace guide tones
                {
                    instruction: 'Play the progression! The guide tones move: (F,C) → (B,F) → (E,B). Notice the smooth half-step motions!',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'C→B (half step down), F stays, then B stays, F→E (half step down). This is beautiful voice leading!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'Guide tones create the smoothest melodic motion!'
                },
                // Step 6: Melody implication
                {
                    instruction: 'A melody following these guide tones (F→B→E on the 3rds, or C→F→B on the 7ths) would sound incredibly smooth and "right".',
                    callout: 'Jazz soloists often target guide tones. They\'re the "skeleton" of a good melody over chord changes!',
                    validation: null,
                    successMessage: null
                },
                // Step 7: Completion
                {
                    instruction: 'You now understand how melody relates to harmony through chord tones and guide tones!',
                    callout: 'When writing melodies: land on chord tones on strong beats, use passing tones for movement, and follow guide tones for smooth voice leading!',
                    validation: null,
                    successMessage: 'You understand the melody-chord relationship!',
                    allowFreeExplore: true
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

// ===========================================
// SCALE EXPLORER TUTORIAL
// ===========================================

/**
 * "Mastering Scale Types" Tutorial
 * Guides users through exploring different scale types
 * using the Scale Explorer to hear and compare them.
 */
export const scaleTypesTutorial = defineTutorial({
    id: 'scale-types',
    title: 'Mastering Scale Types',
    lessonId: 'lesson-scale-types',
    steps: [
        {
            type: 'guided_builder',
            title: 'Explore Scale Types in the Scale Explorer!',
            instruction: 'Let\'s explore the different scale families and hear what makes each unique.',
            targetTab: 'scales',
            guidedSteps: [
                // Step 1: Introduction
                {
                    instruction: 'Welcome to the Scale Explorer! We\'ll explore the 15 scale types, organized by family: Major/Minor, Pentatonic, Modes, and Exotic scales.',
                    callout: 'Each scale exists for a reason - different cultures and composers needed specific colors that other scales couldn\'t provide.',
                    validation: null,
                    successMessage: null
                },
                // Step 2: Point to root selector
                {
                    instruction: 'First, let\'s set our root note. Select "C" as the root - it\'s the easiest to visualize since it has no sharps or flats.',
                    spotlight: '#scale-note-selector',
                    targetElement: '#scale-note-selector',
                    callout: 'The root note is the "home" of the scale - where it starts and ends.',
                    validation: null,
                    successMessage: null
                },
                // Step 3: Start with Major
                {
                    instruction: 'Select "Major (Ionian)" from the scale type selector.',
                    spotlight: '#scale-type-selector',
                    targetElement: '#scale-type-selector',
                    callout: 'The Major scale is the foundation of Western music. All white keys from C to C!',
                    validation: null,
                    successMessage: null
                },
                // Step 4: Play Major
                {
                    instruction: 'Click "Play ▲" to hear the C Major scale ascending.',
                    spotlight: '#scale-play-asc',
                    targetElement: '#scale-play-asc',
                    callout: 'C Major: C-D-E-F-G-A-B-C. The "Do-Re-Mi" scale. Bright, happy, resolved.',
                    validation: null,
                    successMessage: 'The major scale - the foundation of Western harmony!'
                },
                // Step 5: Switch to Natural Minor
                {
                    instruction: 'Now select "Natural Minor (Aeolian)" to hear the sad counterpart.',
                    spotlight: '#scale-type-selector',
                    targetElement: '#scale-type-selector',
                    callout: 'Natural Minor has ♭3, ♭6, and ♭7 compared to major. This creates its darker sound.',
                    validation: null,
                    successMessage: null
                },
                // Step 6: Play Natural Minor
                {
                    instruction: 'Play the Natural Minor scale.',
                    spotlight: '#scale-play-asc',
                    targetElement: '#scale-play-asc',
                    callout: 'C Natural Minor: C-D-Eb-F-G-Ab-Bb-C. Sad, serious, dramatic.',
                    validation: null,
                    successMessage: 'Hear how the flattened notes create a darker mood!'
                },
                // Step 7: Try Harmonic Minor
                {
                    instruction: 'Select "Harmonic Minor" - this adds a raised 7th to natural minor.',
                    spotlight: '#scale-type-selector',
                    targetElement: '#scale-type-selector',
                    callout: 'Composers needed a leading tone in minor keys. The raised 7th (B natural instead of Bb) pulls strongly to the root.',
                    validation: null,
                    successMessage: null
                },
                // Step 8: Play Harmonic Minor
                {
                    instruction: 'Play the Harmonic Minor scale. Listen for that exotic gap!',
                    spotlight: '#scale-play-asc',
                    targetElement: '#scale-play-asc',
                    callout: 'C Harmonic Minor: C-D-Eb-F-G-Ab-B-C. The 3-half-step gap between Ab and B creates that Middle Eastern flavor!',
                    validation: null,
                    successMessage: 'That exotic sound is why it\'s used in "Hava Nagila" and metal!'
                },
                // Step 9: Now Pentatonic
                {
                    instruction: 'Let\'s try the Pentatonic family. Select "Major Pentatonic".',
                    spotlight: '#scale-type-selector',
                    targetElement: '#scale-type-selector',
                    callout: 'Pentatonic = 5 notes. By removing the 4th and 7th, we eliminate all half steps. No wrong notes possible!',
                    validation: null,
                    successMessage: null
                },
                // Step 10: Play Major Pentatonic
                {
                    instruction: 'Play the Major Pentatonic scale.',
                    spotlight: '#scale-play-asc',
                    targetElement: '#scale-play-asc',
                    callout: 'C Major Pentatonic: C-D-E-G-A-C. Found in every culture worldwide - it\'s universally pleasing!',
                    validation: null,
                    successMessage: 'This is the sound of "Amazing Grace" and countless folk melodies!'
                },
                // Step 11: Minor Pentatonic
                {
                    instruction: 'Now try "Minor Pentatonic" - the rock/blues foundation.',
                    spotlight: '#scale-type-selector',
                    targetElement: '#scale-type-selector',
                    callout: 'Minor Pentatonic is THE scale for rock and blues improvisation. Every guitarist learns this first!',
                    validation: null,
                    successMessage: null
                },
                // Step 12: Play Minor Pentatonic
                {
                    instruction: 'Play the Minor Pentatonic scale.',
                    spotlight: '#scale-play-asc',
                    targetElement: '#scale-play-asc',
                    callout: 'C Minor Pentatonic: C-Eb-F-G-Bb-C. The backbone of rock guitar solos!',
                    validation: null,
                    successMessage: 'If you can play this scale, you can solo over any rock song!'
                },
                // Step 13: Blues Scale
                {
                    instruction: 'Select "Blues" - it\'s Minor Pentatonic plus ONE special note.',
                    spotlight: '#scale-type-selector',
                    targetElement: '#scale-type-selector',
                    callout: 'The Blues Scale adds the ♭5 (tritone) - the "blue note" that changed music forever.',
                    validation: null,
                    successMessage: null
                },
                // Step 14: Play Blues
                {
                    instruction: 'Play the Blues scale. Listen for that tense ♭5!',
                    spotlight: '#scale-play-asc',
                    targetElement: '#scale-play-asc',
                    callout: 'C Blues: C-Eb-F-Gb-G-Bb-C. The Gb→G tension is the soul of blues music!',
                    validation: null,
                    successMessage: 'That one added note (the ♭5) created an entire genre!'
                },
                // Step 15: Explore a Mode - Dorian
                {
                    instruction: 'Now the Modes! Select "Dorian (Mode 2)" - the jazzy minor.',
                    spotlight: '#scale-type-selector',
                    targetElement: '#scale-type-selector',
                    callout: 'Dorian is natural minor with a raised 6th. Same notes as Bb Major, but C is home!',
                    validation: null,
                    successMessage: null
                },
                // Step 16: Play Dorian
                {
                    instruction: 'Play Dorian and compare to Natural Minor in your mind.',
                    spotlight: '#scale-play-asc',
                    targetElement: '#scale-play-asc',
                    callout: 'C Dorian: C-D-Eb-F-G-A-Bb-C. The A natural (vs Ab in natural minor) makes it brighter and jazzier!',
                    validation: null,
                    successMessage: 'This is the sound of "So What" by Miles Davis!'
                },
                // Step 17: Lydian
                {
                    instruction: 'Try "Lydian (Mode 4)" - the dreamy, floating mode.',
                    spotlight: '#scale-type-selector',
                    targetElement: '#scale-type-selector',
                    callout: 'Lydian is major with a #4. This removes the only "dark" interval, making it the brightest mode!',
                    validation: null,
                    successMessage: null
                },
                // Step 18: Play Lydian
                {
                    instruction: 'Play Lydian. Feel that floating, magical quality!',
                    spotlight: '#scale-play-asc',
                    targetElement: '#scale-play-asc',
                    callout: 'C Lydian: C-D-E-F#-G-A-B-C. The F# creates a dreamy, otherworldly sound. Used in film scores for wonder!',
                    validation: null,
                    successMessage: 'The Simpsons theme and many movie "wonder" moments use Lydian!'
                },
                // Step 19: Mixolydian
                {
                    instruction: 'Now "Mixolydian (Mode 5)" - the rock mode.',
                    spotlight: '#scale-type-selector',
                    targetElement: '#scale-type-selector',
                    callout: 'Mixolydian is major with a ♭7. This gives major a bluesy, driving quality.',
                    validation: null,
                    successMessage: null
                },
                // Step 20: Play Mixolydian
                {
                    instruction: 'Play Mixolydian. Classic rock sound!',
                    spotlight: '#scale-play-asc',
                    targetElement: '#scale-play-asc',
                    callout: 'C Mixolydian: C-D-E-F-G-A-Bb-C. The Bb adds rock swagger! "Sweet Home Alabama" is in Mixolydian.',
                    validation: null,
                    successMessage: 'Mixolydian is why classic rock has that bluesy-but-major sound!'
                },
                // Step 21: Whole Tone (exotic)
                {
                    instruction: 'Finally, an exotic scale: "Whole Tone" - all notes equally spaced!',
                    spotlight: '#scale-type-selector',
                    targetElement: '#scale-type-selector',
                    callout: 'Whole Tone divides the octave into 6 equal parts. No sense of "home" - pure floating ambiguity.',
                    validation: null,
                    successMessage: null
                },
                // Step 22: Play Whole Tone
                {
                    instruction: 'Play the Whole Tone scale. Very dreamlike and ungrounded!',
                    spotlight: '#scale-play-asc',
                    targetElement: '#scale-play-asc',
                    callout: 'C Whole Tone: C-D-E-F#-G#-A#-C. Debussy used this for impressionistic, underwater-like passages.',
                    validation: null,
                    successMessage: 'Symmetrical scales like this create ambiguity - nowhere feels like home!'
                },
                // Step 23: Completion
                {
                    instruction: 'You\'ve explored the major scale families! Each scale is a tool for expressing different emotions.',
                    callout: 'Continue exploring: Try Phrygian for Spanish/dark sounds, Locrian for instability, Diminished for jazz tension. The Scale Explorer is your laboratory!',
                    validation: null,
                    successMessage: 'You now understand why 15 different scales exist!',
                    allowFreeExplore: true
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

// ===========================================
// ADVANCED LESSON TUTORIALS
// ===========================================

/**
 * "Introduction to Modes" Tutorial
 * Teaches the seven modes and how to build modal progressions
 * that stay in each mode without slipping back to major/minor.
 */
export const modesIntroTutorial = defineTutorial({
    id: 'modes-intro',
    title: 'Introduction to Modes',
    lessonId: 'lesson-modes-intro',
    steps: [
        {
            type: 'guided_builder',
            title: 'Explore the Modes!',
            instruction: 'Let\'s build progressions in the four most useful modes: Dorian, Phrygian, Lydian, and Mixolydian.',
            targetTab: 'trainer',
            guidedSteps: [
                // Step 1: Introduction
                {
                    instruction: 'Modes are scales derived from the major scale, each with a unique character. We\'ll build progressions that showcase each mode\'s distinctive sound!',
                    callout: 'The four most useful modes: Dorian (jazzy minor), Phrygian (Spanish/dark), Lydian (dreamy), Mixolydian (rock/blues).',
                    validation: null,
                    successMessage: null
                },
                // Step 2: Start with Dorian
                {
                    instruction: 'First, let\'s explore Dorian - the "jazz" mode. It\'s minor but with a brighter 6th. Let\'s build a Dorian vamp.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'D Dorian uses C major\'s notes but treats D as home. The key feature: major IV chord (G) instead of minor!',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        const form = document.getElementById('quick-add-chord-form-melody');
                        if (form && form.classList.contains('hidden')) {
                            if (window.toggleQuickAddChordForm) {
                                window.toggleQuickAddChordForm('quick-add-chord-form-melody');
                            }
                        }
                    }
                },
                // Step 3: Add Dm7
                {
                    instruction: 'Add D Minor 7 - our Dorian home chord.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'In Dorian, the i chord (Dm7) is home. We stay here - no resolving to C major!',
                    validation: { type: 'progression_chord_added', value: 'D Minor 7' },
                    successMessage: 'Dorian home established!'
                },
                // Step 4: Add G7 (the IV chord)
                {
                    instruction: 'Add G7 - this is the IV7 in D Dorian. The major IV is Dorian\'s signature!',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'G7 contains B natural (not Bb). In natural minor, this would be Gm. The major IV is what makes it Dorian!',
                    validation: { type: 'progression_chord_added', value: 'G Dominant 7' },
                    successMessage: 'The IV7 - Dorian\'s signature chord!'
                },
                // Step 5: Repeat the vamp
                {
                    instruction: 'Add Dm7 again to complete the vamp.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'D Minor 7' },
                    successMessage: 'Vamp complete!'
                },
                // Step 6: Add one more G7
                {
                    instruction: 'Add G7 again for a full two-bar vamp.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'G Dominant 7' },
                    successMessage: 'The classic jazz Dorian vamp!'
                },
                // Step 7: Play Dorian vamp
                {
                    instruction: 'Play the Dorian vamp! This is "So What" territory - pure modal jazz.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'Notice: we DON\'T resolve to C! D is home. The B natural in G7 is what makes it Dorian, not natural minor.',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'That\'s the Dorian sound - jazzy, sophisticated, but still minor!'
                },
                // Step 8: Clear for Mixolydian
                {
                    instruction: 'Now let\'s try Mixolydian - the rock/blues mode. Click "Clear All".',
                    spotlight: '#action-clear-progression',
                    targetElement: '#action-clear-progression',
                    callout: 'Mixolydian is major but with a ♭7. The ♭VII chord is its signature - pure rock sound!',
                    validation: { type: 'progression_cleared' },
                    successMessage: 'Ready for Mixolydian!'
                },
                // Step 9: Build Mixolydian progression
                {
                    instruction: 'Add G Major - our Mixolydian home.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'G Mixolydian is major but has F natural (♭7) instead of F#. This gives it that bluesy rock quality.',
                    validation: { type: 'progression_chord_added', value: 'G Major' },
                    successMessage: 'Mixolydian home!'
                },
                // Step 10: Add F (♭VII)
                {
                    instruction: 'Add F Major - the ♭VII chord! This is Mixolydian\'s signature.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'F is the ♭VII of G. In G major, this chord would be F#dim. The major ♭VII is pure Mixolydian rock!',
                    validation: { type: 'progression_chord_added', value: 'F Major' },
                    successMessage: 'The ♭VII - rock\'s favorite chord!'
                },
                // Step 11: Add C
                {
                    instruction: 'Add C Major - the IV chord.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'The IV chord!'
                },
                // Step 12: Return to G
                {
                    instruction: 'Return to G Major.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'G Major' },
                    successMessage: 'Back home!'
                },
                // Step 13: Play Mixolydian
                {
                    instruction: 'Play the Mixolydian progression! This is the sound of classic rock.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'G - F - C - G. The F (♭VII) is what makes it Mixolydian, not G major. "Sweet Home Alabama" territory!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'That\'s Mixolydian - major but with rock swagger!'
                },
                // Step 14: Clear for Phrygian
                {
                    instruction: 'Now Phrygian - the dark, Spanish mode. Click "Clear All".',
                    spotlight: '#action-clear-progression',
                    targetElement: '#action-clear-progression',
                    callout: 'Phrygian has a ♭2 - the half-step from ♭II to i creates instant drama and darkness.',
                    validation: { type: 'progression_cleared' },
                    successMessage: 'Ready for Phrygian!'
                },
                // Step 15: Build Phrygian
                {
                    instruction: 'Add E Minor - our Phrygian home.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'E Phrygian uses C major\'s notes but treats E as home. The F chord (♭II) defines it.',
                    validation: { type: 'progression_chord_added', value: 'E Minor' },
                    successMessage: 'Phrygian home!'
                },
                // Step 16: Add F (♭II)
                {
                    instruction: 'Add F Major - the ♭II chord! This half-step motion creates the Spanish/flamenco sound.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'F is a half-step above E. This ♭II - i motion is the most distinctive sound in Phrygian!',
                    validation: { type: 'progression_chord_added', value: 'F Major' },
                    successMessage: 'The ♭II - instant flamenco!'
                },
                // Step 17: Add more Em
                {
                    instruction: 'Add E Minor again.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'E Minor' },
                    successMessage: 'Back to Phrygian home!'
                },
                // Step 18: One more F
                {
                    instruction: 'Add F Major again for a repeating vamp.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'F Major' },
                    successMessage: 'Phrygian vamp complete!'
                },
                // Step 19: Play Phrygian
                {
                    instruction: 'Play the Phrygian vamp! Hear that dark, Spanish intensity.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'Em - F - Em - F. That F→E half-step motion is pure drama. Flamenco, metal, and mysterious music use this!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'That\'s Phrygian - dark, dramatic, Spanish!'
                },
                // Step 20: Completion
                {
                    instruction: 'You\'ve experienced Dorian, Mixolydian, and Phrygian! Each mode has its own character chord that defines its sound.',
                    callout: 'Key takeaways: Dorian = major IV, Mixolydian = ♭VII, Phrygian = ♭II. Try Lydian (II major) on your own - it\'s dreamy and floating!',
                    validation: null,
                    successMessage: 'You\'ve unlocked the modes!',
                    allowFreeExplore: true
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

/**
 * "Modal Harmony" Tutorial
 * Teaches how to write progressions that stay in a mode
 * without falling back into major/minor tonality.
 */
export const modalHarmonyTutorial = defineTutorial({
    id: 'modal-harmony',
    title: 'Modal Harmony',
    lessonId: 'lesson-modal-harmony',
    steps: [
        {
            type: 'guided_builder',
            title: 'Build Progressions That Stay Modal!',
            instruction: 'Learn the secret to keeping progressions in a mode: avoid V-I and use characteristic chords.',
            targetTab: 'trainer',
            guidedSteps: [
                // Step 1: Introduction
                {
                    instruction: 'The challenge of modal harmony: your ear wants to hear major or minor. V-I cadences instantly destroy modal color. Let\'s learn to avoid them!',
                    callout: 'Rule #1: Avoid V-I (or V7-I). Rule #2: Use the characteristic chord. Rule #3: Vamps work better than long progressions.',
                    validation: null,
                    successMessage: null
                },
                // Step 2: Wrong way first
                {
                    instruction: 'First, let\'s see what NOT to do. We\'ll build what seems like D Dorian but falls into C major.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'If we play Dm - G - C, our ear hears "ii - V - I in C major" and D Dorian is lost!',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        const form = document.getElementById('quick-add-chord-form-melody');
                        if (form && form.classList.contains('hidden')) {
                            if (window.toggleQuickAddChordForm) {
                                window.toggleQuickAddChordForm('quick-add-chord-form-melody');
                            }
                        }
                    }
                },
                // Step 3: Build "wrong" progression
                {
                    instruction: 'Add D Minor - supposedly our Dorian home.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'D Minor' },
                    successMessage: 'D Minor added.'
                },
                // Step 4: Add G
                {
                    instruction: 'Add G Major.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'G Major' },
                    successMessage: 'G added.'
                },
                // Step 5: Add C
                {
                    instruction: 'Add C Major - and watch Dorian disappear!',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'The moment G resolves to C, your ear says "we\'re in C major!" Dm becomes just the ii chord.',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'C added - but we\'ve lost Dorian!'
                },
                // Step 6: Play the "wrong" way
                {
                    instruction: 'Play it and notice how it sounds like C major, not D Dorian.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'G → C is the V - I cadence that destroys modal feeling. Your ear hears C as home!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'Hear it? That\'s C major with a ii chord, not D Dorian!'
                },
                // Step 7: Clear for correct way
                {
                    instruction: 'Now let\'s do it RIGHT. Click "Clear All".',
                    spotlight: '#action-clear-progression',
                    targetElement: '#action-clear-progression',
                    callout: 'We\'ll avoid G → C and keep D as our center using Dorian\'s characteristic chord.',
                    validation: { type: 'progression_cleared' },
                    successMessage: 'Ready for true Dorian!'
                },
                // Step 8: Build true Dorian
                {
                    instruction: 'Add D Minor 7 - our true modal home.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'This time, D stays home. No resolving to C!',
                    validation: { type: 'progression_chord_added', value: 'D Minor 7' },
                    successMessage: 'Dorian home!'
                },
                // Step 9: Add G (but not going to C!)
                {
                    instruction: 'Add G7 - the characteristic IV7 chord.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'G7 contains B natural - the raised 6th that defines Dorian. And we won\'t resolve it to C!',
                    validation: { type: 'progression_chord_added', value: 'G Dominant 7' },
                    successMessage: 'The IV7 - Dorian\'s signature!'
                },
                // Step 10: Add C (as ♭VII, not as I!)
                {
                    instruction: 'Add C Major - but this time it\'s the ♭VII, not the destination!',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'C is now the ♭VII of D, not a tonic. We\'re going BACK to D!',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'C as ♭VII, passing through!'
                },
                // Step 11: Return to Dm
                {
                    instruction: 'Return to D Minor 7 - reaffirming D as home.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'D is home! The C → D motion (♭VII → i) keeps the modal color.',
                    validation: { type: 'progression_chord_added', value: 'D Minor 7' },
                    successMessage: 'Home is D, not C!'
                },
                // Step 12: Play true Dorian
                {
                    instruction: 'Play it! D is clearly home - this is true Dorian.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'Dm7 - G7 - C - Dm7. We used G and C, but D is home. The B natural in G7 keeps it Dorian!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'THAT\'S Dorian! D is home, and the raised 6th (B) defines the mode.'
                },
                // Step 13: Clear for Mixolydian example
                {
                    instruction: 'Let\'s apply the same principle to Mixolydian. Click "Clear All".',
                    spotlight: '#action-clear-progression',
                    targetElement: '#action-clear-progression',
                    callout: 'In Mixolydian, we avoid the V chord resolving to I (D → G in G Mixolydian). We use ♭VII instead!',
                    validation: { type: 'progression_cleared' },
                    successMessage: 'Ready for Mixolydian!'
                },
                // Step 14: Build Mixolydian
                {
                    instruction: 'Add G Major - our Mixolydian home.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'G Major' },
                    successMessage: 'Mixolydian home!'
                },
                // Step 15: Add ♭VII
                {
                    instruction: 'Add F Major - the ♭VII! This is Mixolydian\'s signature.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'F is the ♭VII of G. This chord contains the ♭7 (F instead of F#) that defines Mixolydian!',
                    validation: { type: 'progression_chord_added', value: 'F Major' },
                    successMessage: '♭VII - the rock chord!'
                },
                // Step 16: Add IV
                {
                    instruction: 'Add C Major - the IV chord.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'IV chord!'
                },
                // Step 17: Back to G
                {
                    instruction: 'Return to G Major. Notice: no D → G (V - I) anywhere!',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'We avoided D (the V) entirely. ♭VII → I (F → G) replaces V → I.',
                    validation: { type: 'progression_chord_added', value: 'G Major' },
                    successMessage: 'G is home!'
                },
                // Step 18: Play Mixolydian
                {
                    instruction: 'Play the Mixolydian progression! Classic rock sound.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'G - F - C - G. No D chord means no V-I. The F (♭VII) keeps it unmistakably Mixolydian!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'That\'s modal harmony - the mode is preserved because we avoided V-I!'
                },
                // Step 19: Completion
                {
                    instruction: 'You now understand modal harmony! Avoid V-I, use characteristic chords, and keep your modal tonic as home.',
                    callout: 'Practice tip: For any mode, find its characteristic chord and build vamps around it. Short progressions work best for establishing modal color!',
                    validation: null,
                    successMessage: 'You\'ve mastered modal harmony principles!',
                    allowFreeExplore: true
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

/**
 * "Advanced Voice Leading" Tutorial
 * Teaches guide tone movement, contrary motion, and
 * creating independent melodic lines within chord progressions.
 */
export const advancedVoiceLeadingTutorial = defineTutorial({
    id: 'advanced-voice-leading',
    title: 'Advanced Voice Leading',
    lessonId: 'lesson-advanced-voice-leading',
    steps: [
        {
            type: 'guided_builder',
            title: 'Master Guide Tones and Voice Independence!',
            instruction: 'Learn to track guide tones and create smooth voice leading in jazz progressions.',
            targetTab: 'trainer',
            guidedSteps: [
                // Step 1: Introduction
                {
                    instruction: 'Advanced voice leading means each chord tone moves melodically. The 3rds and 7ths (guide tones) are your map - they should move by step or stay the same.',
                    callout: 'Guide tones: 3rd and 7th of each chord. In Dm7 - G7 - Cmaj7: watch how F and C move!',
                    validation: null,
                    successMessage: null
                },
                // Step 2: Build ii-V-I to trace guide tones
                {
                    instruction: 'Let\'s build ii-V-I with 7th chords and trace the guide tone movement.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Dm7: 3rd = F, 7th = C. G7: 3rd = B, 7th = F. Cmaj7: 3rd = E, 7th = B. Watch the smooth connections!',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        const form = document.getElementById('quick-add-chord-form-melody');
                        if (form && form.classList.contains('hidden')) {
                            if (window.toggleQuickAddChordForm) {
                                window.toggleQuickAddChordForm('quick-add-chord-form-melody');
                            }
                        }
                    }
                },
                // Step 3: Add Dm7
                {
                    instruction: 'Add D Minor 7. Guide tones: F (3rd) and C (7th).',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Dm7 = D-F-A-C. The F and C are the "soul" of this chord.',
                    validation: { type: 'progression_chord_added', value: 'D Minor 7' },
                    successMessage: 'Dm7: Guide tones F and C!'
                },
                // Step 4: Add G7
                {
                    instruction: 'Add G Dominant 7. Guide tones: B (3rd) and F (7th).',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'G7 = G-B-D-F. Notice: C dropped to B (half step), F stayed! That\'s smooth voice leading.',
                    validation: { type: 'progression_chord_added', value: 'G Dominant 7' },
                    successMessage: 'G7: C→B (half step), F stays!'
                },
                // Step 5: Add Cmaj7
                {
                    instruction: 'Add C Major 7. Guide tones: E (3rd) and B (7th).',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Cmaj7 = C-E-G-B. F dropped to E (half step), B stayed! Perfect guide tone resolution.',
                    validation: { type: 'progression_chord_added', value: 'C Major 7' },
                    successMessage: 'Cmaj7: F→E (half step), B stays!'
                },
                // Step 6: Play and analyze
                {
                    instruction: 'Play it and listen for the smooth guide tone movement.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'Full guide tone motion: F stays → F → E, and C → B stays → B. All half-steps or common tones!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'That smoothness comes from guide tones moving by step!'
                },
                // Step 7: Now with voice leading in the progression
                {
                    instruction: 'Now let\'s apply inversions to create an even smoother bass line. We\'ll expand the chord cards.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'With inversions, we can make EVERY voice move smoothly, not just the guide tones.',
                    validation: null,
                    successMessage: null
                },
                // Step 8: Expand Dm7 card
                {
                    instruction: 'Click on the Dm7 chord to select it, then expand it to see inversion controls.',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'Dm7 in root position: D in bass. Let\'s keep it there as our starting point.',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        if (window.highlightChordCard) {
                            window.highlightChordCard(0);
                        }
                    }
                },
                // Step 9: Set G7 inversion
                {
                    instruction: 'Now expand the G7 card. Set it to 2nd inversion (D in bass) - the bass stays on D!',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'G7/D means D stays in bass: D → D. One voice doesn\'t move at all! This is called a pedal tone.',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        if (window.expandChordCard) {
                            window.expandChordCard(1);
                        }
                    }
                },
                // Step 10: Set Cmaj7 inversion
                {
                    instruction: 'Expand Cmaj7. Try 1st inversion (E in bass) - the bass walks D → D → E (just a step up!).',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'Bass line: D → D → E. Minimal movement! This is contrary motion - bass up while inner voices move down.',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        if (window.expandChordCard) {
                            window.expandChordCard(2);
                        }
                    }
                },
                // Step 11: Play voice-led version
                {
                    instruction: 'Play the voice-led version! Compare to the root position version.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'Bass: D → D → E. Much smoother than D → G → C! Every voice now moves minimally.',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'Hear how much smoother that is? That\'s advanced voice leading!'
                },
                // Step 12: Clear for walking bass example
                {
                    instruction: 'Let\'s try another technique: creating a walking bass line. Click "Clear All".',
                    spotlight: '#action-clear-progression',
                    targetElement: '#action-clear-progression',
                    callout: 'A walking bass moves by step, creating a melody in the bass voice. Very common in jazz!',
                    validation: { type: 'progression_cleared' },
                    successMessage: 'Ready for walking bass!'
                },
                // Step 13: Build progression for walking bass
                {
                    instruction: 'Build C - Am - Dm - G. We\'ll add inversions for a walking bass.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'C Major' },
                    successMessage: 'C added!'
                },
                // Step 14-16: Complete progression
                {
                    instruction: 'Add A Minor.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'A Minor' },
                    successMessage: 'Am added!'
                },
                {
                    instruction: 'Add D Minor.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'D Minor' },
                    successMessage: 'Dm added!'
                },
                {
                    instruction: 'Add G Major.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    validation: { type: 'progression_chord_added', value: 'G Major' },
                    successMessage: 'G added!'
                },
                // Step 17: Apply inversions for walking bass
                {
                    instruction: 'Now apply inversions: Am in 1st inv (C bass), Dm root (D bass), G in 1st inv (B bass). Bass walks: C → C → D → B!',
                    spotlight: '#melody-progression-visualization',
                    targetElement: '#melody-progression-visualization',
                    spotlightExtraHeight: 200,
                    callout: 'Expand each card and set inversions. The bass becomes a melody: C - C - D - B (or try C - B - D - G for different motion).',
                    validation: null,
                    successMessage: null
                },
                // Step 18: Completion
                {
                    instruction: 'You now understand guide tones and walking bass! These techniques make your progressions sound professional.',
                    callout: 'Key principles: Guide tones (3rds and 7ths) should move by step. The bass is a melody. Contrary motion creates independence!',
                    validation: null,
                    successMessage: 'You\'ve mastered advanced voice leading concepts!',
                    allowFreeExplore: true
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

/**
 * "Extended Chords" Tutorial
 * Teaches 9th, 11th, and 13th chords and how to
 * use them in jazz and R&B progressions.
 */
export const extendedChordsTutorial = defineTutorial({
    id: 'extended-chords',
    title: 'Extended Chords',
    lessonId: 'lesson-extended-chords',
    steps: [
        {
            type: 'guided_builder',
            title: 'Explore 9ths, 11ths, and 13ths!',
            instruction: 'Learn to add rich jazz colors with extended chord tones.',
            targetTab: 'builder',
            guidedSteps: [
                // Step 1: Introduction
                {
                    instruction: 'Extended chords add notes beyond the 7th: the 9th, 11th, and 13th. These create the lush sounds of jazz, R&B, and neo-soul.',
                    callout: '9th = adds warmth, 11th = adds suspension (but clashes on major chords!), 13th = adds soulfulness.',
                    validation: null,
                    successMessage: null
                },
                // Step 2: Start with C root
                {
                    instruction: 'Let\'s build and compare extended chords on C. Select "C" as the root.',
                    spotlight: '#builder-note-selector',
                    targetElement: '#builder-note-selector',
                    validation: { type: 'root_selected', value: 'C' },
                    successMessage: 'C selected!'
                },
                // Step 3: Build Cmaj9
                {
                    instruction: 'Select "Major 9" - the dreamy, sophisticated sound.',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    callout: 'Cmaj9 = C-E-G-B-D. The 9th (D) floats beautifully over the major 7th. Pure jazz ballad material!',
                    validation: { type: 'type_selected', value: 'Major 9' },
                    successMessage: 'Major 9 selected!'
                },
                // Step 4: Play Cmaj9
                {
                    instruction: 'Play Cmaj9. Listen to how the 9th adds sweetness without tension.',
                    callout: 'This is the sound of jazz endings, bossa nova, and romantic ballads. The 9th is the "gateway to jazz."',
                    validation: { type: 'chord_played' },
                    successMessage: 'Lush and dreamy - that\'s the major 9!'
                },
                // Step 5: Try C9 (dominant)
                {
                    instruction: 'Now try "Dominant 9" - the soulful R&B sound.',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    callout: 'C9 = C-E-G-Bb-D. The dominant 7th + 9th creates bluesy warmth.',
                    validation: { type: 'type_selected', value: 'Dominant 9' },
                    successMessage: 'Dominant 9 selected!'
                },
                // Step 6: Play C9
                {
                    instruction: 'Play C9. This is the foundation of funk and R&B harmony.',
                    callout: 'Stevie Wonder, Earth Wind & Fire, Daft Punk - all built on dominant 9ths!',
                    validation: { type: 'chord_played' },
                    successMessage: 'That\'s the soul/funk sound!'
                },
                // Step 7: Try Cm9 (minor)
                {
                    instruction: 'Try "Minor 9" - smooth, modern, emotional.',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    callout: 'Cm9 = C-Eb-G-Bb-D. The 9th softens the minor quality, making it cooler and jazzier.',
                    validation: { type: 'type_selected', value: 'Minor 9' },
                    successMessage: 'Minor 9 selected!'
                },
                // Step 8: Play Cm9
                {
                    instruction: 'Play Cm9. Very modern and sophisticated.',
                    callout: 'Neo-soul, chill-hop, and modern jazz all love the minor 9. It\'s sad but smooth.',
                    validation: { type: 'chord_played' },
                    successMessage: 'Smooth and emotional - the minor 9!'
                },
                // Step 9: Try the Hendrix chord
                {
                    instruction: 'Now the famous "Hendrix chord" - try "7#9" (Dominant 7 sharp 9).',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    callout: 'C7#9 = C-E-G-Bb-D#. The #9 (D#) clashes with the major 3rd (E) in a beautiful, gritty way!',
                    validation: { type: 'type_selected', value: '7#9' },
                    successMessage: '7#9 selected!'
                },
                // Step 10: Play 7#9
                {
                    instruction: 'Play the 7#9. Pure Hendrix rock-blues!',
                    callout: '"Purple Haze" uses E7#9. The major 3rd and #9 fighting creates that aggressive, bluesy bite.',
                    validation: { type: 'chord_played' },
                    successMessage: 'That\'s the Hendrix chord! Gritty and powerful.'
                },
                // Step 11: Try Minor 11
                {
                    instruction: 'Now "Minor 11" - the 11th works perfectly on minor chords!',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    callout: 'Cm11 = C-Eb-G-Bb-D-F. The 11th (F) adds suspension. Unlike major chords, it doesn\'t clash with the 3rd!',
                    validation: { type: 'type_selected', value: 'Minor 11' },
                    successMessage: 'Minor 11 selected!'
                },
                // Step 12: Play Cm11
                {
                    instruction: 'Play Cm11. Very modern jazz sound.',
                    callout: 'Minor 11ths are fusion/modern jazz staples. The 11th adds "suspended" quality to the minor.',
                    validation: { type: 'chord_played' },
                    successMessage: 'The 11th works beautifully on minor chords!'
                },
                // Step 13: Explain the 11th problem
                {
                    instruction: 'Important: the 11th CLASHES on major and dominant chords! The 11th (F) is a half-step from the 3rd (E).',
                    callout: 'Solution: On major chords, use #11 instead! The #11 (F#) creates Lydian color without the clash.',
                    validation: null,
                    successMessage: null
                },
                // Step 14: Try 13th chord
                {
                    instruction: 'Finally, "Dominant 13" - the ultimate jazz dominant!',
                    spotlight: '#builder-chord-type-selector',
                    targetElement: '#builder-chord-type-selector',
                    callout: 'C13 = C-E-G-Bb-D-(F)-A. The 13th (A) adds warmth. Usually we omit the 5th and 11th!',
                    validation: { type: 'type_selected', value: 'Dominant 13' },
                    successMessage: '13th chord selected!'
                },
                // Step 15: Play 13th
                {
                    instruction: 'Play the 13th chord. Rich, full, jazzy!',
                    callout: 'The 13th is the ultimate extension - it contains almost every note of the scale!',
                    validation: { type: 'chord_played' },
                    successMessage: 'That rich, complex sound is the 13th chord!'
                },
                // Step 16: Go to trainer for extended ii-V-I
                {
                    instruction: 'Now let\'s use these in a real progression! Let\'s build an extended ii-V-I.',
                    callout: 'We\'ll build Dm9 - G13 - Cmaj9 - the jazz standard with extensions.',
                    validation: null,
                    successMessage: null
                }
            ]
        },
        // Part 2: Extended ii-V-I
        {
            type: 'guided_builder',
            title: 'Build an Extended Jazz Progression',
            instruction: 'Apply extended chords to the ii-V-I for professional jazz sound.',
            targetTab: 'trainer',
            guidedSteps: [
                // Step 1: Introduction
                {
                    instruction: 'The extended ii-V-I is the sound of jazz. Let\'s build Dm9 - G13 - Cmaj9.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Extensions add color without changing function. ii is still ii, just richer!',
                    validation: null,
                    successMessage: null,
                    onEnter: () => {
                        const form = document.getElementById('quick-add-chord-form-melody');
                        if (form && form.classList.contains('hidden')) {
                            if (window.toggleQuickAddChordForm) {
                                window.toggleQuickAddChordForm('quick-add-chord-form-melody');
                            }
                        }
                    }
                },
                // Step 2: Add Dm9
                {
                    instruction: 'Add D Minor 9.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Dm9 = D-F-A-C-E. The 9th (E) adds sweetness to the ii chord.',
                    validation: { type: 'progression_chord_added', value: 'D Minor 9' },
                    successMessage: 'Dm9 - smooth preparation!'
                },
                // Step 3: Add G13
                {
                    instruction: 'Add G Dominant 13.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'G13 = G-B-D-F-A-E. The 13th (E) adds warmth to the dominant tension.',
                    validation: { type: 'progression_chord_added', value: 'G Dominant 13' },
                    successMessage: 'G13 - rich dominant!'
                },
                // Step 4: Add Cmaj9
                {
                    instruction: 'Resolve to C Major 9.',
                    spotlight: '#quick-add-chord-form-melody',
                    targetElement: '#quick-add-chord-form-melody',
                    callout: 'Cmaj9 = C-E-G-B-D. The 9th (D) floats over the resolution. Sophisticated!',
                    validation: { type: 'progression_chord_added', value: 'C Major 9' },
                    successMessage: 'Cmaj9 - dreamy resolution!'
                },
                // Step 5: Play extended ii-V-I
                {
                    instruction: 'Play your extended ii-V-I! This is professional jazz harmony.',
                    spotlight: '#action-play-btn',
                    targetElement: '#action-play-btn',
                    callout: 'Compare this to basic Dm - G - C. The extensions add so much richness and sophistication!',
                    validation: { type: 'progression_play_complete' },
                    successMessage: 'That\'s the jazz sound! Extensions transform everything.'
                },
                // Step 6: Completion
                {
                    instruction: 'You\'ve mastered extended chords! 9ths add warmth, 11ths add suspension (use #11 on major), 13ths add soul.',
                    callout: 'Try upgrading any progression with extensions. Replace Dm with Dm9, G7 with G13, C with Cmaj9. Instant sophistication!',
                    validation: null,
                    successMessage: 'You now have the vocabulary of jazz harmony!',
                    allowFreeExplore: true
                }
            ]
        }
    ],
    onComplete: () => {
    }
});

// ===========================================
// EXPORTS
// ===========================================

export default {
    createMiniKeyboard,
    createSpotlight,
    removeSpotlight,
    defineTutorial,
    startTutorial,
    whatIsANoteTutorial,
    sharpsFlatsTutorial,
    octavesTutorial,
    scalesTutorial,
    intervalsTutorial,
    whatIsAChordTutorial,
    majorVsMinorTutorial,
    chordInversionsTutorial,
    firstProgressionTutorial,
    voiceLeadingTutorial,
    popularProgressionTutorial,
    addingEmotionTutorial,
    seventhChordsTutorial,
    secondaryDominantsTutorial,
    borrowedChordsTutorial,
    tensionReleaseTutorial,
    melodyChordTutorial,
    scaleTypesTutorial,
    modesIntroTutorial,
    modalHarmonyTutorial,
    advancedVoiceLeadingTutorial,
    extendedChordsTutorial
};
