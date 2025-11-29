// --- GLOBAL DATA CONSTANTS ---

const ALL_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTES =  ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "Cb"];

const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11];

const ROMAN_MAP_BASE = {
    'I': { index: 0, quality: 'Major' }, 'ii': { index: 1, quality: 'Minor' },
    'iii': { index: 2, quality: 'Minor' }, 'IV': { index: 3, quality: 'Major' },
    'V': { index: 4, quality: 'Major' }, 'vi': { index: 5, quality: 'Minor' },
    'vii°': { index: 6, quality: 'Diminished' },
    'i': { index: 0, quality: 'Minor' }, 'iv': { index: 3, quality: 'Minor' },
};

const COMMON_PROGRESSIONS = {
    'I-IV-V-I (Basic)': ['I', 'IV', 'V', 'I'],
    'I-vi-IV-V (Doo-wop/50s)': ['I', 'vi', 'IV', 'V'],
    'ii-V-I (Jazz Turnaround)': ['ii', 'V', 'I'],
    'I-V-vi-IV (Pop Progression)': ['I', 'V', 'vi', 'IV'],
    'vi-IV-I-V (A variation)': ['vi', 'IV', 'I', 'V'],
    'I-IV-V (Blues/Folk)': ['I', 'IV', 'V'],
    'I-IV-I-V-I': ['I', 'IV', 'I', 'V', 'I'],
    'i-iv-V-i (Minor)': ['i', 'iv', 'V', 'i'],
    'i-iv-V (Minor Basic)': ['i', 'iv', 'V'],
    // Extended progression templates
    '12-Bar Blues (I)': ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'I'],
    '12-Bar Blues (i)': ['i', 'i', 'i', 'i', 'iv', 'iv', 'i', 'i', 'V', 'iv', 'i', 'i'],
    'I-vi-ii-V (Jazz)': ['I', 'vi', 'ii', 'V'],
    'I-iii-vi-ii-V-I (Circle Progression)': ['I', 'iii', 'vi', 'ii', 'V', 'I'],
    'vi-IV-I-V (Minor Pop)': ['vi', 'IV', 'I', 'V'],
    'I-bVII-IV-I (Rock)': ['I', 'bVII', 'IV', 'I'],
    'I-vi-IV-V-I (Classic)': ['I', 'vi', 'IV', 'V', 'I'],
    'ii-vi-IV-V (Alternative)': ['ii', 'vi', 'IV', 'V'],
};

const CHORD_DEFINITIONS = {
    'Major': { intervals: [0, 4, 7], symbol: '', description: 'The foundation triad: Root, Major 3rd, Perfect 5th. All other chords are built from or compared to this. Sounds bright and happy.' },
    'Minor': { intervals: [0, 3, 7], symbol: 'm', description: 'Lowers the 3rd tone of the major triad by a half step (Root, Minor 3rd, Perfect 5th). Creates a sadder, darker sound.' },
    'Diminished': { intervals: [0, 3, 6], symbol: 'dim', description: 'Lowers both the 3rd and 5th tones of the major triad by a half step each (Root, Minor 3rd, Diminished 5th). Sounds tense and unstable.' },
    'Augmented': { intervals: [0, 4, 8], symbol: 'aug', description: 'Raises the 5th tone of the major triad by a half step (Root, Major 3rd, Augmented 5th). Sounds dissonant and dramatic.' },
    'Sus2': { intervals: [0, 2, 7], symbol: 'sus2', description: 'Replaces the 3rd of a major triad with a Major 2nd (Root, Major 2nd, Perfect 5th). The 3rd is removed and replaced, creating an open, unresolved sound.' },
    'Sus4': { intervals: [0, 5, 7], symbol: 'sus4', description: 'Replaces the 3rd of a major triad with a Perfect 4th (Root, Perfect 4th, Perfect 5th). The 3rd is removed and replaced, creating tension that wants to resolve.' },
    'Dominant 7th': { intervals: [0, 4, 7, 10], symbol: '7', description: 'A major triad with a minor 7th added (R, M3, P5, m7). The 7th is a half step below the octave. Creates strong tension, often used to lead back to the tonic.' },
    'Major 7th': { intervals: [0, 4, 7, 11], symbol: 'maj7', description: 'A major triad with a major 7th added (R, M3, P5, M7). The 7th is a half step below the octave. Sounds jazzy, bright, and thoughtful.' },
    'Minor 7th': { intervals: [0, 3, 7, 10], symbol: 'm7', description: 'A minor triad with a minor 7th added (R, m3, P5, m7). Lowers both the 3rd and adds a minor 7th. Sounds soulful and mellow.' },
    'Minor-Major 7th': { intervals: [0, 3, 7, 11], symbol: 'm(maj7)', description: 'A minor triad with a major 7th added (R, m3, P5, M7). Lowers the 3rd but keeps the major 7th. Sounds mysterious and complex, often used in film scores.' },
    'Diminished 7th': { intervals: [0, 3, 6, 9], symbol: 'dim7', description: 'A diminished triad with a diminished 7th added (R, m3, d5, d7). Lowers the 3rd, 5th, and 7th by a half step each from major. Extremely tense and dissonant.' },
    'Half-Diminished 7th': { intervals: [0, 3, 6, 10], symbol: 'm7b5', description: 'A diminished triad with a minor 7th added (R, m3, d5, m7). Lowers the 3rd and 5th, but uses a minor 7th (not diminished). Common in jazz, sounds tense but less harsh than a dim7.' },
    'Augmented 7th': { intervals: [0, 4, 8, 10], symbol: 'aug7', description: 'An augmented triad with a minor 7th added (R, M3, A5, m7). Raises the 5th and adds a minor 7th. A very dissonant dominant chord.' },
    'Major 6th': { intervals: [0, 4, 7, 9], symbol: '6', description: 'A major triad with a major 6th added (R, M3, P5, M6). Adds the 6th scale degree. Sounds sweet and a bit retro.' },
    'Minor 6th': { intervals: [0, 3, 7, 9], symbol: 'm6', description: 'A minor triad with a major 6th added (R, m3, P5, M6). Lowers the 3rd and adds a major 6th. Sounds sophisticated and slightly melancholic.' },
    'Add9': { intervals: [0, 4, 7, 14], symbol: 'add9', description: 'A major triad with a 9th added (R, M3, P5, M9). The 9th is an octave plus a major 2nd. Sounds open and modern.' },
    'Major 9th': { intervals: [0, 4, 7, 11, 14], symbol: 'maj9', description: 'A major 7th chord with a 9th added (R, M3, P5, M7, M9). Adds both the major 7th and 9th to a major triad. Sounds lush, rich, and jazzy.' },
    'Dominant 9th': { intervals: [0, 4, 7, 10, 14], symbol: '9', description: 'A dominant 7th chord with a 9th added (R, M3, P5, m7, M9). Adds a minor 7th and 9th to a major triad. Common in blues and funk.' },
    'Minor 9th': { intervals: [0, 3, 7, 10, 14], symbol: 'm9', description: 'A minor 7th chord with a 9th added (R, m3, P5, m7, M9). Lowers the 3rd and adds a minor 7th and 9th. Sounds smooth and soulful.' },
    '6/9': { intervals: [0, 4, 7, 9, 14], symbol: '6/9', description: 'A major triad with both a 6th and 9th added (R, M3, P5, M6, M9). Adds the 6th and 9th scale degrees. A rich, static jazz chord.' },
    'Dominant 11th': { intervals: [0, 4, 7, 10, 14, 17], symbol: '11', description: 'A dominant 9th chord with an 11th added (R, M3, P5, m7, M9, P11). Adds 7th, 9th, and 11th to a major triad. Common in jazz with a suspended quality.' },
    'Minor 11th': { intervals: [0, 3, 7, 10, 14, 17], symbol: 'm11', description: 'A minor 9th chord with an 11th added (R, m3, P5, m7, M9, P11). Lowers the 3rd and adds 7th, 9th, and 11th. Rich and complex sound common in jazz.' },
    'Dominant 13th': { intervals: [0, 4, 7, 10, 14, 21], symbol: '13', description: 'A dominant 7th chord with a 9th and 13th added (R, M3, P5, m7, M9, M13). Adds 7th, 9th, and 13th to a major triad. Very rich jazz sound, often with 11th omitted.' },
    '7b5': { intervals: [0, 4, 6, 10], symbol: '7b5', description: 'A dominant 7th chord with a flatted 5th (R, M3, b5, m7). Lowers the 5th by a half step from a regular dominant 7th. An altered dominant chord creating strong tension.' },
    '7#5': { intervals: [0, 4, 8, 10], symbol: '7#5', description: 'A dominant 7th chord with a sharped 5th (R, M3, #5, m7). Raises the 5th by a half step from a regular dominant 7th. An altered dominant chord creating strong tension.' },
    '7b9': { intervals: [0, 4, 7, 10, 13], symbol: '7b9', description: 'A dominant 7th chord with a flatted 9th (R, M3, P5, m7, b9). Lowers the 9th by a half step. A very common and tense altered dominant chord in jazz.' },
    '7#9': { intervals: [0, 4, 7, 10, 15], symbol: '7#9', description: 'A dominant 7th chord with a sharped 9th (R, M3, P5, m7, #9). Raises the 9th by a half step. Also known as the "Hendrix chord".' },
    'Power Chord': { intervals: [0, 7], symbol: '5', description: 'Contains only the root and the 5th (R, P5). The 3rd is omitted, making it neither major nor minor. Common in rock music.' },
};

const INVERSION_NAMES = ['Root', '1st', '2nd', '3rd', '4th', '5th'];

const INTERVAL_DEFINITIONS = {
    'Major 2nd': { intervals: [0, 2], symbol: 'M2', description: 'Two semitones (a whole step). The distance from the root to the 2nd scale degree. Example: C to D. Used in Sus2 chords.' },
    'Minor 2nd': { intervals: [0, 1], symbol: 'm2', description: 'One semitone (a half step). The smallest interval in Western music. Creates strong dissonance. Example: C to C#. Also called a semitone.' },
    'Major 3rd': { intervals: [0, 4], symbol: 'M3', description: 'Four semitones. The distance from the root to the 3rd scale degree. A key component of major chords. Example: C to E. This is what makes a chord "major".' },
    'Minor 3rd': { intervals: [0, 3], symbol: 'm3', description: 'Three semitones. One semitone smaller than a Major 3rd. A key component of minor chords. Example: C to Eb. This is what makes a chord "minor".' },
    'Perfect 4th': { intervals: [0, 5], symbol: 'P4', description: 'Five semitones. The distance from the root to the 4th scale degree. A stable, consonant interval. Example: C to F. Used in Sus4 chords.' },
    'Tritone': { intervals: [0, 6], symbol: 'TT', description: 'Six semitones (three whole steps, hence "tritone"). Exactly half an octave. A highly dissonant and unstable interval. Example: C to F#. Creates strong tension that wants to resolve.' },
    'Perfect 5th': { intervals: [0, 7], symbol: 'P5', description: 'Seven semitones. The distance from the root to the 5th scale degree. A very stable and powerful interval, forms the basis of most chords. Example: C to G. Present in almost all chords.' },
    'Major 6th': { intervals: [0, 9], symbol: 'M6', description: 'Nine semitones. The distance from the root to the 6th scale degree. A sweet, consonant interval. Example: C to A. Used in 6th chords and 6/9 chords.' },
    'Minor 6th': { intervals: [0, 8], symbol: 'm6', description: 'Eight semitones. One semitone smaller than a Major 6th. A somewhat melancholic interval. Example: C to Ab. Less common than the major 6th.' },
    'Major 7th': { intervals: [0, 11], symbol: 'M7', description: 'Eleven semitones. One semitone below the octave. The distance from the root to the 7th scale degree in a major scale. A bright, slightly dissonant interval. Example: C to B. Used in Major 7th chords.' },
    'Minor 7th': { intervals: [0, 10], symbol: 'm7', description: 'Ten semitones. Two semitones below the octave. One semitone smaller than a Major 7th. A "bluesy" and very common interval. Example: C to Bb. Used in dominant 7th and minor 7th chords.' },
    'Octave': { intervals: [0, 12], symbol: 'P8', description: 'Twelve semitones. The same note at a higher pitch. The most consonant interval after unison. Example: C4 to C5. All intervals beyond this are "compound" intervals (octave + another interval).' },
    'Major 9th': { intervals: [0, 14], symbol: 'M9', description: 'Fourteen semitones. An octave plus a Major 2nd (12 + 2 = 14 semitones). Used in extended chords like Major 9th. Example: C4 to D5.' },
    'Minor 9th': { intervals: [0, 13], symbol: 'm9', description: 'Thirteen semitones. An octave plus a Minor 2nd (12 + 1 = 13 semitones). Used in altered dominant chords like 7b9. Example: C4 to Db5.' },
};

const CHORD_GROUPS = [
    { title: 'Triads', types: ['Major', 'Minor', 'Augmented', 'Diminished', 'Sus2', 'Sus4', 'Power Chord'] },
    { title: 'Sevenths', types: ['Dominant 7th', 'Major 7th', 'Minor 7th', 'Half-Diminished 7th', 'Diminished 7th', 'Minor-Major 7th'] },
    { title: 'Ninths', types: ['Major 9th', 'Dominant 9th', 'Minor 9th', '6/9', 'Add9'] },
    { title: 'Extended', types: ['Dominant 11th', 'Minor 11th', 'Dominant 13th'] },
    { title: 'Altered', types: ['Augmented 7th', '7b5', '7#5', '7b9', '7#9'] },
];

const INTERVAL_GROUPS = [
    { title: '2nds', types: ['Major 2nd', 'Minor 2nd'] }, { title: '3rds', types: ['Major 3rd', 'Minor 3rd'] },
    { title: '4ths & 5ths', types: ['Perfect 4th', 'Tritone', 'Perfect 5th'] }, { title: '6ths', types: ['Major 6th', 'Minor 6th'] },
    { title: '7ths', types: ['Major 7th', 'Minor 7th'] }, { title: 'Compound', types: ['Octave', 'Major 9th', 'Minor 9th'] }
];

const SCALE_DEFINITIONS = {
    'Major (Ionian)': { intervals: [0, 2, 4, 5, 7, 9, 11] }, 'Natural Minor (Aeolian)': { intervals: [0, 2, 3, 5, 7, 8, 10] },
    'Harmonic Minor': { intervals: [0, 2, 3, 5, 7, 8, 11] }, 'Melodic Minor': { intervals: [0, 2, 3, 5, 7, 9, 11] },
    'Major Pentatonic': { intervals: [0, 2, 4, 7, 9] }, 'Minor Pentatonic': { intervals: [0, 3, 5, 7, 10] },
    'Blues': { intervals: [0, 3, 5, 6, 7, 10] }, 'Dorian (Mode 2)': { intervals: [0, 2, 3, 5, 7, 9, 10] },
    'Phrygian (Mode 3)': { intervals: [0, 1, 3, 5, 7, 8, 10] }, 'Lydian (Mode 4)': { intervals: [0, 2, 4, 6, 7, 9, 11] },
    'Mixolydian (Mode 5)': { intervals: [0, 2, 4, 5, 7, 9, 10] }, 'Locrian (Mode 7)': { intervals: [0, 1, 3, 5, 6, 8, 10] },
    'Whole Tone': { intervals: [0, 2, 4, 6, 8, 10] }, 'Diminished (WH)': { intervals: [0, 1, 3, 4, 6, 7, 9, 10] },
    'Chromatic': { intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
};

const ENHARMONIC_MAP = {
    'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
    'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
    'B': 'Cb', 'Cb': 'B' 
};

const KEY_SIGNATURE_TEXT = {
    'C': 'No Sharps or Flats', 'G': '1 Sharp (F#)', 'D': '2 Sharps (F#, C#)', 'A': '3 Sharps (F#, C#, G#)', 'E': '4 Sharps (F#, C#, G#, D#)', 'B': '5 Sharps (F#, C#, G#, D#, A#)', 'F#': '6 Sharps (F#, C#, G#, D#, A#, E#)', 'C#': '7 Sharps (F#, C#, G#, D#, A#, E#, B#)',
    'F': '1 Flat (Bb)', 'Bb': '2 Flats (Bb, Eb)', 'Eb': '3 Flats (Bb, Eb, Ab)', 'Ab': '4 Flats (Bb, Eb, Ab, Db)', 'Db': '5 Flats (Bb, Eb, Ab, Db, Gb)', 'Gb': '6 Flats (Bb, Eb, Ab, Db, Gb, Cb)', 'Cb': '7 Flats (Bb, Eb, Ab, Db, Gb, Cb, Fb)', 
    'D#': 'Enharmonic with Eb', 'G#': 'Enharmonic with Ab', 'A#': 'Enharmonic with Bb'
};

const KEY_SIGNATURE_IMAGES = {
    'C': { treble: 'treble_0.svg' },
    'G': { treble: 'treble_1s.svg' },
    'D': { treble: 'treble_2s.svg' },
    'A': { treble: 'treble_3s.svg' },
    'E': { treble: 'treble_4s.svg' },
    'B': { treble: 'treble_5s.svg' },
    'F#': { treble: 'treble_6s.svg' },
    'C#': { treble: 'treble_7s.svg' },
    'F': { treble: 'treble_1f.svg' },
    'Bb': { treble: 'treble_2f.svg' },
    'Eb': { treble: 'treble_3f.svg' },
    'Ab': { treble: 'treble_4f.svg' },
    'Db': { treble: 'treble_5f.svg' },
    'Gb': { treble: 'treble_6f.svg' },
    'Cb': { treble: 'treble_7f.svg' }
};

const RELATIVE_MINOR_MAP = {
    'C': 'A minor', 'G': 'E minor', 'D': 'B minor', 'A': 'F# minor', 'E': 'C# minor', 'B': 'G# minor', 'F#': 'D# minor', 'C#': 'A# minor',
    'F': 'D minor', 'Bb': 'G minor', 'Eb': 'C minor', 'Ab': 'F minor', 'Db': 'Bb minor', 'Gb': 'Eb minor', 'Cb': 'Ab minor',
    'D#': 'C minor', 'G#': 'F minor', 'A#': 'G minor'
};

// Diatonic chord groups for major scale
// Pattern: I=Major, ii=Minor, iii=Minor, IV=Major, V=Major, vi=Minor, vii°=Diminished
const DIATONIC_CHORD_GROUPS = [
    {
        title: 'Triads',
        chords: [
            { degree: 1, type: 'Major', roman: 'I' },
            { degree: 2, type: 'Minor', roman: 'ii' },
            { degree: 3, type: 'Minor', roman: 'iii' },
            { degree: 4, type: 'Major', roman: 'IV' },
            { degree: 5, type: 'Major', roman: 'V' },
            { degree: 6, type: 'Minor', roman: 'vi' },
            { degree: 7, type: 'Diminished', roman: 'vii°' }
        ]
    },
    {
        title: 'Sevenths',
        chords: [
            { degree: 1, type: 'Major 7th', roman: 'Imaj7' },
            { degree: 2, type: 'Minor 7th', roman: 'ii7' },
            { degree: 3, type: 'Minor 7th', roman: 'iii7' },
            { degree: 4, type: 'Major 7th', roman: 'IVmaj7' },
            { degree: 5, type: 'Dominant 7th', roman: 'V7' },
            { degree: 6, type: 'Minor 7th', roman: 'vi7' },
            { degree: 7, type: 'Half-Diminished 7th', roman: 'viiø7' }
        ]
    },
    {
        title: 'Ninths',
        chords: [
            { degree: 1, type: 'Major 9th', roman: 'Imaj9' },
            { degree: 2, type: 'Minor 9th', roman: 'ii9' },
            { degree: 3, type: 'Minor 9th', roman: 'iii9' },
            { degree: 4, type: 'Major 9th', roman: 'IVmaj9' },
            { degree: 5, type: 'Dominant 9th', roman: 'V9' },
            { degree: 6, type: 'Minor 9th', roman: 'vi9' }
        ]
    },
    {
        title: 'Extensions',
        chords: [
            { degree: 1, type: 'Add9', roman: 'Iadd9' },
            { degree: 2, type: 'Add9', roman: 'iiadd9' },
            { degree: 4, type: 'Add9', roman: 'IVadd9' },
            { degree: 5, type: 'Add9', roman: 'Vadd9' },
            { degree: 6, type: 'Add9', roman: 'viadd9' }
        ]
    }
];

/**
 * Generates diatonic chords for a given root note
 * @param {string} rootNote - The tonic note (e.g., 'C', 'D', 'F#')
 * @param {Array} noteArray - The note array to use (SHARP_NOTES or FLAT_NOTES)
 * @returns {Array} Array of chord groups with notes and types
 */
function generateDiatonicChords(rootNote, noteArray) {
    const rootIndex = noteArray.indexOf(rootNote);
    if (rootIndex === -1) return [];

    return DIATONIC_CHORD_GROUPS.map(group => {
        const chords = group.chords.map(chord => {
            const scaleIndex = MAJOR_SCALE_STEPS[chord.degree - 1];
            const chordRoot = noteArray[(rootIndex + scaleIndex) % 12];
            return {
                root: chordRoot,
                type: chord.type,
                roman: chord.roman,
                degree: chord.degree
            };
        });

        return {
            title: group.title,
            chords: chords
        };
    });
}

// Export all constants for ES6 module usage
export {
    ALL_NOTES,
    SHARP_NOTES,
    FLAT_NOTES,
    MAJOR_SCALE_STEPS,
    ROMAN_MAP_BASE,
    COMMON_PROGRESSIONS,
    CHORD_DEFINITIONS,
    INVERSION_NAMES,
    INTERVAL_DEFINITIONS,
    CHORD_GROUPS,
    INTERVAL_GROUPS,
    SCALE_DEFINITIONS,
    ENHARMONIC_MAP,
    KEY_SIGNATURE_TEXT,
    KEY_SIGNATURE_IMAGES,
    RELATIVE_MINOR_MAP,
    DIATONIC_CHORD_GROUPS,
    generateDiatonicChords
};
