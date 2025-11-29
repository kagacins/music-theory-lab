/**
 * Guitar Fretboard View Module
 * Interactive visual representation of notes on a guitar fretboard
 */

import { SHARP_NOTES, FLAT_NOTES } from '../../data/music-data.js';
import { getEnharmonicPreference } from '../state/globalState.js';
import { getBuilderState } from '../state/builderState.js';
import { getTrainerState } from '../state/trainerState.js';
import { getScaleState } from '../state/scaleState.js';

let isPanelOpen = false;
let currentFingeringIndex = 0; // Track which fingering is currently shown
let lastChordKey = null; // Track last chord to reset fingering index when chord changes

// Standard guitar tuning (E-A-D-G-B-E from lowest to highest)
const STANDARD_TUNING = ['E', 'A', 'D', 'G', 'B', 'E'];
const NUM_FRETS = 12; // Show first 12 frets

// Guitar chord fingerings database
// Format: { rootNote: { chordType: [{ name: "Fingering Name", positions: [fret for each string], rootFret: number }] } }
// Positions array: [E6, A5, D4, G3, B2, E1] - use -1 for muted string, 0 for open, fret number otherwise
const GUITAR_CHORD_FINGERINGS = {
    'C': {
        'Major': [
            { name: 'Open C', positions: [-1, 3, 2, 0, 1, 0], rootFret: 0 },
            { name: 'C Barre (3rd fret)', positions: [3, 3, 5, 5, 5, 3], rootFret: 3 },
            { name: 'C (8th fret)', positions: [8, 8, 10, 10, 10, 8], rootFret: 8 }
        ],
        'Minor': [
            { name: 'Cm (3rd fret)', positions: [3, 3, 5, 5, 4, 3], rootFret: 3 },
            { name: 'Cm (8th fret)', positions: [8, 8, 10, 10, 9, 8], rootFret: 8 }
        ],
        'Dominant 7th': [
            { name: 'C7 Open', positions: [-1, 3, 2, 3, 1, 0], rootFret: 0 },
            { name: 'C7 (3rd fret)', positions: [3, 3, 5, 3, 5, 3], rootFret: 3 },
            { name: 'C7 (8th fret)', positions: [8, 8, 10, 8, 10, 8], rootFret: 8 }
        ],
        'Major 7th': [
            { name: 'Cmaj7 Open', positions: [-1, 3, 2, 0, 0, 0], rootFret: 0 },
            { name: 'Cmaj7 (3rd fret)', positions: [3, 3, 5, 4, 5, 3], rootFret: 3 },
            { name: 'Cmaj7 (8th fret)', positions: [8, 8, 10, 9, 10, 8], rootFret: 8 }
        ],
        'Minor 7th': [
            { name: 'Cm7 (3rd fret)', positions: [3, 3, 5, 3, 4, 3], rootFret: 3 },
            { name: 'Cm7 (8th fret)', positions: [8, 8, 10, 8, 9, 8], rootFret: 8 }
        ],
        'Sus2': [
            { name: 'Csus2 Open', positions: [-1, 3, 0, 0, 1, 3], rootFret: 0 },
            { name: 'Csus2 (3rd fret)', positions: [3, 3, 5, 5, 3, 3], rootFret: 3 }
        ],
        'Sus4': [
            { name: 'Csus4 Open', positions: [-1, 3, 3, 0, 1, 1], rootFret: 0 },
            { name: 'Csus4 (3rd fret)', positions: [3, 3, 5, 5, 6, 3], rootFret: 3 }
        ],
        'Diminished': [
            { name: 'Cdim (3rd fret)', positions: [3, 3, 4, 5, 4, -1], rootFret: 3 },
            { name: 'Cdim (6th fret)', positions: [-1, 6, 7, 8, 7, -1], rootFret: 6 }
        ],
        'Augmented': [
            { name: 'Caug Open', positions: [-1, 3, 2, 1, 1, 0], rootFret: 0 },
            { name: 'Caug (4th fret)', positions: [4, 4, 6, 5, 5, 4], rootFret: 4 }
        ],
        'Major 6th': [
            { name: 'C6 Open', positions: [-1, 3, 2, 2, 1, 0], rootFret: 0 },
            { name: 'C6 (8th fret)', positions: [8, 8, 10, 10, 10, 10], rootFret: 8 }
        ],
        'Minor 6th': [
            { name: 'Cm6 (3rd fret)', positions: [3, 3, 5, 5, 5, 3], rootFret: 3 }
        ],
        '9th': [
            { name: 'C9 (3rd fret)', positions: [3, 3, 2, 3, 3, 3], rootFret: 3 },
            { name: 'C9 (8th fret)', positions: [8, 8, 7, 8, 8, 8], rootFret: 8 }
        ],
        'Minor 9th': [
            { name: 'Cm9 (3rd fret)', positions: [3, 3, 1, 3, 3, 3], rootFret: 3 }
        ],
        'Major 9th': [
            { name: 'Cmaj9 (3rd fret)', positions: [3, 3, 2, 4, 3, 3], rootFret: 3 }
        ],
        'Add9': [
            { name: 'Cadd9 Open', positions: [-1, 3, 2, 0, 3, 0], rootFret: 0 },
            { name: 'Cadd9 (3rd fret)', positions: [3, 3, 5, 5, 3, 3], rootFret: 3 }
        ],
        'Half-Diminished 7th': [
            { name: 'Cm7b5 (3rd fret)', positions: [-1, 3, 4, 3, 4, -1], rootFret: 3 },
            { name: 'Cm7b5 (8th fret)', positions: [-1, 8, 9, 8, 9, -1], rootFret: 8 }
        ],
        'Diminished 7th': [
            { name: 'Cdim7 (3rd fret)', positions: [-1, 3, 4, 3, 4, 3], rootFret: 3 },
            { name: 'Cdim7 (9th fret)', positions: [-1, 9, 10, 9, 10, 9], rootFret: 9 }
        ],
        '7b5': [
            { name: 'C7b5 (3rd fret)', positions: [-1, 3, 4, 3, 5, 3], rootFret: 3 }
        ],
        '7#5': [
            { name: 'C7#5 (3rd fret)', positions: [-1, 3, 4, 4, 5, 3], rootFret: 3 }
        ],
        'Power Chord': [
            { name: 'C5 (3rd fret)', positions: [-1, 3, 5, 5, -1, -1], rootFret: 3 },
            { name: 'C5 (8th fret)', positions: [-1, 8, 10, 10, -1, -1], rootFret: 8 }
        ]
    },
    'D': {
        'Major': [
            { name: 'Open D', positions: [-1, -1, 0, 2, 3, 2], rootFret: 0 },
            { name: 'D Barre (5th fret)', positions: [5, 5, 7, 7, 7, 5], rootFret: 5 },
            { name: 'D (10th fret)', positions: [10, 10, 12, 12, 12, 10], rootFret: 10 }
        ],
        'Minor': [
            { name: 'Open Dm', positions: [-1, -1, 0, 2, 3, 1], rootFret: 0 },
            { name: 'Dm Barre (5th fret)', positions: [5, 5, 7, 7, 6, 5], rootFret: 5 }
        ],
        'Dominant 7th': [
            { name: 'D7 Open', positions: [-1, -1, 0, 2, 1, 2], rootFret: 0 },
            { name: 'D7 (5th fret)', positions: [5, 5, 7, 5, 7, 5], rootFret: 5 }
        ],
        'Major 7th': [
            { name: 'Dmaj7 Open', positions: [-1, -1, 0, 2, 2, 2], rootFret: 0 },
            { name: 'Dmaj7 (5th fret)', positions: [5, 5, 7, 6, 7, 5], rootFret: 5 }
        ],
        'Minor 7th': [
            { name: 'Dm7 Open', positions: [-1, -1, 0, 2, 1, 1], rootFret: 0 },
            { name: 'Dm7 (5th fret)', positions: [5, 5, 7, 5, 6, 5], rootFret: 5 }
        ],
        'Sus2': [
            { name: 'Dsus2 Open', positions: [-1, -1, 0, 2, 3, 0], rootFret: 0 },
            { name: 'Dsus2 (5th fret)', positions: [5, 5, 7, 7, 5, 5], rootFret: 5 }
        ],
        'Sus4': [
            { name: 'Dsus4 Open', positions: [-1, -1, 0, 2, 3, 3], rootFret: 0 },
            { name: 'Dsus4 (5th fret)', positions: [5, 5, 7, 7, 8, 5], rootFret: 5 }
        ],
        'Diminished': [
            { name: 'Ddim (5th fret)', positions: [5, 5, 6, 7, 6, -1], rootFret: 5 },
            { name: 'Ddim (10th fret)', positions: [10, 10, 11, 12, 11, -1], rootFret: 10 }
        ],
        'Augmented': [
            { name: 'Daug (5th fret)', positions: [5, 5, 7, 6, 6, 5], rootFret: 5 },
            { name: 'Daug (10th fret)', positions: [10, 10, 12, 11, 11, 10], rootFret: 10 }
        ],
        'Major 6th': [
            { name: 'D6 Open', positions: [-1, -1, 0, 2, 0, 2], rootFret: 0 },
            { name: 'D6 (5th fret)', positions: [5, 5, 7, 7, 7, 7], rootFret: 5 }
        ],
        'Add9': [
            { name: 'Dadd9 Open', positions: [-1, -1, 0, 2, 3, 5], rootFret: 0 },
            { name: 'Dadd9 (5th fret)', positions: [5, 5, 7, 7, 5, 5], rootFret: 5 }
        ],
        'Half-Diminished 7th': [
            { name: 'Dm7b5 (5th fret)', positions: [-1, 5, 6, 5, 6, -1], rootFret: 5 }
        ],
        'Diminished 7th': [
            { name: 'Ddim7 (5th fret)', positions: [-1, 5, 6, 5, 6, 5], rootFret: 5 }
        ],
        'Power Chord': [
            { name: 'D5 (5th fret)', positions: [-1, 5, 7, 7, -1, -1], rootFret: 5 }
        ]
    },
    'E': {
        'Major': [
            { name: 'Open E', positions: [0, 2, 2, 1, 0, 0], rootFret: 0 },
            { name: 'E Barre (7th fret)', positions: [7, 7, 9, 9, 9, 7], rootFret: 7 },
            { name: 'E (12th fret)', positions: [12, 12, 14, 14, 14, 12], rootFret: 12 }
        ],
        'Minor': [
            { name: 'Open Em', positions: [0, 2, 2, 0, 0, 0], rootFret: 0 },
            { name: 'Em Barre (7th fret)', positions: [7, 7, 9, 9, 8, 7], rootFret: 7 }
        ],
        'Dominant 7th': [
            { name: 'E7 Open', positions: [0, 2, 0, 1, 0, 0], rootFret: 0 },
            { name: 'E7 (7th fret)', positions: [7, 7, 9, 7, 9, 7], rootFret: 7 }
        ],
        'Major 7th': [
            { name: 'Emaj7 Open', positions: [0, 2, 1, 1, 0, 0], rootFret: 0 },
            { name: 'Emaj7 (7th fret)', positions: [7, 7, 9, 8, 9, 7], rootFret: 7 }
        ],
        'Minor 7th': [
            { name: 'Em7 Open', positions: [0, 2, 0, 0, 0, 0], rootFret: 0 },
            { name: 'Em7 (7th fret)', positions: [7, 7, 9, 7, 8, 7], rootFret: 7 }
        ],
        'Sus2': [
            { name: 'Esus2 Open', positions: [0, 2, 2, 2, 0, 0], rootFret: 0 },
            { name: 'Esus2 (7th fret)', positions: [7, 7, 9, 9, 7, 7], rootFret: 7 }
        ],
        'Sus4': [
            { name: 'Esus4 Open', positions: [0, 2, 2, 2, 0, 0], rootFret: 0 },
            { name: 'Esus4 (7th fret)', positions: [7, 7, 9, 9, 10, 7], rootFret: 7 }
        ],
        'Diminished': [
            { name: 'Edim (7th fret)', positions: [7, 7, 8, 9, 8, -1], rootFret: 7 },
            { name: 'Edim (12th fret)', positions: [12, 12, 13, 14, 13, -1], rootFret: 12 }
        ],
        'Augmented': [
            { name: 'Eaug Open', positions: [0, 2, 2, 1, 1, 0], rootFret: 0 },
            { name: 'Eaug (8th fret)', positions: [8, 8, 10, 9, 9, 8], rootFret: 8 }
        ],
        'Major 6th': [
            { name: 'E6 Open', positions: [0, 2, 2, 1, 2, 0], rootFret: 0 },
            { name: 'E6 (7th fret)', positions: [7, 7, 9, 9, 9, 9], rootFret: 7 }
        ],
        'Add9': [
            { name: 'Eadd9 Open', positions: [0, 2, 2, 1, 2, 0], rootFret: 0 },
            { name: 'Eadd9 (7th fret)', positions: [7, 7, 9, 9, 7, 7], rootFret: 7 }
        ],
        'Half-Diminished 7th': [
            { name: 'Em7b5 (7th fret)', positions: [-1, 7, 8, 7, 8, -1], rootFret: 7 }
        ],
        'Diminished 7th': [
            { name: 'Edim7 (7th fret)', positions: [-1, 7, 8, 7, 8, 7], rootFret: 7 }
        ],
        'Power Chord': [
            { name: 'E5 Open', positions: [0, 2, 2, -1, -1, -1], rootFret: 0 },
            { name: 'E5 (7th fret)', positions: [-1, 7, 9, 9, -1, -1], rootFret: 7 }
        ]
    },
    'F': {
        'Major': [
            { name: 'F Barre (1st fret)', positions: [1, 3, 3, 2, 1, 1], rootFret: 1 },
            { name: 'F (8th fret)', positions: [8, 8, 10, 10, 10, 8], rootFret: 8 }
        ],
        'Minor': [
            { name: 'Fm Barre (1st fret)', positions: [1, 3, 3, 1, 1, 1], rootFret: 1 },
            { name: 'Fm (8th fret)', positions: [8, 8, 10, 10, 9, 8], rootFret: 8 }
        ],
        'Dominant 7th': [
            { name: 'F7 Barre (1st fret)', positions: [1, 3, 1, 2, 1, 1], rootFret: 1 },
            { name: 'F7 (8th fret)', positions: [8, 8, 10, 8, 10, 8], rootFret: 8 }
        ],
        'Major 7th': [
            { name: 'Fmaj7 Barre (1st fret)', positions: [1, 3, 2, 2, 1, 1], rootFret: 1 },
            { name: 'Fmaj7 (8th fret)', positions: [8, 8, 10, 9, 10, 8], rootFret: 8 }
        ],
        'Minor 7th': [
            { name: 'Fm7 Barre (1st fret)', positions: [1, 3, 1, 1, 1, 1], rootFret: 1 },
            { name: 'Fm7 (8th fret)', positions: [8, 8, 10, 8, 9, 8], rootFret: 8 }
        ],
        'Sus2': [
            { name: 'Fsus2 Barre (1st fret)', positions: [1, 3, 3, 3, 1, 1], rootFret: 1 },
            { name: 'Fsus2 (8th fret)', positions: [8, 8, 10, 10, 8, 8], rootFret: 8 }
        ],
        'Sus4': [
            { name: 'Fsus4 Barre (1st fret)', positions: [1, 3, 3, 3, 4, 1], rootFret: 1 },
            { name: 'Fsus4 (8th fret)', positions: [8, 8, 10, 10, 11, 8], rootFret: 8 }
        ],
        'Diminished': [
            { name: 'Fdim (1st fret)', positions: [1, 3, 4, 5, 4, -1], rootFret: 1 },
            { name: 'Fdim (8th fret)', positions: [8, 8, 9, 10, 9, -1], rootFret: 8 }
        ],
        'Augmented': [
            { name: 'Faug Barre (1st fret)', positions: [1, 3, 3, 2, 2, 1], rootFret: 1 },
            { name: 'Faug (9th fret)', positions: [9, 9, 11, 10, 10, 9], rootFret: 9 }
        ],
        'Major 6th': [
            { name: 'F6 Barre (1st fret)', positions: [1, 3, 3, 2, 3, 1], rootFret: 1 },
            { name: 'F6 (8th fret)', positions: [8, 8, 10, 10, 10, 10], rootFret: 8 }
        ],
        'Add9': [
            { name: 'Fadd9 Barre (1st fret)', positions: [1, 3, 3, 2, 3, 1], rootFret: 1 },
            { name: 'Fadd9 (8th fret)', positions: [8, 8, 10, 10, 8, 8], rootFret: 8 }
        ],
        'Half-Diminished 7th': [
            { name: 'Fm7b5 (1st fret)', positions: [-1, 1, 2, 1, 2, -1], rootFret: 1 },
            { name: 'Fm7b5 (8th fret)', positions: [-1, 8, 9, 8, 9, -1], rootFret: 8 }
        ],
        'Diminished 7th': [
            { name: 'Fdim7 (1st fret)', positions: [-1, 1, 2, 1, 2, 1], rootFret: 1 }
        ],
        'Power Chord': [
            { name: 'F5 (1st fret)', positions: [-1, 1, 3, 3, -1, -1], rootFret: 1 },
            { name: 'F5 (8th fret)', positions: [-1, 8, 10, 10, -1, -1], rootFret: 8 }
        ]
    },
    'G': {
        'Major': [
            { name: 'Open G', positions: [3, 2, 0, 0, 3, 3], rootFret: 0 },
            { name: 'G Barre (3rd fret)', positions: [3, 3, 5, 5, 5, 3], rootFret: 3 },
            { name: 'G (10th fret)', positions: [10, 10, 12, 12, 12, 10], rootFret: 10 }
        ],
        'Minor': [
            { name: 'Gm Barre (3rd fret)', positions: [3, 3, 5, 5, 4, 3], rootFret: 3 },
            { name: 'Gm (10th fret)', positions: [10, 10, 12, 12, 11, 10], rootFret: 10 }
        ],
        'Dominant 7th': [
            { name: 'G7 Open', positions: [3, 2, 0, 0, 0, 3], rootFret: 0 },
            { name: 'G7 (3rd fret)', positions: [3, 3, 5, 3, 5, 3], rootFret: 3 }
        ],
        'Major 7th': [
            { name: 'Gmaj7 Open', positions: [3, 2, 0, 0, 0, 2], rootFret: 0 },
            { name: 'Gmaj7 (3rd fret)', positions: [3, 3, 5, 4, 5, 3], rootFret: 3 }
        ],
        'Minor 7th': [
            { name: 'Gm7 (3rd fret)', positions: [3, 3, 5, 3, 4, 3], rootFret: 3 },
            { name: 'Gm7 (10th fret)', positions: [10, 10, 12, 10, 11, 10], rootFret: 10 }
        ],
        'Sus2': [
            { name: 'Gsus2 Open', positions: [3, 0, 0, 0, 3, 3], rootFret: 0 },
            { name: 'Gsus2 (3rd fret)', positions: [3, 3, 5, 5, 3, 3], rootFret: 3 }
        ],
        'Sus4': [
            { name: 'Gsus4 Open', positions: [3, 3, 0, 0, 3, 3], rootFret: 0 },
            { name: 'Gsus4 (3rd fret)', positions: [3, 3, 5, 5, 6, 3], rootFret: 3 }
        ],
        'Diminished': [
            { name: 'Gdim (3rd fret)', positions: [3, 3, 4, 5, 4, -1], rootFret: 3 }
        ],
        'Augmented': [
            { name: 'Gaug Open', positions: [3, 2, 1, 0, 0, 3], rootFret: 0 },
            { name: 'Gaug (4th fret)', positions: [4, 4, 6, 5, 5, 4], rootFret: 4 }
        ],
        'Major 6th': [
            { name: 'G6 Open', positions: [3, 2, 0, 0, 0, 0], rootFret: 0 }
        ],
        'Add9': [
            { name: 'Gadd9 Open', positions: [3, 0, 0, 0, 0, 3], rootFret: 0 },
            { name: 'Gadd9 (3rd fret)', positions: [3, 3, 5, 5, 3, 3], rootFret: 3 }
        ],
        'Half-Diminished 7th': [
            { name: 'Gm7b5 (3rd fret)', positions: [-1, 3, 4, 3, 4, -1], rootFret: 3 }
        ],
        'Diminished 7th': [
            { name: 'Gdim7 (3rd fret)', positions: [-1, 3, 4, 3, 4, 3], rootFret: 3 }
        ],
        'Power Chord': [
            { name: 'G5 (3rd fret)', positions: [3, 3, 5, 5, -1, -1], rootFret: 3 }
        ]
    },
    'A': {
        'Major': [
            { name: 'Open A', positions: [0, 0, 2, 2, 2, 0], rootFret: 0 },
            { name: 'A Barre (5th fret)', positions: [5, 5, 7, 7, 7, 5], rootFret: 5 },
            { name: 'A (12th fret)', positions: [12, 12, 14, 14, 14, 12], rootFret: 12 }
        ],
        'Minor': [
            { name: 'Open Am', positions: [0, 0, 2, 2, 1, 0], rootFret: 0 },
            { name: 'Am Barre (5th fret)', positions: [5, 5, 7, 7, 6, 5], rootFret: 5 }
        ],
        'Dominant 7th': [
            { name: 'A7 Open', positions: [0, 0, 2, 0, 2, 0], rootFret: 0 },
            { name: 'A7 (5th fret)', positions: [5, 5, 7, 5, 7, 5], rootFret: 5 }
        ],
        'Major 7th': [
            { name: 'Amaj7 Open', positions: [0, 0, 2, 1, 2, 0], rootFret: 0 },
            { name: 'Amaj7 (5th fret)', positions: [5, 5, 7, 6, 7, 5], rootFret: 5 }
        ],
        'Minor 7th': [
            { name: 'Am7 Open', positions: [0, 0, 2, 0, 1, 0], rootFret: 0 },
            { name: 'Am7 (5th fret)', positions: [5, 5, 7, 5, 6, 5], rootFret: 5 }
        ],
        'Sus2': [
            { name: 'Asus2 Open', positions: [0, 0, 2, 2, 0, 0], rootFret: 0 },
            { name: 'Asus2 (5th fret)', positions: [5, 5, 7, 7, 5, 5], rootFret: 5 }
        ],
        'Sus4': [
            { name: 'Asus4 Open', positions: [0, 0, 2, 2, 3, 0], rootFret: 0 },
            { name: 'Asus4 (5th fret)', positions: [5, 5, 7, 7, 8, 5], rootFret: 5 }
        ],
        'Diminished': [
            { name: 'Adim (5th fret)', positions: [5, 5, 6, 7, 6, -1], rootFret: 5 }
        ],
        'Augmented': [
            { name: 'Aaug Open', positions: [0, 0, 2, 1, 1, 0], rootFret: 0 },
            { name: 'Aaug (6th fret)', positions: [6, 6, 8, 7, 7, 6], rootFret: 6 }
        ],
        'Major 6th': [
            { name: 'A6 Open', positions: [0, 0, 2, 2, 2, 2], rootFret: 0 }
        ],
        'Add9': [
            { name: 'Aadd9 Open', positions: [0, 0, 2, 4, 2, 0], rootFret: 0 },
            { name: 'Aadd9 (5th fret)', positions: [5, 5, 7, 7, 5, 5], rootFret: 5 }
        ],
        'Half-Diminished 7th': [
            { name: 'Am7b5 (5th fret)', positions: [-1, 5, 6, 5, 6, -1], rootFret: 5 }
        ],
        'Diminished 7th': [
            { name: 'Adim7 (5th fret)', positions: [-1, 5, 6, 5, 6, 5], rootFret: 5 }
        ],
        'Power Chord': [
            { name: 'A5 Open', positions: [0, 0, 2, 2, -1, -1], rootFret: 0 },
            { name: 'A5 (5th fret)', positions: [-1, 5, 7, 7, -1, -1], rootFret: 5 }
        ]
    },
    'B': {
        'Major': [
            { name: 'B Barre (2nd fret)', positions: [2, 2, 4, 4, 4, 2], rootFret: 2 },
            { name: 'B (7th fret)', positions: [7, 7, 9, 9, 9, 7], rootFret: 7 }
        ],
        'Minor': [
            { name: 'Bm Barre (2nd fret)', positions: [2, 2, 4, 4, 3, 2], rootFret: 2 },
            { name: 'Bm (7th fret)', positions: [7, 7, 9, 9, 8, 7], rootFret: 7 }
        ],
        'Dominant 7th': [
            { name: 'B7 Barre (2nd fret)', positions: [2, 2, 4, 2, 4, 2], rootFret: 2 },
            { name: 'B7 (7th fret)', positions: [7, 7, 9, 7, 9, 7], rootFret: 7 }
        ],
        'Major 7th': [
            { name: 'Bmaj7 Barre (2nd fret)', positions: [2, 2, 4, 3, 4, 2], rootFret: 2 },
            { name: 'Bmaj7 (7th fret)', positions: [7, 7, 9, 8, 9, 7], rootFret: 7 }
        ],
        'Minor 7th': [
            { name: 'Bm7 Barre (2nd fret)', positions: [2, 2, 4, 2, 3, 2], rootFret: 2 },
            { name: 'Bm7 (7th fret)', positions: [7, 7, 9, 7, 8, 7], rootFret: 7 }
        ],
        'Sus2': [
            { name: 'Bsus2 Barre (2nd fret)', positions: [2, 2, 4, 4, 2, 2], rootFret: 2 },
            { name: 'Bsus2 (7th fret)', positions: [7, 7, 9, 9, 7, 7], rootFret: 7 }
        ],
        'Sus4': [
            { name: 'Bsus4 Barre (2nd fret)', positions: [2, 2, 4, 4, 5, 2], rootFret: 2 },
            { name: 'Bsus4 (7th fret)', positions: [7, 7, 9, 9, 10, 7], rootFret: 7 }
        ],
        'Diminished': [
            { name: 'Bdim (2nd fret)', positions: [2, 2, 3, 4, 3, -1], rootFret: 2 },
            { name: 'Bdim (7th fret)', positions: [7, 7, 8, 9, 8, -1], rootFret: 7 }
        ],
        'Augmented': [
            { name: 'Baug Barre (2nd fret)', positions: [2, 2, 4, 3, 3, 2], rootFret: 2 },
            { name: 'Baug (8th fret)', positions: [8, 8, 10, 9, 9, 8], rootFret: 8 }
        ],
        'Major 6th': [
            { name: 'B6 Barre (2nd fret)', positions: [2, 2, 4, 4, 4, 4], rootFret: 2 },
            { name: 'B6 (7th fret)', positions: [7, 7, 9, 9, 9, 9], rootFret: 7 }
        ],
        'Add9': [
            { name: 'Badd9 Barre (2nd fret)', positions: [2, 2, 4, 4, 2, 2], rootFret: 2 },
            { name: 'Badd9 (7th fret)', positions: [7, 7, 9, 9, 7, 7], rootFret: 7 }
        ],
        'Half-Diminished 7th': [
            { name: 'Bm7b5 (2nd fret)', positions: [-1, 2, 3, 2, 3, -1], rootFret: 2 },
            { name: 'Bm7b5 (7th fret)', positions: [-1, 7, 8, 7, 8, -1], rootFret: 7 }
        ],
        'Diminished 7th': [
            { name: 'Bdim7 (2nd fret)', positions: [-1, 2, 3, 2, 3, 2], rootFret: 2 }
        ],
        'Power Chord': [
            { name: 'B5 (2nd fret)', positions: [-1, 2, 4, 4, -1, -1], rootFret: 2 },
            { name: 'B5 (7th fret)', positions: [-1, 7, 9, 9, -1, -1], rootFret: 7 }
        ]
    }
};

/**
 * Get available fingerings for a chord
 * @param {string} rootNote - Root note (e.g., 'C', 'D', 'E')
 * @param {string} chordType - Chord type (e.g., 'Major', 'Minor')
 * @returns {Array} Array of fingering objects
 */
function getChordFingerings(rootNote, chordType) {
    // Normalize root note
    const enharmonicMap = {
        'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
        'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
    };
    const normalizedRoot = enharmonicMap[rootNote] || rootNote;
    
    // Normalize chord type - handle variations
    let normalizedChordType = chordType;
    const chordTypeMap = {
        '7': 'Dominant 7th',
        'dom7': 'Dominant 7th',
        'Dom7': 'Dominant 7th',
        'maj7': 'Major 7th',
        'Maj7': 'Major 7th',
        'm7': 'Minor 7th',
        'Min7': 'Minor 7th',
        'min7': 'Minor 7th',
        'Sus2': 'Sus2',
        'sus2': 'Sus2',
        'Sus4': 'Sus4',
        'sus4': 'Sus4',
        'Diminished': 'Diminished',
        'dim': 'Diminished',
        'Augmented': 'Augmented',
        'aug': 'Augmented',
        'Major 6th': 'Major 6th',
        '6': 'Major 6th',
        'Minor 6th': 'Minor 6th',
        'm6': 'Minor 6th',
        'Add9': 'Add9',
        'add9': 'Add9',
        'Half-Diminished 7th': 'Half-Diminished 7th',
        'm7b5': 'Half-Diminished 7th',
        'Diminished 7th': 'Diminished 7th',
        'dim7': 'Diminished 7th',
        'Power Chord': 'Power Chord',
        '5': 'Power Chord'
    };
    if (chordTypeMap[chordType]) {
        normalizedChordType = chordTypeMap[chordType];
    }
    
    if (GUITAR_CHORD_FINGERINGS[normalizedRoot] && GUITAR_CHORD_FINGERINGS[normalizedRoot][normalizedChordType]) {
        return GUITAR_CHORD_FINGERINGS[normalizedRoot][normalizedChordType];
    }
    
    // Fallback: return empty array if no fingerings found
    return [];
}

/**
 * Initialize Guitar Fretboard
 */
export function initGuitarFretboard() {
    createGuitarFretboardPanel();
}

/**
 * Create Guitar Fretboard panel
 */
function createGuitarFretboardPanel() {
    const panel = document.createElement('div');
    panel.id = 'guitar-fretboard-panel';
    panel.className = 'guitar-fretboard-panel hidden';

    panel.innerHTML = `
        <div class="guitar-fretboard-overlay"></div>
        <div class="guitar-fretboard-content">
            <div class="guitar-fretboard-header">
                <h2 class="text-2xl font-bold">Guitar Fretboard</h2>
                <button id="close-guitar-fretboard" class="text-2xl font-bold hover:text-red-500">&times;</button>
            </div>
            <div class="guitar-fretboard-body">
                <div id="guitar-fretboard-svg-container" class="guitar-fretboard-container">
                    <!-- Fretboard will be drawn here by JavaScript -->
                </div>
                <div class="guitar-fretboard-info">
                    <p class="text-sm text-gray-700 font-semibold mb-3">Interactive Guitar Fretboard Visualization</p>
                    <div class="text-xs text-gray-600 space-y-2 text-left">
                        <p class="mb-2">This fretboard shows the notes from your current selection across all six strings in standard tuning (E-A-D-G-B-E).</p>

                        <div class="mt-3 pt-3 border-t border-gray-300">
                            <p class="font-semibold text-gray-700 mb-1">What You're Seeing:</p>
                            <ul class="list-disc list-inside space-y-1 ml-2">
                                <li><strong>Highlighted Dots:</strong> Show where your current chord, scale, or progression notes appear on the fretboard</li>
                                <li><strong>String Names:</strong> Listed on the left (low E string at top, high E at bottom)</li>
                                <li><strong>Fret Numbers:</strong> Shown at the top (0 = open string, 12 = octave)</li>
                                <li><strong>Color Coding:</strong> Matches the keyboard highlighting for each tab</li>
                            </ul>
                        </div>

                        <div class="mt-2">
                            <p class="font-semibold text-gray-700 mb-1">How to Use It:</p>
                            <ul class="list-disc list-inside space-y-1 ml-2">
                                <li><strong>Chord Builder:</strong> See all the places you can play your chord voicing</li>
                                <li><strong>Progression Builder:</strong> Visualize the scale notes available in your key</li>
                                <li><strong>Scale Explorer:</strong> Learn scale patterns and positions on the guitar</li>
                                <li><strong>Practice Tool:</strong> Use this to find easier fingerings or alternative positions</li>
                            </ul>
                        </div>

                        <div class="mt-2">
                            <p class="font-semibold text-gray-700 mb-1">Guitar Tips:</p>
                            <ul class="list-disc list-inside space-y-1 ml-2">
                                <li><strong>CAGED System:</strong> Chord shapes repeat at the 12th fret (one octave higher)</li>
                                <li><strong>Barre Chords:</strong> Many chords can be moved up/down the neck while keeping the same shape</li>
                                <li><strong>Scale Patterns:</strong> Most scales have 5 common positions that connect across the fretboard</li>
                                <li><strong>Root Notes:</strong> The tonic (root) notes are often emphasized in scale patterns</li>
                            </ul>
                        </div>

                        <div class="mt-2 pt-2 border-t border-gray-300">
                            <p class="text-gray-500 italic">💡 Pro tip: Try different octave shifts in the settings to explore notes across the full range of the guitar!</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(panel);

    // Setup event listeners
    document.getElementById('close-guitar-fretboard').addEventListener('click', closeGuitarFretboardPanel);
    document.querySelector('.guitar-fretboard-overlay').addEventListener('click', closeGuitarFretboardPanel);
}

/**
 * Draw the guitar fretboard (inline version, not modal)
 */
function drawGuitarFretboard() {
    const container = document.getElementById('guitar-fretboard-container');
    if (!container) return;

    // Get current notes based on active tab
    const currentTab = window.currentTab || 'builder';
    let notesToHighlight = [];
    let colorClass = 'fret-dot-builder'; // Default color
    let rootNote = null;
    let chordType = null;
    let availableFingerings = [];

    // Check if we're on builder tab and try to get fingerings
    if (currentTab === 'builder') {
        // Try to get chord info from window state
        rootNote = window.currentBuilderRootNote || null;
        chordType = window.currentBuilderChordType || null;
        
        // If we have chord info, check for fingerings
        if (rootNote && chordType) {
            // Reset fingering index if chord changed
            const currentChordKey = `${rootNote}-${chordType}`;
            if (lastChordKey !== null && lastChordKey !== currentChordKey) {
                currentFingeringIndex = 0; // Reset to first fingering when chord changes
            }
            lastChordKey = currentChordKey;
            
            availableFingerings = getChordFingerings(rootNote, chordType);
            
            // Always use fingering if available (default to first)
            if (availableFingerings.length > 0) {
                // Ensure index is valid
                if (currentFingeringIndex >= availableFingerings.length) {
                    currentFingeringIndex = 0;
                }
                const currentFingering = availableFingerings[currentFingeringIndex];
                // Use fingering positions instead of just highlighting notes
                notesToHighlight = drawFingeringPositions(currentFingering);
                colorClass = 'fret-dot-builder';
            } else {
                // Fallback to note-based highlighting only if no fingerings found
                notesToHighlight = window.currentBuilderNotes || [];
            }
        } else {
            // No chord info available, use note-based highlighting
            notesToHighlight = window.currentBuilderNotes || [];
            colorClass = 'fret-dot-builder';
        }
    } else if (currentTab === 'trainer') {
        // Get current scale notes (the key's scale notes)
        const trainerState = getTrainerState();
        notesToHighlight = trainerState.scaleNotes || [];
        colorClass = 'fret-dot-trainer';
    } else if (currentTab === 'scales') {
        // Get current scale notes
        notesToHighlight = window.currentScaleNotes || [];
        colorClass = 'fret-dot-scale';
    }

    // Convert notes to just base names (no octave numbers) if using note-based highlighting
    let baseNotesToHighlight = [];
    if (Array.isArray(notesToHighlight) && notesToHighlight.length > 0 && typeof notesToHighlight[0] === 'string') {
        baseNotesToHighlight = notesToHighlight.map(note => note.replace(/[0-9]/g, ''));
    } else {
        // notesToHighlight is already in fingering format (array of positions)
        baseNotesToHighlight = notesToHighlight;
    }

    // Create fretboard HTML with fingering selector if available
    let html = '';
    
    // Add fingering selector UI if we have fingerings (always show if at least one exists)
    if (currentTab === 'builder' && availableFingerings.length > 0) {
        html += '<div class="fretboard-fingering-selector mb-2 flex items-center gap-2">';
        html += '<label class="text-xs font-semibold text-gray-700">Fingering:</label>';
        html += '<select id="guitar-fingering-select" class="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded-lg text-gray-800 focus:ring-amber-500 focus:border-amber-500">';
        availableFingerings.forEach((fingering, index) => {
            html += `<option value="${index}" ${index === currentFingeringIndex ? 'selected' : ''}>${fingering.name}</option>`;
        });
        html += '</select>';
        html += '</div>';
    }

    html += '<div class="fretboard-grid">';

    // Fret markers at top
    html += '<div class="fret-numbers">';
    html += '<div class="string-label-spacer"></div>';
    for (let fret = 0; fret <= NUM_FRETS; fret++) {
        html += `<div class="fret-number">${fret}</div>`;
    }
    html += '</div>';

    // Check if we're using fingering positions (array of positions) or note-based highlighting
    const usingFingering = Array.isArray(notesToHighlight) && notesToHighlight.length > 0 && 
                          (typeof notesToHighlight[0] === 'number' || notesToHighlight[0] === -1);

    // Track which notes have been shown to avoid duplicates (for note-based highlighting)
    const shownNotes = new Set();
    
    // Detect barre patterns (when multiple consecutive strings share the same fret)
    // Only show barres when 3 or more consecutive strings share the same fret (traditional barre)
    const barrePatterns = [];
    if (usingFingering && notesToHighlight.length === 6) {
        // Group consecutive strings with the same fret position
        let currentBarre = null;
        for (let i = 0; i < 6; i++) {
            const fret = notesToHighlight[i];
            if (fret !== -1 && fret > 0) { // Barre only for fretted positions (not open)
                if (currentBarre && currentBarre.fret === fret) {
                    // Continue current barre
                    currentBarre.endString = i;
                } else {
                    // Start new barre or finish previous
                    // Only keep barres that span 3+ strings
                    if (currentBarre && currentBarre.endString - currentBarre.startString >= 2) {
                        barrePatterns.push(currentBarre);
                    }
                    currentBarre = { fret: fret, startString: i, endString: i };
                }
            } else {
                // Muted or open string - finish current barre if exists
                // Only keep barres that span 3+ strings
                if (currentBarre && currentBarre.endString - currentBarre.startString >= 2) {
                    barrePatterns.push(currentBarre);
                }
                currentBarre = null;
            }
        }
        // Finish last barre if exists - only keep if spans 3+ strings
        if (currentBarre && currentBarre.endString - currentBarre.startString >= 2) {
            barrePatterns.push(currentBarre);
        }
    }

    // Draw each string
    STANDARD_TUNING.forEach((openNote, stringIndex) => {
        html += `<div class="guitar-string" data-string-index="${stringIndex}" data-open-note="${openNote}">`;

        // String label
        html += `<div class="string-label">${openNote}</div>`;

        // Draw frets for this string
        for (let fret = 0; fret <= NUM_FRETS; fret++) {
            const noteAtFret = getNoteAtFret(openNote, fret);
            const fretNoteKey = `${noteAtFret}`;
            
            if (usingFingering && stringIndex < notesToHighlight.length) {
                // Using fingering positions - show dot at specified fret position
                const fretPosition = notesToHighlight[stringIndex];
                const shouldShow = fretPosition === fret && fretPosition !== -1;
                
                // Check if this position is part of a barre
                const isBarre = barrePatterns.some(barre => 
                    barre.fret === fret && 
                    stringIndex >= barre.startString && 
                    stringIndex <= barre.endString
                );
                
                html += `<div class="fret-position ${fret === 0 ? 'open-string' : ''} ${isBarre ? 'barre-fret' : ''}" data-fret="${fret}" data-note="${noteAtFret}" data-string-index="${stringIndex}">`;
                
                // Draw barre bar if this is the first string of a barre
                if (isBarre && barrePatterns.some(barre => barre.fret === fret && barre.startString === stringIndex)) {
                    const barre = barrePatterns.find(barre => barre.fret === fret && barre.startString === stringIndex);
                    const barreLength = barre.endString - barre.startString + 1;
                    const barreHeight = barreLength * 20 + 4; // Add small padding
                    const barreTop = -(barreLength - 1) * 10; // Center vertically
                    html += `<div class="barre-bar" style="height: ${barreHeight}px; top: ${barreTop}px;" title="Barre across ${barreLength} strings"></div>`;
                }
                
                if (shouldShow) {
                    html += `<div class="fret-dot ${colorClass}" title="${noteAtFret}">
                        <span class="fret-note-label">${noteAtFret}</span>
                    </div>`;
                }
                html += '</div>';
            } else {
                // Using note-based highlighting
            const isHighlighted = baseNotesToHighlight.includes(noteAtFret);

                // Only show each unique note once (first occurrence found)
                const shouldShow = isHighlighted && !shownNotes.has(fretNoteKey);
                
                html += `<div class="fret-position ${fret === 0 ? 'open-string' : ''}" data-fret="${fret}" data-note="${noteAtFret}" data-string-index="${stringIndex}">`;
                if (shouldShow) {
                    shownNotes.add(fretNoteKey);
                html += `<div class="fret-dot ${colorClass}" title="${noteAtFret}">
                    <span class="fret-note-label">${noteAtFret}</span>
                </div>`;
            }
            html += '</div>';
            }
        }

        html += '</div>';
    });

    html += '</div>';

    container.innerHTML = html;

    // Add click handlers to fret dots after rendering
    setTimeout(() => {
        addFretDotClickHandlers();
        
        // Add fingering selector change handler
        const fingeringSelect = document.getElementById('guitar-fingering-select');
        if (fingeringSelect) {
            fingeringSelect.addEventListener('change', (e) => {
                currentFingeringIndex = parseInt(e.target.value, 10);
                drawGuitarFretboard(); // Redraw with new fingering
            });
        }
    }, 10);
}

/**
 * Draw fingering positions on the fretboard
 * @param {Object} fingering - Fingering object with positions array
 * @returns {Array<number>} Array of fret positions for each string (E6, A5, D4, G3, B2, E1)
 */
function drawFingeringPositions(fingering) {
    // Return the positions array directly - each index corresponds to a string
    // positions: [E6, A5, D4, G3, B2, E1]
    return fingering.positions || [];
}

/**
 * Get the note at a specific fret on a string
 * @param {string} openNote - The open string note
 * @param {number} fret - Fret number (0 = open)
 * @returns {string} Note name
 */
function getNoteAtFret(openNote, fret) {
    const enharmonicPreference = getEnharmonicPreference();
    const notes = enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    // Find the index of the open note
    let openIndex = notes.indexOf(openNote);
    if (openIndex === -1) {
        // Try finding enharmonic equivalent
        const enharmonicMap = {
            'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
            'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
        };
        openIndex = notes.indexOf(enharmonicMap[openNote] || openNote);
    }

    if (openIndex === -1) return openNote; // Fallback

    // Calculate note at fret (wrapping around 12 notes)
    const noteIndex = (openIndex + fret) % 12;
    return notes[noteIndex];
}

/**
 * Toggle Guitar Fretboard panel
 */
export function toggleGuitarFretboardPanel() {
    const panel = document.getElementById('guitar-fretboard-panel');
    if (!panel) return;

    if (isPanelOpen) {
        closeGuitarFretboardPanel();
    } else {
        openGuitarFretboardPanel();
    }
}

/**
 * Open Guitar Fretboard panel
 */
export function openGuitarFretboardPanel() {
    const panel = document.getElementById('guitar-fretboard-panel');
    if (panel) {
        panel.classList.remove('hidden');
        isPanelOpen = true;

        // Draw the fretboard with current notes
        drawGuitarFretboard();
    }
}

/**
 * Close Guitar Fretboard panel
 */
export function closeGuitarFretboardPanel() {
    const panel = document.getElementById('guitar-fretboard-panel');
    if (panel) {
        panel.classList.add('hidden');
        isPanelOpen = false;
    }
}

/**
 * Track active fret notes for hold-to-play
 */
let activeFretNotes = new Set();

/**
 * Add click handlers to fretboard dots for guitar sound playback (hold-to-play like piano)
 * Now enables clicking ANY fret position, not just where dots are visible
 */
function addFretDotClickHandlers() {
    const fretPositions = document.querySelectorAll('#guitar-fretboard-container .fret-position');
    
    // Remove old listeners by cloning and replacing
    fretPositions.forEach(position => {
        const newPosition = position.cloneNode(true);
        position.parentNode.replaceChild(newPosition, position);
    });
    
    // Get fresh references after cloning
    const freshFretPositions = document.querySelectorAll('#guitar-fretboard-container .fret-position');
    
    // Add handlers to ALL fret positions (not just ones with dots)
    freshFretPositions.forEach(position => {
        const noteName = position.dataset.note;
        if (!noteName) return;

        // Convert note name to note with octave
        // Calculate octave correctly based on string and fret position
        let noteWithOctave = noteName;
        const fret = parseInt(position.dataset.fret, 10);
        const stringIndex = parseInt(position.dataset.stringIndex, 10);
        
        // Standard guitar tuning octaves (6th string to 1st string)
        const openStringOctaves = [2, 2, 3, 3, 3, 4]; // E2, A2, D3, G3, B3, E4
        
        // Get the open string note name and find its position in the chromatic scale
        const openStringNote = STANDARD_TUNING[stringIndex];
        const enharmonicPreference = getEnharmonicPreference();
        const notes = enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const openStringNoteIndex = notes.indexOf(openStringNote);
        
        // Calculate the actual octave: start with open string octave
        let octave = openStringOctaves[stringIndex] || 3;
        
        // Add octaves for every 12 frets (one full octave)
        octave += Math.floor(fret / 12);
        
        // For frets < 12, check if we've crossed an octave boundary
        // This happens when the total semitones (openStringNoteIndex + fret) >= 12
        // Example: D string (index 2), fret 10 = 2 + 10 = 12, which means we've crossed into next octave
        if (fret < 12 && (openStringNoteIndex + fret) >= 12) {
            octave++;
        }
        
        // Build note name with octave
        if (noteName.length === 1) {
            noteWithOctave = noteName + octave;
        } else if (noteName.length === 2) {
            if (noteName[1] === '#' || noteName[1] === 'b') {
                noteWithOctave = noteName + octave;
            } else {
                noteWithOctave = noteName[0] + octave;
            }
        } else {
            noteWithOctave = noteName + octave;
        }

        // Store note for this element
        position.dataset.noteWithOctave = noteWithOctave;

        // Get the guitar string element for animation
        const guitarString = position.closest('.guitar-string');

        // Mouse/touch handlers for hold-to-play
        const startNote = (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            // Initialize audio and resume audio context
            if (window.initAudio) window.initAudio();
            
            // Ensure audio context is running (required for Tone.js after user interaction)
            if (Tone && Tone.context.state !== 'running') {
                Tone.context.resume().catch(err => {
                    console.warn("Could not resume audio context:", err);
                });
            }
            
            // Use getInstrument() to respect fretboard mode and get consistent sound
            const getInstrument = window.getInstrument || (() => window.getGuitar ? window.getGuitar() : null);
            const instrument = getInstrument();
            
            // For guitar, we don't need to wait for audioIsReady (piano samples)
            // The guitar synth is ready immediately after creation
            if (!instrument) {
                console.warn("Guitar instrument not available");
                return;
            }
            
            // Start playing (hold-to-play)
            if (!activeFretNotes.has(noteWithOctave)) {
                activeFretNotes.add(noteWithOctave);
                instrument.triggerAttack(noteWithOctave, Tone.now());
                
                // Trigger string wiggle animation
                if (guitarString) {
                    guitarString.classList.add('playing');
                    setTimeout(() => {
                        guitarString.classList.remove('playing');
                    }, 300);
                }
            }
        };

        const stopNote = (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            const getInstrument = window.getInstrument || (() => window.getGuitar ? window.getGuitar() : null);
            const instrument = getInstrument();
            if (!instrument) return;
            
            // Stop playing
            if (activeFretNotes.has(noteWithOctave)) {
                activeFretNotes.delete(noteWithOctave);
                instrument.triggerRelease(noteWithOctave, Tone.now());
            }
        };

        // Mouse events
        position.addEventListener('mousedown', startNote);
        position.addEventListener('mouseup', stopNote);
        position.addEventListener('mouseleave', stopNote);
        
        // Touch events
        position.addEventListener('touchstart', startNote, { passive: false });
        position.addEventListener('touchend', stopNote, { passive: false });
        position.addEventListener('touchcancel', stopNote, { passive: false });
    });
    
    // Global mouse/touch release handlers
    const container = document.getElementById('guitar-fretboard-container');
    if (container) {
        const handleGlobalRelease = () => {
            const getInstrument = window.getInstrument || (() => window.getGuitar ? window.getGuitar() : null);
            const instrument = getInstrument();
            if (!instrument) return;
            
            activeFretNotes.forEach(note => {
                instrument.triggerRelease(note, Tone.now());
            });
            activeFretNotes.clear();
            
            // Remove all playing classes
            document.querySelectorAll('.guitar-string.playing').forEach(str => {
                str.classList.remove('playing');
            });
        };
        
        // Remove old listeners if any
        container.removeEventListener('mouseup', handleGlobalRelease);
        container.removeEventListener('touchend', handleGlobalRelease);
        
        // Add new listeners
        container.addEventListener('mouseup', handleGlobalRelease);
        container.addEventListener('touchend', handleGlobalRelease);
    }
}

/**
 * Update fretboard when notes change
 */
export function updateGuitarFretboard() {
    // Draw fretboard if panel is open OR if inline fretboard mode is on
    const isFretboardModeOn = window.getIsFretboardModeOn ? window.getIsFretboardModeOn() : false;
    if (isPanelOpen || isFretboardModeOn) {
        drawGuitarFretboard();
    }
}
