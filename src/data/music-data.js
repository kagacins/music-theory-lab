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
    'Major': { intervals: [0, 4, 7], symbol: '', description: 'A standard major triad (Root, Major 3rd, Perfect 5th). Sounds bright and happy.' },
    'Minor': { intervals: [0, 3, 7], symbol: 'm', description: 'A standard minor triad (Root, Minor 3rd, Perfect 5th). The 3rd is lowered by a semitone from major, creating a sadder sound.' },
    'Diminished': { intervals: [0, 3, 6], symbol: 'dim', description: 'A minor triad with a lowered 5th (Root, Minor 3rd, Diminished 5th). Sounds tense and unstable.' },
    'Augmented': { intervals: [0, 4, 8], symbol: 'aug', description: 'A major triad with a raised 5th (Root, Major 3rd, Augmented 5th). Sounds dissonant and dramatic.' },
    'Sus2': { intervals: [0, 2, 7], symbol: 'sus2', description: 'A triad with the 3rd replaced by a Major 2nd (Root, Major 2nd, Perfect 5th). Sounds open and unresolved.' },
    'Sus4': { intervals: [0, 5, 7], symbol: 'sus4', description: 'A triad with the 3rd replaced by a Perfect 4th (Root, Perfect 4th, Perfect 5th). Sounds open and wants to resolve.' },
    'Dominant 7th': { intervals: [0, 4, 7, 10], symbol: '7', description: 'A major triad with a minor 7th (R, M3, P5, m7). Creates strong tension, often used to lead back to the tonic.' },
    'Major 7th': { intervals: [0, 4, 7, 11], symbol: 'maj7', description: 'A major triad with a major 7th (R, M3, P5, M7). Sounds jazzy, bright, and thoughtful.' },
    'Minor 7th': { intervals: [0, 3, 7, 10], symbol: 'm7', description: 'A minor triad with a minor 7th (R, m3, P5, m7). Sounds soulful and mellow.' },
    'Minor-Major 7th': { intervals: [0, 3, 7, 11], symbol: 'm(maj7)', description: 'A minor triad with a major 7th (R, m3, P5, M7). Sounds mysterious and complex, often used in film scores.' },
    'Diminished 7th': { intervals: [0, 3, 6, 9], symbol: 'dim7', description: 'A diminished triad with a diminished 7th (R, m3, d5, d7). Extremely tense and dissonant.' },
    'Half-Diminished 7th': { intervals: [0, 3, 6, 10], symbol: 'm7b5', description: 'A diminished triad with a minor 7th (R, m3, d5, m7). Common in jazz, sounds tense but less harsh than a dim7.' },
    'Augmented 7th': { intervals: [0, 4, 8, 10], symbol: 'aug7', description: 'An augmented triad with a minor 7th (R, M3, A5, m7). A very dissonant dominant chord.' },
    'Major 6th': { intervals: [0, 4, 7, 9], symbol: '6', description: 'A major triad with an added major 6th (R, M3, P5, M6). Sounds sweet and a bit retro.' },
    'Minor 6th': { intervals: [0, 3, 7, 9], symbol: 'm6', description: 'A minor triad with an added major 6th (R, m3, P5, M6). Sounds sophisticated and slightly melancholic.' },
    'Add9': { intervals: [0, 4, 7, 14], symbol: 'add9', description: 'A major triad with an added 9th (an octave plus a major 2nd). Sounds open and modern.' },
    'Major 9th': { intervals: [0, 4, 7, 11, 14], symbol: 'maj9', description: 'A major 7th chord with an added 9th. Sounds lush, rich, and jazzy.' },
    'Dominant 9th': { intervals: [0, 4, 7, 10, 14], symbol: '9', description: 'A dominant 7th chord with an added 9th. Common in blues and funk.' },
    'Minor 9th': { intervals: [0, 3, 7, 10, 14], symbol: 'm9', description: 'A minor 7th chord with an added 9th. Sounds smooth and soulful.' },
    '6/9': { intervals: [0, 4, 7, 9, 14], symbol: '6/9', description: 'A major triad with both an added 6th and 9th. A rich, static jazz chord.' },
    'Dominant 11th': { intervals: [0, 4, 7, 10, 14, 17], symbol: '11', description: 'A dominant 9th chord with an added 11th. Common in jazz with a suspended quality.' },
    'Minor 11th': { intervals: [0, 3, 7, 10, 14, 17], symbol: 'm11', description: 'A minor 9th chord with an added 11th. Rich and complex sound common in jazz.' },
    'Dominant 13th': { intervals: [0, 4, 7, 10, 14, 21], symbol: '13', description: 'A dominant 7th chord with a 9th and 13th. Very rich jazz sound, often with 11th omitted.' },
    '7b5': { intervals: [0, 4, 6, 10], symbol: '7b5', description: 'A dominant 7th chord with a flatted 5th. An altered dominant chord creating strong tension.' },
    '7#5': { intervals: [0, 4, 8, 10], symbol: '7#5', description: 'A dominant 7th chord with a sharped 5th. An altered dominant chord creating strong tension.' },
    '7b9': { intervals: [0, 4, 7, 10, 13], symbol: '7b9', description: 'A dominant 7th chord with a flatted 9th. A very common and tense altered dominant chord in jazz.' },
    '7#9': { intervals: [0, 4, 7, 10, 15], symbol: '7#9', description: 'A dominant 7th chord with a sharped 9th. Also known as the "Hendrix chord".' },
    'Power Chord': { intervals: [0, 7], symbol: '5', description: 'Contains only the root and the 5th. Neither major nor minor, common in rock music.' },
};

const INVERSION_NAMES = ['Root', '1st', '2nd', '3rd'];

const INTERVAL_DEFINITIONS = {
    'Major 2nd': { intervals: [0, 2], symbol: 'M2', description: 'Two semitones, or a whole step (e.g., C to D).' },
    'Minor 2nd': { intervals: [0, 1], symbol: 'm2', description: 'One semitone. Creates strong dissonance (e.g., C to C#).' },
    'Major 3rd': { intervals: [0, 4], symbol: 'M3', description: 'Four semitones. A key component of major chords (e.g., C to E).' },
    'Minor 3rd': { intervals: [0, 3], symbol: 'm3', description: 'Three semitones. A key component of minor chords (e.g., C to Eb).' },
    'Perfect 4th': { intervals: [0, 5], symbol: 'P4', description: 'Five semitones. A stable, consonant interval (e.g., C to F).' },
    'Tritone': { intervals: [0, 6], symbol: 'TT', description: 'Six semitones. A highly dissonant and unstable interval (e.g., C to F#).' },
    'Perfect 5th': { intervals: [0, 7], symbol: 'P5', description: 'Seven semitones. A very stable and powerful interval, forms the basis of most chords (e.g., C to G).' },
    'Major 6th': { intervals: [0, 9], symbol: 'M6', description: 'Nine semitones. A sweet, consonant interval (e.g., C to A).' },
    'Minor 6th': { intervals: [0, 8], symbol: 'm6', description: 'Eight semitones. A somewhat melancholic interval (e.g., C to Ab).' },
    'Major 7th': { intervals: [0, 11], symbol: 'M7', description: 'Eleven semitones. A bright, slightly dissonant interval (e.g., C to B).' },
    'Minor 7th': { intervals: [0, 10], symbol: 'm7', description: 'Ten semitones. A "bluesy" and very common interval (e.g., C to Bb).' },
    'Octave': { intervals: [0, 12], symbol: 'P8', description: 'Twelve semitones. The same note at a higher pitch (e.g., C4 to C5).' },
    'Major 9th': { intervals: [0, 14], symbol: 'M9', description: 'Fourteen semitones. An octave plus a Major 2nd.' },
    'Minor 9th': { intervals: [0, 13], symbol: 'm9', description: 'Thirteen semitones. An octave plus a Minor 2nd.' },
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
    RELATIVE_MINOR_MAP
};
