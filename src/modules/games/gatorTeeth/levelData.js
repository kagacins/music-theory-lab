/**
 * Level Data for Chord Runner
 *
 * Defines worlds, levels, and chord progressions for the game.
 * Each world has a theme and focuses on different chord types/keys.
 *
 * Level structure:
 * - name: Display name
 * - description: Brief description shown on level select
 * - chordsRequired: Number of chords to complete the level
 * - chords: Array of chord data objects
 * - shuffle: Whether to randomize chord order
 * - speed: Speed multiplier (1.0 = normal)
 * - octaveRange: How many octaves to display (1 or 2)
 * - theme: Visual theme overrides
 */

// ============================================
// WORLD 1: WHITE KEY BASICS
// ============================================

const WORLD_1_LEVELS = [
    {
        id: 1,
        name: 'First Steps',
        description: 'Learn C Major',
        chordsRequired: 5,
        speed: 0.7,
        shuffle: false,
        octaveRange: 1,
        chords: [
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'] },
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'] },
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'] },
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'] },
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'] }
        ],
        theme: {
            background: '#1a2a1a',
            accent: '#4ecca3'
        }
    },
    {
        id: 2,
        name: 'Two Friends',
        description: 'C and G Major',
        chordsRequired: 8,
        speed: 0.8,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'] },
            { root: 'G', type: 'Major', notes: ['G4', 'B4', 'D5'] },
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'] },
            { root: 'G', type: 'Major', notes: ['G4', 'B4', 'D5'] }
        ]
    },
    {
        id: 3,
        name: 'The Big Three',
        description: 'C, F, and G Major',
        chordsRequired: 10,
        speed: 0.9,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'] },
            { root: 'F', type: 'Major', notes: ['F4', 'A4', 'C5'] },
            { root: 'G', type: 'Major', notes: ['G4', 'B4', 'D5'] }
        ]
    },
    {
        id: 4,
        name: 'Minor Mood',
        description: 'Add A minor and E minor',
        chordsRequired: 10,
        speed: 0.9,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'] },
            { root: 'A', type: 'Minor', notes: ['A4', 'C5', 'E5'] },
            { root: 'F', type: 'Major', notes: ['F4', 'A4', 'C5'] },
            { root: 'E', type: 'Minor', notes: ['E4', 'G4', 'B4'] },
            { root: 'G', type: 'Major', notes: ['G4', 'B4', 'D5'] }
        ]
    },
    {
        id: 5,
        name: 'White Key Master',
        description: 'All white key triads',
        chordsRequired: 12,
        speed: 1.0,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'] },
            { root: 'D', type: 'Minor', notes: ['D4', 'F4', 'A4'] },
            { root: 'E', type: 'Minor', notes: ['E4', 'G4', 'B4'] },
            { root: 'F', type: 'Major', notes: ['F4', 'A4', 'C5'] },
            { root: 'G', type: 'Major', notes: ['G4', 'B4', 'D5'] },
            { root: 'A', type: 'Minor', notes: ['A4', 'C5', 'E5'] },
            { root: 'B', type: 'Diminished', notes: ['B4', 'D5', 'F5'] }
        ]
    }
];

// ============================================
// WORLD 2: SHARP TERRITORY
// ============================================

const WORLD_2_LEVELS = [
    {
        id: 1,
        name: 'Sharp Intro',
        description: 'G Major with F#',
        chordsRequired: 8,
        speed: 0.8,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'G', type: 'Major', notes: ['G4', 'B4', 'D5'] },
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'] },
            { root: 'D', type: 'Major', notes: ['D4', 'F#4', 'A4'] }
        ],
        theme: {
            background: '#2a1a2a',
            accent: '#cc4e9a'
        }
    },
    {
        id: 2,
        name: 'D Major Territory',
        description: 'F# and C# together',
        chordsRequired: 10,
        speed: 0.9,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'D', type: 'Major', notes: ['D4', 'F#4', 'A4'] },
            { root: 'G', type: 'Major', notes: ['G4', 'B4', 'D5'] },
            { root: 'A', type: 'Major', notes: ['A4', 'C#5', 'E5'] },
            { root: 'E', type: 'Minor', notes: ['E4', 'G4', 'B4'] }
        ]
    },
    {
        id: 3,
        name: 'A Major Adventure',
        description: 'Three sharps!',
        chordsRequired: 10,
        speed: 0.9,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'A', type: 'Major', notes: ['A4', 'C#5', 'E5'] },
            { root: 'D', type: 'Major', notes: ['D4', 'F#4', 'A4'] },
            { root: 'E', type: 'Major', notes: ['E4', 'G#4', 'B4'] },
            { root: 'F#', type: 'Minor', notes: ['F#4', 'A4', 'C#5'] }
        ]
    },
    {
        id: 4,
        name: 'E Major Express',
        description: 'Four sharps territory',
        chordsRequired: 10,
        speed: 1.0,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'E', type: 'Major', notes: ['E4', 'G#4', 'B4'] },
            { root: 'A', type: 'Major', notes: ['A4', 'C#5', 'E5'] },
            { root: 'B', type: 'Major', notes: ['B4', 'D#5', 'F#5'] },
            { root: 'C#', type: 'Minor', notes: ['C#4', 'E4', 'G#4'] }
        ]
    },
    {
        id: 5,
        name: 'Sharp Master',
        description: 'All sharp keys combined',
        chordsRequired: 12,
        speed: 1.0,
        shuffle: true,
        octaveRange: 2,
        chords: [
            { root: 'G', type: 'Major', notes: ['G4', 'B4', 'D5'] },
            { root: 'D', type: 'Major', notes: ['D4', 'F#4', 'A4'] },
            { root: 'A', type: 'Major', notes: ['A4', 'C#5', 'E5'] },
            { root: 'E', type: 'Major', notes: ['E4', 'G#4', 'B4'] },
            { root: 'B', type: 'Major', notes: ['B4', 'D#5', 'F#5'] },
            { root: 'F#', type: 'Major', notes: ['F#4', 'A#4', 'C#5'] }
        ]
    }
];

// ============================================
// WORLD 3: FLAT TERRITORY
// ============================================

const WORLD_3_LEVELS = [
    {
        id: 1,
        name: 'First Flat',
        description: 'F Major with Bb',
        chordsRequired: 8,
        speed: 0.8,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'F', type: 'Major', notes: ['F4', 'A4', 'C5'] },
            { root: 'Bb', type: 'Major', notes: ['Bb4', 'D5', 'F5'] },
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'] }
        ],
        theme: {
            background: '#1a1a2e',
            accent: '#4e7ccc'
        }
    },
    {
        id: 2,
        name: 'Bb Major Blues',
        description: 'Two flats',
        chordsRequired: 10,
        speed: 0.9,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'Bb', type: 'Major', notes: ['Bb4', 'D5', 'F5'] },
            { root: 'Eb', type: 'Major', notes: ['Eb4', 'G4', 'Bb4'] },
            { root: 'F', type: 'Major', notes: ['F4', 'A4', 'C5'] },
            { root: 'G', type: 'Minor', notes: ['G4', 'Bb4', 'D5'] }
        ]
    },
    {
        id: 3,
        name: 'Eb Major Journey',
        description: 'Three flats',
        chordsRequired: 10,
        speed: 0.9,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'Eb', type: 'Major', notes: ['Eb4', 'G4', 'Bb4'] },
            { root: 'Ab', type: 'Major', notes: ['Ab4', 'C5', 'Eb5'] },
            { root: 'Bb', type: 'Major', notes: ['Bb4', 'D5', 'F5'] },
            { root: 'C', type: 'Minor', notes: ['C4', 'Eb4', 'G4'] }
        ]
    },
    {
        id: 4,
        name: 'Ab Major Depths',
        description: 'Four flats',
        chordsRequired: 10,
        speed: 1.0,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'Ab', type: 'Major', notes: ['Ab4', 'C5', 'Eb5'] },
            { root: 'Db', type: 'Major', notes: ['Db4', 'F4', 'Ab4'] },
            { root: 'Eb', type: 'Major', notes: ['Eb4', 'G4', 'Bb4'] },
            { root: 'F', type: 'Minor', notes: ['F4', 'Ab4', 'C5'] }
        ]
    },
    {
        id: 5,
        name: 'Flat Master',
        description: 'All flat keys combined',
        chordsRequired: 12,
        speed: 1.0,
        shuffle: true,
        octaveRange: 2,
        chords: [
            { root: 'F', type: 'Major', notes: ['F4', 'A4', 'C5'] },
            { root: 'Bb', type: 'Major', notes: ['Bb4', 'D5', 'F5'] },
            { root: 'Eb', type: 'Major', notes: ['Eb4', 'G4', 'Bb4'] },
            { root: 'Ab', type: 'Major', notes: ['Ab4', 'C5', 'Eb5'] },
            { root: 'Db', type: 'Major', notes: ['Db4', 'F4', 'Ab4'] },
            { root: 'Gb', type: 'Major', notes: ['Gb4', 'Bb4', 'Db5'] }
        ]
    }
];

// ============================================
// WORLD 4: SEVENTH HEAVEN
// ============================================

const WORLD_4_LEVELS = [
    {
        id: 1,
        name: 'Dominant Discovery',
        description: 'Dominant 7th chords',
        chordsRequired: 8,
        speed: 0.8,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'G', type: 'Dominant 7th', notes: ['G4', 'B4', 'D5', 'F5'] },
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'] },
            { root: 'D', type: 'Dominant 7th', notes: ['D4', 'F#4', 'A4', 'C5'] },
            { root: 'G', type: 'Major', notes: ['G4', 'B4', 'D5'] }
        ],
        theme: {
            background: '#2e1a2e',
            accent: '#cc9a4e'
        }
    },
    {
        id: 2,
        name: 'Major 7th Magic',
        description: 'Dreamy major 7ths',
        chordsRequired: 10,
        speed: 0.9,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'C', type: 'Major 7th', notes: ['C4', 'E4', 'G4', 'B4'] },
            { root: 'F', type: 'Major 7th', notes: ['F4', 'A4', 'C5', 'E5'] },
            { root: 'G', type: 'Dominant 7th', notes: ['G4', 'B4', 'D5', 'F5'] },
            { root: 'A', type: 'Minor 7th', notes: ['A4', 'C5', 'E5', 'G5'] }
        ]
    },
    {
        id: 3,
        name: 'Minor 7th Moods',
        description: 'Smooth minor 7ths',
        chordsRequired: 10,
        speed: 0.9,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'A', type: 'Minor 7th', notes: ['A4', 'C5', 'E5', 'G5'] },
            { root: 'D', type: 'Minor 7th', notes: ['D4', 'F4', 'A4', 'C5'] },
            { root: 'E', type: 'Minor 7th', notes: ['E4', 'G4', 'B4', 'D5'] },
            { root: 'G', type: 'Dominant 7th', notes: ['G4', 'B4', 'D5', 'F5'] }
        ]
    },
    {
        id: 4,
        name: 'Jazz Progression',
        description: 'ii-V-I in action',
        chordsRequired: 12,
        speed: 1.0,
        shuffle: false, // Keep the progression order!
        octaveRange: 1,
        chords: [
            { root: 'D', type: 'Minor 7th', notes: ['D4', 'F4', 'A4', 'C5'] },
            { root: 'G', type: 'Dominant 7th', notes: ['G4', 'B4', 'D5', 'F5'] },
            { root: 'C', type: 'Major 7th', notes: ['C4', 'E4', 'G4', 'B4'] },
            { root: 'C', type: 'Major 7th', notes: ['C4', 'E4', 'G4', 'B4'] }
        ]
    },
    {
        id: 5,
        name: 'Seventh Master',
        description: 'All 7th chord types',
        chordsRequired: 15,
        speed: 1.0,
        shuffle: true,
        octaveRange: 2,
        chords: [
            { root: 'C', type: 'Major 7th', notes: ['C4', 'E4', 'G4', 'B4'] },
            { root: 'D', type: 'Minor 7th', notes: ['D4', 'F4', 'A4', 'C5'] },
            { root: 'E', type: 'Minor 7th', notes: ['E4', 'G4', 'B4', 'D5'] },
            { root: 'F', type: 'Major 7th', notes: ['F4', 'A4', 'C5', 'E5'] },
            { root: 'G', type: 'Dominant 7th', notes: ['G4', 'B4', 'D5', 'F5'] },
            { root: 'A', type: 'Minor 7th', notes: ['A4', 'C5', 'E5', 'G5'] },
            { root: 'B', type: 'Half-Diminished 7th', notes: ['B4', 'D5', 'F5', 'A5'] }
        ]
    }
];

// ============================================
// WORLD 5: INVERSIONS
// ============================================

const WORLD_5_LEVELS = [
    {
        id: 1,
        name: 'First Inversion',
        description: '3rd in the bass',
        chordsRequired: 8,
        speed: 0.8,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'C', type: 'Major', notes: ['E4', 'G4', 'C5'], inversion: 1 },
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'], inversion: 0 },
            { root: 'G', type: 'Major', notes: ['B4', 'D5', 'G5'], inversion: 1 },
            { root: 'G', type: 'Major', notes: ['G4', 'B4', 'D5'], inversion: 0 }
        ],
        theme: {
            background: '#1a2e2e',
            accent: '#4eccc0'
        }
    },
    {
        id: 2,
        name: 'Second Inversion',
        description: '5th in the bass',
        chordsRequired: 10,
        speed: 0.9,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'C', type: 'Major', notes: ['G4', 'C5', 'E5'], inversion: 2 },
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'], inversion: 0 },
            { root: 'F', type: 'Major', notes: ['C4', 'F4', 'A4'], inversion: 2 },
            { root: 'G', type: 'Major', notes: ['D4', 'G4', 'B4'], inversion: 2 }
        ]
    },
    {
        id: 3,
        name: 'All Inversions',
        description: 'Root, 1st, and 2nd',
        chordsRequired: 12,
        speed: 0.9,
        shuffle: true,
        octaveRange: 1,
        chords: [
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'], inversion: 0 },
            { root: 'C', type: 'Major', notes: ['E4', 'G4', 'C5'], inversion: 1 },
            { root: 'C', type: 'Major', notes: ['G4', 'C5', 'E5'], inversion: 2 },
            { root: 'G', type: 'Major', notes: ['G4', 'B4', 'D5'], inversion: 0 },
            { root: 'G', type: 'Major', notes: ['B4', 'D5', 'G5'], inversion: 1 },
            { root: 'G', type: 'Major', notes: ['D4', 'G4', 'B4'], inversion: 2 }
        ]
    },
    {
        id: 4,
        name: '7th Inversions',
        description: 'Four positions',
        chordsRequired: 12,
        speed: 1.0,
        shuffle: true,
        octaveRange: 2,
        chords: [
            { root: 'C', type: 'Major 7th', notes: ['C4', 'E4', 'G4', 'B4'], inversion: 0 },
            { root: 'C', type: 'Major 7th', notes: ['E4', 'G4', 'B4', 'C5'], inversion: 1 },
            { root: 'C', type: 'Major 7th', notes: ['G4', 'B4', 'C5', 'E5'], inversion: 2 },
            { root: 'C', type: 'Major 7th', notes: ['B3', 'C4', 'E4', 'G4'], inversion: 3 }
        ]
    },
    {
        id: 5,
        name: 'Inversion Master',
        description: 'The ultimate test',
        chordsRequired: 15,
        speed: 1.1,
        shuffle: true,
        octaveRange: 2,
        chords: [
            { root: 'C', type: 'Major', notes: ['C4', 'E4', 'G4'], inversion: 0 },
            { root: 'C', type: 'Major', notes: ['E4', 'G4', 'C5'], inversion: 1 },
            { root: 'C', type: 'Major', notes: ['G4', 'C5', 'E5'], inversion: 2 },
            { root: 'F', type: 'Major', notes: ['F4', 'A4', 'C5'], inversion: 0 },
            { root: 'F', type: 'Major', notes: ['A4', 'C5', 'F5'], inversion: 1 },
            { root: 'G', type: 'Dominant 7th', notes: ['G4', 'B4', 'D5', 'F5'], inversion: 0 },
            { root: 'G', type: 'Dominant 7th', notes: ['B4', 'D5', 'F5', 'G5'], inversion: 1 },
            { root: 'G', type: 'Dominant 7th', notes: ['D4', 'F4', 'G4', 'B4'], inversion: 2 }
        ]
    }
];

// ============================================
// WORLDS ARRAY
// ============================================

export const WORLDS = [
    {
        id: 1,
        name: 'White Key Basics',
        description: 'Learn major and minor triads on white keys',
        levels: WORLD_1_LEVELS,
        theme: {
            primary: '#4ecca3',
            background: '#1a2a1a'
        }
    },
    {
        id: 2,
        name: 'Sharp Territory',
        description: 'Explore keys with sharps',
        levels: WORLD_2_LEVELS,
        theme: {
            primary: '#cc4e9a',
            background: '#2a1a2a'
        }
    },
    {
        id: 3,
        name: 'Flat Territory',
        description: 'Explore keys with flats',
        levels: WORLD_3_LEVELS,
        theme: {
            primary: '#4e7ccc',
            background: '#1a1a2e'
        }
    },
    {
        id: 4,
        name: 'Seventh Heaven',
        description: 'Master 7th chords',
        levels: WORLD_4_LEVELS,
        theme: {
            primary: '#cc9a4e',
            background: '#2e1a2e'
        }
    },
    {
        id: 5,
        name: 'Inversions',
        description: 'Same chords, different positions',
        levels: WORLD_5_LEVELS,
        theme: {
            primary: '#4eccc0',
            background: '#1a2e2e'
        }
    }
];

/**
 * Get level data by world and level number
 */
export function getLevelData(worldId, levelNum) {
    const world = WORLDS.find(w => w.id === worldId);
    if (!world) return null;

    const level = world.levels.find(l => l.id === levelNum);
    if (!level) return null;

    // Merge world theme with level theme
    return {
        ...level,
        worldName: world.name,
        theme: {
            ...world.theme,
            ...level.theme
        }
    };
}

/**
 * Get total number of levels
 */
export function getTotalLevels() {
    return WORLDS.reduce((sum, world) => sum + world.levels.length, 0);
}

/**
 * Get world by ID
 */
export function getWorld(worldId) {
    return WORLDS.find(w => w.id === worldId);
}
