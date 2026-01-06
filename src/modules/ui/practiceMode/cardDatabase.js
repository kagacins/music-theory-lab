/**
 * Practice Mode Card Database
 *
 * Contains all flashcard content organized by category.
 * Each card has a unique ID, front content (question), back content (answer),
 * difficulty level, and optional audio/visual hints.
 */

import { CARD_CATEGORIES } from './practiceModeProgress.js';

// ===========================================
// CHORD BUILDING CARDS
// ===========================================

/**
 * Chord building flashcards
 * Front: "Build a [chord type] chord"
 * Back: Notes and intervals
 */
const CHORD_BUILDING_CARDS = [
    // Major Triads
    { id: 'chord_C_Major', root: 'C', type: 'Major', notes: ['C', 'E', 'G'], intervals: ['Root', 'Major 3rd', 'Perfect 5th'], difficulty: 1 },
    { id: 'chord_G_Major', root: 'G', type: 'Major', notes: ['G', 'B', 'D'], intervals: ['Root', 'Major 3rd', 'Perfect 5th'], difficulty: 1 },
    { id: 'chord_D_Major', root: 'D', type: 'Major', notes: ['D', 'F#', 'A'], intervals: ['Root', 'Major 3rd', 'Perfect 5th'], difficulty: 1 },
    { id: 'chord_A_Major', root: 'A', type: 'Major', notes: ['A', 'C#', 'E'], intervals: ['Root', 'Major 3rd', 'Perfect 5th'], difficulty: 1 },
    { id: 'chord_E_Major', root: 'E', type: 'Major', notes: ['E', 'G#', 'B'], intervals: ['Root', 'Major 3rd', 'Perfect 5th'], difficulty: 1 },
    { id: 'chord_F_Major', root: 'F', type: 'Major', notes: ['F', 'A', 'C'], intervals: ['Root', 'Major 3rd', 'Perfect 5th'], difficulty: 1 },
    { id: 'chord_Bb_Major', root: 'Bb', type: 'Major', notes: ['Bb', 'D', 'F'], intervals: ['Root', 'Major 3rd', 'Perfect 5th'], difficulty: 2 },
    { id: 'chord_Eb_Major', root: 'Eb', type: 'Major', notes: ['Eb', 'G', 'Bb'], intervals: ['Root', 'Major 3rd', 'Perfect 5th'], difficulty: 2 },

    // Minor Triads
    { id: 'chord_A_Minor', root: 'A', type: 'Minor', notes: ['A', 'C', 'E'], intervals: ['Root', 'Minor 3rd', 'Perfect 5th'], difficulty: 1 },
    { id: 'chord_E_Minor', root: 'E', type: 'Minor', notes: ['E', 'G', 'B'], intervals: ['Root', 'Minor 3rd', 'Perfect 5th'], difficulty: 1 },
    { id: 'chord_D_Minor', root: 'D', type: 'Minor', notes: ['D', 'F', 'A'], intervals: ['Root', 'Minor 3rd', 'Perfect 5th'], difficulty: 1 },
    { id: 'chord_B_Minor', root: 'B', type: 'Minor', notes: ['B', 'D', 'F#'], intervals: ['Root', 'Minor 3rd', 'Perfect 5th'], difficulty: 2 },
    { id: 'chord_F#_Minor', root: 'F#', type: 'Minor', notes: ['F#', 'A', 'C#'], intervals: ['Root', 'Minor 3rd', 'Perfect 5th'], difficulty: 2 },
    { id: 'chord_C_Minor', root: 'C', type: 'Minor', notes: ['C', 'Eb', 'G'], intervals: ['Root', 'Minor 3rd', 'Perfect 5th'], difficulty: 2 },

    // Dominant 7th
    { id: 'chord_G7', root: 'G', type: 'Dominant 7th', notes: ['G', 'B', 'D', 'F'], intervals: ['Root', 'Major 3rd', 'Perfect 5th', 'Minor 7th'], difficulty: 2 },
    { id: 'chord_C7', root: 'C', type: 'Dominant 7th', notes: ['C', 'E', 'G', 'Bb'], intervals: ['Root', 'Major 3rd', 'Perfect 5th', 'Minor 7th'], difficulty: 2 },
    { id: 'chord_D7', root: 'D', type: 'Dominant 7th', notes: ['D', 'F#', 'A', 'C'], intervals: ['Root', 'Major 3rd', 'Perfect 5th', 'Minor 7th'], difficulty: 2 },
    { id: 'chord_A7', root: 'A', type: 'Dominant 7th', notes: ['A', 'C#', 'E', 'G'], intervals: ['Root', 'Major 3rd', 'Perfect 5th', 'Minor 7th'], difficulty: 2 },
    { id: 'chord_E7', root: 'E', type: 'Dominant 7th', notes: ['E', 'G#', 'B', 'D'], intervals: ['Root', 'Major 3rd', 'Perfect 5th', 'Minor 7th'], difficulty: 2 },

    // Major 7th
    { id: 'chord_Cmaj7', root: 'C', type: 'Major 7th', notes: ['C', 'E', 'G', 'B'], intervals: ['Root', 'Major 3rd', 'Perfect 5th', 'Major 7th'], difficulty: 2 },
    { id: 'chord_Fmaj7', root: 'F', type: 'Major 7th', notes: ['F', 'A', 'C', 'E'], intervals: ['Root', 'Major 3rd', 'Perfect 5th', 'Major 7th'], difficulty: 2 },
    { id: 'chord_Gmaj7', root: 'G', type: 'Major 7th', notes: ['G', 'B', 'D', 'F#'], intervals: ['Root', 'Major 3rd', 'Perfect 5th', 'Major 7th'], difficulty: 3 },
    { id: 'chord_Dmaj7', root: 'D', type: 'Major 7th', notes: ['D', 'F#', 'A', 'C#'], intervals: ['Root', 'Major 3rd', 'Perfect 5th', 'Major 7th'], difficulty: 3 },

    // Minor 7th
    { id: 'chord_Am7', root: 'A', type: 'Minor 7th', notes: ['A', 'C', 'E', 'G'], intervals: ['Root', 'Minor 3rd', 'Perfect 5th', 'Minor 7th'], difficulty: 2 },
    { id: 'chord_Dm7', root: 'D', type: 'Minor 7th', notes: ['D', 'F', 'A', 'C'], intervals: ['Root', 'Minor 3rd', 'Perfect 5th', 'Minor 7th'], difficulty: 2 },
    { id: 'chord_Em7', root: 'E', type: 'Minor 7th', notes: ['E', 'G', 'B', 'D'], intervals: ['Root', 'Minor 3rd', 'Perfect 5th', 'Minor 7th'], difficulty: 2 },
    { id: 'chord_Bm7', root: 'B', type: 'Minor 7th', notes: ['B', 'D', 'F#', 'A'], intervals: ['Root', 'Minor 3rd', 'Perfect 5th', 'Minor 7th'], difficulty: 3 },

    // Diminished
    { id: 'chord_Bdim', root: 'B', type: 'Diminished', notes: ['B', 'D', 'F'], intervals: ['Root', 'Minor 3rd', 'Diminished 5th'], difficulty: 3 },
    { id: 'chord_F#dim', root: 'F#', type: 'Diminished', notes: ['F#', 'A', 'C'], intervals: ['Root', 'Minor 3rd', 'Diminished 5th'], difficulty: 3 },
    { id: 'chord_C#dim', root: 'C#', type: 'Diminished', notes: ['C#', 'E', 'G'], intervals: ['Root', 'Minor 3rd', 'Diminished 5th'], difficulty: 3 },

    // Half-Diminished 7th
    { id: 'chord_Bm7b5', root: 'B', type: 'Half-Diminished 7th', notes: ['B', 'D', 'F', 'A'], intervals: ['Root', 'Minor 3rd', 'Diminished 5th', 'Minor 7th'], difficulty: 4 },
    { id: 'chord_F#m7b5', root: 'F#', type: 'Half-Diminished 7th', notes: ['F#', 'A', 'C', 'E'], intervals: ['Root', 'Minor 3rd', 'Diminished 5th', 'Minor 7th'], difficulty: 4 },

    // Augmented
    { id: 'chord_Caug', root: 'C', type: 'Augmented', notes: ['C', 'E', 'G#'], intervals: ['Root', 'Major 3rd', 'Augmented 5th'], difficulty: 3 },
    { id: 'chord_Gaug', root: 'G', type: 'Augmented', notes: ['G', 'B', 'D#'], intervals: ['Root', 'Major 3rd', 'Augmented 5th'], difficulty: 3 },

    // Sus chords
    { id: 'chord_Csus4', root: 'C', type: 'Sus4', notes: ['C', 'F', 'G'], intervals: ['Root', 'Perfect 4th', 'Perfect 5th'], difficulty: 2 },
    { id: 'chord_Dsus4', root: 'D', type: 'Sus4', notes: ['D', 'G', 'A'], intervals: ['Root', 'Perfect 4th', 'Perfect 5th'], difficulty: 2 },
    { id: 'chord_Gsus4', root: 'G', type: 'Sus4', notes: ['G', 'C', 'D'], intervals: ['Root', 'Perfect 4th', 'Perfect 5th'], difficulty: 2 },
    { id: 'chord_Csus2', root: 'C', type: 'Sus2', notes: ['C', 'D', 'G'], intervals: ['Root', 'Major 2nd', 'Perfect 5th'], difficulty: 2 },

    // 9th chords
    { id: 'chord_C9', root: 'C', type: 'Dominant 9th', notes: ['C', 'E', 'G', 'Bb', 'D'], intervals: ['Root', 'Major 3rd', 'Perfect 5th', 'Minor 7th', 'Major 9th'], difficulty: 4 },
    { id: 'chord_Cmaj9', root: 'C', type: 'Major 9th', notes: ['C', 'E', 'G', 'B', 'D'], intervals: ['Root', 'Major 3rd', 'Perfect 5th', 'Major 7th', 'Major 9th'], difficulty: 4 },
    { id: 'chord_Am9', root: 'A', type: 'Minor 9th', notes: ['A', 'C', 'E', 'G', 'B'], intervals: ['Root', 'Minor 3rd', 'Perfect 5th', 'Minor 7th', 'Major 9th'], difficulty: 4 }
];

// ===========================================
// INTERVAL RECOGNITION CARDS
// ===========================================

/**
 * Interval recognition flashcards
 * Front: "What interval is [note1] to [note2]?"
 * Back: Interval name and half steps
 */
const INTERVAL_CARDS = [
    // Minor 2nd (1 half step)
    { id: 'interval_C_Db', note1: 'C', note2: 'Db', interval: 'Minor 2nd', halfSteps: 1, difficulty: 2 },
    { id: 'interval_E_F', note1: 'E', note2: 'F', interval: 'Minor 2nd', halfSteps: 1, difficulty: 1 },
    { id: 'interval_B_C', note1: 'B', note2: 'C', interval: 'Minor 2nd', halfSteps: 1, difficulty: 1 },

    // Major 2nd (2 half steps)
    { id: 'interval_C_D', note1: 'C', note2: 'D', interval: 'Major 2nd', halfSteps: 2, difficulty: 1 },
    { id: 'interval_G_A', note1: 'G', note2: 'A', interval: 'Major 2nd', halfSteps: 2, difficulty: 1 },
    { id: 'interval_D_E', note1: 'D', note2: 'E', interval: 'Major 2nd', halfSteps: 2, difficulty: 1 },

    // Minor 3rd (3 half steps)
    { id: 'interval_C_Eb', note1: 'C', note2: 'Eb', interval: 'Minor 3rd', halfSteps: 3, difficulty: 1 },
    { id: 'interval_A_C', note1: 'A', note2: 'C', interval: 'Minor 3rd', halfSteps: 3, difficulty: 1 },
    { id: 'interval_E_G', note1: 'E', note2: 'G', interval: 'Minor 3rd', halfSteps: 3, difficulty: 1 },
    { id: 'interval_D_F', note1: 'D', note2: 'F', interval: 'Minor 3rd', halfSteps: 3, difficulty: 1 },

    // Major 3rd (4 half steps)
    { id: 'interval_C_E', note1: 'C', note2: 'E', interval: 'Major 3rd', halfSteps: 4, difficulty: 1 },
    { id: 'interval_G_B', note1: 'G', note2: 'B', interval: 'Major 3rd', halfSteps: 4, difficulty: 1 },
    { id: 'interval_F_A', note1: 'F', note2: 'A', interval: 'Major 3rd', halfSteps: 4, difficulty: 1 },

    // Perfect 4th (5 half steps)
    { id: 'interval_C_F', note1: 'C', note2: 'F', interval: 'Perfect 4th', halfSteps: 5, difficulty: 1 },
    { id: 'interval_G_C', note1: 'G', note2: 'C', interval: 'Perfect 4th', halfSteps: 5, difficulty: 1 },
    { id: 'interval_D_G', note1: 'D', note2: 'G', interval: 'Perfect 4th', halfSteps: 5, difficulty: 1 },

    // Tritone (6 half steps)
    { id: 'interval_C_Gb', note1: 'C', note2: 'Gb', interval: 'Tritone', halfSteps: 6, difficulty: 2 },
    { id: 'interval_F_B', note1: 'F', note2: 'B', interval: 'Tritone', halfSteps: 6, difficulty: 2 },
    { id: 'interval_B_F', note1: 'B', note2: 'F', interval: 'Tritone', halfSteps: 6, difficulty: 2 },

    // Perfect 5th (7 half steps)
    { id: 'interval_C_G', note1: 'C', note2: 'G', interval: 'Perfect 5th', halfSteps: 7, difficulty: 1 },
    { id: 'interval_D_A', note1: 'D', note2: 'A', interval: 'Perfect 5th', halfSteps: 7, difficulty: 1 },
    { id: 'interval_G_D', note1: 'G', note2: 'D', interval: 'Perfect 5th', halfSteps: 7, difficulty: 1 },
    { id: 'interval_A_E', note1: 'A', note2: 'E', interval: 'Perfect 5th', halfSteps: 7, difficulty: 1 },

    // Minor 6th (8 half steps)
    { id: 'interval_C_Ab', note1: 'C', note2: 'Ab', interval: 'Minor 6th', halfSteps: 8, difficulty: 2 },
    { id: 'interval_E_C', note1: 'E', note2: 'C', interval: 'Minor 6th', halfSteps: 8, difficulty: 2 },

    // Major 6th (9 half steps)
    { id: 'interval_C_A', note1: 'C', note2: 'A', interval: 'Major 6th', halfSteps: 9, difficulty: 2 },
    { id: 'interval_G_E', note1: 'G', note2: 'E', interval: 'Major 6th', halfSteps: 9, difficulty: 2 },
    { id: 'interval_F_D', note1: 'F', note2: 'D', interval: 'Major 6th', halfSteps: 9, difficulty: 2 },

    // Minor 7th (10 half steps)
    { id: 'interval_C_Bb', note1: 'C', note2: 'Bb', interval: 'Minor 7th', halfSteps: 10, difficulty: 2 },
    { id: 'interval_G_F', note1: 'G', note2: 'F', interval: 'Minor 7th', halfSteps: 10, difficulty: 2 },
    { id: 'interval_D_C', note1: 'D', note2: 'C', interval: 'Minor 7th', halfSteps: 10, difficulty: 2 },

    // Major 7th (11 half steps)
    { id: 'interval_C_B', note1: 'C', note2: 'B', interval: 'Major 7th', halfSteps: 11, difficulty: 2 },
    { id: 'interval_F_E', note1: 'F', note2: 'E', interval: 'Major 7th', halfSteps: 11, difficulty: 2 },
    { id: 'interval_G_F#', note1: 'G', note2: 'F#', interval: 'Major 7th', halfSteps: 11, difficulty: 3 },

    // Octave (12 half steps)
    { id: 'interval_C_C8', note1: 'C', note2: 'C (octave)', interval: 'Perfect Octave', halfSteps: 12, difficulty: 1 }
];

// ===========================================
// PROGRESSION COMPLETION CARDS
// ===========================================

/**
 * Progression completion flashcards
 * Front: "Complete: ii - V - ?" or "I - ? - vi - IV"
 * Back: Missing chord(s) with explanation
 */
const PROGRESSION_CARDS = [
    // ii-V-I patterns - The most important progression in Western music
    {
        id: 'prog_iiVI_C', key: 'C', progression: ['ii', 'V', '?'], answer: 'I', answerChord: 'C',
        patternName: 'ii-V-I Cadence',
        hint: 'V wants to resolve home',
        explanation: 'The ii-V-I is the strongest cadential motion in music. The V chord contains a tritone (B-F in C major) that creates tension demanding resolution to I.',
        difficulty: 1
    },
    {
        id: 'prog_iiVI_G', key: 'G', progression: ['ii', 'V', '?'], answer: 'I', answerChord: 'G',
        patternName: 'ii-V-I Cadence',
        hint: 'This is the most common jazz ending',
        explanation: 'ii-V-I appears in virtually every jazz standard. The ii chord (Am) sets up the V (D), which resolves to I (G).',
        difficulty: 1
    },
    {
        id: 'prog_iiVI_F', key: 'F', progression: ['ii', 'V', '?'], answer: 'I', answerChord: 'F',
        patternName: 'ii-V-I Cadence',
        hint: 'Where does dominant tension resolve?',
        explanation: 'The V chord (C) creates dominant tension that naturally resolves to the tonic (F). This is called an "authentic cadence".',
        difficulty: 1
    },

    // I-IV-V-I patterns - Classic rock/folk/country
    {
        id: 'prog_IVVI_C', key: 'C', progression: ['I', 'IV', 'V', '?'], answer: 'I', answerChord: 'C',
        patternName: 'I-IV-V-I (Three Chord Song)',
        hint: 'The song needs to end - where\'s home?',
        explanation: 'I-IV-V-I is the foundation of rock, folk, and country music. V→I is the "authentic cadence" - the strongest resolution in tonal music.',
        difficulty: 1
    },
    {
        id: 'prog_I?VI_C', key: 'C', progression: ['I', '?', 'V', 'I'], answer: 'IV', answerChord: 'F',
        patternName: 'I-IV-V-I (Three Chord Song)',
        hint: 'What chord prepares the dominant?',
        explanation: 'IV (subdominant) commonly moves to V. This IV→V motion is called "pre-dominant" function - it sets up the tension before resolution.',
        difficulty: 1
    },

    // Pop progressions - Modern hits
    {
        id: 'prog_IVviIV_C', key: 'C', progression: ['I', 'V', 'vi', '?'], answer: 'IV', answerChord: 'F',
        patternName: 'I-V-vi-IV (Pop Progression)',
        hint: 'Think "Let It Be", "No Woman No Cry", hundreds of pop songs...',
        explanation: 'This is the famous "Axis of Awesome" progression used in countless hits. It loops back to I via the plagal sound of IV→I.',
        difficulty: 1
    },
    {
        id: 'prog_viIVIV_C', key: 'C', progression: ['vi', 'IV', 'I', '?'], answer: 'V', answerChord: 'G',
        patternName: 'vi-IV-I-V (Emotional Pop)',
        hint: 'The progression needs to loop back to vi',
        explanation: 'Starting on vi gives a melancholic feel. V at the end creates tension that resolves when the progression loops back to vi.',
        difficulty: 2
    },

    // Jazz turnarounds
    {
        id: 'prog_I_vi_ii_V', key: 'C', progression: ['I', 'vi', 'ii', '?'], answer: 'V', answerChord: 'G',
        patternName: 'I-vi-ii-V (Jazz Turnaround)',
        hint: 'Follow the circle of fifths: vi→ii→?',
        explanation: 'This turnaround follows the circle of fifths backwards. Each chord\'s root is a 5th below the next: C←G←D←A (I←V←ii←vi).',
        difficulty: 2
    },
    {
        id: 'prog_iii_vi_ii_V', key: 'C', progression: ['iii', 'vi', 'ii', '?'], answer: 'V', answerChord: 'G',
        patternName: 'iii-vi-ii-V (Extended Turnaround)',
        hint: 'Circle of fifths: E→A→D→?',
        explanation: 'Extended turnaround starting from iii. Root motion by 5ths: E(iii)→A(vi)→D(ii)→G(V). V then resolves to I.',
        difficulty: 3
    },

    // Deceptive cadence
    {
        id: 'prog_IV_V_?_dec', key: 'C', progression: ['IV', 'V', '?'], answer: 'vi', answerChord: 'Am',
        patternName: 'Deceptive Cadence',
        hint: 'Deceptive! V doesn\'t go where you expect...',
        explanation: 'The deceptive cadence surprises by going to vi instead of I. It works because vi shares two notes with I (C and E in C major).',
        difficulty: 3
    },

    // Modal interchange / Borrowed chords
    {
        id: 'prog_I_bVII_IV', key: 'C', progression: ['I', '?', 'IV'], answer: 'bVII', answerChord: 'Bb',
        patternName: 'Borrowed bVII',
        hint: 'Borrowed from parallel minor - think rock music',
        explanation: 'bVII (Bb in C) is borrowed from C minor. This gives a "rock" sound. Think "Sweet Child O\' Mine" or "Hey Jude".',
        difficulty: 4
    },
    {
        id: 'prog_I_bVI_bVII', key: 'C', progression: ['I', 'bVI', '?', 'I'], answer: 'bVII', answerChord: 'Bb',
        patternName: 'bVI-bVII-I (Mario Cadence)',
        hint: 'What borrowed chord leads back to I in video game music?',
        explanation: 'The "Mario cadence" (bVI-bVII-I) is iconic in video game music. Both chords are borrowed from the parallel minor.',
        difficulty: 4
    },

    // Secondary dominants
    {
        id: 'prog_V_of_V', key: 'C', progression: ['I', '?', 'V', 'I'], answer: 'V/V', answerChord: 'D',
        patternName: 'Secondary Dominant',
        hint: 'What chord "dominates" the V chord?',
        explanation: 'V/V (D major) is the "dominant of the dominant". It contains F# which pulls strongly to G. This "tonicizes" G momentarily.',
        difficulty: 4
    },

    // Blues
    {
        id: 'prog_blues_1', key: 'C', progression: ['I7', 'IV7', '?', 'V7'], answer: 'I7', answerChord: 'C7',
        patternName: '12-Bar Blues',
        hint: 'Blues form: 4 bars I, 2 bars IV, then back to...?',
        explanation: '12-bar blues structure: I7(4 bars) - IV7(2 bars) - I7(2 bars) - V7(1 bar) - IV7(1 bar) - I7(2 bars). The I7 returns after IV7.',
        difficulty: 2
    }
];

// ===========================================
// FUNCTION IDENTIFICATION CARDS
// ===========================================

/**
 * Function identification flashcards
 * Front: "In [key], what function does [chord] serve?"
 * Back: Function name with explanation
 */
const FUNCTION_CARDS = [
    // Tonic function
    { id: 'func_C_in_C', key: 'C', chord: 'C', romanNumeral: 'I', function: 'Tonic', explanation: 'The I chord is the home base, providing stability and resolution', difficulty: 1 },
    { id: 'func_Am_in_C', key: 'C', chord: 'Am', romanNumeral: 'vi', function: 'Tonic substitute', explanation: 'vi shares 2 notes with I, making it a tonic substitute', difficulty: 2 },
    { id: 'func_Em_in_C', key: 'C', chord: 'Em', romanNumeral: 'iii', function: 'Tonic substitute (weak)', explanation: 'iii can function as a weak tonic substitute, sharing notes with both I and V', difficulty: 3 },

    // Subdominant function
    { id: 'func_F_in_C', key: 'C', chord: 'F', romanNumeral: 'IV', function: 'Subdominant', explanation: 'IV creates a gentle pull away from tonic, preparing for dominant', difficulty: 1 },
    { id: 'func_Dm_in_C', key: 'C', chord: 'Dm', romanNumeral: 'ii', function: 'Subdominant (Pre-dominant)', explanation: 'ii commonly leads to V, functioning as a pre-dominant chord', difficulty: 2 },

    // Dominant function
    { id: 'func_G_in_C', key: 'C', chord: 'G', romanNumeral: 'V', function: 'Dominant', explanation: 'V creates the strongest pull back to tonic (I)', difficulty: 1 },
    { id: 'func_G7_in_C', key: 'C', chord: 'G7', romanNumeral: 'V7', function: 'Dominant', explanation: 'V7 has an even stronger pull to I due to the tritone between B and F', difficulty: 2 },
    { id: 'func_Bdim_in_C', key: 'C', chord: 'Bdim', romanNumeral: 'vii°', function: 'Dominant substitute', explanation: 'vii° shares 3 notes with V7, making it a dominant substitute', difficulty: 3 },

    // More keys
    { id: 'func_D_in_G', key: 'G', chord: 'D', romanNumeral: 'V', function: 'Dominant', explanation: 'In G major, D is the V chord with dominant function', difficulty: 1 },
    { id: 'func_Em_in_G', key: 'G', chord: 'Em', romanNumeral: 'vi', function: 'Tonic substitute', explanation: 'Em is the relative minor of G, functioning as a tonic substitute', difficulty: 2 },
    { id: 'func_C_in_G', key: 'G', chord: 'C', romanNumeral: 'IV', function: 'Subdominant', explanation: 'In G major, C is the subdominant (IV)', difficulty: 1 },
    { id: 'func_Am_in_G', key: 'G', chord: 'Am', romanNumeral: 'ii', function: 'Pre-dominant', explanation: 'Am (ii) typically moves to V (D) in a ii-V-I progression', difficulty: 2 },

    // Secondary dominants
    { id: 'func_D7_in_C', key: 'C', chord: 'D7', romanNumeral: 'V/V', function: 'Secondary Dominant', explanation: 'D7 is V/V, tonicizing G (the V chord). It contains F# which pulls to G.', difficulty: 4 },
    { id: 'func_E7_in_C', key: 'C', chord: 'E7', romanNumeral: 'V/vi', function: 'Secondary Dominant', explanation: 'E7 is V/vi, temporarily tonicizing Am. The G# pulls to A.', difficulty: 4 },
    { id: 'func_A7_in_C', key: 'C', chord: 'A7', romanNumeral: 'V/ii', function: 'Secondary Dominant', explanation: 'A7 leads strongly to Dm (ii), containing C# that pulls to D.', difficulty: 4 },

    // Modal interchange
    { id: 'func_Bb_in_C', key: 'C', chord: 'Bb', romanNumeral: 'bVII', function: 'Modal Interchange (borrowed)', explanation: 'bVII is borrowed from C minor/Mixolydian. Provides a "rock" sound.', difficulty: 4 },
    { id: 'func_Ab_in_C', key: 'C', chord: 'Ab', romanNumeral: 'bVI', function: 'Modal Interchange (borrowed)', explanation: 'bVI is borrowed from C minor. Often used in the "Mario cadence" (bVI-bVII-I).', difficulty: 4 },
    { id: 'func_Fm_in_C', key: 'C', chord: 'Fm', romanNumeral: 'iv', function: 'Modal Interchange (borrowed)', explanation: 'iv (minor iv) is borrowed from C minor. Creates a darker subdominant.', difficulty: 3 }
];

// ===========================================
// CARD GETTERS
// ===========================================

/**
 * Get all cards for a category
 * @param {string} category - Category from CARD_CATEGORIES
 * @returns {Array} Array of card objects
 */
export function getCardsByCategory(category) {
    switch (category) {
        case CARD_CATEGORIES.CHORD_BUILDING:
            return CHORD_BUILDING_CARDS;
        case CARD_CATEGORIES.INTERVAL_RECOGNITION:
            return INTERVAL_CARDS;
        case CARD_CATEGORIES.PROGRESSION_COMPLETION:
            return PROGRESSION_CARDS;
        case CARD_CATEGORIES.FUNCTION_IDENTIFICATION:
            return FUNCTION_CARDS;
        default:
            return [];
    }
}

/**
 * Get a specific card by ID
 * @param {string} cardId - The card ID
 * @returns {Object|null} Card object or null if not found
 */
export function getCardById(cardId) {
    // Determine category from ID prefix
    if (cardId.startsWith('chord_')) {
        return CHORD_BUILDING_CARDS.find(c => c.id === cardId) || null;
    }
    if (cardId.startsWith('interval_')) {
        return INTERVAL_CARDS.find(c => c.id === cardId) || null;
    }
    if (cardId.startsWith('prog_')) {
        return PROGRESSION_CARDS.find(c => c.id === cardId) || null;
    }
    if (cardId.startsWith('func_')) {
        return FUNCTION_CARDS.find(c => c.id === cardId) || null;
    }
    return null;
}

/**
 * Get cards filtered by difficulty
 * @param {string} category - Category from CARD_CATEGORIES
 * @param {number} maxDifficulty - Maximum difficulty level (1-5)
 * @returns {Array} Filtered array of cards
 */
export function getCardsByDifficulty(category, maxDifficulty) {
    const cards = getCardsByCategory(category);
    return cards.filter(c => c.difficulty <= maxDifficulty);
}

/**
 * Get all card IDs for a category
 * @param {string} category - Category from CARD_CATEGORIES
 * @returns {Array<string>} Array of card IDs
 */
export function getCardIds(category) {
    return getCardsByCategory(category).map(c => c.id);
}

/**
 * Get random cards from a category
 * @param {string} category - Category from CARD_CATEGORIES
 * @param {number} count - Number of cards to return
 * @param {number} maxDifficulty - Maximum difficulty (optional)
 * @returns {Array} Random selection of cards
 */
export function getRandomCards(category, count, maxDifficulty = 5) {
    const cards = getCardsByDifficulty(category, maxDifficulty);
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

/**
 * Get category info
 */
export function getCategoryInfo(category) {
    const cards = getCardsByCategory(category);
    const byDifficulty = {};
    cards.forEach(c => {
        byDifficulty[c.difficulty] = (byDifficulty[c.difficulty] || 0) + 1;
    });

    return {
        totalCards: cards.length,
        byDifficulty
    };
}

/**
 * Get all categories with their info
 */
export function getAllCategoriesInfo() {
    return {
        [CARD_CATEGORIES.CHORD_BUILDING]: {
            name: 'Chord Building',
            icon: '🎹',
            description: 'Build chords from their component notes',
            ...getCategoryInfo(CARD_CATEGORIES.CHORD_BUILDING)
        },
        [CARD_CATEGORIES.INTERVAL_RECOGNITION]: {
            name: 'Interval Recognition',
            icon: '📏',
            description: 'Identify the distance between two notes',
            ...getCategoryInfo(CARD_CATEGORIES.INTERVAL_RECOGNITION)
        },
        [CARD_CATEGORIES.PROGRESSION_COMPLETION]: {
            name: 'Common Progressions',
            icon: '🔗',
            description: 'Learn common chord patterns like ii-V-I',
            ...getCategoryInfo(CARD_CATEGORIES.PROGRESSION_COMPLETION)
        },
        [CARD_CATEGORIES.FUNCTION_IDENTIFICATION]: {
            name: 'Function Identification',
            icon: '🎯',
            description: 'Identify harmonic function of chords',
            ...getCategoryInfo(CARD_CATEGORIES.FUNCTION_IDENTIFICATION)
        }
    };
}

export default {
    CHORD_BUILDING_CARDS,
    INTERVAL_CARDS,
    PROGRESSION_CARDS,
    FUNCTION_CARDS,
    getCardsByCategory,
    getCardById,
    getCardsByDifficulty,
    getCardIds,
    getRandomCards,
    getCategoryInfo,
    getAllCategoriesInfo
};
