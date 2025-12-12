/**
 * Songwriting Wizard - Enhanced Version
 *
 * Comprehensive guided song creation experience with:
 * - Expanded mood selection (10 moods)
 * - Style/Genre selection
 * - Song structure templates
 * - Tempo and feel settings
 * - Full song preview with sections
 */

import { getChordNotes } from '../utils/noteUtils.js';
import { getPiano } from '../audio/audioEngine.js';
import { setProgressionData, getCurrentKey, setCurrentKey } from '../state/trainerState.js';
import { switchTab } from './tabs.js';
import { getCompositionState } from '../state/compositionState.js';

// ===========================================
// WIZARD DATA - EXPANDED MOODS
// ===========================================

const MOOD_OPTIONS = [
    {
        id: 'happy',
        emoji: '😊',
        title: 'Happy',
        subtitle: 'Uplifting & Bright',
        color: '#fef08a',
        progression: { key: 'C', chords: ['C', 'G', 'Am', 'F'], roman: ['I', 'V', 'vi', 'IV'] },
        suggestedTempo: 120,
        tips: [
            'Major key creates brightness',
            'Strong I-V movement adds energy',
            'The vi chord adds just enough emotion'
        ]
    },
    {
        id: 'sad',
        emoji: '😢',
        title: 'Sad',
        subtitle: 'Melancholy & Touching',
        color: '#bfdbfe',
        progression: { key: 'Am', chords: ['Am', 'F', 'C', 'G'], roman: ['i', 'VI', 'III', 'VII'] },
        suggestedTempo: 72,
        tips: [
            'Starting on minor creates immediate emotion',
            'The F (VI) chord adds warmth to the sadness',
            'Ending on G creates longing'
        ]
    },
    {
        id: 'energetic',
        emoji: '⚡',
        title: 'Energetic',
        subtitle: 'Powerful & Driving',
        color: '#fca5a5',
        progression: { key: 'E', chords: ['E', 'A', 'B', 'E'], roman: ['I', 'IV', 'V', 'I'] },
        suggestedTempo: 140,
        tips: [
            'The classic I-IV-V-I is rock\'s foundation',
            'Key of E is popular for guitar',
            'Simple progressions work best for high energy'
        ]
    },
    {
        id: 'dreamy',
        emoji: '🌙',
        title: 'Dreamy',
        subtitle: 'Ethereal & Floating',
        color: '#c4b5fd',
        progression: { key: 'C', chords: ['Cmaj7', 'Fmaj7', 'Am7', 'Em7'], roman: ['Imaj7', 'IVmaj7', 'vi7', 'iii7'] },
        suggestedTempo: 85,
        tips: [
            'Major 7th chords create a floating quality',
            'Avoiding the V chord keeps things unresolved',
            'The iii chord adds mystery'
        ]
    },
    {
        id: 'romantic',
        emoji: '❤️',
        title: 'Romantic',
        subtitle: 'Warm & Tender',
        color: '#fbcfe8',
        progression: { key: 'G', chords: ['G', 'Em', 'C', 'D'], roman: ['I', 'vi', 'IV', 'V'] },
        suggestedTempo: 76,
        tips: [
            'Key of G is warm and accessible',
            'The vi (Em) early creates vulnerability',
            'Building to V creates anticipation'
        ]
    },
    {
        id: 'chill',
        emoji: '🌊',
        title: 'Chill',
        subtitle: 'Relaxed & Smooth',
        color: '#a5f3fc',
        progression: { key: 'D', chords: ['Dmaj7', 'A', 'Bm', 'G'], roman: ['Imaj7', 'V', 'vi', 'IV'] },
        suggestedTempo: 90,
        tips: [
            'The maj7 on I creates a relaxed home base',
            'This variation feels more mellow',
            'Perfect for acoustic or lo-fi vibes'
        ]
    },
    {
        id: 'mysterious',
        emoji: '🔮',
        title: 'Mysterious',
        subtitle: 'Enigmatic & Dark',
        color: '#a78bfa',
        progression: { key: 'Em', chords: ['Em', 'Am', 'B7', 'Em'], roman: ['i', 'iv', 'V7', 'i'] },
        suggestedTempo: 95,
        tips: [
            'Natural minor creates an ancient feel',
            'The iv chord adds depth without resolution',
            'B7 creates tension that resolves to minor'
        ]
    },
    {
        id: 'triumphant',
        emoji: '🏆',
        title: 'Triumphant',
        subtitle: 'Epic & Victorious',
        color: '#fcd34d',
        progression: { key: 'D', chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'D'], roman: ['I', 'V', 'vi', 'IV', 'I', 'V', 'IV', 'I'] },
        suggestedTempo: 130,
        tips: [
            'Extended 8-chord progression builds momentum',
            'The repeated D→A creates strength',
            'Ending on I provides powerful resolution'
        ]
    },
    {
        id: 'nostalgic',
        emoji: '📷',
        title: 'Nostalgic',
        subtitle: 'Bittersweet & Reflective',
        color: '#fed7aa',
        progression: { key: 'F', chords: ['Fmaj7', 'Dm7', 'Bbmaj7', 'C'], roman: ['Imaj7', 'vi7', 'IVmaj7', 'V'] },
        suggestedTempo: 82,
        tips: [
            '7th chords add wistfulness',
            'The vi7 creates emotional depth',
            'IVmaj7 adds warmth and memory'
        ]
    },
    {
        id: 'playful',
        emoji: '🎪',
        title: 'Playful',
        subtitle: 'Fun & Bouncy',
        color: '#86efac',
        progression: { key: 'G', chords: ['G', 'C', 'D', 'G'], roman: ['I', 'IV', 'V', 'I'] },
        suggestedTempo: 135,
        tips: [
            'Simple I-IV-V-I is inherently joyful',
            'Key of G has a light, open sound',
            'Fast tempo adds bounce and energy'
        ]
    }
];

// ===========================================
// STYLE/GENRE OPTIONS
// ===========================================

const STYLE_OPTIONS = [
    {
        id: 'pop',
        emoji: '🎤',
        title: 'Pop',
        description: 'Catchy hooks, simple progressions',
        chordComplexity: 'simple',
        suggestedMoods: ['happy', 'energetic', 'romantic'],
        tempoRange: [100, 130]
    },
    {
        id: 'rock',
        emoji: '🎸',
        title: 'Rock',
        description: 'Power chords, driving rhythm',
        chordComplexity: 'simple',
        suggestedMoods: ['energetic', 'triumphant'],
        tempoRange: [110, 150]
    },
    {
        id: 'jazz',
        emoji: '🎷',
        title: 'Jazz',
        description: '7th chords, sophisticated harmony',
        chordComplexity: 'complex',
        suggestedMoods: ['chill', 'dreamy', 'nostalgic'],
        tempoRange: [80, 140]
    },
    {
        id: 'folk',
        emoji: '🪕',
        title: 'Folk/Acoustic',
        description: 'Warm, organic, storytelling',
        chordComplexity: 'simple',
        suggestedMoods: ['nostalgic', 'romantic', 'sad'],
        tempoRange: [70, 110]
    },
    {
        id: 'electronic',
        emoji: '🎹',
        title: 'Electronic',
        description: 'Repetitive, atmospheric, modern',
        chordComplexity: 'medium',
        suggestedMoods: ['dreamy', 'energetic', 'mysterious'],
        tempoRange: [90, 140]
    },
    {
        id: 'rnb',
        emoji: '🎙️',
        title: 'R&B/Soul',
        description: 'Smooth, emotional, groovy',
        chordComplexity: 'complex',
        suggestedMoods: ['romantic', 'chill', 'nostalgic'],
        tempoRange: [60, 100]
    },
    {
        id: 'classical',
        emoji: '🎻',
        title: 'Classical',
        description: 'Traditional harmony, elegant',
        chordComplexity: 'complex',
        suggestedMoods: ['triumphant', 'sad', 'mysterious'],
        tempoRange: [60, 140]
    },
    {
        id: 'blues',
        emoji: '🎺',
        title: 'Blues',
        description: '12-bar patterns, soulful',
        chordComplexity: 'medium',
        suggestedMoods: ['sad', 'chill', 'nostalgic'],
        tempoRange: [70, 120]
    }
];

// ===========================================
// SONG STRUCTURE TEMPLATES
// ===========================================

const STRUCTURE_OPTIONS = [
    {
        id: 'simple',
        title: 'Simple Loop',
        description: '4 chords, perfect for starting out',
        icon: '🔄',
        sections: [{ type: 'loop', measures: 4, repeat: 4 }],
        totalMeasures: 16
    },
    {
        id: 'verse-chorus',
        title: 'Verse-Chorus',
        description: 'Classic pop/rock structure',
        icon: '🎵',
        sections: [
            { type: 'intro', measures: 4 },
            { type: 'verse', measures: 8 },
            { type: 'chorus', measures: 8 },
            { type: 'verse', measures: 8 },
            { type: 'chorus', measures: 8 },
            { type: 'outro', measures: 4 }
        ],
        totalMeasures: 40
    },
    {
        id: 'verse-prechorus-chorus',
        title: 'Verse-Pre-Chorus',
        description: 'Builds anticipation before chorus',
        icon: '📈',
        sections: [
            { type: 'intro', measures: 4 },
            { type: 'verse', measures: 8 },
            { type: 'prechorus', measures: 4 },
            { type: 'chorus', measures: 8 },
            { type: 'verse', measures: 8 },
            { type: 'prechorus', measures: 4 },
            { type: 'chorus', measures: 8 },
            { type: 'bridge', measures: 8 },
            { type: 'chorus', measures: 8 },
            { type: 'outro', measures: 4 }
        ],
        totalMeasures: 64
    },
    {
        id: 'aaba',
        title: 'AABA (32-bar)',
        description: 'Classic jazz/standard form',
        icon: '🎷',
        sections: [
            { type: 'A', measures: 8 },
            { type: 'A', measures: 8 },
            { type: 'B', measures: 8 },
            { type: 'A', measures: 8 }
        ],
        totalMeasures: 32
    },
    {
        id: 'blues',
        title: '12-Bar Blues',
        description: 'The foundation of rock & blues',
        icon: '🎸',
        sections: [
            { type: 'blues', measures: 12, repeat: 3 }
        ],
        totalMeasures: 36
    }
];

// ===========================================
// SECTION-SPECIFIC PROGRESSION GENERATORS
// ===========================================

/**
 * Generate chord progressions for different section types.
 * Uses Roman numerals relative to the key, with multiple options per section type.
 * Each option has a 'pattern' (Roman numerals) and 'description' for educational purposes.
 */
const SECTION_PROGRESSIONS = {
    // Intro: Usually simpler, sets the mood
    intro: [
        { pattern: ['I', 'V'], description: 'Simple and open' },
        { pattern: ['I', 'IV'], description: 'Warm and inviting' },
        { pattern: ['vi', 'IV'], description: 'Reflective opening' },
        { pattern: ['I'], description: 'Single chord drone' }
    ],
    // Verse: Tells the story, often more subdued
    verse: [
        { pattern: ['I', 'V', 'vi', 'IV'], description: 'Classic pop verse' },
        { pattern: ['I', 'IV', 'I', 'V'], description: 'Folk-style verse' },
        { pattern: ['vi', 'IV', 'I', 'V'], description: 'Emotional verse' },
        { pattern: ['I', 'vi', 'IV', 'V'], description: '50s progression' },
        { pattern: ['I', 'iii', 'vi', 'IV'], description: 'Gentle descent' }
    ],
    // Pre-chorus: Builds tension toward chorus
    prechorus: [
        { pattern: ['ii', 'V'], description: 'Classic buildup' },
        { pattern: ['IV', 'V'], description: 'Strong lift' },
        { pattern: ['vi', 'V'], description: 'Emotional tension' },
        { pattern: ['ii', 'IV', 'V'], description: 'Extended buildup' },
        { pattern: ['IV', 'I', 'V'], description: 'Anticipation builder' }
    ],
    // Chorus: The hook, usually brightest/most memorable
    chorus: [
        { pattern: ['IV', 'V', 'I', 'vi'], description: 'Uplifting chorus' },
        { pattern: ['I', 'V', 'vi', 'IV'], description: 'Anthemic chorus' },
        { pattern: ['IV', 'I', 'V', 'vi'], description: 'Driving chorus' },
        { pattern: ['I', 'IV', 'V', 'V'], description: 'Power chorus' },
        { pattern: ['vi', 'IV', 'I', 'V'], description: 'Emotional chorus' }
    ],
    // Bridge: Contrast, often different key area feeling
    bridge: [
        { pattern: ['vi', 'ii', 'V', 'I'], description: 'Circle progression' },
        { pattern: ['IV', 'iv', 'I', 'V'], description: 'Minor IV color' },
        { pattern: ['ii', 'V', 'iii', 'vi'], description: 'Jazz-influenced' },
        { pattern: ['vi', 'V', 'IV', 'V'], description: 'Descending then lift' },
        { pattern: ['iii', 'vi', 'ii', 'V'], description: 'Full circle of fifths' }
    ],
    // Outro: Resolution or fade
    outro: [
        { pattern: ['IV', 'I'], description: 'Plagal cadence (Amen)' },
        { pattern: ['V', 'I'], description: 'Perfect resolution' },
        { pattern: ['I', 'IV', 'I'], description: 'Gentle ending' },
        { pattern: ['vi', 'IV', 'I'], description: 'Soft landing' }
    ],
    // For AABA form - A section
    A: [
        { pattern: ['I', 'vi', 'ii', 'V'], description: 'Standard A section' },
        { pattern: ['I', 'IV', 'iii', 'vi'], description: 'Descending A section' },
        { pattern: ['I', 'vi', 'IV', 'V'], description: 'Classic turnaround' }
    ],
    // For AABA form - B section (bridge/release)
    B: [
        { pattern: ['IV', 'iv', 'I', 'vi'], description: 'Contrasting bridge' },
        { pattern: ['iii', 'vi', 'ii', 'V'], description: 'Circle of fifths bridge' },
        { pattern: ['II', 'V', 'I', 'vi'], description: 'Secondary dominant bridge' }
    ]
};

/**
 * Convert Roman numeral to chord in a given key
 * @param {string} roman - Roman numeral (I, ii, iii, IV, V, vi, vii°, etc.)
 * @param {string} key - The key (C, G, Am, etc.)
 * @param {string} style - Style for chord quality adjustments
 * @returns {string} Chord name (e.g., "C", "Dm", "G7")
 */
function romanToChord(roman, key, style = 'pop') {
    // Major key scale degrees
    const majorScaleChords = {
        'C': ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'],
        'G': ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim'],
        'D': ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#dim'],
        'A': ['A', 'Bm', 'C#m', 'D', 'E', 'F#m', 'G#dim'],
        'E': ['E', 'F#m', 'G#m', 'A', 'B', 'C#m', 'D#dim'],
        'F': ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'Edim'],
        'Bb': ['Bb', 'Cm', 'Dm', 'Eb', 'F', 'Gm', 'Adim'],
        'Eb': ['Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'Cm', 'Ddim'],
        'Ab': ['Ab', 'Bbm', 'Cm', 'Db', 'Eb', 'Fm', 'Gdim']
    };

    // Minor key scale degrees (natural minor)
    const minorScaleChords = {
        'Am': ['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G'],
        'Em': ['Em', 'F#dim', 'G', 'Am', 'Bm', 'C', 'D'],
        'Bm': ['Bm', 'C#dim', 'D', 'Em', 'F#m', 'G', 'A'],
        'Dm': ['Dm', 'Edim', 'F', 'Gm', 'Am', 'Bb', 'C'],
        'Gm': ['Gm', 'Adim', 'Bb', 'Cm', 'Dm', 'Eb', 'F']
    };

    // Determine if we're in a minor key
    const isMinor = key.includes('m') && !key.includes('
    const scaleChords = isMinor ? minorScaleChords[key] : majorScaleChords[key];

    // Fallback to C major if key not found
    const chords = scaleChords || majorScaleChords['C'];

    // Parse the Roman numeral
    const romanMap = {
        'I': 0, 'i': 0,
        'II': 1, 'ii': 1,
        'III': 2, 'iii': 2,
        'IV': 3, 'iv': 3,
        'V': 4, 'v': 4,
        'VI': 5, 'vi': 5,
        'VII': 6, 'vii': 6, 'vii°': 6
    };

    // Extract base numeral and any modifiers
    const baseRoman = roman.replace(/[°7maj]/g, '');
    const degree = romanMap[baseRoman];

    if (degree === undefined) return chords[0]; // Fallback to I

    let chord = chords[degree];

    // Handle special cases
    if (roman.includes('7') && style === 'jazz') {
        // Add 7ths for jazz style
        if (roman === roman.toUpperCase() || roman === 'V') {
            chord = chord.replace('m', '') + '7'; // Dominant 7
        } else {
            chord = chord + '7'; // Minor 7 or Maj7
        }
    }

    // Handle minor IV (iv) - borrowed chord
    if (roman === 'iv') {
        const root = chord.replace('m', '').replace('dim', '');
        chord = root + 'm';
    }

    // Handle secondary dominants (II instead of ii)
    if (roman === 'II') {
        const root = chords[1].replace('m', '').replace('dim', '');
        chord = root; // Major instead of minor
    }

    return chord;
}

/**
 * Generate a progression for a section type with randomness
 * @param {string} sectionType - Type of section (verse, chorus, etc.)
 * @param {string} key - The key to generate in
 * @param {number} measures - Number of measures needed
 * @param {string} style - Musical style
 * @returns {Array} Array of chord names
 */
function generateSectionProgression(sectionType, key, measures, style = 'pop') {
    const options = SECTION_PROGRESSIONS[sectionType];

    if (!options || options.length === 0) {
        // Fallback: simple I-IV-V-I
        const fallback = ['I', 'IV', 'V', 'I'];
        return expandPattern(fallback, measures, key, style);
    }

    // Randomly select one of the options
    const selected = options[Math.floor(Math.random() * options.length)];

    return expandPattern(selected.pattern, measures, key, style);
}

/**
 * Expand a Roman numeral pattern to fill the required measures
 * @param {Array} pattern - Array of Roman numerals
 * @param {number} measures - Number of measures to fill
 * @param {string} key - The key
 * @param {string} style - Musical style
 * @returns {Array} Array of chord names
 */
function expandPattern(pattern, measures, key, style) {
    const chords = [];

    for (let i = 0; i < measures; i++) {
        const roman = pattern[i % pattern.length];
        const chord = romanToChord(roman, key, style);
        chords.push(chord);
    }

    return chords;
}

// ===========================================
// WIZARD STEPS CONFIGURATION
// ===========================================

const WIZARD_STEPS = [
    { id: 'mood', title: 'Mood', icon: '🎭' },
    { id: 'style', title: 'Style', icon: '🎨' },
    { id: 'structure', title: 'Structure', icon: '🏗️' },
    { id: 'tempo', title: 'Tempo', icon: '⏱️' },
    { id: 'preview', title: 'Preview', icon: '👂' },
    { id: 'customize', title: 'Customize', icon: '✏️' },
    { id: 'bass', title: 'Bass', icon: '🎸' },
    { id: 'launch', title: 'Launch', icon: '🚀' }
];

// ===========================================
// BASS PATTERN OPTIONS
// ===========================================

const BASS_PATTERN_CATEGORIES = {
    simple: {
        title: 'Simple',
        description: 'Great for beginners',
        patterns: [
            { id: 'whole-note', name: 'Whole Notes', desc: 'One note per measure' },
            { id: 'root-fifth', name: 'Root-Fifth', desc: 'Classic country/folk' },
            { id: 'half-time', name: 'Half Time', desc: 'Two notes per measure' },
            { id: 'pedal', name: 'Pedal Tone', desc: 'Sustained bass note' }
        ]
    },
    arpeggiated: {
        title: 'Arpeggiated',
        description: 'Broken chord patterns',
        patterns: [
            { id: 'arpeggio', name: 'Arpeggio', desc: 'Rolling chord tones' },
            { id: 'alberti', name: 'Alberti Bass', desc: 'Classical piano style' },
            { id: 'broken-octave', name: 'Broken Octave', desc: 'Octave alternation' }
        ]
    },
    walking: {
        title: 'Walking & Melodic',
        description: 'Jazz and blues styles',
        patterns: [
            { id: 'walking', name: 'Walking Bass', desc: 'Jazz standard' },
            { id: 'chromatic-approach', name: 'Chromatic Approach', desc: 'Half-step lead-ins' },
            { id: 'scalar-walk', name: 'Scalar Walk', desc: 'Scale-based movement' }
        ]
    },
    rhythmic: {
        title: 'Rhythmic',
        description: 'Groove-focused patterns',
        patterns: [
            { id: 'syncopated', name: 'Syncopated', desc: 'Off-beat emphasis' },
            { id: 'shuffle', name: 'Shuffle', desc: 'Blues/rock groove' },
            { id: 'driving-rock', name: 'Driving Rock', desc: 'Eighth note pulse' },
            { id: 'boogie', name: 'Boogie', desc: 'Rock & roll classic' }
        ]
    },
    style: {
        title: 'Style-Specific',
        description: 'Genre patterns',
        patterns: [
            { id: 'country', name: 'Country', desc: 'Boom-chuck pattern' },
            { id: 'bossa-nova', name: 'Bossa Nova', desc: 'Brazilian rhythm' },
            { id: 'motown', name: 'Motown', desc: 'Soul/R&B groove' },
            { id: 'reggae', name: 'Reggae', desc: 'Off-beat drops' },
            { id: 'funk', name: 'Funk', desc: 'Syncopated groove' }
        ]
    }
};

// ===========================================
// STATE
// ===========================================

let currentStep = 0;
let selectedMood = null;
let selectedStyle = null;
let selectedStructure = 'simple';
let isPlaying = false;
let playbackTimeoutIds = [];

let customizations = {
    key: null,
    tempo: 100,
    feel: 'straight',
    variation: 'standard',
    timeSignature: '4/4',
    bassPattern: 'root-fifth'
};

// ===========================================
// AUDIO HELPERS
// ===========================================

function stopPlayback() {
    playbackTimeoutIds.forEach(id => clearTimeout(id));
    playbackTimeoutIds = [];
    isPlaying = false;

    // Update play buttons
    document.querySelectorAll('.play-btn-icon').forEach(icon => {
        icon.textContent = '▶';
    });
}

async function playProgression(chordNames, duration = 0.8, loop = false) {
    if (isPlaying) {
        stopPlayback();
        return;
    }
    isPlaying = true;

    // Update button
    document.querySelectorAll('.play-btn-icon').forEach(icon => {
        icon.textContent = '⏹';
    });

    try {
        const piano = getPiano ? getPiano() : (window.getPiano ? window.getPiano() : null);
        if (!piano || typeof Tone === 'undefined') {
            isPlaying = false;
            return;
        }

        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        const playOnce = async () => {
            const now = Tone.now();

            for (let i = 0; i < chordNames.length; i++) {
                if (!isPlaying) break;

                const { root, type } = parseChordName(chordNames[i]);
                const chordInfo = getChordNotes(root, type);
                const notes = chordInfo?.specificNotes || [];

                if (notes.length > 0) {
                    piano.triggerAttackRelease(notes, duration * 0.9, now + (i * duration));
                }
            }

            await new Promise(resolve => {
                const timeoutId = setTimeout(resolve, chordNames.length * duration * 1000);
                playbackTimeoutIds.push(timeoutId);
            });
        };

        if (loop) {
            while (isPlaying) {
                await playOnce();
            }
        } else {
            await playOnce();
        }

    } catch (err) {

    } finally {
        isPlaying = false;
        document.querySelectorAll('.play-btn-icon').forEach(icon => {
            icon.textContent = '▶';
        });
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
        <div class="wizard-step-indicator flex justify-center gap-1 md:gap-2 mb-6 flex-wrap">
            ${WIZARD_STEPS.map((step, idx) => `
                <div class="flex items-center">
                    <div class="flex flex-col items-center">
                        <div class="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm md:text-lg transition-all ${
                            idx < currentStep ? 'bg-green-500 text-white' :
                            idx === currentStep ? 'bg-blue-600 text-white ring-4 ring-blue-200' :
                            'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                        }">
                            ${idx < currentStep ? '✓' : step.icon}
                        </div>
                        <span class="text-[10px] md:text-xs mt-1 font-medium max-w-[60px] text-center ${
                            idx === currentStep ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                        }">${step.title}</span>
                    </div>
                    ${idx < WIZARD_STEPS.length - 1 ? `
                        <div class="w-4 md:w-8 h-0.5 mx-1 mt-[-16px] ${idx < currentStep ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}"></div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function renderStep1Mood() {
    return `
        <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">What feeling do you want to capture?</h2>
            <p class="text-gray-600 dark:text-gray-300">Choose a mood - this shapes the entire composition</p>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            ${MOOD_OPTIONS.map(mood => `
                <button class="mood-option group p-3 rounded-xl border-2 transition-all hover:scale-[1.02] ${
                    selectedMood === mood.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 shadow-lg'
                        : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 bg-white dark:bg-gray-800'
                }" data-mood="${mood.id}" style="${selectedMood === mood.id ? `background: linear-gradient(135deg, ${mood.color}40, transparent);` : ''}">
                    <div class="text-3xl mb-1">${mood.emoji}</div>
                    <div class="font-bold text-gray-900 dark:text-white text-sm">${mood.title}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 leading-tight">${mood.subtitle}</div>
                </button>
            `).join('')}
        </div>

        ${selectedMood ? `
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                <div class="flex items-center gap-3 mb-2">
                    <span class="text-2xl">${MOOD_OPTIONS.find(m => m.id === selectedMood)?.emoji}</span>
                    <span class="font-bold text-gray-900 dark:text-white">${MOOD_OPTIONS.find(m => m.id === selectedMood)?.title}</span>
                    <button id="preview-mood-btn" class="ml-auto px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm flex items-center gap-1">
                        <span class="play-btn-icon">▶</span> Preview
                    </button>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-300">${MOOD_OPTIONS.find(m => m.id === selectedMood)?.tips[0]}</p>
            </div>
        ` : ''}
    `;
}

function renderStep2Style() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);

    return `
        <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">What style fits your vision?</h2>
            <p class="text-gray-600 dark:text-gray-300">This affects chord complexity and recommended patterns</p>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            ${STYLE_OPTIONS.map(style => {
                const isRecommended = mood && style.suggestedMoods.includes(mood.id);
                return `
                    <button class="style-option group p-4 rounded-xl border-2 transition-all hover:scale-[1.02] relative ${
                        selectedStyle === style.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 shadow-lg'
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 bg-white dark:bg-gray-800'
                    }" data-style="${style.id}">
                        ${isRecommended ? '<span class="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">Recommended</span>' : ''}
                        <div class="text-3xl mb-2">${style.emoji}</div>
                        <div class="font-bold text-gray-900 dark:text-white">${style.title}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${style.description}</div>
                    </button>
                `;
            }).join('')}
        </div>

        ${selectedStyle ? `
            <div class="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">${STYLE_OPTIONS.find(s => s.id === selectedStyle)?.emoji}</span>
                    <div>
                        <span class="font-bold text-gray-900 dark:text-white">${STYLE_OPTIONS.find(s => s.id === selectedStyle)?.title}</span>
                        <p class="text-sm text-gray-600 dark:text-gray-300">
                            Chord complexity: <span class="font-medium">${STYLE_OPTIONS.find(s => s.id === selectedStyle)?.chordComplexity}</span>
                        </p>
                    </div>
                </div>
            </div>
        ` : ''}
    `;
}

function renderStep3Structure() {
    return `
        <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Choose your song structure</h2>
            <p class="text-gray-600 dark:text-gray-300">This defines the overall form of your composition</p>
        </div>

        <div class="space-y-3 mb-6">
            ${STRUCTURE_OPTIONS.map(structure => `
                <button class="structure-option w-full p-4 rounded-xl border-2 transition-all hover:scale-[1.01] text-left ${
                    selectedStructure === structure.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 shadow-lg'
                        : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 bg-white dark:bg-gray-800'
                }" data-structure="${structure.id}">
                    <div class="flex items-center gap-4">
                        <div class="text-3xl">${structure.icon}</div>
                        <div class="flex-1">
                            <div class="font-bold text-gray-900 dark:text-white">${structure.title}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">${structure.description}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-lg font-bold text-blue-600 dark:text-blue-400">${structure.totalMeasures}</div>
                            <div class="text-xs text-gray-500">measures</div>
                        </div>
                    </div>
                    ${selectedStructure === structure.id ? `
                        <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                            <div class="flex flex-wrap gap-2">
                                ${structure.sections.map(s => `
                                    <span class="px-2 py-1 rounded-full text-xs font-medium ${getSectionColor(s.type)}">
                                        ${s.type}${s.repeat ? ` ×${s.repeat}` : ''} (${s.measures}m)
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </button>
            `).join('')}
        </div>
    `;
}

function getSectionColor(type) {
    const colors = {
        intro: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
        verse: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
        prechorus: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
        chorus: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
        bridge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
        outro: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300',
        loop: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
        A: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
        B: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
        blues: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
}

function renderStep4Tempo() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    const style = STYLE_OPTIONS.find(s => s.id === selectedStyle);

    const suggestedTempo = mood?.suggestedTempo || 100;
    const currentTempo = customizations.tempo || suggestedTempo;
    const currentFeel = customizations.feel || 'straight';
    const currentTimeSig = customizations.timeSignature || '4/4';

    // Get tempo description
    const getTempoLabel = (bpm) => {
        if (bpm < 60) return 'Very Slow (Largo)';
        if (bpm < 80) return 'Slow (Adagio)';
        if (bpm < 100) return 'Moderate (Andante)';
        if (bpm < 120) return 'Walking (Moderato)';
        if (bpm < 140) return 'Fast (Allegro)';
        if (bpm < 170) return 'Very Fast (Vivace)';
        return 'Extremely Fast (Presto)';
    };

    // Style-suggested feel
    const suggestedFeel = style?.id === 'jazz' ? 'swing' :
                          style?.id === 'blues' ? 'shuffle' : 'straight';

    return `
        <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Set the pace & feel</h2>
            <p class="text-gray-600 dark:text-gray-300">Configure tempo, rhythmic feel, and time signature</p>
        </div>

        <!-- Tempo Section -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600 mb-4">
            <div class="text-center mb-4">
                <span id="tempo-display" class="text-5xl font-bold text-blue-600 dark:text-blue-400">${currentTempo}</span>
                <span class="text-xl text-gray-500 ml-2">BPM</span>
                <div id="tempo-label" class="text-sm text-gray-500 mt-1">${getTempoLabel(currentTempo)}</div>
            </div>

            <input type="range" id="tempo-slider" min="40" max="200" value="${currentTempo}"
                class="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600">

            <div class="flex justify-between text-xs text-gray-500 mt-2 mb-4">
                <span>Ballad (60)</span>
                <span>Pop (100)</span>
                <span>Dance (140)</span>
                <span>Punk (180)</span>
            </div>

            <!-- Tap Tempo -->
            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div class="flex items-center justify-between mb-2">
                    <div>
                        <div class="font-medium text-gray-900 dark:text-white text-sm">Tap to set tempo</div>
                        <div class="text-xs text-gray-500">Press <kbd class="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-[10px]">Space</kbd> rhythmically</div>
                    </div>
                    <button id="tap-tempo-btn" class="relative px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all active:scale-90 shadow-md">
                        <span id="tap-btn-text">TAP</span>
                        <span id="tap-pulse" class="absolute inset-0 rounded-lg bg-white opacity-0 pointer-events-none"></span>
                    </button>
                </div>
                <div id="tap-feedback" class="flex items-center justify-center gap-3 h-5">
                    <div id="tap-dots" class="flex gap-1">
                        <span class="tap-dot w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                        <span class="tap-dot w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                        <span class="tap-dot w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                        <span class="tap-dot w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                    </div>
                    <span id="tap-message" class="text-sm text-gray-500"></span>
                </div>
            </div>

            ${mood ? `
                <div class="mt-3 flex items-center justify-center gap-2">
                    <span class="text-sm text-gray-500">Suggested for ${mood.title}:</span>
                    <button id="use-suggested-tempo" class="px-3 py-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-full text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors">
                        ${suggestedTempo} BPM
                    </button>
                </div>
            ` : ''}
        </div>

        <!-- Feel & Time Signature Section -->
        <div class="grid md:grid-cols-2 gap-4 mb-4">
            <!-- Feel Selection -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                <div class="flex items-center justify-between mb-3">
                    <div class="font-medium text-gray-900 dark:text-white">Feel</div>
                    ${style && suggestedFeel !== 'straight' ? `
                        <span class="text-xs text-green-600 dark:text-green-400">${style.title} often uses ${suggestedFeel}</span>
                    ` : ''}
                </div>
                <div class="grid grid-cols-3 gap-2">
                    <button class="feel-option p-3 rounded-lg border-2 transition-all text-center ${
                        currentFeel === 'straight'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40'
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                    }" data-feel="straight">
                        <div class="text-2xl mb-1">➡️</div>
                        <div class="text-xs font-medium text-gray-900 dark:text-white">Straight</div>
                        <div class="text-[10px] text-gray-500">Even 8ths</div>
                    </button>
                    <button class="feel-option p-3 rounded-lg border-2 transition-all text-center ${
                        currentFeel === 'swing'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40'
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                    }" data-feel="swing">
                        <div class="text-2xl mb-1">🎷</div>
                        <div class="text-xs font-medium text-gray-900 dark:text-white">Swing</div>
                        <div class="text-[10px] text-gray-500">Jazz triplet</div>
                    </button>
                    <button class="feel-option p-3 rounded-lg border-2 transition-all text-center ${
                        currentFeel === 'shuffle'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40'
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                    }" data-feel="shuffle">
                        <div class="text-2xl mb-1">🎸</div>
                        <div class="text-xs font-medium text-gray-900 dark:text-white">Shuffle</div>
                        <div class="text-[10px] text-gray-500">Blues groove</div>
                    </button>
                </div>
            </div>

            <!-- Time Signature Selection -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                <div class="font-medium text-gray-900 dark:text-white mb-3">Time Signature</div>
                <div class="grid grid-cols-3 gap-2">
                    <button class="timesig-option p-3 rounded-lg border-2 transition-all text-center ${
                        currentTimeSig === '4/4'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40'
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                    }" data-timesig="4/4">
                        <div class="text-xl font-bold text-gray-900 dark:text-white">4/4</div>
                        <div class="text-[10px] text-gray-500">Common time</div>
                    </button>
                    <button class="timesig-option p-3 rounded-lg border-2 transition-all text-center ${
                        currentTimeSig === '3/4'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40'
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                    }" data-timesig="3/4">
                        <div class="text-xl font-bold text-gray-900 dark:text-white">3/4</div>
                        <div class="text-[10px] text-gray-500">Waltz</div>
                    </button>
                    <button class="timesig-option p-3 rounded-lg border-2 transition-all text-center ${
                        currentTimeSig === '6/8'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40'
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                    }" data-timesig="6/8">
                        <div class="text-xl font-bold text-gray-900 dark:text-white">6/8</div>
                        <div class="text-[10px] text-gray-500">Compound</div>
                    </button>
                </div>
            </div>
        </div>

        <div class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-700/50">
            <div class="flex items-start gap-2">
                <span class="text-lg">💡</span>
                <div class="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Current settings:</strong> ${currentTempo} BPM, ${currentFeel} feel, ${currentTimeSig} time
                </div>
            </div>
        </div>
    `;
}

function renderStep5Preview() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    const style = STYLE_OPTIONS.find(s => s.id === selectedStyle);
    const structure = STRUCTURE_OPTIONS.find(s => s.id === selectedStructure);

    if (!mood) return '<p class="text-center text-gray-500">Please select a mood first</p>';

    return `
        <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Preview Your Composition</h2>
            <p class="text-gray-600 dark:text-gray-300">Here's what we've created based on your choices</p>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600 text-center">
                <div class="text-2xl mb-1">${mood.emoji}</div>
                <div class="text-xs text-gray-500">Mood</div>
                <div class="font-bold text-gray-900 dark:text-white">${mood.title}</div>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600 text-center">
                <div class="text-2xl mb-1">${style?.emoji || '🎵'}</div>
                <div class="text-xs text-gray-500">Style</div>
                <div class="font-bold text-gray-900 dark:text-white">${style?.title || 'Any'}</div>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600 text-center">
                <div class="text-2xl mb-1">🎹</div>
                <div class="text-xs text-gray-500">Key</div>
                <div class="font-bold text-gray-900 dark:text-white">${customizations.key || mood.progression.key}</div>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600 text-center">
                <div class="text-2xl mb-1">⏱️</div>
                <div class="text-xs text-gray-500">Tempo</div>
                <div class="font-bold text-gray-900 dark:text-white">${customizations.tempo} BPM</div>
            </div>
        </div>

        <!-- Chord Progression -->
        <div class="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-600">
            <h3 class="font-bold text-gray-900 dark:text-white mb-4 text-center">Your Chord Progression</h3>
            <div class="flex justify-center gap-2 md:gap-4 flex-wrap mb-6">
                ${mood.progression.chords.map((chord, idx) => `
                    <div class="text-center">
                        <div class="w-14 h-14 md:w-16 md:h-16 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-lg md:text-xl font-bold text-blue-900 dark:text-blue-100 shadow-md">
                            ${chord}
                        </div>
                        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">${mood.progression.roman[idx]}</div>
                    </div>
                `).join(`
                    <div class="self-center text-gray-400 dark:text-gray-500 font-bold">→</div>
                `)}
            </div>

            <div class="flex justify-center gap-3">
                <button id="play-progression-btn" class="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors font-medium shadow-md">
                    <span class="play-btn-icon">▶</span> Play Once
                </button>
                <button id="play-loop-btn" class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors font-medium shadow-md">
                    <span>🔁</span> Loop
                </button>
            </div>
        </div>

        <!-- Why This Works -->
        <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-5 border border-yellow-200 dark:border-yellow-700/50">
            <h3 class="font-bold text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2">
                <span>💡</span> Why This Works for "${mood.title}"
            </h3>
            <ul class="space-y-2">
                ${mood.tips.map(tip => `
                    <li class="flex items-start gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                        <span class="mt-0.5">•</span>
                        <span>${tip}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
}

function renderStep6Customize() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    const style = STYLE_OPTIONS.find(s => s.id === selectedStyle);
    if (!mood) return '<p class="text-center text-gray-500">Please select a mood first</p>';

    const keys = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    const currentKey = customizations.key || mood.progression.key;

    // Check if progression already has 7ths
    const alreadyHas7ths = mood.progression.chords.some(c => c.includes('7') || c.includes('maj7'));

    // Style-specific variations
    const getVariations = () => {
        const variations = [
            {
                id: 'standard',
                title: 'Standard',
                desc: 'Use the progression as-is',
                available: true
            }
        ];

        // Add 7ths only if not already present
        if (!alreadyHas7ths) {
            variations.push({
                id: 'sevenths',
                title: 'Add 7ths',
                desc: style?.id === 'jazz' ? 'Already jazzy, but more color!' : 'Richer, more sophisticated',
                available: true
            });
        }

        // Rotated start
        if (mood.progression.chords.length > 2) {
            variations.push({
                id: 'rotated',
                title: 'Start on Different Chord',
                desc: `Begin on ${mood.progression.chords[1]} instead of ${mood.progression.chords[0]}`,
                available: true
            });
        }

        // Style-specific options
        if (style?.id === 'rock' || style?.id === 'pop') {
            variations.push({
                id: 'power',
                title: 'Power Chords',
                desc: 'Remove 3rds for a rock sound',
                available: true
            });
        }

        return variations;
    };

    const variations = getVariations();

    return `
        <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Fine-tune Your Creation</h2>
            <p class="text-gray-600 dark:text-gray-300">Optional adjustments - skip if you're happy with the preview</p>
        </div>

        <div class="grid md:grid-cols-2 gap-6 mb-6">
            <!-- Key Selection -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                <h3 class="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <span>🎹</span> Key
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    Change key to match your vocal range or band
                </p>
                <div class="flex flex-wrap gap-2">
                    ${keys.map(key => `
                        <button class="key-option px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                            key === currentKey
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }" data-key="${key}">
                            ${key}
                        </button>
                    `).join('')}
                </div>
                <div class="mt-3 text-xs text-gray-500">
                    Current: <strong>${currentKey}</strong> ${currentKey !== mood.progression.key ? `(originally ${mood.progression.key})` : ''}
                </div>
            </div>

            <!-- Variation Selection -->
            <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                <h3 class="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <span>✨</span> Variation
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    ${alreadyHas7ths ? 'This progression already uses 7th chords' : 'Try a different flavor'}
                </p>
                <div class="space-y-2">
                    ${variations.map(v => `
                        <button class="variation-option w-full text-left px-4 py-3 rounded-lg transition-colors ${
                            customizations.variation === v.id
                                ? 'bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-500'
                                : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                        } ${!v.available ? 'opacity-50 cursor-not-allowed' : ''}"
                        data-variation="${v.id}" ${!v.available ? 'disabled' : ''}>
                            <div class="font-semibold text-gray-900 dark:text-white">${v.title}</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">${v.desc}</div>
                        </button>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- Preview current customization -->
        <div class="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
            <div class="flex items-center justify-between">
                <div>
                    <div class="font-medium text-gray-900 dark:text-white">Current progression:</div>
                    <div class="text-sm text-gray-500">${getCustomizedChords().join(' → ')}</div>
                </div>
                <button id="preview-custom-btn" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors font-medium">
                    <span class="play-btn-icon">▶</span> Preview
                </button>
            </div>
        </div>
    `;
}

function renderStep7BassPattern() {
    const style = STYLE_OPTIONS.find(s => s.id === selectedStyle);
    const currentPattern = customizations.bassPattern || 'root-fifth';

    // Get suggested patterns based on style
    const getSuggestedPatterns = () => {
        const suggestions = {
            'pop': ['root-fifth', 'half-time', 'syncopated'],
            'rock': ['driving-rock', 'root-fifth', 'boogie'],
            'jazz': ['walking', 'chromatic-approach', 'arpeggio'],
            'folk': ['root-fifth', 'country', 'arpeggio'],
            'electronic': ['syncopated', 'pedal', 'half-time'],
            'rnb': ['motown', 'syncopated', 'funk'],
            'classical': ['alberti', 'arpeggio', 'whole-note'],
            'blues': ['shuffle', 'walking', 'boogie']
        };
        return suggestions[style?.id] || ['root-fifth', 'half-time', 'arpeggio'];
    };

    const suggestedPatterns = getSuggestedPatterns();

    // Find a pattern by ID from any category
    const findPattern = (id) => {
        for (const cat of Object.values(BASS_PATTERN_CATEGORIES)) {
            const found = cat.patterns.find(p => p.id === id);
            if (found) return found;
        }
        return null;
    };

    return `
        <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Choose a Bass Pattern</h2>
            <p class="text-gray-600 dark:text-gray-300">This will be applied to your composition (you can change it later)</p>
        </div>

        <!-- Suggested Patterns -->
        ${style ? `
        <div class="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 mb-6 border border-green-200 dark:border-green-700/50">
            <div class="flex items-center gap-2 mb-3">
                <span class="text-lg">✨</span>
                <span class="font-medium text-green-800 dark:text-green-200">Recommended for ${style.title}</span>
            </div>
            <div class="flex flex-wrap gap-2">
                ${suggestedPatterns.map(patternId => {
                    const pattern = findPattern(patternId);
                    if (!pattern) return '';
                    return `
                        <button class="bass-pattern-option px-4 py-2 rounded-lg transition-all ${
                            currentPattern === patternId
                                ? 'bg-green-600 text-white shadow-md'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-green-100 dark:hover:bg-green-800/30 border border-green-300 dark:border-green-600'
                        }" data-pattern="${patternId}">
                            <div class="font-medium">${pattern.name}</div>
                            <div class="text-xs opacity-75">${pattern.desc}</div>
                        </button>
                    `;
                }).join('')}
            </div>
        </div>
        ` : ''}

        <!-- All Pattern Categories -->
        <div class="space-y-4 mb-6">
            ${Object.entries(BASS_PATTERN_CATEGORIES).map(([catId, category]) => `
                <div class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                    <div class="flex items-center justify-between mb-3">
                        <div>
                            <div class="font-medium text-gray-900 dark:text-white">${category.title}</div>
                            <div class="text-xs text-gray-500">${category.description}</div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                        ${category.patterns.map(pattern => `
                            <button class="bass-pattern-option p-3 rounded-lg border-2 transition-all text-left ${
                                currentPattern === pattern.id
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40'
                                    : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                            }" data-pattern="${pattern.id}">
                                <div class="font-medium text-sm text-gray-900 dark:text-white">${pattern.name}</div>
                                <div class="text-xs text-gray-500">${pattern.desc}</div>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>

        <!-- Current Selection -->
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700/50">
            <div class="flex items-center justify-between">
                <div>
                    <div class="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Selected:</strong> ${findPattern(currentPattern)?.name || 'Root-Fifth'}
                    </div>
                    <div class="text-xs text-blue-600 dark:text-blue-300 mt-1">
                        ${findPattern(currentPattern)?.desc || ''}
                    </div>
                </div>
                <div class="text-xs text-blue-600 dark:text-blue-400">
                    You can change this anytime in the Melody Composer
                </div>
            </div>
        </div>
    `;
}

function renderStep8Launch() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    const style = STYLE_OPTIONS.find(s => s.id === selectedStyle);
    const structure = STRUCTURE_OPTIONS.find(s => s.id === selectedStructure);

    if (!mood) return '<p class="text-center text-gray-500">Please select a mood first</p>';

    const chords = getCustomizedChords();

    // Calculate what will actually be generated
    const getExpandedInfo = () => {
        if (!structure) return { totalMeasures: chords.length, sections: [] };

        let totalMeasures = 0;
        const sections = [];

        for (const sectionDef of structure.sections) {
            const repeatCount = sectionDef.repeat || 1;
            for (let r = 0; r < repeatCount; r++) {
                const measures = sectionDef.type === 'blues' ? 12 : sectionDef.measures;
                totalMeasures += measures;
                sections.push({
                    type: sectionDef.type,
                    measures: measures
                });
            }
        }

        return { totalMeasures, sections };
    };

    const expandedInfo = getExpandedInfo();

    return `
        <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Ready to Create!</h2>
            <p class="text-gray-600 dark:text-gray-300">Here's what will be generated based on your choices</p>
        </div>

        <!-- Summary Card -->
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
            <div class="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
                <div class="text-white text-center">
                    <div class="text-sm opacity-80">Your ${mood.title} ${style?.title || ''} Song</div>
                    <div class="text-lg font-bold">${chords.join(' → ')}</div>
                </div>
            </div>
            <div class="p-4 grid grid-cols-5 gap-3 text-center text-sm">
                <div>
                    <div class="text-gray-500 dark:text-gray-400">Key</div>
                    <div class="font-bold text-gray-900 dark:text-white">${customizations.key || mood.progression.key}</div>
                </div>
                <div>
                    <div class="text-gray-500 dark:text-gray-400">Tempo</div>
                    <div class="font-bold text-gray-900 dark:text-white">${customizations.tempo} BPM</div>
                </div>
                <div>
                    <div class="text-gray-500 dark:text-gray-400">Structure</div>
                    <div class="font-bold text-gray-900 dark:text-white">${structure?.title || 'Loop'}</div>
                </div>
                <div>
                    <div class="text-gray-500 dark:text-gray-400">Bass</div>
                    <div class="font-bold text-gray-900 dark:text-white text-xs">${getBassPatternName(customizations.bassPattern)}</div>
                </div>
                <div>
                    <div class="text-gray-500 dark:text-gray-400">Total</div>
                    <div class="font-bold text-blue-600 dark:text-blue-400">${expandedInfo.totalMeasures}m</div>
                </div>
            </div>
        </div>

        ${expandedInfo.sections.length > 0 ? `
        <!-- Structure Preview -->
        <div class="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-6">
            <div class="text-sm font-medium text-gray-900 dark:text-white mb-3">Song Structure Preview:</div>
            <div class="flex flex-wrap gap-2">
                ${expandedInfo.sections.map(s => `
                    <span class="px-3 py-1.5 rounded-full text-xs font-medium ${getSectionColor(s.type)}">
                        ${s.type.charAt(0).toUpperCase() + s.type.slice(1)} (${s.measures}m)
                    </span>
                `).join('')}
            </div>
            <div class="text-xs text-gray-500 mt-3">
                Each section will be created with labeled brackets in the composer
            </div>
        </div>
        ` : ''}

        <!-- Main Launch Button -->
        <button id="load-to-melody-btn" class="w-full p-6 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg transition-all hover:scale-[1.01] mb-4">
            <div class="flex items-center justify-center gap-4">
                <div class="text-4xl">🚀</div>
                <div class="text-left">
                    <div class="text-xl font-bold">Start Composing</div>
                    <div class="text-sm text-green-100">Load ${expandedInfo.totalMeasures} measures into the Melody Composer</div>
                </div>
            </div>
        </button>

        <!-- What happens next -->
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-4 border border-blue-200 dark:border-blue-700/50">
            <div class="text-sm text-blue-800 dark:text-blue-200">
                <strong>What happens when you click:</strong>
                <ol class="mt-2 space-y-1 list-decimal list-inside text-blue-700 dark:text-blue-300">
                    <li>Your ${chords.length}-chord progression is expanded to ${expandedInfo.totalMeasures} measures</li>
                    ${expandedInfo.sections.length > 0 ? `<li>${expandedInfo.sections.length} labeled sections are created automatically</li>` : ''}
                    <li>Key set to <strong>${customizations.key || mood.progression.key}</strong>, tempo to <strong>${customizations.tempo} BPM</strong></li>
                    <li>Ready to add melody! Press <kbd class="px-1.5 py-0.5 bg-blue-200 dark:bg-blue-700 rounded text-xs">Tab</kbd> for AI suggestions</li>
                </ol>
            </div>
        </div>

        <!-- Alternative option -->
        <div class="flex items-center justify-between text-sm">
            <button id="load-to-trainer-btn" class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline">
                Or open in Progression Workshop instead →
            </button>
            <button id="start-over-btn" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                Start over
            </button>
        </div>
    `;
}

function getBassPatternName(patternId) {
    for (const category of Object.values(BASS_PATTERN_CATEGORIES)) {
        const found = category.patterns.find(p => p.id === patternId);
        if (found) return found.name;
    }
    return 'Root-Fifth';
}

function getCustomizedChords() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    if (!mood) return [];

    let chords = [...mood.progression.chords];

    if (customizations.variation === 'sevenths') {
        chords = chords.map(chord => {
            const { root, type } = parseChordName(chord);
            if (type === 'Major') return root + 'maj7';
            if (type === 'Minor') return root + 'm7';
            return chord;
        });
    } else if (customizations.variation === 'rotated') {
        chords = [...chords.slice(1), chords[0]];
    }

    return chords;
}

// ===========================================
// MAIN RENDER
// ===========================================

export function renderSongwritingWizard(container) {
    // Clean up previous keyboard listeners
    if (container._cleanupKeydown) {
        container._cleanupKeydown();
    }

    let stepContent = '';

    switch (currentStep) {
        case 0: stepContent = renderStep1Mood(); break;
        case 1: stepContent = renderStep2Style(); break;
        case 2: stepContent = renderStep3Structure(); break;
        case 3: stepContent = renderStep4Tempo(); break;
        case 4: stepContent = renderStep5Preview(); break;
        case 5: stepContent = renderStep6Customize(); break;
        case 6: stepContent = renderStep7BassPattern(); break;
        case 7: stepContent = renderStep8Launch(); break;
    }

    const canProceed = currentStep === 0 ? selectedMood : true;

    const html = `
        <div class="songwriting-wizard bg-white dark:bg-gray-900 max-w-4xl mx-auto p-4 md:p-6 rounded-xl">
            <div class="mb-6 text-center">
                <h1 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-3">
                    <span class="text-3xl md:text-4xl">✨</span> Songwriting Wizard
                </h1>
                <p class="text-gray-500 dark:text-gray-400 text-sm">Step ${currentStep + 1} of ${WIZARD_STEPS.length}</p>
            </div>

            ${renderStepIndicator()}

            <div id="wizard-step-content" class="mb-6 min-h-[300px]">
                ${stepContent}
            </div>

            <div class="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                ${currentStep > 0 ? `
                    <button id="wizard-back-btn" class="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-2">
                        <span>←</span> Back
                    </button>
                ` : '<div></div>'}

                ${currentStep < WIZARD_STEPS.length - 1 ? `
                    <button id="wizard-next-btn" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-md ${!canProceed ? 'opacity-50 cursor-not-allowed' : ''}">
                        Next <span>→</span>
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
            const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
            if (mood) {
                customizations.tempo = mood.suggestedTempo;
            }
            renderSongwritingWizard(container);
        });
    });

    // Style selection
    container.querySelectorAll('.style-option').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedStyle = btn.dataset.style;
            renderSongwritingWizard(container);
        });
    });

    // Structure selection
    container.querySelectorAll('.structure-option').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedStructure = btn.dataset.structure;
            renderSongwritingWizard(container);
        });
    });

    // Feel selection
    container.querySelectorAll('.feel-option').forEach(btn => {
        btn.addEventListener('click', () => {
            customizations.feel = btn.dataset.feel;
            renderSongwritingWizard(container);
        });
    });

    // Time Signature selection
    container.querySelectorAll('.timesig-option').forEach(btn => {
        btn.addEventListener('click', () => {
            customizations.timeSignature = btn.dataset.timesig;
            renderSongwritingWizard(container);
        });
    });

    // Bass Pattern selection
    container.querySelectorAll('.bass-pattern-option').forEach(btn => {
        btn.addEventListener('click', () => {
            customizations.bassPattern = btn.dataset.pattern;
            renderSongwritingWizard(container);
        });
    });

    // Tempo slider
    const tempoSlider = container.querySelector('#tempo-
    const tempoDisplay = container.querySelector('#tempo-
    if (tempoSlider && tempoDisplay) {
        tempoSlider.addEventListener('input', () => {
            customizations.tempo = parseInt(tempoSlider.value);
            tempoDisplay.textContent = customizations.tempo;
        });
    }

    // Tap tempo
    let tapTimes = [];
    let tapResetTimeout = null;

    const handleTap = () => {
        const now = Date.now();

        // Reset if more than 2 seconds since last tap
        if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 2000) {
            tapTimes = [];
        }

        tapTimes.push(now);

        // Keep only last 4 taps
        if (tapTimes.length > 4) tapTimes.shift();

        // Visual feedback - pulse animation
        const pulse = container.querySelector('#tap-
        if (pulse) {
            pulse.style.transition = 'none';
            pulse.style.opacity = '0.3';
            setTimeout(() => {
                pulse.style.transition = 'opacity 0.3s ease-out';
                pulse.style.opacity = '0';
            }, 50);
        }

        // Update tap dots
        const tapDots = container.querySelectorAll('.tap-
        tapDots.forEach((dot, idx) => {
            if (idx < tapTimes.length) {
                dot.classList.remove('bg-gray-300', 'dark:bg-gray-600');
                dot.classList.add('bg-blue-500');
            } else {
                dot.classList.remove('bg-blue-500');
                dot.classList.add('bg-gray-300', 'dark:bg-gray-600');
            }
        });

        // Show message
        const tapMessage = container.querySelector('#tap-
        if (tapMessage) {
            if (tapTimes.length < 2) {
                tapMessage.textContent = 'Keep tapping...';
            } else if (tapTimes.length < 4) {
                tapMessage.textContent = `${4 - tapTimes.length} more for accuracy`;
            }
        }

        // Calculate tempo after 2+ taps
        if (tapTimes.length >= 2) {
            const intervals = [];
            for (let i = 1; i < tapTimes.length; i++) {
                intervals.push(tapTimes[i] - tapTimes[i - 1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
            const bpm = Math.round(60000 / avgInterval);
            if (bpm >= 40 && bpm <= 200) {
                customizations.tempo = bpm;
                if (tempoSlider) tempoSlider.value = bpm;
                if (tempoDisplay) tempoDisplay.textContent = bpm;

                // Update tempo label
                const tempoLabel = container.querySelector('#tempo-
                if (tempoLabel) {
                    const getTempoLabel = (bpm) => {
                        if (bpm < 60) return 'Very Slow (Largo)';
                        if (bpm < 80) return 'Slow (Adagio)';
                        if (bpm < 100) return 'Moderate (Andante)';
                        if (bpm < 120) return 'Walking (Moderato)';
                        if (bpm < 140) return 'Fast (Allegro)';
                        if (bpm < 170) return 'Very Fast (Vivace)';
                        return 'Extremely Fast (Presto)';
                    };
                    tempoLabel.textContent = getTempoLabel(bpm);
                }

                if (tapMessage && tapTimes.length >= 4) {
                    tapMessage.textContent = `Detected: ${bpm} BPM`;
                    tapMessage.classList.add('text-green-600', 'dark:text-green-400', 'font-
                    tapMessage.classList.remove('text-gray-500');
                }
            }
        }

        // Reset after inactivity
        clearTimeout(tapResetTimeout);
        tapResetTimeout = setTimeout(() => {
            tapTimes = [];
            const tapDots = container.querySelectorAll('.tap-
            tapDots.forEach(dot => {
                dot.classList.remove('bg-blue-500');
                dot.classList.add('bg-gray-300', 'dark:bg-gray-600');
            });
            if (tapMessage) {
                tapMessage.textContent = '';
                tapMessage.classList.remove('text-green-600', 'dark:text-green-400', 'font-
                tapMessage.classList.add('text-gray-500');
            }
        }, 3000);
    };

    container.querySelector('#tap-tempo-btn')?.addEventListener('click', handleTap);

    // Use suggested tempo
    container.querySelector('#use-suggested-tempo')?.addEventListener('click', () => {
        const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
        if (mood) {
            customizations.tempo = mood.suggestedTempo;
            if (tempoSlider) tempoSlider.value = mood.suggestedTempo;
            if (tempoDisplay) tempoDisplay.textContent = mood.suggestedTempo;
        }
    });

    // Preview mood
    container.querySelector('#preview-mood-btn')?.addEventListener('click', async () => {
        const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
        if (mood) {
            await playProgression(mood.progression.chords, 0.7);
        }
    });

    // Play progression
    container.querySelector('#play-progression-btn')?.addEventListener('click', async () => {
        const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
        if (mood) {
            const duration = 60 / customizations.tempo;
            await playProgression(mood.progression.chords, duration);
        }
    });

    // Play looped
    container.querySelector('#play-loop-btn')?.addEventListener('click', async () => {
        const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
        if (mood) {
            const duration = 60 / customizations.tempo;
            await playProgression(mood.progression.chords, duration, true);
        }
    });

    // Key selection
    container.querySelectorAll('.key-option').forEach(btn => {
        btn.addEventListener('click', () => {
            customizations.key = btn.dataset.key;
            renderSongwritingWizard(container);
        });
    });

    // Variation selection
    container.querySelectorAll('.variation-option').forEach(btn => {
        btn.addEventListener('click', () => {
            customizations.variation = btn.dataset.variation;
            renderSongwritingWizard(container);
        });
    });

    // Preview customized
    container.querySelector('#preview-custom-btn')?.addEventListener('click', async () => {
        const duration = 60 / customizations.tempo;
        await playProgression(getCustomizedChords(), duration);
    });

    // Load to trainer
    container.querySelector('#load-to-trainer-btn')?.addEventListener('click', () => {
        loadToComposition('
    });

    // Load to melody
    container.querySelector('#load-to-melody-btn')?.addEventListener('click', () => {
        loadToComposition('
    });

    // Start over
    container.querySelector('#start-over-btn')?.addEventListener('click', () => {
        stopPlayback();
        resetWizard();
        renderSongwritingWizard(container);
    });

    // Navigation
    container.querySelector('#wizard-back-btn')?.addEventListener('click', () => {
        stopPlayback();
        if (currentStep > 0) {
            currentStep--;
            renderSongwritingWizard(container);
        }
    });

    container.querySelector('#wizard-next-btn')?.addEventListener('click', () => {
        if (currentStep === 0 && !selectedMood) return;
        stopPlayback();
        if (currentStep < WIZARD_STEPS.length - 1) {
            currentStep++;
            renderSongwritingWizard(container);
        }
    });

    // Keyboard shortcuts
    const handleKeydown = (e) => {
        // Only handle spacebar on tempo step (step 3)
        if (e.code === 'Space' && currentStep === 3 && document.activeElement?.id !== 'tempo-slider') {
            e.preventDefault();
            handleTap();
        }
    };
    document.addEventListener('keydown', handleKeydown);

    // Clean up listener on re-render
    container._cleanupKeydown = () => document.removeEventListener('keydown', handleKeydown);
}

function loadToComposition(targetTab) {
    const baseChords = getCustomizedChords();
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    const style = STYLE_OPTIONS.find(s => s.id === selectedStyle);
    const structure = STRUCTURE_OPTIONS.find(s => s.id === selectedStructure);
    const key = customizations.key || mood?.progression.key || 'C';
    const styleId = style?.id || 'pop';

    // Map structure section types to composition section types
    const sectionTypeMap = {
        'intro': 'intro',
        'verse': 'verse',
        'prechorus': 'prechorus',
        'chorus': 'chorus',
        'bridge': 'bridge',
        'outro': 'outro',
        'loop': null, // No section type for simple loops
        'A': 'verse', // AABA form uses verse-like sections
        'B': 'bridge', // Bridge for the B section
        'blues': 'verse' // 12-bar blues treated as verse
    };

    // Generate expanded progression based on structure
    let expandedProgression = [];
    let sectionDefinitions = []; // Track which chord indices belong to which section
    let currentChordIndex = 0;

    if (structure && structure.sections) {
        for (const sectionDef of structure.sections) {
            const repeatCount = sectionDef.repeat || 1;

            for (let r = 0; r < repeatCount; r++) {
                const sectionStartIndex = currentChordIndex;
                const measuresNeeded = sectionDef.measures;

                // Generate section-specific progression
                let chordsForSection = [];

                if (sectionDef.type === 'blues') {
                    // 12-bar blues has a specific pattern
                    const bluesPattern = generateBluesProgression(baseChords[0]);
                    chordsForSection = bluesPattern;
                } else if (sectionDef.type === 'loop') {
                    // Simple loop: just use the base progression
                    for (let i = 0; i < measuresNeeded; i++) {
                        const chordIndex = i % baseChords.length;
                        const chord = baseChords[chordIndex];
                        const { root, type } = parseChordName(chord);
                        chordsForSection.push({
                            root,
                            type,
                            roman: mood?.progression.roman[chordIndex] || '',
                            duration: 1
                        });
                    }
                } else {
                    // Generate section-specific progression with variety!
                    const sectionChordNames = generateSectionProgression(
                        sectionDef.type,
                        key,
                        measuresNeeded,

                    // Convert chord names to progression data objects
                    chordsForSection = sectionChordNames.map(chordName => {
                        const { root, type } = parseChordName(chordName);
                        return {
                            root,
                            type,
                            roman: '', // Could calculate Roman numerals but keep it simple
                            duration: 1
                        };
                    });
                }

                expandedProgression = expandedProgression.concat(chordsForSection);

                // Track section for later creation (skip for simple loop)
                const mappedType = sectionTypeMap[sectionDef.type];
                if (mappedType) {
                    sectionDefinitions.push({
                        type: mappedType,
                        startIndex: sectionStartIndex,
                        endIndex: currentChordIndex + chordsForSection.length - 1
                    });
                }

                currentChordIndex += chordsForSection.length;
            }
        }
    } else {
        // Fallback: simple 4-chord progression from mood
        expandedProgression = baseChords.map((chord, idx) => {
            const { root, type } = parseChordName(chord);
            return {
                root,
                type,
                roman: mood?.progression.roman[idx % mood.progression.roman.length] || '',
                duration: 1
            };
        });
    }

    // Set key and progression
    setCurrentKey(customizations.key || mood?.progression.key || 'C');
    setProgressionData(expandedProgression);

    // Set tempo via global if available
    if (typeof window.setGlobalTempo === 'function') {
        window.setGlobalTempo(customizations.tempo);
    }

    // Apply bass pattern
    // If feel is swing or shuffle, adjust the bass pattern to use shuffle variant
    let effectiveBassPattern = customizations.bassPattern || 'root-fifth';
    if (customizations.feel === 'swing' || customizations.feel === 'shuffle') {
        // If user selected swing/shuffle feel, use shuffle bass unless they specifically picked a different pattern
        if (effectiveBassPattern === 'root-fifth' || effectiveBassPattern === 'half-time') {
            effectiveBassPattern = 'shuffle';
        }
    }

    if (typeof window.setBassPattern === 'function') {
        window.setBassPattern(effectiveBassPattern);

    }

    // Enable auto-generate bass so the pattern is applied
    if (typeof window.getCompositionState === 'function') {
        const compositionState = window.getCompositionState();
        if (compositionState && typeof compositionState.updateSettings === 'function') {
            compositionState.updateSettings({ autoGenerateBass: true });

        }
    }

    // Create sections in composition state (after a small delay to ensure progression is loaded)
    if (sectionDefinitions.length > 0) {
        setTimeout(() => {
            try {
                const compositionState = getCompositionState();
                if (compositionState && typeof compositionState.createSection === 'function') {
                    // Clear existing sections first
                    const existingSections = compositionState.getSections ? compositionState.getSections() : [];
                    existingSections.forEach(s => {
                        if (compositionState.deleteSection) {
                            compositionState.deleteSection(s.id);
                        }
                    });

                    // Create new sections
                    for (const secDef of sectionDefinitions) {
                        const chordIndices = [];
                        for (let i = secDef.startIndex; i <= secDef.endIndex; i++) {
                            chordIndices.push(i);
                        }
                        compositionState.createSection(secDef.type, chordIndices);

                    }

                    // Refresh UI to show sections on chord cards
                    setTimeout(() => {
                        if (typeof window.renderProgressionDisplay === 'function') {
                            window.renderProgressionDisplay('progression-visualization', true);
                            window.renderProgressionDisplay('melody-progression-visualization', false);

                        }
                    }, 50);
                }
            } catch (err) {

            }
        }, 100);
    }

    switchTab(targetTab);
}

/**
 * Generate a 12-bar blues progression
 * @param {string} baseChord - The root chord (e.g., "C" or "G7")
 * @returns {Array} Array of chord data objects
 */
function generateBluesProgression(baseChord) {
    const { root } = parseChordName(baseChord);

    // Standard 12-bar blues: I7 I7 I7 I7 | IV7 IV7 I7 I7 | V7 IV7 I7 V7
    const bluesNotes = {
        'C': { I: 'C7', IV: 'F7', V: 'G7' },
        'D': { I: 'D7', IV: 'G7', V: 'A7' },
        'E': { I: 'E7', IV: 'A7', V: 'B7' },
        'F': { I: 'F7', IV: 'Bb7', V: 'C7' },
        'G': { I: 'G7', IV: 'C7', V: 'D7' },
        'A': { I: 'A7', IV: 'D7', V: 'E7' },
        'Bb': { I: 'Bb7', IV: 'Eb7', V: 'F7' },
        'Eb': { I: 'Eb7', IV: 'Ab7', V: 'Bb7' }
    };

    const chords = bluesNotes[root] || bluesNotes['C'];

    // 12-bar blues pattern
    const pattern = [
        chords.I, chords.I, chords.I, chords.I,      // Bars 1-4
        chords.IV, chords.IV, chords.I, chords.I,    // Bars 5-8
        chords.V, chords.IV, chords.I, chords.V      // Bars 9-12 (turnaround)
    ];

    return pattern.map((chord, idx) => {
        const { root: chordRoot, type } = parseChordName(chord);
        const roman = idx < 4 ? 'I7' : (idx < 6 ? 'IV7' : (idx < 8 ? 'I7' : (idx === 8 ? 'V7' : (idx === 9 ? 'IV7' : (idx === 10 ? 'I7' : 'V7')))));
        return {
            root: chordRoot,
            type,
            roman,
            duration: 1
        };
    });
}

function resetWizard() {
    currentStep = 0;
    selectedMood = null;
    selectedStyle = null;
    selectedStructure = 'simple';
    customizations = {
        key: null,
        tempo: 100,
        feel: 'straight',
        variation: 'standard',
        timeSignature: '4/4',
        bassPattern: 'root-fifth'
    };
}

// ===========================================
// EXPORTS
// ===========================================

export function showSongwritingWizard() {
    resetWizard();
    window.dispatchEvent(new CustomEvent('showSongwritingWizard'));
}

export function openWizardInModal() {
    // Could be used to open wizard in a modal overlay from main screen
    const modal = document.createElement('
    modal.id = 'wizard-modal';
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div class="sticky top-0 bg-white dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-end z-10">
                <button id="close-wizard-modal" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-white">
                    <span class="text-xl font-bold">×</span>
                </button>
            </div>
            <div id="wizard-modal-content"></div>
        </div>
    `;
    document.body.appendChild(modal);

    const content = modal.querySelector('#wizard-modal-
    renderSongwritingWizard(content);

    modal.querySelector('#close-wizard-modal').addEventListener('click', () => {
        stopPlayback();
        modal.remove();
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            stopPlayback();
            modal.remove();
        }
    });
}

// Export for window access
window.openSongwritingWizard = openWizardInModal;

export default {
    renderSongwritingWizard,
    showSongwritingWizard,
    openWizardInModal
};
