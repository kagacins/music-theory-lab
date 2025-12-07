/**
 * Songwriting Wizard
 *
 * Phase 3.3 of the Interactive Learning Plan
 * Step-by-step guided song creation for beginners.
 * Leverages our chord builder and progression builder tools.
 */

import { getChordNotes } from '../utils/noteUtils.js';
import { getPiano } from '../audio/audioEngine.js';
import { setProgressionData, getCurrentKey, setCurrentKey } from '../state/trainerState.js';
import { switchTab } from './tabs.js';

// ===========================================
// WIZARD DATA
// ===========================================

const MOOD_OPTIONS = [
    {
        id: 'happy',
        emoji: '😊',
        title: 'Happy',
        subtitle: 'Uplifting',
        description: 'Bright and joyful',
        progression: { key: 'C', chords: ['C', 'G', 'Am', 'F'], roman: ['I', 'V', 'vi', 'IV'] },
        tips: [
            'Major key creates brightness',
            'Strong I-V movement adds energy',
            'The vi chord adds just enough emotion without being sad'
        ]
    },
    {
        id: 'sad',
        emoji: '😢',
        title: 'Sad',
        subtitle: 'Emotional',
        description: 'Melancholy and touching',
        progression: { key: 'Am', chords: ['Am', 'F', 'C', 'G'], roman: ['i', 'VI', 'III', 'VII'] },
        tips: [
            'Starting on minor creates immediate emotion',
            'The F (VI) chord adds warmth to the sadness',
            'Ending on G creates longing that wants to resolve'
        ]
    },
    {
        id: 'energetic',
        emoji: '⚡',
        title: 'Energetic',
        subtitle: 'Driving',
        description: 'Powerful and intense',
        progression: { key: 'E', chords: ['E', 'A', 'B', 'E'], roman: ['I', 'IV', 'V', 'I'] },
        tips: [
            'The classic I-IV-V-I is rock\'s foundation',
            'Key of E is popular for guitar-driven songs',
            'Simple progressions work best for high energy'
        ]
    },
    {
        id: 'dreamy',
        emoji: '🌙',
        title: 'Dreamy',
        subtitle: 'Ethereal',
        description: 'Floating and atmospheric',
        progression: { key: 'C', chords: ['Cmaj7', 'Fmaj7', 'Am7', 'Em7'], roman: ['Imaj7', 'IVmaj7', 'vi7', 'iii7'] },
        tips: [
            'Major 7th chords create a floating, dreamy quality',
            'Avoiding the V chord keeps things unresolved and ethereal',
            'The iii chord (Em) adds mystery'
        ]
    },
    {
        id: 'romantic',
        emoji: '❤️',
        title: 'Romantic',
        subtitle: 'Warm',
        description: 'Loving and tender',
        progression: { key: 'G', chords: ['G', 'Em', 'C', 'D'], roman: ['I', 'vi', 'IV', 'V'] },
        tips: [
            'Key of G is warm and accessible',
            'The vi (Em) early creates vulnerability',
            'Building to V (D) creates anticipation'
        ]
    },
    {
        id: 'chill',
        emoji: '🌊',
        title: 'Chill',
        subtitle: 'Relaxed',
        description: 'Laid back and smooth',
        progression: { key: 'D', chords: ['Dmaj7', 'A', 'Bm', 'G'], roman: ['Imaj7', 'V', 'vi', 'IV'] },
        tips: [
            'The maj7 on I creates a relaxed home base',
            'This variation of the popular progression feels more mellow',
            'Perfect for acoustic or lo-fi vibes'
        ]
    }
];

const WIZARD_STEPS = [
    { id: 'mood', title: 'Choose Your Mood', icon: '🎭' },
    { id: 'preview', title: 'Preview & Learn', icon: '👂' },
    { id: 'customize', title: 'Customize', icon: '🎨' },
    { id: 'melody-tips', title: 'Melody Tips', icon: '🎵' },
    { id: 'export', title: 'Use Your Song', icon: '🚀' }
];

// ===========================================
// STATE
// ===========================================

let currentStep = 0;
let selectedMood = null;
let customizations = {
    key: null,
    tempo: 100,
    variation: 'standard'
};
let isPlaying = false;

// ===========================================
// AUDIO HELPERS
// ===========================================

async function playProgression(chordNames, duration = 0.8) {
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

        for (let i = 0; i < chordNames.length; i++) {
            const { root, type } = parseChordName(chordNames[i]);
            const chordInfo = getChordNotes(root, type);
            const notes = chordInfo?.specificNotes || [];

            if (notes.length > 0) {
                piano.triggerAttackRelease(notes, duration * 0.9, now + (i * duration));
            }
        }

        await new Promise(resolve => setTimeout(resolve, chordNames.length * duration * 1000 + 200));
    } catch (err) {
        console.error('[SongwritingWizard] Error playing:', err);
    } finally {
        isPlaying = false;
    }
}

function parseChordName(name) {
    const patterns = [
        { regex: /^([A-G][#b]?)maj7$/i, type: 'Major 7th' },
        { regex: /^([A-G][#b]?)m7$/i, type: 'Minor 7th' },
        { regex: /^([A-G][#b]?)7$/i, type: 'Dominant 7th' },
        { regex: /^([A-G][#b]?)dim$/i, type: 'Diminished' },
        { regex: /^([A-G][#b]?)m$/i, type: 'Minor' },
        { regex: /^([A-G][#b]?)$/i, type: 'Major' }
    ];

    for (const { regex, type } of patterns) {
        const match = name.match(regex);
        if (match) {
            return { root: match[1], type };
        }
    }

    return { root: name.replace(/[^A-G#b]/gi, ''), type: 'Major' };
}

// ===========================================
// RENDER FUNCTIONS
// ===========================================

function renderStepIndicator() {
    return `
        <div class="flex justify-center gap-2 mb-6">
            ${WIZARD_STEPS.map((step, idx) => `
                <div class="flex items-center">
                    <div class="flex flex-col items-center">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                            idx < currentStep ? 'bg-green-500 text-white' :
                            idx === currentStep ? 'bg-blue-600 text-white' :
                            'bg-gray-200 dark:bg-gray-600 text-black dark:text-black'
                        }">
                            ${idx < currentStep ? '✓' : step.icon}
                        </div>
                        <span class="text-xs mt-1 font-medium ${idx === currentStep ? 'text-blue-600 dark:text-blue-400' : 'text-black dark:text-black'}">${step.title}</span>
                    </div>
                    ${idx < WIZARD_STEPS.length - 1 ? `
                        <div class="w-8 h-0.5 mx-2 mt-[-16px] ${idx < currentStep ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}"></div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function renderStep1Mood() {
    return `
        <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-black dark:text-white mb-2">How do you want your song to feel?</h2>
            <p class="text-black dark:text-black font-medium">Choose a mood and we'll suggest the perfect chord progression</p>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            ${MOOD_OPTIONS.map(mood => `
                <button class="mood-option p-4 rounded-xl border-2 transition-all ${
                    selectedMood === mood.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50 dark:bg-gray-700'
                }" data-mood="${mood.id}">
                    <div class="text-4xl mb-2">${mood.emoji}</div>
                    <div class="font-bold text-black dark:text-white">${mood.title}</div>
                    <div class="text-sm font-medium text-black dark:text-black">${mood.subtitle}</div>
                </button>
            `).join('')}
        </div>
    `;
}

function renderStep2Preview() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    if (!mood) return '<p>Please select a mood first</p>';

    return `
        <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-black dark:text-white mb-2">
                ${mood.emoji} ${mood.title} / ${mood.subtitle}
            </h2>
            <p class="text-black dark:text-black font-medium">Here's a progression that matches your mood</p>
        </div>

        <div class="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-600">
            <div class="flex justify-center gap-4 mb-6">
                ${mood.progression.chords.map((chord, idx) => `
                    <div class="text-center">
                        <div class="w-16 h-16 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-xl font-bold text-blue-900 dark:text-blue-100">
                            ${chord}
                        </div>
                        <div class="text-sm font-semibold text-black dark:text-black mt-1">${mood.progression.roman[idx]}</div>
                    </div>
                `).join(`
                    <div class="self-center text-black dark:text-black font-bold">→</div>
                `)}
            </div>

            <div class="flex justify-center gap-4">
                <button id="play-progression-btn" class="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors font-medium">
                    <span>▶</span> Play Progression
                </button>
                <button id="play-loop-btn" class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors font-medium">
                    <span>🔁</span> Play Looped
                </button>
            </div>
        </div>

        <div class="bg-yellow-50 dark:bg-yellow-900/40 rounded-xl p-6 border-2 border-yellow-300 dark:border-yellow-600">
            <h3 class="font-bold text-yellow-900 dark:text-yellow-100 mb-3">Why this works for "${mood.title}":</h3>
            <ul class="space-y-2">
                ${mood.tips.map(tip => `
                    <li class="flex items-start gap-2 text-yellow-900 dark:text-yellow-100 font-medium">
                        <span>💡</span>
                        <span>${tip}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
}

function renderStep3Customize() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    if (!mood) return '<p>Please select a mood first</p>';

    const keys = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    const currentKey = customizations.key || mood.progression.key;

    return `
        <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-black dark:text-white mb-2">Customize Your Progression</h2>
            <p class="text-black dark:text-black font-medium">Make it your own with these options</p>
        </div>

        <div class="grid md:grid-cols-2 gap-6 mb-6">
            <!-- Key Selection -->
            <div class="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                <h3 class="font-bold text-black dark:text-white mb-4">Key</h3>
                <p class="text-sm text-black dark:text-black mb-3 font-medium">Change the key to match your voice or other instruments</p>
                <div class="flex flex-wrap gap-2">
                    ${keys.map(key => `
                        <button class="key-option px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            key === currentKey
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-600 text-black dark:text-black hover:bg-gray-200 dark:hover:bg-gray-500'
                        }" data-key="${key}">
                            ${key}
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Variation Selection -->
            <div class="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                <h3 class="font-bold text-black dark:text-white mb-4">Variation</h3>
                <p class="text-sm text-black dark:text-black mb-3 font-medium">Try different flavors of the same progression</p>
                <div class="space-y-2">
                    <button class="variation-option w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        customizations.variation === 'standard' ? 'bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-500' : 'bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500'
                    }" data-variation="standard">
                        <div class="font-semibold text-black dark:text-white">Standard</div>
                        <div class="text-sm text-black dark:text-black">The classic version</div>
                    </button>
                    <button class="variation-option w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        customizations.variation === 'sevenths' ? 'bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-500' : 'bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500'
                    }" data-variation="sevenths">
                        <div class="font-semibold text-black dark:text-white">Add 7ths</div>
                        <div class="text-sm text-black dark:text-black">More sophisticated, jazzy feel</div>
                    </button>
                    <button class="variation-option w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        customizations.variation === 'rotated' ? 'bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-500' : 'bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500'
                    }" data-variation="rotated">
                        <div class="font-semibold text-black dark:text-white">Different Start</div>
                        <div class="text-sm text-black dark:text-black">Same chords, different starting point</div>
                    </button>
                </div>
            </div>
        </div>

        <div class="flex justify-center">
            <button id="preview-custom-btn" class="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors font-medium">
                <span>▶</span> Preview Customized Version
            </button>
        </div>
    `;
}

function renderStep4MelodyTips() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    if (!mood) return '<p>Please select a mood first</p>';

    return `
        <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-black dark:text-white mb-2">Melody Tips</h2>
            <p class="text-black dark:text-black">How to write a melody that fits your progression</p>
        </div>

        <div class="space-y-6">
            <div class="bg-white dark:bg-gray-700 rounded-xl p-6">
                <h3 class="font-semibold text-black dark:text-white mb-3 flex items-center gap-2">
                    <span class="text-2xl">🎯</span> Chord Tones
                </h3>
                <p class="text-black dark:text-black mb-3">
                    The safest notes to sing or play are the notes IN the chord. For each chord:
                </p>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    ${mood.progression.chords.map(chord => {
                        const { root, type } = parseChordName(chord);
                        // Simplified chord tone display
                        return `
                            <div class="bg-gray-100 dark:bg-gray-600 rounded-lg p-3 text-center">
                                <div class="font-bold text-black dark:text-white">${chord}</div>
                                <div class="text-sm text-black dark:text-black">Safe to use over this chord</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <div class="bg-white dark:bg-gray-700 rounded-xl p-6">
                <h3 class="font-semibold text-black dark:text-white mb-3 flex items-center gap-2">
                    <span class="text-2xl">🎵</span> Melody Movement Tips
                </h3>
                <ul class="space-y-3 text-black dark:text-black">
                    <li class="flex items-start gap-3">
                        <span class="text-xl">➡️</span>
                        <span><strong class="text-black dark:text-white">Step-wise motion:</strong> Moving to neighboring notes sounds smooth and natural</span>
                    </li>
                    <li class="flex items-start gap-3">
                        <span class="text-xl">⬆️</span>
                        <span><strong class="text-black dark:text-white">Leaps for impact:</strong> Jumping to a higher note creates excitement - use sparingly</span>
                    </li>
                    <li class="flex items-start gap-3">
                        <span class="text-xl">🔄</span>
                        <span><strong class="text-black dark:text-white">Repetition:</strong> Repeating a melodic phrase makes it memorable</span>
                    </li>
                    <li class="flex items-start gap-3">
                        <span class="text-xl">📍</span>
                        <span><strong class="text-black dark:text-white">Land on chord tones:</strong> End phrases on notes that are in the current chord</span>
                    </li>
                </ul>
            </div>

            <div class="bg-blue-50 dark:bg-blue-900/40 rounded-xl p-6 border border-blue-200 dark:border-blue-700">
                <h3 class="font-semibold text-blue-900 dark:text-blue-100 mb-3">Try our Melody Composer!</h3>
                <p class="text-blue-800 dark:text-blue-200 mb-3">
                    Use the Melody Composer tab to write a melody over your progression. It will show you which notes fit best!
                </p>
                <button id="open-melody-composer-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                    Open Melody Composer
                </button>
            </div>
        </div>
    `;
}

function renderStep5Export() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    if (!mood) return '<p>Please select a mood first</p>';

    return `
        <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-black dark:text-white mb-2">Use Your Song!</h2>
            <p class="text-black dark:text-black">Your ${mood.title.toLowerCase()} progression is ready to go</p>
        </div>

        <div class="bg-white dark:bg-gray-700 rounded-xl p-6 mb-6">
            <div class="flex justify-center gap-4 mb-6">
                ${getCustomizedChords().map((chord, idx) => `
                    <div class="text-center">
                        <div class="w-16 h-16 rounded-lg bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-xl font-bold text-green-800 dark:text-green-200">
                            ${chord}
                        </div>
                    </div>
                `).join(`
                    <div class="self-center text-black dark:text-black">→</div>
                `)}
            </div>
        </div>

        <div class="grid md:grid-cols-2 gap-6">
            <div class="bg-white dark:bg-gray-700 rounded-xl p-6">
                <h3 class="font-semibold text-black dark:text-white mb-3 flex items-center gap-2">
                    <span class="text-2xl">🎹</span> Load into Progression Builder
                </h3>
                <p class="text-black dark:text-black mb-4">
                    Add this progression to the Progression Workshop where you can edit, expand, and refine it.
                </p>
                <button id="load-to-trainer-btn" class="w-full px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors">
                    Load into Progression Workshop
                </button>
            </div>

            <div class="bg-white dark:bg-gray-700 rounded-xl p-6">
                <h3 class="font-semibold text-black dark:text-white mb-3 flex items-center gap-2">
                    <span class="text-2xl">🎵</span> Start Writing Melody
                </h3>
                <p class="text-black dark:text-black mb-4">
                    Jump to the Melody Composer and start writing a melody over your new progression.
                </p>
                <button id="load-to-melody-btn" class="w-full px-4 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors">
                    Open Melody Composer
                </button>
            </div>
        </div>

        <div class="mt-6 text-center">
            <button id="start-over-btn" class="text-black hover:text-black dark:text-black dark:hover:text-black underline font-medium">
                Start Over with a Different Mood
            </button>
        </div>
    `;
}

function getCustomizedChords() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    if (!mood) return [];

    let chords = [...mood.progression.chords];

    // Apply variations
    if (customizations.variation === 'sevenths') {
        chords = chords.map(chord => {
            const { root, type } = parseChordName(chord);
            if (type === 'Major') return root + 'maj7';
            if (type === 'Minor') return root + 'm7';
            return chord;
        });
    } else if (customizations.variation === 'rotated') {
        // Rotate the progression by one position
        chords = [...chords.slice(1), chords[0]];
    }

    // Key transposition would go here (simplified for now)

    return chords;
}

// ===========================================
// MAIN RENDER
// ===========================================

export function renderSongwritingWizard(container) {
    let stepContent = '';

    switch (currentStep) {
        case 0: stepContent = renderStep1Mood(); break;
        case 1: stepContent = renderStep2Preview(); break;
        case 2: stepContent = renderStep3Customize(); break;
        case 3: stepContent = renderStep4MelodyTips(); break;
        case 4: stepContent = renderStep5Export(); break;
    }

    const html = `
        <div class="songwriting-wizard max-w-4xl mx-auto p-6">
            <div class="mb-8 text-center">
                <h1 class="text-3xl font-bold text-black dark:text-white mb-2 flex items-center justify-center gap-3">
                    <span>🎵</span> Let's Write Your First Song!
                </h1>
                <p class="text-black dark:text-black">Step ${currentStep + 1} of ${WIZARD_STEPS.length}</p>
            </div>

            ${renderStepIndicator()}

            <div id="wizard-step-content" class="mb-8">
                ${stepContent}
            </div>

            <div class="flex justify-between">
                ${currentStep > 0 ? `
                    <button id="wizard-back-btn" class="px-6 py-3 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-black dark:text-black rounded-lg transition-colors">
                        ← Back
                    </button>
                ` : '<div></div>'}

                ${currentStep < WIZARD_STEPS.length - 1 ? `
                    <button id="wizard-next-btn" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors ${!selectedMood && currentStep === 0 ? 'opacity-50 cursor-not-allowed' : ''}">
                        Next →
                    </button>
                ` : ''}
            </div>
        </div>
    `;

    container.innerHTML = html;
    attachWizardListeners(container);
}

function attachWizardListeners(container) {
    // Mood selection
    container.querySelectorAll('.mood-option').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedMood = btn.dataset.mood;
            container.querySelectorAll('.mood-option').forEach(b => {
                b.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/40');
                b.classList.add('border-gray-300', 'dark:border-gray-600', 'bg-white', 'dark:bg-gray-700');
            });
            btn.classList.remove('border-gray-300', 'dark:border-gray-600', 'bg-white', 'dark:bg-gray-700');
            btn.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/40');

            // Enable next button
            const nextBtn = container.querySelector('#wizard-next-btn');
            if (nextBtn) {
                nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });
    });

    // Play progression
    container.querySelector('#play-progression-btn')?.addEventListener('click', async () => {
        const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
        if (mood) {
            await playProgression(mood.progression.chords);
        }
    });

    // Play looped
    container.querySelector('#play-loop-btn')?.addEventListener('click', async () => {
        const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
        if (mood) {
            for (let i = 0; i < 2; i++) {
                await playProgression(mood.progression.chords);
            }
        }
    });

    // Key selection
    container.querySelectorAll('.key-option').forEach(btn => {
        btn.addEventListener('click', () => {
            customizations.key = btn.dataset.key;
            container.querySelectorAll('.key-option').forEach(b => {
                b.classList.remove('bg-blue-600', 'text-white');
                b.classList.add('bg-gray-100', 'dark:bg-gray-600', 'text-black', 'dark:text-black');
            });
            btn.classList.remove('bg-gray-100', 'dark:bg-gray-600', 'text-black', 'dark:text-black');
            btn.classList.add('bg-blue-600', 'text-white');
        });
    });

    // Variation selection
    container.querySelectorAll('.variation-option').forEach(btn => {
        btn.addEventListener('click', () => {
            customizations.variation = btn.dataset.variation;
            container.querySelectorAll('.variation-option').forEach(b => {
                b.classList.remove('bg-blue-100', 'dark:bg-blue-900/50', 'border-2', 'border-blue-500');
                b.classList.add('bg-gray-100', 'dark:bg-gray-600');
            });
            btn.classList.remove('bg-gray-100', 'dark:bg-gray-600');
            btn.classList.add('bg-blue-100', 'dark:bg-blue-900/50', 'border-2', 'border-blue-500');
        });
    });

    // Preview customized
    container.querySelector('#preview-custom-btn')?.addEventListener('click', async () => {
        await playProgression(getCustomizedChords());
    });

    // Open melody composer
    container.querySelector('#open-melody-composer-btn')?.addEventListener('click', () => {
        switchTab('melody');
    });

    // Load to trainer
    container.querySelector('#load-to-trainer-btn')?.addEventListener('click', () => {
        const chords = getCustomizedChords();
        const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);

        // Build progression data
        const progressionData = chords.map((chord, idx) => {
            const { root, type } = parseChordName(chord);
            return {
                root,
                type,
                roman: mood?.progression.roman[idx] || '',
                duration: 1
            };
        });

        // Set progression and key
        setCurrentKey(customizations.key || mood?.progression.key || 'C');
        setProgressionData(progressionData);

        // Switch to Composition Studio
        switchTab('melody');
    });

    // Load to melody
    container.querySelector('#load-to-melody-btn')?.addEventListener('click', () => {
        const chords = getCustomizedChords();
        const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);

        // Build progression data
        const progressionData = chords.map((chord, idx) => {
            const { root, type } = parseChordName(chord);
            return {
                root,
                type,
                roman: mood?.progression.roman[idx] || '',
                duration: 1
            };
        });

        setCurrentKey(customizations.key || mood?.progression.key || 'C');
        setProgressionData(progressionData);
        switchTab('melody');
    });

    // Start over
    container.querySelector('#start-over-btn')?.addEventListener('click', () => {
        resetWizard();
        renderSongwritingWizard(container);
    });

    // Navigation
    container.querySelector('#wizard-back-btn')?.addEventListener('click', () => {
        if (currentStep > 0) {
            currentStep--;
            renderSongwritingWizard(container);
        }
    });

    container.querySelector('#wizard-next-btn')?.addEventListener('click', () => {
        if (currentStep === 0 && !selectedMood) return;
        if (currentStep < WIZARD_STEPS.length - 1) {
            currentStep++;
            renderSongwritingWizard(container);
        }
    });
}

function resetWizard() {
    currentStep = 0;
    selectedMood = null;
    customizations = { key: null, tempo: 100, variation: 'standard' };
}

// ===========================================
// EXPORTS
// ===========================================

export function showSongwritingWizard() {
    resetWizard();
    window.dispatchEvent(new CustomEvent('showSongwritingWizard'));
}

export default {
    renderSongwritingWizard,
    showSongwritingWizard
};
