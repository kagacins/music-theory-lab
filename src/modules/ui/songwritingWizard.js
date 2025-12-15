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
import { createSongBuilder, createSectionsFromWizardStructure, SECTION_TYPES } from './songBuilder.js';

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
        progressions: [
            { name: 'Classic Pop', key: 'C', chords: ['C', 'G', 'Am', 'F'], roman: ['I', 'V', 'vi', 'IV'], desc: 'The most popular progression ever' },
            { name: 'Optimistic', key: 'G', chords: ['G', 'C', 'D', 'G'], roman: ['I', 'IV', 'V', 'I'], desc: 'Simple and bright' },
            { name: 'Joyful', key: 'D', chords: ['D', 'A', 'G', 'A'], roman: ['I', 'V', 'IV', 'V'], desc: 'Energetic bounce' },
            { name: '50s Happy', key: 'C', chords: ['C', 'Am', 'F', 'G'], roman: ['I', 'vi', 'IV', 'V'], desc: 'Classic doo-wop feel' }
        ],
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
        progressions: [
            { name: 'Heartbreak', key: 'Am', chords: ['Am', 'F', 'C', 'G'], roman: ['i', 'VI', 'III', 'VII'], desc: 'Modern emotional ballad' },
            { name: 'Longing', key: 'Em', chords: ['Em', 'C', 'G', 'D'], roman: ['i', 'VI', 'III', 'VII'], desc: 'Gentle sadness' },
            { name: 'Teardrops', key: 'Am', chords: ['Am', 'Dm', 'E', 'Am'], roman: ['i', 'iv', 'V', 'i'], desc: 'Classic minor progression' },
            { name: 'Bittersweet', key: 'C', chords: ['C', 'G', 'Am', 'Em'], roman: ['I', 'V', 'vi', 'iii'], desc: 'Major key sadness' }
        ],
        suggestedTempo: 72,
        tips: [
            'Starting on minor creates immediate emotion',
            'The VI chord adds warmth to the sadness',
            'Slower tempos enhance melancholy'
        ]
    },
    {
        id: 'energetic',
        emoji: '⚡',
        title: 'Energetic',
        subtitle: 'Powerful & Driving',
        color: '#fca5a5',
        progressions: [
            { name: 'Rock Power', key: 'E', chords: ['E', 'A', 'B', 'E'], roman: ['I', 'IV', 'V', 'I'], desc: 'Classic rock foundation' },
            { name: 'Punk Drive', key: 'G', chords: ['G', 'C', 'D', 'D'], roman: ['I', 'IV', 'V', 'V'], desc: 'Fast and aggressive' },
            { name: 'Arena Rock', key: 'A', chords: ['A', 'D', 'E', 'D'], roman: ['I', 'IV', 'V', 'IV'], desc: 'Stadium anthem feel' },
            { name: 'Power Pop', key: 'D', chords: ['D', 'Bm', 'G', 'A'], roman: ['I', 'vi', 'IV', 'V'], desc: 'Catchy and driving' }
        ],
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
        progressions: [
            { name: 'Floating', key: 'C', chords: ['Cmaj7', 'Fmaj7', 'Am7', 'Em7'], roman: ['Imaj7', 'IVmaj7', 'vi7', 'iii7'], desc: 'Lush 7th chords' },
            { name: 'Ambient', key: 'G', chords: ['Gmaj7', 'Em7', 'Cmaj7', 'D'], roman: ['Imaj7', 'vi7', 'IVmaj7', 'V'], desc: 'Spacious and open' },
            { name: 'Celestial', key: 'D', chords: ['Dmaj7', 'F#m7', 'Gmaj7', 'A'], roman: ['Imaj7', 'iii7', 'IVmaj7', 'V'], desc: 'Ascending feel' },
            { name: 'Hazy', key: 'F', chords: ['Fmaj7', 'Am7', 'Dm7', 'Bbmaj7'], roman: ['Imaj7', 'iii7', 'vi7', 'IVmaj7'], desc: 'No dominant, unresolved' }
        ],
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
        progressions: [
            { name: 'Love Song', key: 'G', chords: ['G', 'Em', 'C', 'D'], roman: ['I', 'vi', 'IV', 'V'], desc: 'Classic ballad progression' },
            { name: 'First Dance', key: 'C', chords: ['C', 'Am', 'F', 'G'], roman: ['I', 'vi', 'IV', 'V'], desc: 'Timeless romance' },
            { name: 'Tender', key: 'F', chords: ['F', 'Dm', 'Bb', 'C'], roman: ['I', 'vi', 'IV', 'V'], desc: 'Soft and warm' },
            { name: 'Serenade', key: 'D', chords: ['D', 'G', 'A', 'Bm'], roman: ['I', 'IV', 'V', 'vi'], desc: 'Building to emotion' }
        ],
        suggestedTempo: 76,
        tips: [
            'Key of G is warm and accessible',
            'The vi chord early creates vulnerability',
            'Building to V creates anticipation'
        ]
    },
    {
        id: 'chill',
        emoji: '🌊',
        title: 'Chill',
        subtitle: 'Relaxed & Smooth',
        color: '#a5f3fc',
        progressions: [
            { name: 'Lo-Fi', key: 'D', chords: ['Dmaj7', 'A', 'Bm', 'G'], roman: ['Imaj7', 'V', 'vi', 'IV'], desc: 'Perfect for lo-fi beats' },
            { name: 'Smooth', key: 'G', chords: ['Gmaj7', 'Am7', 'Bm7', 'Cmaj7'], roman: ['Imaj7', 'ii7', 'iii7', 'IVmaj7'], desc: 'Jazz-influenced chill' },
            { name: 'Laid Back', key: 'C', chords: ['C', 'Em', 'F', 'G'], roman: ['I', 'iii', 'IV', 'V'], desc: 'Simple and relaxed' },
            { name: 'Sunset', key: 'A', chords: ['Amaj7', 'D', 'E', 'F#m7'], roman: ['Imaj7', 'IV', 'V', 'vi7'], desc: 'Warm evening vibes' }
        ],
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
        progressions: [
            { name: 'Dark', key: 'Em', chords: ['Em', 'Am', 'B7', 'Em'], roman: ['i', 'iv', 'V7', 'i'], desc: 'Classic minor tension' },
            { name: 'Suspense', key: 'Am', chords: ['Am', 'Dm', 'E7', 'Am'], roman: ['i', 'iv', 'V7', 'i'], desc: 'Building dread' },
            { name: 'Enigma', key: 'Dm', chords: ['Dm', 'Bb', 'Gm', 'A7'], roman: ['i', 'VI', 'iv', 'V7'], desc: 'Unexpected turns' },
            { name: 'Shadows', key: 'Em', chords: ['Em', 'C', 'Am', 'B7'], roman: ['i', 'VI', 'iv', 'V7'], desc: 'Haunting movement' }
        ],
        suggestedTempo: 95,
        tips: [
            'Natural minor creates an ancient feel',
            'The iv chord adds depth without resolution',
            'V7 creates tension that resolves to minor'
        ]
    },
    {
        id: 'triumphant',
        emoji: '🏆',
        title: 'Triumphant',
        subtitle: 'Epic & Victorious',
        color: '#fcd34d',
        progressions: [
            { name: 'Victory', key: 'D', chords: ['D', 'A', 'Bm', 'G'], roman: ['I', 'V', 'vi', 'IV'], desc: 'Anthemic and powerful' },
            { name: 'Epic', key: 'C', chords: ['C', 'G', 'Am', 'F'], roman: ['I', 'V', 'vi', 'IV'], desc: 'Stadium-ready' },
            { name: 'Glory', key: 'G', chords: ['G', 'D', 'Em', 'C'], roman: ['I', 'V', 'vi', 'IV'], desc: 'Uplifting triumph' },
            { name: 'Champion', key: 'E', chords: ['E', 'B', 'C#m', 'A'], roman: ['I', 'V', 'vi', 'IV'], desc: 'Rock anthem style' }
        ],
        suggestedTempo: 130,
        tips: [
            'Strong I-V movement creates power',
            'The vi adds emotional depth',
            'Ending on IV provides lift before resolution'
        ]
    },
    {
        id: 'nostalgic',
        emoji: '📷',
        title: 'Nostalgic',
        subtitle: 'Bittersweet & Reflective',
        color: '#fed7aa',
        progressions: [
            { name: 'Memories', key: 'F', chords: ['Fmaj7', 'Dm7', 'Bbmaj7', 'C'], roman: ['Imaj7', 'vi7', 'IVmaj7', 'V'], desc: 'Wistful 7ths' },
            { name: 'Yesteryear', key: 'G', chords: ['G', 'Em', 'C', 'D'], roman: ['I', 'vi', 'IV', 'V'], desc: 'Simple nostalgia' },
            { name: 'Flashback', key: 'C', chords: ['Cmaj7', 'Am7', 'Fmaj7', 'G7'], roman: ['Imaj7', 'vi7', 'IVmaj7', 'V7'], desc: 'Jazz-tinged memory' },
            { name: 'Old Photo', key: 'D', chords: ['D', 'Bm', 'G', 'A'], roman: ['I', 'vi', 'IV', 'V'], desc: 'Warm remembrance' }
        ],
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
        progressions: [
            { name: 'Bouncy', key: 'G', chords: ['G', 'C', 'D', 'G'], roman: ['I', 'IV', 'V', 'I'], desc: 'Simple and joyful' },
            { name: 'Skippy', key: 'C', chords: ['C', 'F', 'G', 'C'], roman: ['I', 'IV', 'V', 'I'], desc: 'Light and fun' },
            { name: 'Whimsical', key: 'D', chords: ['D', 'G', 'A', 'Bm'], roman: ['I', 'IV', 'V', 'vi'], desc: 'Playful with a twist' },
            { name: 'Silly', key: 'A', chords: ['A', 'D', 'E', 'A'], roman: ['I', 'IV', 'V', 'I'], desc: 'Carefree and bright' }
        ],
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
    const isMinor = key.includes('m') && !key.includes('maj');
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
    { id: 'welcome', title: 'Welcome', icon: '👋' },
    { id: 'mood', title: 'Mood', icon: '🎭' },
    { id: 'style', title: 'Style', icon: '🎨' },
    { id: 'structure', title: 'Structure', icon: '🏗️' },
    { id: 'tempo', title: 'Tempo', icon: '⏱️' },
    { id: 'preview', title: 'Preview', icon: '👂' },
    { id: 'customize', title: 'Customize', icon: '✏️' },
    { id: 'melody-bass', title: 'Melody & Bass', icon: '🎵' },
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
let creationMode = null; // 'quick', 'full', or 'explore'
let selectedMood = null;
let selectedStyle = null;
let selectedStructure = 'simple';
let selectedProgressionIndex = 0; // Which progression option within the mood
let isPlaying = false;
let playbackTimeoutIds = [];

// Track swapped chords for swap-back functionality
// Map of chord index -> original chord name
let swappedChords = new Map();

// Track the current working progression (may differ from mood default after swaps)
let workingProgression = null;

let customizations = {
    key: null,
    tempo: 100,
    feel: 'straight',
    variation: 'standard',
    timeSignature: '4/4',
    bassPattern: 'root-fifth',
    enableAIMelody: true,
    showChordTones: true,
    showBeginnerTips: false
};

// ===========================================
// TRANSPOSE HELPERS
// ===========================================

const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const ENHARMONIC_TO_SHARP = {
    'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B',
    'E#': 'F', 'B#': 'C'
};

/**
 * Get the selected progression option from the current mood
 * @returns {Object} Progression object with key, chords, roman, name, desc
 */
function getSelectedMoodProgression() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    if (mood && mood.progressions && mood.progressions.length > 0) {
        const idx = Math.min(selectedProgressionIndex, mood.progressions.length - 1);
        return mood.progressions[idx];
    }
    // Fallback
    return { name: 'Default', key: 'C', chords: ['C', 'G', 'Am', 'F'], roman: ['I', 'V', 'vi', 'IV'], desc: '' };
}

/**
 * Get the current working progression (with any applied swaps)
 * @returns {Object} Progression object with key, chords, roman
 */
function getCurrentProgression() {
    if (workingProgression) {
        return workingProgression;
    }
    const selectedProg = getSelectedMoodProgression();
    // Initialize working progression from selected mood progression
    workingProgression = {
        key: selectedProg.key,
        chords: [...selectedProg.chords],
        roman: [...selectedProg.roman],
        name: selectedProg.name
    };
    return workingProgression;
}

/**
 * Apply a chord swap to the working progression
 * @param {number} index - Chord index to swap
 * @param {string} newChord - New chord name
 */
function applyChordSwap(index, newChord) {
    const progression = getCurrentProgression();
    if (index >= 0 && index < progression.chords.length) {
        // Store original for undo
        if (!swappedChords.has(index)) {
            swappedChords.set(index, progression.chords[index]);
        }
        progression.chords[index] = newChord;
    }
}

/**
 * Revert a chord swap
 * @param {number} index - Chord index to revert
 */
function revertChordSwap(index) {
    const progression = getCurrentProgression();
    if (swappedChords.has(index)) {
        progression.chords[index] = swappedChords.get(index);
        swappedChords.delete(index);
    }
}

/**
 * Get the pitch class index (0-11) for a note name
 */
function getPitchIndex(note) {
    // Handle flats and enharmonics
    let normalized = ENHARMONIC_TO_SHARP[note] || note;
    // Handle lowercase
    normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    return PITCH_CLASSES.indexOf(normalized);
}

/**
 * Transpose a chord name by a given number of semitones
 */
function transposeChord(chordName, semitones) {
    if (!chordName || semitones === 0) return chordName;

    // Parse the chord - find root and suffix
    let root = '';
    let suffix = '';

    // Check for two-character root (e.g., "C#", "Bb")
    if (chordName.length >= 2 && (chordName[1] === '#' || chordName[1] === 'b')) {
        root = chordName.substring(0, 2);
        suffix = chordName.substring(2);
    } else {
        root = chordName[0];
        suffix = chordName.substring(1);
    }

    // Normalize to sharp
    const normalizedRoot = ENHARMONIC_TO_SHARP[root] || root;
    let rootIndex = PITCH_CLASSES.indexOf(normalizedRoot);

    if (rootIndex === -1) {
        console.warn('[Wizard] Unknown root note:', root);
        return chordName;
    }

    // Transpose
    let newIndex = (rootIndex + semitones) % 12;
    if (newIndex < 0) newIndex += 12;

    const newRoot = PITCH_CLASSES[newIndex];
    return newRoot + suffix;
}

/**
 * Calculate semitones between two keys
 */
function getSemitonesBetweenKeys(fromKey, toKey) {
    // Extract root note from key (e.g., "Am" -> "A", "C" -> "C")
    const fromRoot = fromKey.replace('m', '').replace('#', '').replace('b', '');
    const toRoot = toKey.replace('m', '').replace('#', '').replace('b', '');

    // Get full root including accidentals
    let fromNote = fromKey.charAt(0);
    if (fromKey.length > 1 && (fromKey.charAt(1) === '#' || fromKey.charAt(1) === 'b')) {
        fromNote = fromKey.substring(0, 2);
    }

    let toNote = toKey.charAt(0);
    if (toKey.length > 1 && (toKey.charAt(1) === '#' || toKey.charAt(1) === 'b')) {
        toNote = toKey.substring(0, 2);
    }

    const fromIndex = getPitchIndex(fromNote);
    const toIndex = getPitchIndex(toNote);

    if (fromIndex === -1 || toIndex === -1) return 0;

    let semitones = toIndex - fromIndex;
    if (semitones < -6) semitones += 12;
    if (semitones > 6) semitones -= 12;

    return semitones;
}

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
            const key = customizations.key || getCurrentProgression().key || 'C';

            for (let i = 0; i < chordNames.length; i++) {
                if (!isPlaying) break;

                const { root, type } = parseChordName(chordNames[i]);
                const chordInfo = getChordNotes(root, type, key, 3); // octave 3 for better sound
                const notes = chordInfo?.specificNotes || chordInfo?.baseNotes || [];

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
        console.error('[SongwritingWizard] Error playing:', err);
    } finally {
        isPlaying = false;
        document.querySelectorAll('.play-btn-icon').forEach(icon => {
            icon.textContent = '▶';
        });
    }
}

function parseChordName(name) {
    if (!name || typeof name !== 'string') {
        console.warn('[parseChordName] Invalid input:', name);
        return { root: 'C', type: 'Major' };
    }

    // Order matters - more specific patterns first
    const patterns = [
        // Extended chords
        { regex: /^([A-G][#b]?)maj9$/i, type: 'Major 9th' },
        { regex: /^([A-G][#b]?)m9$/i, type: 'Minor 9th' },
        { regex: /^([A-G][#b]?)9$/i, type: 'Dominant 9th' },
        { regex: /^([A-G][#b]?)add9$/i, type: 'Add9' },
        // 7th chords
        { regex: /^([A-G][#b]?)maj7$/i, type: 'Major 7th' },
        { regex: /^([A-G][#b]?)m7$/i, type: 'Minor 7th' },
        { regex: /^([A-G][#b]?)7$/i, type: 'Dominant 7th' },
        { regex: /^([A-G][#b]?)dim7$/i, type: 'Diminished 7th' },
        // 6th chords
        { regex: /^([A-G][#b]?)m6$/i, type: 'Minor 6th' },
        { regex: /^([A-G][#b]?)6$/i, type: 'Major 6th' },
        // Triads and other
        { regex: /^([A-G][#b]?)dim$/i, type: 'Diminished' },
        { regex: /^([A-G][#b]?)aug$/i, type: 'Augmented' },
        { regex: /^([A-G][#b]?)sus4$/i, type: 'Sus4' },
        { regex: /^([A-G][#b]?)sus2$/i, type: 'Sus2' },
        { regex: /^([A-G][#b]?)m$/i, type: 'Minor' },
        { regex: /^([A-G][#b]?)$/i, type: 'Major' }
    ];

    for (const { regex, type } of patterns) {
        const match = name.match(regex);
        if (match) {
            // Normalize root: uppercase letter, lowercase accidental
            const root = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
            return { root, type };
        }
    }

    // Fallback: try to extract root note more carefully
    const rootMatch = name.match(/^([A-G][#b]?)/i);
    if (rootMatch) {
        // Normalize root: uppercase letter, lowercase accidental
        const root = rootMatch[1].charAt(0).toUpperCase() + rootMatch[1].slice(1).toLowerCase();
        // Try to determine type from suffix
        const suffix = name.substring(rootMatch[0].length).toLowerCase();
        if (suffix.includes('maj7')) return { root, type: 'Major 7th' };
        if (suffix.includes('m7')) return { root, type: 'Minor 7th' };
        if (suffix.includes('7')) return { root, type: 'Dominant 7th' };
        if (suffix.includes('dim')) return { root, type: 'Diminished' };
        if (suffix.includes('aug')) return { root, type: 'Augmented' };
        if (suffix.includes('m') || suffix.includes('min')) return { root, type: 'Minor' };
        return { root, type: 'Major' };
    }

    console.warn('[parseChordName] Could not parse chord:', name);
    return { root: 'C', type: 'Major' };
}

// ===========================================
// RENDER FUNCTIONS
// ===========================================

function renderStepIndicator() {
    return `
        <div class="wizard-step-indicator flex justify-center gap-0.5 mb-3 overflow-x-auto">
            ${WIZARD_STEPS.map((step, idx) => `
                <div class="flex items-center flex-shrink-0">
                    <div class="flex flex-col items-center">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all ${
                            idx < currentStep ? 'bg-green-500 text-white' :
                            idx === currentStep ? 'bg-blue-600 text-white ring-2 ring-blue-200' :
                            'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                        }">
                            ${idx < currentStep ? '✓' : step.icon}
                        </div>
                    </div>
                    ${idx < WIZARD_STEPS.length - 1 ? `
                        <div class="w-3 h-0.5 ${idx < currentStep ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}"></div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function renderStep0Welcome() {
    const modes = [
        {
            id: 'quick',
            emoji: '⚡',
            title: 'Quick Song',
            subtitle: '4 chords, get started fast',
            description: 'Perfect for beginners or quick ideas. Creates a simple loop you can expand later.',
            time: '~2 minutes',
            color: 'from-blue-500 to-cyan-500'
        },
        {
            id: 'full',
            emoji: '🎼',
            title: 'Full Composition',
            subtitle: 'Verse, chorus, bridge & more',
            description: 'Build a complete song structure with multiple sections, transitions, and professional arrangement.',
            time: '~5 minutes',
            color: 'from-purple-500 to-pink-500'
        },
        {
            id: 'explore',
            emoji: '🧪',
            title: 'Explore & Learn',
            subtitle: 'Sandbox mode',
            description: 'No structure constraints. Experiment freely with chords, learn as you go, and discover what sounds good.',
            time: 'Open-ended',
            color: 'from-green-500 to-emerald-500'
        }
    ];

    return `
        <div class="text-center mb-4">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-1">What would you like to create?</h2>
            <p class="text-gray-600 dark:text-gray-300 text-sm">Choose your songwriting approach</p>
        </div>

        <div class="grid md:grid-cols-3 gap-3">
            ${modes.map(mode => `
                <button class="creation-mode-option group p-3 rounded-xl border-2 transition-all hover:scale-[1.01] text-left ${
                    creationMode === mode.id
                        ? 'border-blue-500 shadow-lg ring-2 ring-blue-200 dark:ring-blue-800'
                        : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 bg-white dark:bg-gray-800'
                }" data-mode="${mode.id}">
                    <div class="flex items-start gap-3">
                        <div class="bg-gradient-to-br ${mode.color} w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow flex-shrink-0">
                            ${mode.emoji}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-gray-900 dark:text-white">${mode.title}</div>
                            <div class="text-xs text-blue-600 dark:text-blue-400 font-medium">${mode.subtitle}</div>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">${mode.description}</p>
                        </div>
                    </div>
                </button>
            `).join('')}
        </div>
    `;
}

function renderStep1Mood() {
    const currentMood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    const progressions = currentMood?.progressions || [];

    return `
        <div class="text-center mb-3">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-1">What feeling do you want?</h2>
            <p class="text-gray-600 dark:text-gray-300 text-sm">Select a mood, then choose a progression</p>
        </div>

        <div class="grid grid-cols-5 gap-2">
            ${MOOD_OPTIONS.map(mood => `
                <button class="mood-option group p-2 rounded-lg border-2 transition-all hover:scale-[1.02] ${
                    selectedMood === mood.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 shadow-md'
                        : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
                }" data-mood="${mood.id}" style="${selectedMood === mood.id ? `background: linear-gradient(135deg, ${mood.color}40, transparent);` : ''}">
                    <div class="text-2xl">${mood.emoji}</div>
                    <div class="font-semibold text-gray-900 dark:text-white text-xs">${mood.title}</div>
                </button>
            `).join('')}
        </div>

        ${selectedMood && progressions.length > 0 ? `
            <div class="mt-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xl">${currentMood?.emoji}</span>
                    <span class="font-bold text-gray-900 dark:text-white text-sm">${currentMood?.title}</span>
                    <span class="text-xs text-gray-500">${currentMood?.subtitle}</span>
                </div>

                <!-- Progression Options -->
                <div class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Choose a progression:</div>
                <div class="grid grid-cols-2 gap-2">
                    ${progressions.map((prog, idx) => `
                        <div class="progression-option flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedProgressionIndex === idx
                                ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/50'
                                : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
                        }" data-progression-index="${idx}">
                            <button class="progression-play-btn flex-shrink-0 w-7 h-7 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center text-xs transition-colors" data-progression-index="${idx}" title="Play ${prog.name}">
                                ▶
                            </button>
                            <div class="flex-1 min-w-0">
                                <div class="font-semibold text-gray-900 dark:text-white text-xs">${prog.name}</div>
                                <div class="text-[10px] text-gray-500 dark:text-gray-400 truncate">${prog.chords.join(' → ')}</div>
                                <div class="text-[9px] text-gray-400 dark:text-gray-500">${prog.desc}</div>
                            </div>
                            ${selectedProgressionIndex === idx ? '<span class="text-blue-500 text-sm">✓</span>' : ''}
                        </div>
                    `).join('')}
                </div>

                <!-- Tips for selected progression -->
                <div class="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                    <div class="text-[10px] text-gray-600 dark:text-gray-400">
                        <strong>Key:</strong> ${progressions[selectedProgressionIndex]?.key} ·
                        <strong>Roman:</strong> ${progressions[selectedProgressionIndex]?.roman.join(' - ')}
                    </div>
                </div>
            </div>
        ` : ''}
    `;
}

function renderStep2Style() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);

    return `
        <div class="text-center mb-3">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-1">What style fits your vision?</h2>
            <p class="text-gray-600 dark:text-gray-300 text-sm">Affects chord complexity</p>
        </div>

        <div class="grid grid-cols-4 gap-2 pt-2 overflow-visible">
            ${STYLE_OPTIONS.map(style => {
                const isRecommended = mood && style.suggestedMoods.includes(mood.id);
                return `
                    <button class="style-option group p-2 rounded-lg border-2 transition-all hover:scale-[1.02] relative overflow-visible ${
                        selectedStyle === style.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 shadow-md'
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
                    }" data-style="${style.id}">
                        ${isRecommended ? '<span class="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full shadow-sm z-10">★</span>' : ''}
                        <div class="text-2xl">${style.emoji}</div>
                        <div class="font-semibold text-gray-900 dark:text-white text-xs">${style.title}</div>
                    </button>
                `;
            }).join('')}
        </div>

        ${selectedStyle ? `
            <div class="mt-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg p-2 border border-purple-200 dark:border-purple-700">
                <div class="flex items-center gap-2">
                    <span class="text-xl">${STYLE_OPTIONS.find(s => s.id === selectedStyle)?.emoji}</span>
                    <span class="font-bold text-gray-900 dark:text-white text-sm">${STYLE_OPTIONS.find(s => s.id === selectedStyle)?.title}</span>
                    <span class="text-xs text-gray-500">Complexity: ${STYLE_OPTIONS.find(s => s.id === selectedStyle)?.chordComplexity}</span>
                </div>
            </div>
        ` : ''}
    `;
}

function renderStep3Structure() {
    const style = STYLE_OPTIONS.find(s => s.id === selectedStyle);

    // Determine recommended structures based on style
    const getRecommendedStructures = () => {
        if (!style) return ['verse-chorus', 'simple']; // Default recommendations
        switch (style.id) {
            case 'jazz': return ['aaba', 'simple'];
            case 'blues': return ['blues', 'simple'];
            case 'rock': return ['verse-chorus', 'verse-prechorus-chorus'];
            case 'pop': return ['verse-chorus', 'verse-prechorus-chorus'];
            case 'electronic': return ['simple', 'verse-chorus'];
            case 'folk': return ['verse-chorus', 'simple'];
            case 'rnb': return ['verse-prechorus-chorus', 'verse-chorus'];
            case 'classical': return ['aaba', 'verse-prechorus-chorus'];
            default: return ['verse-chorus', 'simple'];
        }
    };

    const recommendedIds = getRecommendedStructures();

    return `
        <div class="text-center mb-3">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-1">Choose your song structure</h2>
            <p class="text-gray-600 dark:text-gray-300 text-sm">Defines the overall form</p>
        </div>

        <div class="space-y-2">
            ${STRUCTURE_OPTIONS.map(structure => {
                const isRecommended = recommendedIds.includes(structure.id);
                return `
                <button class="structure-option w-full p-2 rounded-lg border-2 transition-all text-left ${
                    selectedStructure === structure.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 shadow-md'
                        : isRecommended
                            ? 'border-green-300 dark:border-green-600 hover:border-green-400 bg-green-50/50 dark:bg-green-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 bg-white dark:bg-gray-800'
                }" data-structure="${structure.id}">
                    <div class="flex items-center gap-3">
                        <div class="text-xl">${structure.icon}</div>
                        <div class="flex-1">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-semibold text-gray-900 dark:text-white text-sm">${structure.title}</span>
                                ${isRecommended ? `<span class="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-medium rounded flex-shrink-0">★ Recommended</span>` : ''}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">${structure.description}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-sm font-bold text-blue-600 dark:text-blue-400">${structure.totalMeasures}m</div>
                        </div>
                    </div>
                    ${selectedStructure === structure.id ? `
                        <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <div class="flex flex-wrap gap-1">
                                ${structure.sections.map(s => `
                                    <span class="px-1.5 py-0.5 rounded text-[10px] font-medium ${getSectionColor(s.type)}">
                                        ${s.type}${s.repeat ? `×${s.repeat}` : ''}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </button>
            `;}).join('')}
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

    const getTempoLabel = (bpm) => {
        if (bpm < 80) return 'Slow';
        if (bpm < 120) return 'Medium';
        if (bpm < 150) return 'Fast';
        return 'Very Fast';
    };

    const suggestedFeel = style?.id === 'jazz' ? 'swing' :
                          style?.id === 'blues' ? 'shuffle' : 'straight';

    return `
        <div class="text-center mb-3">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-1">Set the pace & feel</h2>
        </div>

        <div class="grid md:grid-cols-2 gap-3">
            <!-- Tempo -->
            <div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                <div class="flex items-center justify-between mb-2">
                    <span class="font-medium text-gray-900 dark:text-white text-sm">Tempo</span>
                    <div>
                        <span id="tempo-display" class="text-2xl font-bold text-blue-600 dark:text-blue-400">${currentTempo}</span>
                        <span class="text-sm text-gray-500 dark:text-gray-400">BPM</span>
                    </div>
                </div>
                <input type="range" id="tempo-slider" min="40" max="200" value="${currentTempo}"
                    class="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600">
                <div class="flex justify-between text-[10px] text-gray-500 dark:text-white mt-1">
                    <span>60</span><span>100</span><span>140</span><span>180</span>
                </div>
                <div class="flex items-center justify-between mt-2">
                    <button id="tap-tempo-btn" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium">
                        TAP
                    </button>
                    ${mood ? `
                        <button id="use-suggested-tempo" class="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs">
                            Use ${suggestedTempo}
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Feel & Time -->
            <div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                <div class="mb-2">
                    <span class="font-medium text-gray-900 dark:text-white text-sm" title="How the rhythm is subdivided - straight (even), swing (triplet feel), or shuffle (blues groove)">Feel <span class="text-gray-400 text-xs">ⓘ</span></span>
                    <div class="grid grid-cols-3 gap-1 mt-1">
                        ${[
                            { id: 'straight', tip: 'Even eighth notes - standard pop/rock feel' },
                            { id: 'swing', tip: 'Triplet-based rhythm - jazzy, bouncy feel' },
                            { id: 'shuffle', tip: 'Blues groove - laid-back, syncopated feel' }
                        ].map(feel => `
                            <button class="feel-option p-1.5 rounded border transition-all text-center ${
                                currentFeel === feel.id
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100'
                                    : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                            }" data-feel="${feel.id}" title="${feel.tip}">
                                <div class="text-xs font-medium capitalize">${feel.id}</div>
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div>
                    <span class="font-medium text-gray-900 dark:text-white text-sm" title="Beats per measure - 4/4 is most common, 3/4 for waltz, 6/8 for compound feel">Time <span class="text-gray-400 text-xs">ⓘ</span></span>
                    <div class="grid grid-cols-3 gap-1 mt-1">
                        ${[
                            { sig: '4/4', tip: 'Common time - 4 beats per measure (most music)' },
                            { sig: '3/4', tip: 'Waltz time - 3 beats per measure' },
                            { sig: '6/8', tip: 'Compound time - 6 eighth notes, feels like 2 groups of 3' }
                        ].map(item => `
                            <button class="timesig-option p-1.5 rounded border transition-all text-center ${
                                currentTimeSig === item.sig
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100'
                                    : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                            }" data-timesig="${item.sig}" title="${item.tip}">
                                <div class="text-sm font-bold">${item.sig}</div>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderStep5Preview() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    const style = STYLE_OPTIONS.find(s => s.id === selectedStyle);

    if (!mood) return '<p class="text-center text-gray-500">Please select a mood first</p>';

    return `
        <div class="text-center mb-2">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">Preview Your Composition</h2>
        </div>

        <!-- Summary row -->
        <div class="flex justify-center gap-4 mb-3 text-sm text-gray-700 dark:text-gray-200">
            <span>${mood.emoji} ${mood.title}</span>
            <span>${style?.emoji || '🎵'} ${style?.title || 'Any'}</span>
            <span>🎹 ${customizations.key || getSelectedMoodProgression().key}</span>
            <span>⏱️ ${customizations.tempo} BPM</span>
        </div>

        <!-- Chord Progression -->
        <div class="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg p-3 mb-3 border border-gray-200 dark:border-gray-600">
            <div class="flex justify-center items-center gap-2 flex-wrap mb-3" id="wizard-progression-display">
                ${getCustomizedChords().map((chord, idx) => `
                    <div class="wizard-chord-chip w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-sm font-bold text-blue-900 dark:text-blue-100 shadow cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all" data-chord="${chord}" title="Click and hold to play ${chord}">
                        ${chord}
                    </div>
                `).join(`<span class="text-gray-400 dark:text-gray-500">→</span>`)}
            </div>
            <div class="flex justify-center gap-2">
                <button id="play-progression-btn" class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm flex items-center gap-1">
                    <span class="play-btn-icon">▶</span> Play
                </button>
                <button id="play-loop-btn" class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm flex items-center gap-1">
                    🔁 Loop
                </button>
            </div>
        </div>

        <!-- Quick Swaps -->
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-700/50">
            <div class="font-semibold text-blue-800 dark:text-blue-200 mb-2 text-sm flex items-center gap-1">
                <span>🔄</span> Quick Swaps
            </div>
            <div class="flex flex-wrap gap-2" id="quick-swap-container">
                ${(() => {
                    // Get current customized chords (with key transposition)
                    const currentChords = getCustomizedChords();
                    // Get suggestions based on current displayed chords
                    const suggestions = getQuickSwapSuggestions(currentChords, selectedMood, selectedStyle);
                    // Also show undo cards for any active swaps not covered by suggestions
                    const result = [];

                    // First, show undo cards for active swaps
                    for (const [index, originalChord] of swappedChords.entries()) {
                        const currentChord = currentChords[index] || '';
                        if (currentChord !== originalChord) {
                            result.push(`
                                <div class="quick-swap-card flex items-center gap-2 p-2 rounded bg-white dark:bg-gray-800 border border-green-400">
                                    <span class="text-xs font-medium text-gray-800 dark:text-gray-200">${currentChord}→${originalChord}</span>
                                    <button class="quick-swap-play-btn p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 rounded" data-chord="${originalChord}" title="Play original chord">▶</button>
                                    <button class="quick-swap-back-btn p-1 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900 rounded" data-swap-index="${index}" title="Undo swap">↩</button>
                                </div>
                            `);
                        }
                    }

                    // Then show new suggestions (excluding already swapped indices)
                    for (const swap of suggestions) {
                        if (!swappedChords.has(swap.index)) {
                            result.push(`
                                <div class="quick-swap-card flex items-center gap-2 p-2 rounded bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-600">
                                    <span class="text-xs font-medium text-gray-800 dark:text-gray-200">${swap.from}→${swap.to}</span>
                                    <button class="quick-swap-play-btn p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 rounded" data-chord="${swap.to}" title="Play this chord">▶</button>
                                    <button class="quick-swap-apply-btn p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900 rounded" data-swap-from="${swap.from}" data-swap-to="${swap.to}" data-swap-index="${swap.index}" title="Apply swap">✓</button>
                                </div>
                            `);
                        }
                    }

                    return result.join('');
                })()}
            </div>
        </div>
    `;
}

/**
 * Generate quick swap suggestions based on the progression
 * Works with any key by using chord type-based substitutions
 */
function getQuickSwapSuggestions(chords, moodId, styleId) {
    const suggestions = [];

    // Type-based substitutions (work in any key)
    // Format: { type: chordType, subs: [{ suffix: newSuffix, reason: string }] }
    const typeSubstitutions = {
        'Minor': [
            { suffix: 'm7', reason: 'Jazzier, smoother' },
        ],
        'Major': [
            { suffix: 'maj7', reason: 'Softer, more sophisticated' },
            { suffix: '7', reason: 'More drive to resolve' },
        ],
        'Minor 7th': [
            { suffix: 'm', reason: 'Simpler, cleaner' },
        ],
        'Major 7th': [
            { suffix: '', reason: 'Simpler, cleaner' },
        ],
        'Dominant 7th': [
            { suffix: '', reason: 'Simpler, cleaner' },
        ]
    };

    chords.forEach((chord, idx) => {
        const { root, type } = parseChordName(chord);

        // Skip if chord already has a suggestion at this index
        if (suggestions.some(s => s.index === idx)) return;

        if (typeSubstitutions[type]) {
            const sub = typeSubstitutions[type][0];
            const newChord = root + sub.suffix;

            // Don't suggest the same chord
            if (newChord !== chord) {
                suggestions.push({
                    index: idx,
                    from: chord,
                    to: newChord,
                    reason: sub.reason
                });
            }
        }
    });

    // Add style-specific suggestions
    if (styleId === 'jazz' && !chords.some(c => c.includes('7'))) {
        suggestions.push({
            index: -1,
            from: 'All chords',
            to: 'Add 7ths',
            reason: 'Essential for jazz harmony'
        });
    }

    if (styleId === 'rock' && chords.some(c => c.includes('7') || c.includes('maj'))) {
        suggestions.push({
            index: -1,
            from: 'Complex chords',
            to: 'Power chords',
            reason: 'Raw rock energy'
        });
    }

    // Limit to 4 suggestions
    return suggestions.slice(0, 4);
}

function renderStep6Customize() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    const style = STYLE_OPTIONS.find(s => s.id === selectedStyle);
    if (!mood) return '<p class="text-center text-gray-500">Please select a mood first</p>';

    const selectedProg = getSelectedMoodProgression();
    const keys = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    const currentKey = customizations.key || selectedProg.key;

    // Check if progression already has 7ths
    const alreadyHas7ths = selectedProg.chords.some(c => c.includes('7') || c.includes('maj7'));

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
        if (selectedProg.chords.length > 2) {
            variations.push({
                id: 'rotated',
                title: 'Start on Different Chord',
                desc: `Begin on ${selectedProg.chords[1]} instead of ${selectedProg.chords[0]}`,
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
        <div class="text-center mb-3">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-1">Fine-tune Your Creation</h2>
        </div>

        <div class="grid md:grid-cols-2 gap-3 mb-3">
            <!-- Key Selection -->
            <div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                <div class="font-semibold text-gray-900 dark:text-white mb-2 text-sm flex items-center gap-1">
                    <span>🎹</span> Key
                </div>
                <div class="flex flex-wrap gap-1">
                    ${keys.map(key => `
                        <button class="key-option px-2 py-1 rounded text-xs font-semibold transition-all ${
                            key === currentKey
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                        }" data-key="${key}">
                            ${key}
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Variation Selection -->
            <div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                <div class="font-semibold text-gray-900 dark:text-white mb-2 text-sm flex items-center gap-1">
                    <span>✨</span> Variation
                </div>
                <div class="space-y-1">
                    ${variations.map(v => `
                        <button class="variation-option w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                            customizations.variation === v.id
                                ? 'bg-blue-100 dark:bg-blue-900/50 border border-blue-500 text-blue-900 dark:text-blue-100'
                                : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100'
                        }" data-variation="${v.id}">
                            <span class="font-semibold">${v.title}</span>
                            <span class="text-gray-500 dark:text-gray-400 ml-1">${v.desc}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- Preview current customization -->
        <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
            <div class="flex items-center justify-between">
                <div>
                    <div class="text-sm font-medium text-gray-900 dark:text-white">Progression:</div>
                    <div class="text-xs text-gray-500" id="customize-progression-display">${getCustomizedChords().join(' → ')}</div>
                </div>
                <button id="preview-custom-btn" class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm flex items-center gap-1">
                    <span class="play-btn-icon">▶</span> Preview
                </button>
            </div>
        </div>
    `;
}

function renderStep7MelodyBass() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    const style = STYLE_OPTIONS.find(s => s.id === selectedStyle);
    const currentPattern = customizations.bassPattern || 'root-fifth';
    const chords = getCustomizedChords();
    const key = customizations.key || mood?.progression.key || 'C';

    // Generate melody tips based on mood/style
    const getMelodyTips = () => {
        const moodTips = {
            'happy': ['Ascending phrases = energy', 'Emphasize 3rds & 5ths', 'Syncopation adds bounce'],
            'sad': ['Descending lines = emotion', 'Linger on minor 3rds', 'Leave space between phrases'],
            'energetic': ['Repeated rhythms = drive', 'Strong downbeats', 'Leap between chord tones'],
            'dreamy': ['Stepwise = smooth', 'Let notes sustain', 'Avoid strong accents'],
            'romantic': ['Gentle flowing phrases', 'Passing tones add warmth', 'Build to climaxes'],
            'chill': ['Keep it sparse', 'Longer note values', 'Explore upper register'],
            'mysterious': ['Chromatic passing tones', 'Unexpected rhythms', 'Minor 2nds = tension'],
            'triumphant': ['End phrases high', 'Dotted rhythms = power', 'Bold leaps'],
            'nostalgic': ['Echo earlier phrases', 'Familiar melodic shapes', 'Gentle ornaments'],
            'playful': ['Short bouncy phrases', 'Unexpected rests', 'Vary your motifs']
        };
        return moodTips[selectedMood] || ['Start on chord tones', 'Use stepwise motion', 'End on stable notes'];
    };

    // Voice leading & technique tips
    const getVoiceLeadingTips = () => {
        return [
            { label: 'Chord Tones', tip: 'Root, 3rd, 5th are safest on strong beats' },
            { label: 'Passing Tones', tip: 'Connect chord tones on weak beats' },
            { label: 'Voice Leading', tip: 'Move by step when chords change' },
            { label: 'Repetition', tip: 'Repeat motifs with small variations' }
        ];
    };

    // Rhythm suggestions based on style
    const getRhythmTips = () => {
        const styleTips = {
            'pop': { pattern: '♩ ♩ ♩ ♩', desc: 'Steady quarters with syncopated accents' },
            'rock': { pattern: '♩ ♪♪ ♩ ♪♪', desc: 'Driving eighth notes, accent 2 & 4' },
            'jazz': { pattern: '♪.♪ ♪.♪', desc: 'Swing feel, behind the beat' },
            'folk': { pattern: '♩ ♩ ♩ ♩', desc: 'Simple and singable' },
            'electronic': { pattern: '♪♪♪♪ ♪♪♪♪', desc: 'Consistent 8ths or 16ths' },
            'rnb': { pattern: '♩. ♪ ♩ ♪♪', desc: 'Syncopated, laid-back groove' },
            'classical': { pattern: '♩ ♪♪ ♩ ♪♪', desc: 'Balanced phrases, clear structure' },
            'blues': { pattern: '♪.♪ ♪.♪', desc: 'Shuffle feel, expressive bends' }
        };
        return styleTips[style?.id] || { pattern: '♩ ♩ ♩ ♩', desc: 'Quarter notes for stability' };
    };

    // Get starter motifs
    const getStarterMotifs = () => {
        if (!chords.length) return [];
        const { root } = parseChordName(chords[0]);
        return [
            { name: 'Rise', notes: `${root}→2→3→2` },
            { name: 'Arpeggio', notes: `${root}→3→5→3` },
            { name: 'Question', notes: `${root}→5 / 3→${root}` }
        ];
    };

    // Get suggested bass patterns based on style
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

    const melodyTips = getMelodyTips();
    const voiceLeadingTips = getVoiceLeadingTips();
    const rhythmTip = getRhythmTips();
    const starterMotifs = getStarterMotifs();
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
        <div class="text-center mb-2">
            <h2 class="text-lg font-bold text-gray-900 dark:text-white">Melody & Bass Guidance</h2>
        </div>

        <!-- Two-column layout for compact view -->
        <div class="grid md:grid-cols-2 gap-2">
            <!-- Melody Section -->
            <div class="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-2 border border-purple-200 dark:border-purple-700/50">
                <div class="flex items-center gap-1 mb-1">
                    <span class="text-sm">🎵</span>
                    <span class="font-bold text-xs text-purple-900 dark:text-purple-100">Melody for ${mood?.title || 'Your Song'}</span>
                </div>

                <!-- Mood-specific tips -->
                <div class="space-y-0.5 mb-2">
                    ${melodyTips.map(tip => `
                        <div class="text-[10px] text-purple-800 dark:text-purple-200 leading-tight">
                            <span class="text-purple-500">•</span> ${tip}
                        </div>
                    `).join('')}
                </div>

                <!-- Voice Leading Quick Reference -->
                <div class="bg-white/50 dark:bg-gray-800/50 rounded p-1.5 mb-2">
                    <div class="text-[10px] font-semibold text-purple-900 dark:text-purple-100 mb-1">📝 Quick Reference</div>
                    <div class="grid grid-cols-2 gap-x-2 gap-y-0.5">
                        ${voiceLeadingTips.map(item => `
                            <div class="text-[9px] text-purple-700 dark:text-purple-300">
                                <strong>${item.label}:</strong> ${item.tip}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Rhythm suggestion -->
                <div class="bg-white/50 dark:bg-gray-800/50 rounded p-1.5 mb-2">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-semibold text-purple-900 dark:text-purple-100">🥁 Rhythm:</span>
                        <span class="font-mono text-xs text-purple-700 dark:text-purple-300">${rhythmTip.pattern}</span>
                    </div>
                    <div class="text-[9px] text-purple-600 dark:text-purple-400">${rhythmTip.desc}</div>
                </div>

                <!-- Starter Motifs -->
                <div class="flex flex-wrap gap-1 mb-1">
                    ${starterMotifs.map(m => `
                        <span class="bg-white dark:bg-gray-800 rounded px-1.5 py-0.5 text-[10px] border border-purple-300 dark:border-purple-600">
                            <strong class="text-purple-900 dark:text-white">${m.name}:</strong>
                            <span class="text-purple-600 dark:text-purple-400">${m.notes}</span>
                        </span>
                    `).join('')}
                </div>

                <div class="text-[9px] text-purple-600 dark:text-purple-400">
                    <kbd class="px-1 py-0.5 bg-purple-200 dark:bg-purple-700 rounded">Tab</kbd> in Composer = AI suggestions
                </div>
            </div>

            <!-- Bass Section -->
            <div class="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
                <div class="flex items-center gap-1 mb-1">
                    <span class="text-sm">🎸</span>
                    <span class="font-bold text-xs text-gray-900 dark:text-white">Bass Pattern</span>
                    <span class="text-[9px] text-gray-500 dark:text-gray-400 ml-auto">${findPattern(currentPattern)?.name || 'Root-Fifth'}</span>
                </div>

                ${style ? `
                <div class="mb-1.5">
                    <div class="text-[9px] text-green-700 dark:text-green-300 mb-0.5">★ Recommended for ${style.title}:</div>
                    <div class="flex flex-wrap gap-0.5">
                        ${suggestedPatterns.map(patternId => {
                            const pattern = findPattern(patternId);
                            if (!pattern) return '';
                            return `
                                <button class="bass-pattern-option px-1.5 py-0.5 rounded text-[9px] transition-all ${
                                    currentPattern === patternId
                                        ? 'bg-green-600 text-white'
                                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/50'
                                }" data-pattern="${patternId}">
                                    ${pattern.name}${currentPattern === patternId ? ' ✓' : ''}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- All Bass Pattern Categories -->
                <div class="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                    ${Object.entries(BASS_PATTERN_CATEGORIES).map(([catId, category]) => `
                        <div>
                            <div class="text-[9px] font-semibold text-gray-600 dark:text-gray-400 mb-0.5">${category.title}</div>
                            <div class="flex flex-wrap gap-0.5">
                                ${category.patterns.map(pattern => `
                                    <button class="bass-pattern-option px-1 py-0.5 rounded text-[9px] transition-all ${
                                        currentPattern === pattern.id
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                    }" data-pattern="${pattern.id}" title="${pattern.desc}">
                                        ${pattern.name}${currentPattern === pattern.id ? ' ✓' : ''}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Bass Tips (collapsed) -->
                <details class="mt-1.5">
                    <summary class="text-[9px] text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">📝 Bass Tips</summary>
                    <div class="mt-1 space-y-0.5 text-[9px] text-gray-600 dark:text-gray-300 pl-2">
                        <div>• <strong>Root</strong> on beat 1 anchors the chord</div>
                        <div>• <strong>5th</strong> on beat 3 adds movement</div>
                        <div>• <strong>Walking</strong> = stepwise between roots</div>
                        <div>• <strong>Approach</strong> = half-step into next root</div>
                    </div>
                </details>
            </div>
        </div>
    `;
}

function renderStep8Launch() {
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    const style = STYLE_OPTIONS.find(s => s.id === selectedStyle);
    const structure = STRUCTURE_OPTIONS.find(s => s.id === selectedStructure);

    if (!mood) return '<p class="text-center text-gray-500">Please select a mood first</p>';

    const selectedProg = getSelectedMoodProgression();
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
                    <div class="font-bold text-gray-900 dark:text-white">${customizations.key || selectedProg.key}</div>
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

        <!-- AI Features Configuration -->
        <div class="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 mb-4 border border-purple-200 dark:border-purple-700/50">
            <div class="flex items-center gap-2 mb-3">
                <span>🤖</span>
                <span class="font-medium text-purple-800 dark:text-purple-200">AI-Assisted Composition</span>
            </div>
            <div class="space-y-3">
                <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" id="ai-melody-toggle" class="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500" ${customizations.enableAIMelody !== false ? 'checked' : ''}>
                    <div>
                        <div class="font-medium text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">Enable AI melody suggestions</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">Get smart note suggestions while composing</div>
                    </div>
                </label>
                <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" id="chord-tone-toggle" class="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500" ${customizations.showChordTones !== false ? 'checked' : ''}>
                    <div>
                        <div class="font-medium text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">Show chord tone highlighting</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">Highlight which notes fit the current chord</div>
                    </div>
                </label>
                <label class="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" id="beginner-tips-toggle" class="w-5 h-5 rounded border-purple-300 text-purple-600 focus:ring-purple-500" ${customizations.showBeginnerTips ? 'checked' : ''}>
                    <div>
                        <div class="font-medium text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">Show beginner tutorials</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">Step-by-step guidance for new composers</div>
                    </div>
                </label>
            </div>
        </div>

        <!-- What happens next -->
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-4 border border-blue-200 dark:border-blue-700/50">
            <div class="text-sm text-blue-800 dark:text-blue-200">
                <strong>What happens when you click:</strong>
                <ol class="mt-2 space-y-1 list-decimal list-inside text-blue-700 dark:text-blue-300">
                    <li>Your ${chords.length}-chord progression is expanded to ${expandedInfo.totalMeasures} measures</li>
                    ${expandedInfo.sections.length > 0 ? `<li>${expandedInfo.sections.length} labeled sections are created automatically</li>` : ''}
                    <li>Key set to <strong>${customizations.key || selectedProg.key}</strong>, tempo to <strong>${customizations.tempo} BPM</strong></li>
                    <li>Ready to add melody! Press <kbd class="px-1.5 py-0.5 bg-blue-200 dark:bg-blue-700 rounded text-xs">Tab</kbd> for AI suggestions</li>
                </ol>
            </div>
        </div>

        ${creationMode === 'full' && expandedInfo.sections.length > 1 ? `
        <!-- Song Builder Option for Full Composition Mode -->
        <div class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 mb-4 border border-indigo-200 dark:border-indigo-700/50">
            <div class="flex items-center gap-3 mb-2">
                <span class="text-2xl">🏗️</span>
                <div>
                    <span class="font-medium text-indigo-800 dark:text-indigo-200">Multi-Section Song Builder</span>
                    <span class="ml-2 px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs rounded">Recommended</span>
                </div>
            </div>
            <p class="text-sm text-indigo-600 dark:text-indigo-300 mb-3">
                Visual timeline for managing your ${expandedInfo.sections.length} sections. Add, copy, reorder sections and get transition suggestions.
            </p>
            <button id="open-song-builder-btn" class="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/>
                </svg>
                Open Song Builder
            </button>
        </div>
        ` : ''}

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

    // Use working progression (which includes any applied swaps)
    const progression = getCurrentProgression();
    let chords = [...progression.chords];

    // Apply variations first
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

    // Transpose to user's selected key if different from mood's original key
    const originalKey = progression.key;
    const targetKey = customizations.key;

    if (targetKey && targetKey !== originalKey) {
        const semitones = getSemitonesBetweenKeys(originalKey, targetKey);
        if (semitones !== 0) {
            chords = chords.map(chord => transposeChord(chord, semitones));
        }
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
        case 0: stepContent = renderStep0Welcome(); break;
        case 1: stepContent = renderStep1Mood(); break;
        case 2: stepContent = renderStep2Style(); break;
        case 3: stepContent = renderStep3Structure(); break;
        case 4: stepContent = renderStep4Tempo(); break;
        case 5: stepContent = renderStep5Preview(); break;
        case 6: stepContent = renderStep6Customize(); break;
        case 7: stepContent = renderStep7MelodyBass(); break;
        case 8: stepContent = renderStep8Launch(); break;
    }

    // Determine if user can proceed to next step
    let canProceed = true;
    if (currentStep === 0) canProceed = !!creationMode;
    else if (currentStep === 1) canProceed = !!selectedMood;

    const html = `
        <div class="songwriting-wizard bg-white dark:bg-gray-900 max-w-4xl mx-auto p-3 md:p-4 rounded-xl">
            <!-- Header with title and nav buttons on same row -->
            <div class="flex items-center justify-between mb-3">
                ${currentStep > 0 ? `
                    <button id="wizard-back-btn" class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-1 text-sm">
                        <span>←</span> Back
                    </button>
                ` : '<div class="w-20"></div>'}

                <div class="text-center flex-1">
                    <h1 class="text-lg md:text-xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
                        <span class="text-xl md:text-2xl">✨</span> Songwriting Wizard
                    </h1>
                    <p class="text-gray-500 dark:text-gray-400 text-xs">Step ${currentStep + 1} of ${WIZARD_STEPS.length}</p>
                </div>

                ${currentStep < WIZARD_STEPS.length - 1 ? `
                    <button id="wizard-next-btn" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1 shadow-md text-sm ${!canProceed ? 'opacity-50 cursor-not-allowed' : ''}">
                        Next <span>→</span>
                    </button>
                ` : '<div class="w-20"></div>'}
            </div>

            ${renderStepIndicator()}

            <div id="wizard-step-content" class="wizard-step-content">
                ${stepContent}
            </div>
        </div>
    `;

    container.innerHTML = html;
    attachWizardListeners(container);
}

function attachWizardListeners(container) {
    // Creation mode selection (Welcome step)
    container.querySelectorAll('.creation-mode-option').forEach(btn => {
        btn.addEventListener('click', () => {
            creationMode = btn.dataset.mode;

            // Auto-configure based on mode
            if (creationMode === 'quick') {
                selectedStructure = 'simple';
            } else if (creationMode === 'full') {
                selectedStructure = 'verse-chorus';
            } else if (creationMode === 'explore') {
                selectedStructure = 'simple';
            }

            renderSongwritingWizard(container);
        });
    });

    // Mood selection
    container.querySelectorAll('.mood-option').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedMood = btn.dataset.mood;
            // Reset working progression, swaps, and progression index when mood changes
            workingProgression = null;
            swappedChords = new Map();
            selectedProgressionIndex = 0; // Reset to first progression option
            const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
            if (mood) {
                customizations.tempo = mood.suggestedTempo;
            }
            renderSongwritingWizard(container);
        });
    });

    // Progression option selection (clicking to select)
    container.querySelectorAll('.progression-option').forEach(option => {
        option.addEventListener('click', (e) => {
            // Don't select if clicking the play button
            if (e.target.closest('.progression-play-btn')) return;

            const idx = parseInt(option.dataset.progressionIndex, 10);
            if (!isNaN(idx)) {
                selectedProgressionIndex = idx;
                // Reset working progression when selecting a different progression
                workingProgression = null;
                swappedChords = new Map();
                renderSongwritingWizard(container);
            }
        });
    });

    // Progression play buttons
    container.querySelectorAll('.progression-play-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Don't trigger the parent selection
            const idx = parseInt(btn.dataset.progressionIndex, 10);
            const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
            if (!mood || !mood.progressions || isNaN(idx)) return;

            const prog = mood.progressions[idx];
            if (!prog) return;

            try {
                const piano = getPiano();
                if (!piano) return;

                // Visual feedback
                btn.textContent = '■';
                btn.classList.add('bg-red-500');
                btn.classList.remove('bg-green-500');

                // Play all chords in the progression
                const key = prog.key || 'C';
                const duration = 0.5; // seconds per chord
                for (let i = 0; i < prog.chords.length; i++) {
                    const { root, type } = parseChordName(prog.chords[i]);
                    const chordInfo = getChordNotes(root, type, key, 3);
                    const notes = chordInfo?.specificNotes || chordInfo?.baseNotes || [];
                    if (notes.length > 0) {
                        piano.triggerAttackRelease(notes, duration * 0.9, `+${i * duration}`);
                    }
                }

                // Reset button after playback
                setTimeout(() => {
                    btn.textContent = '▶';
                    btn.classList.remove('bg-red-500');
                    btn.classList.add('bg-green-500');
                }, prog.chords.length * duration * 1000 + 200);

            } catch (e) {
                console.warn('[Wizard] Progression play failed:', e);
                btn.textContent = '▶';
                btn.classList.remove('bg-red-500');
                btn.classList.add('bg-green-500');
            }
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

    // Chord chip click-and-hold to play
    container.querySelectorAll('.wizard-chord-chip').forEach(chip => {
        let isHolding = false;
        let holdInterval = null;

        const startPlaying = async () => {
            const chord = chip.dataset.chord;
            if (!chord) return;

            try {
                const piano = getPiano();
                if (!piano) return;

                const { root, type } = parseChordName(chord);
                const key = customizations.key || getCurrentProgression().key || 'C';
                const notesResult = getChordNotes(root, type, key, 3);
                const notes = notesResult?.specificNotes || notesResult?.baseNotes || [];

                if (notes.length > 0) {
                    isHolding = true;
                    chip.classList.add('ring-2', 'ring-blue-500', 'scale-95');

                    // Play the chord
                    piano.triggerAttack(notes);

                    // Store notes for release
                    chip._playingNotes = notes;
                }
            } catch (e) {
                console.warn('Failed to play chord chip:', e);
            }
        };

        const stopPlaying = () => {
            if (isHolding) {
                isHolding = false;
                chip.classList.remove('ring-2', 'ring-blue-500', 'scale-95');

                try {
                    const piano = getPiano();
                    if (piano && chip._playingNotes) {
                        piano.triggerRelease(chip._playingNotes);
                        chip._playingNotes = null;
                    }
                } catch (e) {
                    // Silent fail
                }
            }
        };

        chip.addEventListener('mousedown', startPlaying);
        chip.addEventListener('mouseup', stopPlaying);
        chip.addEventListener('mouseleave', stopPlaying);
        chip.addEventListener('touchstart', (e) => { e.preventDefault(); startPlaying(); });
        chip.addEventListener('touchend', stopPlaying);
        chip.addEventListener('touchcancel', stopPlaying);
    });

    // Quick swap - Play button
    container.querySelectorAll('.quick-swap-play-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const chord = btn.dataset.chord;
            try {
                const piano = getPiano();
                if (!piano || !chord) return;
                const { root, type } = parseChordName(chord);
                const key = customizations.key || getCurrentProgression().key || 'C';
                const notesResult = getChordNotes(root, type, key, 3); // octave 3 to match progression
                const notes = notesResult?.specificNotes || notesResult?.baseNotes || [];
                if (notes.length > 0) {
                    piano.triggerAttackRelease(notes, '2n');
                }
            } catch (e) {
                console.warn('Failed to play chord:', e);
            }
        });
    });

    // Quick swap - Apply button
    container.querySelectorAll('.quick-swap-apply-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const swapTo = btn.dataset.swapTo;
            const swapIndex = parseInt(btn.dataset.swapIndex);

            if (swapIndex >= 0 && swapTo) {
                // The swap suggestion is based on DISPLAYED (transposed) chords
                // We need to UNTRANSPOSE the new chord back to the base key
                const progression = getCurrentProgression();
                const originalKey = progression.key;
                const targetKey = customizations.key;

                let chordToStore = swapTo;
                if (targetKey && targetKey !== originalKey) {
                    // Untranspose: from displayed key back to original key
                    const semitones = getSemitonesBetweenKeys(targetKey, originalKey);
                    if (semitones !== 0) {
                        chordToStore = transposeChord(swapTo, semitones);
                    }
                }

                // Apply the swap with the untransposed chord
                applyChordSwap(swapIndex, chordToStore);

                // Play the new chord as feedback (use displayed key for audio)
                try {
                    const piano = getPiano();
                    if (piano) {
                        const { root, type } = parseChordName(swapTo);
                        const key = customizations.key || originalKey || 'C';
                        const notesResult = getChordNotes(root, type, key, 3); // octave 3 to match progression
                        const notes = notesResult?.specificNotes || notesResult?.baseNotes || [];
                        if (notes.length > 0) {
                            piano.triggerAttackRelease(notes, '4n');
                        }
                    }
                } catch (e) {
                    // Silent fail
                }

                // Re-render to update UI
                renderSongwritingWizard(container);
            }
        });
    });

    // Quick swap - Undo/Revert button
    container.querySelectorAll('.quick-swap-back-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const swapIndex = parseInt(btn.dataset.swapIndex);

            if (!isNaN(swapIndex)) {
                // Revert the swap
                revertChordSwap(swapIndex);

                // Re-render to update UI
                renderSongwritingWizard(container);
            }
        });
    });

    // Tempo slider
    const tempoSlider = container.querySelector('#tempo-slider');
    const tempoDisplay = container.querySelector('#tempo-display');
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
        const pulse = container.querySelector('#tap-pulse');
        if (pulse) {
            pulse.style.transition = 'none';
            pulse.style.opacity = '0.3';
            setTimeout(() => {
                pulse.style.transition = 'opacity 0.3s ease-out';
                pulse.style.opacity = '0';
            }, 50);
        }

        // Update tap dots
        const tapDots = container.querySelectorAll('.tap-dot');
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
        const tapMessage = container.querySelector('#tap-message');
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
                const tempoLabel = container.querySelector('#tempo-label');
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
                    tapMessage.classList.add('text-green-600', 'dark:text-green-400', 'font-medium');
                    tapMessage.classList.remove('text-gray-500');
                }
            }
        }

        // Reset after inactivity
        clearTimeout(tapResetTimeout);
        tapResetTimeout = setTimeout(() => {
            tapTimes = [];
            const tapDots = container.querySelectorAll('.tap-dot');
            tapDots.forEach(dot => {
                dot.classList.remove('bg-blue-500');
                dot.classList.add('bg-gray-300', 'dark:bg-gray-600');
            });
            if (tapMessage) {
                tapMessage.textContent = '';
                tapMessage.classList.remove('text-green-600', 'dark:text-green-400', 'font-medium');
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
        const selectedProg = getSelectedMoodProgression();
        if (selectedProg && selectedProg.chords) {
            await playProgression(selectedProg.chords, 0.7);
        }
    });

    // Play progression
    container.querySelector('#play-progression-btn')?.addEventListener('click', async () => {
        if (selectedMood) {
            const duration = 60 / customizations.tempo;
            await playProgression(getCustomizedChords(), duration);
        }
    });

    // Play looped
    container.querySelector('#play-loop-btn')?.addEventListener('click', async () => {
        if (selectedMood) {
            const duration = 60 / customizations.tempo;
            await playProgression(getCustomizedChords(), duration, true);
        }
    });

    // Key selection
    container.querySelectorAll('.key-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const newKey = btn.dataset.key;
            customizations.key = newKey;
            // NOTE: Do NOT update workingProgression.key - it should stay as the original key
            // getCustomizedChords() transposes from originalKey to customizations.key
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
        loadToComposition('melody');
    });

    // Load to melody
    container.querySelector('#load-to-melody-btn')?.addEventListener('click', () => {
        loadToComposition('melody');
    });

    // Open Song Builder (for Full Composition mode)
    container.querySelector('#open-song-builder-btn')?.addEventListener('click', () => {
        loadToComposition('melody');
        // After loading, show the Song Builder modal - need longer delay for sections to be created
        // Pass true to force showing builder even if state sync is delayed
        setTimeout(() => {
            showSongBuilderModal(true);
        }, 500);
    });

    // AI feature toggles
    container.querySelector('#ai-melody-toggle')?.addEventListener('change', (e) => {
        customizations.enableAIMelody = e.target.checked;
    });

    container.querySelector('#chord-tone-toggle')?.addEventListener('change', (e) => {
        customizations.showChordTones = e.target.checked;
    });

    container.querySelector('#beginner-tips-toggle')?.addEventListener('change', (e) => {
        customizations.showBeginnerTips = e.target.checked;
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
        if (currentStep === 0 && !creationMode) return;
        stopPlayback();
        if (currentStep < WIZARD_STEPS.length - 1) {
            currentStep++;
            renderSongwritingWizard(container);
        }
    });

    // Keyboard shortcuts
    const handleKeydown = (e) => {
        // Only handle spacebar on tempo step (step 4)
        if (e.code === 'Space' && currentStep === 4 && document.activeElement?.id !== 'tempo-slider') {
            e.preventDefault();
            handleTap();
        }
    };
    document.addEventListener('keydown', handleKeydown);

    // Clean up listener on re-render
    container._cleanupKeydown = () => document.removeEventListener('keydown', handleKeydown);
}

/**
 * Generate a section-appropriate variation of the user's progression
 * This creates harmonic coherence - the whole song sounds unified
 * @param {string} sectionType - Type of section (verse, chorus, bridge, etc.)
 * @param {Array} baseChords - User's selected progression (chord names)
 * @param {number} measuresNeeded - Number of measures to fill
 * @param {Array} romanNumerals - Roman numerals for the progression
 * @returns {Array} Array of chord objects for the section
 */
function generateCoherentSectionChords(sectionType, baseChords, measuresNeeded, romanNumerals) {
    const chords = [];

    // Different sections use the user's progression in different ways
    switch (sectionType) {
        case 'verse':
        case 'loop':
        case 'A':
            // Verse: Use progression as-is, looped
            for (let i = 0; i < measuresNeeded; i++) {
                const idx = i % baseChords.length;
                const { root, type } = parseChordName(baseChords[idx]);
                chords.push({ root, type, roman: romanNumerals[idx] || '', duration: 1 });
            }
            break;

        case 'chorus':
            // Chorus: Same progression but can start on a different chord (rotation)
            // Often choruses start on the IV or on the same chord for anthem effect
            const chorusRotation = 0; // Start on same chord for anthemic feel
            for (let i = 0; i < measuresNeeded; i++) {
                const idx = (i + chorusRotation) % baseChords.length;
                const { root, type } = parseChordName(baseChords[idx]);
                chords.push({ root, type, roman: romanNumerals[idx] || '', duration: 1 });
            }
            break;

        case 'prechorus':
            // Pre-chorus: Use last 2 chords to build tension, or ii-V pattern
            const tensionChords = baseChords.length >= 2
                ? baseChords.slice(-2)
                : baseChords;
            for (let i = 0; i < measuresNeeded; i++) {
                const idx = i % tensionChords.length;
                const { root, type } = parseChordName(tensionChords[idx]);
                const romanIdx = baseChords.length - tensionChords.length + idx;
                chords.push({ root, type, roman: romanNumerals[romanIdx] || '', duration: 1 });
            }
            break;

        case 'bridge':
        case 'B':
            // Bridge: Start on a different chord for contrast (often vi or IV)
            // Rotate progression to start on chord index 2 or 3 (typically vi or IV)
            const bridgeStart = Math.min(2, baseChords.length - 1);
            for (let i = 0; i < measuresNeeded; i++) {
                const idx = (i + bridgeStart) % baseChords.length;
                const { root, type } = parseChordName(baseChords[idx]);
                chords.push({ root, type, roman: romanNumerals[idx] || '', duration: 1 });
            }
            break;

        case 'intro':
            // Intro: Use first 1-2 chords, simpler
            const introChords = baseChords.slice(0, Math.min(2, baseChords.length));
            for (let i = 0; i < measuresNeeded; i++) {
                const idx = i % introChords.length;
                const { root, type } = parseChordName(introChords[idx]);
                chords.push({ root, type, roman: romanNumerals[idx] || '', duration: 1 });
            }
            break;

        case 'outro':
            // Outro: Use last 2 chords or full progression for resolution
            const outroChords = baseChords.length >= 2
                ? [baseChords[baseChords.length - 2], baseChords[0]] // IV-I or V-I cadence feel
                : baseChords;
            for (let i = 0; i < measuresNeeded; i++) {
                const idx = i % outroChords.length;
                const { root, type } = parseChordName(outroChords[idx]);
                chords.push({ root, type, roman: '', duration: 1 });
            }
            break;

        default:
            // Fallback: loop the progression
            for (let i = 0; i < measuresNeeded; i++) {
                const idx = i % baseChords.length;
                const { root, type } = parseChordName(baseChords[idx]);
                chords.push({ root, type, roman: romanNumerals[idx] || '', duration: 1 });
            }
    }

    return chords;
}

function loadToComposition(targetTab) {
    const baseChords = getCustomizedChords();
    const mood = MOOD_OPTIONS.find(m => m.id === selectedMood);
    const style = STYLE_OPTIONS.find(s => s.id === selectedStyle);
    const structure = STRUCTURE_OPTIONS.find(s => s.id === selectedStructure);
    const selectedProg = getSelectedMoodProgression();
    const key = customizations.key || selectedProg.key || 'C';
    const romanNumerals = selectedProg.roman || [];

    console.log('[SongwritingWizard] loadToComposition called');
    console.log('  baseChords:', baseChords);
    console.log('  key:', key);
    console.log('  selectedProgression:', selectedProg.name);

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
    // KEY CHANGE: Now uses the user's progression coherently throughout!
    let expandedProgression = [];
    let sectionDefinitions = [];
    let currentChordIndex = 0;

    if (structure && structure.sections) {
        for (const sectionDef of structure.sections) {
            const repeatCount = sectionDef.repeat || 1;

            for (let r = 0; r < repeatCount; r++) {
                const sectionStartIndex = currentChordIndex;
                const measuresNeeded = sectionDef.measures;

                let chordsForSection = [];

                if (sectionDef.type === 'blues') {
                    // 12-bar blues has a specific pattern (keeps traditional blues feel)
                    const bluesPattern = generateBluesProgression(baseChords[0]);
                    chordsForSection = bluesPattern;
                } else {
                    // USE USER'S PROGRESSION COHERENTLY
                    chordsForSection = generateCoherentSectionChords(
                        sectionDef.type,
                        baseChords,
                        measuresNeeded,
                        romanNumerals
                    );
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
        // Fallback: simple 4-chord progression from user's selection
        expandedProgression = baseChords.map((chord, idx) => {
            const { root, type } = parseChordName(chord);
            return {
                root,
                type,
                roman: romanNumerals[idx % romanNumerals.length] || '',
                duration: 1
            };
        });
    }

    console.log('[SongwritingWizard] expandedProgression:', expandedProgression);

    // Set key and progression
    setCurrentKey(key);
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
        console.log('[SongwritingWizard] Set bass pattern to:', effectiveBassPattern);
    }

    // Enable auto-generate bass so the pattern is applied
    if (typeof window.getCompositionState === 'function') {
        const compositionState = window.getCompositionState();
        if (compositionState && typeof compositionState.updateSettings === 'function') {
            compositionState.updateSettings({ autoGenerateBass: true });
            console.log('[SongwritingWizard] Enabled auto-generate bass');
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
                        console.log('[SongwritingWizard] Created section:', secDef.type, 'with chords:', chordIndices);
                    }

                    // Refresh UI to show sections on chord cards
                    setTimeout(() => {
                        if (typeof window.renderProgressionDisplay === 'function') {
                            window.renderProgressionDisplay('progression-visualization', true);
                            window.renderProgressionDisplay('melody-progression-visualization', false);
                            console.log('[SongwritingWizard] Refreshed progression display to show sections');
                        }
                    }, 50);
                }
            } catch (err) {
                console.error('[SongwritingWizard] Error creating sections:', err);
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
    creationMode = null;
    selectedMood = null;
    selectedStyle = null;
    selectedStructure = 'simple';
    swappedChords = new Map();
    workingProgression = null;
    customizations = {
        key: null,
        tempo: 100,
        feel: 'straight',
        variation: 'standard',
        timeSignature: '4/4',
        bassPattern: 'root-fifth',
        enableAIMelody: true,
        showChordTones: true,
        showBeginnerTips: false
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
    const modal = document.createElement('div');
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

    const content = modal.querySelector('#wizard-modal-content');
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

/**
 * Show the Song Builder in a modal overlay
 * Used after loading composition from wizard in "Full Composition" mode
 * @param {boolean} forceShowBuilder - If true, always show builder even if no content detected
 */
export function showSongBuilderModal(forceShowBuilder = false) {
    // Remove existing modal if present
    const existingModal = document.getElementById('song-builder-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'song-builder-modal';
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]';

    // Safely get composition state
    let compositionState;
    try {
        compositionState = getCompositionState();
    } catch (e) {
        console.warn('[showSongBuilderModal] Could not get composition state:', e);
    }

    // Also try window.getCompositionState as fallback
    if (!compositionState && typeof window.getCompositionState === 'function') {
        compositionState = window.getCompositionState();
    }

    const sections = compositionState?.getSections?.() || [];
    const progression = compositionState?.getProgression?.() || [];
    // When called from wizard, we force showing the builder
    const hasContent = forceShowBuilder || sections.length > 0 || progression.length > 0;

    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4 relative">
            <div class="sticky top-0 bg-white dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-20">
                <div class="flex items-center gap-2">
                    <span class="text-xl">🏗️</span>
                    <span class="font-bold text-gray-900 dark:text-white">Song Structure Builder</span>
                </div>
                <button class="close-modal-btn p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-300 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div id="song-builder-modal-content" class="p-4">
                ${!hasContent ? renderEmptyBuilderState() : ''}
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const content = modal.querySelector('#song-builder-modal-content');

    // Render the builder if we have content or forced
    if (hasContent) {
        try {
            createSongBuilder(content, {
                showHeader: false,
                onStructureChange: () => {
                    try {
                        createSongBuilder(content, { showHeader: false });
                    } catch (e) {
                        console.error('[showSongBuilderModal] Error refreshing builder:', e);
                    }
                }
            });
        } catch (e) {
            console.error('[showSongBuilderModal] Error creating builder:', e);
            // Show fallback message if builder fails
            content.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">⚠️</div>
                    <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Loading Song Structure...</h3>
                    <p class="text-gray-600 dark:text-gray-400 mb-4">
                        The composition is still being set up. Please wait a moment or try again.
                    </p>
                    <button id="retry-builder-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                        Retry
                    </button>
                </div>
            `;
            content.querySelector('#retry-builder-btn')?.addEventListener('click', () => {
                try {
                    createSongBuilder(content, { showHeader: false });
                } catch (retryError) {
                    console.error('[showSongBuilderModal] Retry failed:', retryError);
                }
            });
        }
    } else {
        // Wire up empty state buttons
        content.querySelector('#start-wizard-from-builder')?.addEventListener('click', () => {
            modal.remove();
            openWizardInModal();
        });

        content.querySelector('#start-with-template')?.addEventListener('click', () => {
            showTemplateSelector(content, modal);
        });
    }

    // Close button handler - use optional chaining to be safe
    const closeBtn = modal.querySelector('.close-modal-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });
    }

    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Escape key to close
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

/**
 * Render empty state for Song Builder when no composition exists
 */
function renderEmptyBuilderState() {
    return `
        <div class="text-center py-8">
            <div class="text-6xl mb-4">🎼</div>
            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Start Creating Your Song</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                The Song Builder organizes your chords into sections like Verse, Chorus, and Bridge.
                <span class="font-medium text-gray-700 dark:text-gray-300">First, you need some chords to work with:</span>
            </p>

            <div class="grid md:grid-cols-2 gap-4 max-w-lg mx-auto">
                <button id="start-wizard-from-builder" class="p-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl shadow-lg transition-all hover:scale-105 ring-2 ring-purple-300 ring-offset-2">
                    <div class="text-xs uppercase tracking-wide text-purple-200 mb-1">Recommended</div>
                    <div class="text-2xl mb-2">🎵</div>
                    <div class="font-bold">Songwriting Wizard</div>
                    <div class="text-sm text-purple-100">Guided step-by-step creation</div>
                </button>

                <button id="start-with-template" class="p-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl shadow-lg transition-all hover:scale-105">
                    <div class="text-xs uppercase tracking-wide text-gray-300 mb-1">Quick Start</div>
                    <div class="text-2xl mb-2">📋</div>
                    <div class="font-bold">Use a Template</div>
                    <div class="text-sm text-gray-300">Pick a structure, add chords later</div>
                </button>
            </div>

            <div class="mt-6 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg max-w-md mx-auto">
                <p class="text-sm text-gray-600 dark:text-gray-400">
                    <span class="font-medium">Already have chords?</span> Create them in <span class="font-medium">Chord Lab</span> first, then come back here to organize them into song sections.
                </p>
            </div>
        </div>
    `;
}

/**
 * Show template selector within the modal
 */
function showTemplateSelector(content, modal) {
    const templates = [
        { id: 'verse-chorus', name: 'Verse-Chorus', icon: '🎤', desc: 'Pop/Rock standard', sections: ['Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Outro'] },
        { id: 'verse-chorus-bridge', name: 'Full Structure', icon: '🏛️', desc: 'Complete song form', sections: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus', 'Outro'] },
        { id: 'aaba', name: 'AABA (32-bar)', icon: '🎷', desc: 'Jazz standard', sections: ['A', 'A', 'B', 'A'] },
        { id: 'simple', name: 'Simple Loop', icon: '🔄', desc: 'Repeating progression', sections: ['Loop'] }
    ];

    content.innerHTML = `
        <div class="py-4">
            <button id="back-to-empty" class="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                </svg>
                Back
            </button>

            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Choose a Song Structure Template</h3>

            <div class="grid gap-3">
                ${templates.map(t => `
                    <button class="template-btn p-4 bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700 hover:border-blue-400 rounded-xl text-left transition-all" data-template="${t.id}">
                        <div class="flex items-start gap-3">
                            <span class="text-2xl">${t.icon}</span>
                            <div class="flex-1">
                                <div class="font-bold text-gray-900 dark:text-white">${t.name}</div>
                                <div class="text-sm text-gray-500 dark:text-gray-400">${t.desc}</div>
                                <div class="flex flex-wrap gap-1 mt-2">
                                    ${t.sections.map(s => `<span class="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded">${s}</span>`).join('')}
                                </div>
                            </div>
                        </div>
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    content.querySelector('#back-to-empty').addEventListener('click', () => {
        content.innerHTML = renderEmptyBuilderState();
        content.querySelector('#start-wizard-from-builder')?.addEventListener('click', () => {
            modal.remove();
            openWizardInModal();
        });
        content.querySelector('#start-with-template')?.addEventListener('click', () => {
            showTemplateSelector(content, modal);
        });
    });

    content.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const templateId = btn.dataset.template;
            applyTemplateAndClose(templateId, modal);
        });
    });
}

/**
 * Apply a template and close modal
 */
function applyTemplateAndClose(templateId, modal) {
    const compositionState = getCompositionState();

    // Template definitions mapping to section types
    const templateSections = {
        'verse-chorus': ['intro', 'verse', 'chorus', 'verse', 'chorus', 'outro'],
        'verse-chorus-bridge': ['intro', 'verse', 'prechorus', 'chorus', 'verse', 'chorus', 'bridge', 'chorus', 'outro'],
        'aaba': ['verse', 'verse', 'bridge', 'verse'],
        'simple': ['verse']
    };

    const sections = templateSections[templateId] || ['verse'];

    // Clear existing sections
    const existingSections = compositionState.getSections();
    existingSections.forEach(s => compositionState.deleteSection(s.id));

    // Create new empty sections from template
    sections.forEach(sectionType => {
        compositionState.createSection(sectionType, []);
    });

    modal.remove();

    // Switch to compose tab so user can add chords
    if (typeof switchTab === 'function') {
        switchTab('builder');
    }

    // Show a toast or notification
    window.dispatchEvent(new CustomEvent('showNotification', {
        detail: { message: `Created ${sections.length} sections. Add chords to fill them in!`, type: 'success' }
    }));
}

// Export for window access
window.openSongwritingWizard = openWizardInModal;
window.showSongBuilderModal = showSongBuilderModal;

export default {
    renderSongwritingWizard,
    showSongwritingWizard,
    openWizardInModal,
    showSongBuilderModal
};
