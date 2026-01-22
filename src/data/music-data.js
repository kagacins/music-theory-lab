// --- GLOBAL DATA CONSTANTS ---

const ALL_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTES =  ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "Cb"];

// --- CHORD ID GENERATION ---
// Each chord card gets a unique ID for tracking bass edits across reorders/inserts/removes
let _chordIdCounter = 0;

/**
 * Generate a unique chord ID
 * Format: "chord_<timestamp>_<counter>" to ensure uniqueness even across sessions
 * @returns {string} Unique chord ID
 */
function generateChordId() {
    _chordIdCounter++;
    return `chord_${Date.now()}_${_chordIdCounter}`;
}

/**
 * Ensure a chord has an ID, generating one if missing
 * @param {Object} chord - Chord object
 * @returns {Object} The chord with an ID property
 */
function ensureChordId(chord) {
    if (!chord.id) {
        chord.id = generateChordId();
    }
    return chord;
}

const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11];

const ROMAN_MAP_BASE = {
    // Diatonic major key chords
    'I': { index: 0, quality: 'Major' }, 'ii': { index: 1, quality: 'Minor' },
    'iii': { index: 2, quality: 'Minor' }, 'IV': { index: 3, quality: 'Major' },
    'V': { index: 4, quality: 'Major' }, 'vi': { index: 5, quality: 'Minor' },
    'vii°': { index: 6, quality: 'Diminished' },
    'vii': { index: 6, quality: 'Diminished' },  // For when ° is stripped by regex
    // Diatonic minor key chords
    'i': { index: 0, quality: 'Minor' }, 'iv': { index: 3, quality: 'Minor' },
    'ii°': { index: 1, quality: 'Diminished' },  // Diminished ii in minor keys
    // Non-diatonic / Secondary dominant variants (major on normally minor degrees)
    'II': { index: 1, quality: 'Major' },   // V/V - secondary dominant
    'III': { index: 2, quality: 'Major' },  // V/vi - secondary dominant
    'VI': { index: 5, quality: 'Major' },   // V/ii - secondary dominant
    'VII': { index: 6, quality: 'Major' },  // V/iii - secondary dominant (subtonic)
    // Non-diatonic minor variants (minor on normally major degrees)
    'v': { index: 4, quality: 'Minor' },    // Minor dominant (modal)
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
    'Major 7th #11': { intervals: [0, 4, 7, 11, 18], symbol: 'maj7#11', description: 'A major 7th chord with a raised 11th (R, M3, P5, M7, #11). The #11 creates a Lydian flavor - dreamy and floating. Common in jazz and film scores.' },
    'Power Chord': { intervals: [0, 7], symbol: '5', description: 'Contains only the root and the 5th (R, P5). The 3rd is omitted, making it neither major nor minor. Common in rock music.' },

    // Special: No Chord (N.C.) - reserves time in composition without specifying harmony
    'No Chord': { intervals: [], symbol: 'N.C.', description: 'No chord - silence or melody without harmonic accompaniment. Reserves time in the composition without specifying any chord. The bass clef will be empty during this time.' },

    // Aliases for backwards compatibility (non-hyphenated and long form names)
    'Half Diminished 7th': { intervals: [0, 3, 6, 10], symbol: 'm7b5', description: 'Alias for Half-Diminished 7th' },
    'Minor Major 7th': { intervals: [0, 3, 7, 11], symbol: 'm(maj7)', description: 'Alias for Minor-Major 7th' },
    'Dominant 7th #9': { intervals: [0, 4, 7, 10, 15], symbol: '7#9', description: 'Alias for 7#9 (Hendrix chord)' },
    'Dominant 7th b9': { intervals: [0, 4, 7, 10, 13], symbol: '7b9', description: 'Alias for 7b9' },
    'Dominant 7th #5': { intervals: [0, 4, 8, 10], symbol: '7#5', description: 'Alias for 7#5' },
    'Dominant 7th b5': { intervals: [0, 4, 6, 10], symbol: '7b5', description: 'Alias for 7b5' },
    'Sus2': { intervals: [0, 2, 7], symbol: 'sus2', description: 'Alias for Suspended 2nd' },
    'Sus4': { intervals: [0, 5, 7], symbol: 'sus4', description: 'Alias for Suspended 4th' },
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
    { title: 'Sixths', types: ['Major 6th', 'Minor 6th', '6/9'] },
    { title: 'Sevenths', types: ['Dominant 7th', 'Major 7th', 'Minor 7th', 'Half-Diminished 7th', 'Diminished 7th', 'Minor-Major 7th'] },
    { title: 'Ninths', types: ['Major 9th', 'Dominant 9th', 'Minor 9th', 'Add9'] },
    { title: 'Extended', types: ['Dominant 11th', 'Minor 11th', 'Dominant 13th', 'Major 7th #11'] },
    { title: 'Altered', types: ['Augmented 7th', '7b5', '7#5', '7b9', '7#9'] },
];

// ============ CHORD PALETTES ============
// Curated chord collections for different styles, moods, and functions
// These work as filters that can be combined with Chromatic/Diatonic modes

const CHORD_PALETTE_CATEGORIES = {
    genre: {
        label: 'Genre',
        icon: 'music-note', // Will map to SVG
        description: 'Chords commonly used in specific musical styles'
    },
    mood: {
        label: 'Mood',
        icon: 'sparkles',
        description: 'Chords grouped by emotional quality'
    },
    function: {
        label: 'Function',
        icon: 'puzzle',
        description: 'Chords grouped by harmonic role'
    }
};

const CHORD_PALETTES = {
    // ============ GENRE PALETTES ============
    'jazz-essentials': {
        category: 'genre',
        label: 'Jazz Essentials',
        description: 'Core jazz voicings for ii-V-I progressions and standards',
        color: 'from-amber-500 to-orange-600',
        chordTypes: [
            'Major 7th', 'Minor 7th', 'Dominant 7th', 'Half-Diminished 7th',
            'Diminished 7th', 'Major 9th', 'Minor 9th', 'Dominant 9th',
            '6/9', 'Minor 6th', 'Major 6th'
        ]
    },
    'jazz-altered': {
        category: 'genre',
        label: 'Jazz Altered',
        description: 'Altered dominants and colorful extensions for bebop and modern jazz',
        color: 'from-orange-500 to-red-600',
        chordTypes: [
            '7b5', '7#5', '7b9', '7#9', 'Augmented 7th',
            'Dominant 11th', 'Dominant 13th', 'Major 7th #11',
            'Minor-Major 7th', 'Half-Diminished 7th'
        ]
    },
    'pop-essentials': {
        category: 'genre',
        label: 'Pop Essentials',
        description: 'The building blocks of modern pop music',
        color: 'from-pink-500 to-rose-600',
        chordTypes: [
            'Major', 'Minor', 'Sus2', 'Sus4',
            'Add9', 'Major 7th', 'Minor 7th', 'Dominant 7th'
        ]
    },
    'rock-power': {
        category: 'genre',
        label: 'Rock & Power',
        description: 'Powerful chords for rock, metal, and punk',
        color: 'from-slate-600 to-zinc-800',
        chordTypes: [
            'Power Chord', 'Major', 'Minor', 'Sus4',
            'Dominant 7th', 'Add9', 'Augmented', 'Diminished'
        ]
    },
    'blues': {
        category: 'genre',
        label: 'Blues',
        description: 'Classic blues chord vocabulary with dominant and altered sounds',
        color: 'from-blue-600 to-indigo-700',
        chordTypes: [
            'Dominant 7th', 'Dominant 9th', '7#9', 'Minor 7th',
            'Major', 'Minor', '7b5', 'Diminished 7th'
        ]
    },
    'rnb-soul': {
        category: 'genre',
        label: 'R&B / Soul',
        description: 'Smooth chord colors for R&B, neo-soul, and gospel',
        color: 'from-purple-600 to-violet-700',
        chordTypes: [
            'Major 7th', 'Minor 7th', 'Major 9th', 'Minor 9th',
            'Dominant 9th', '6/9', 'Minor 6th', 'Add9',
            'Minor 11th', 'Dominant 13th'
        ]
    },
    'folk-acoustic': {
        category: 'genre',
        label: 'Folk / Acoustic',
        description: 'Open voicings perfect for acoustic guitar',
        color: 'from-amber-600 to-yellow-700',
        chordTypes: [
            'Major', 'Minor', 'Sus2', 'Sus4', 'Add9',
            'Major 7th', 'Minor 7th', '6/9'
        ]
    },

    // ============ MOOD PALETTES ============
    'bright-happy': {
        category: 'mood',
        label: 'Bright & Happy',
        description: 'Uplifting major-based chords that convey joy and energy',
        color: 'from-yellow-400 to-amber-500',
        chordTypes: [
            'Major', 'Major 7th', 'Major 9th', 'Add9',
            '6/9', 'Major 6th', 'Sus2', 'Dominant 7th'
        ]
    },
    'melancholic': {
        category: 'mood',
        label: 'Melancholic',
        description: 'Minor and emotional chords for sad or reflective moments',
        color: 'from-slate-500 to-gray-600',
        chordTypes: [
            'Minor', 'Minor 7th', 'Minor 9th', 'Minor 6th',
            'Minor-Major 7th', 'Half-Diminished 7th', 'Diminished'
        ]
    },
    'tense-dramatic': {
        category: 'mood',
        label: 'Tense & Dramatic',
        description: 'Dissonant chords that create suspense and intensity',
        color: 'from-red-600 to-rose-800',
        chordTypes: [
            'Diminished', 'Diminished 7th', 'Augmented', 'Augmented 7th',
            '7b5', '7#5', '7b9', '7#9', 'Minor-Major 7th'
        ]
    },
    'dreamy-ambient': {
        category: 'mood',
        label: 'Dreamy & Ambient',
        description: 'Floating, ethereal chords for atmospheric textures',
        color: 'from-cyan-400 to-teal-500',
        chordTypes: [
            'Major 7th', 'Major 9th', 'Major 7th #11', 'Add9',
            'Sus2', 'Sus4', '6/9', 'Minor 9th', 'Minor 11th'
        ]
    },
    'mysterious': {
        category: 'mood',
        label: 'Mysterious',
        description: 'Ambiguous and intriguing harmonic colors',
        color: 'from-indigo-600 to-purple-800',
        chordTypes: [
            'Augmented', 'Diminished', 'Half-Diminished 7th', 'Minor-Major 7th',
            'Major 7th #11', '7b5', 'Sus4', 'Minor 6th'
        ]
    },
    'triumphant': {
        category: 'mood',
        label: 'Triumphant',
        description: 'Bold, powerful chords for climactic moments',
        color: 'from-amber-500 to-orange-600',
        chordTypes: [
            'Major', 'Power Chord', 'Sus4', 'Add9',
            'Dominant 7th', 'Major 7th', 'Augmented'
        ]
    },

    // ============ FUNCTION PALETTES ============
    'tonic-stable': {
        category: 'function',
        label: 'Tonic (Stable)',
        description: 'Chords that feel "home" - I and vi chord types',
        color: 'from-emerald-500 to-green-600',
        chordTypes: [
            'Major', 'Major 7th', 'Major 9th', 'Major 6th', '6/9', 'Add9',
            'Minor', 'Minor 7th', 'Minor 9th', 'Minor 6th'
        ]
    },
    'subdominant-moving': {
        category: 'function',
        label: 'Subdominant (Moving)',
        description: 'Chords that create motion away from tonic - ii and IV types',
        color: 'from-cyan-500 to-blue-600',
        chordTypes: [
            'Major', 'Minor', 'Minor 7th', 'Minor 9th', 'Minor 11th',
            'Major 7th', 'Sus2', 'Sus4', 'Add9'
        ]
    },
    'dominant-tension': {
        category: 'function',
        label: 'Dominant (Tension)',
        description: 'Chords that create strong pull back to tonic - V chord types',
        color: 'from-yellow-500 to-amber-600',
        chordTypes: [
            'Dominant 7th', 'Dominant 9th', 'Dominant 11th', 'Dominant 13th',
            '7b5', '7#5', '7b9', '7#9', 'Augmented 7th', 'Sus4'
        ]
    },
    'diminished-passing': {
        category: 'function',
        label: 'Diminished (Passing)',
        description: 'Transitional chords that connect other harmonies',
        color: 'from-gray-500 to-slate-600',
        chordTypes: [
            'Diminished', 'Diminished 7th', 'Half-Diminished 7th',
            'Augmented', 'Minor-Major 7th'
        ]
    }
};

/**
 * Get all palettes in a specific category
 * @param {string} category - 'genre', 'mood', or 'function'
 * @returns {Array} Array of {id, ...palette} objects
 */
function getPalettesByCategory(category) {
    return Object.entries(CHORD_PALETTES)
        .filter(([_, palette]) => palette.category === category)
        .map(([id, palette]) => ({ id, ...palette }));
}

/**
 * Get a specific palette by ID
 * @param {string} paletteId - The palette identifier
 * @returns {Object|null} The palette object or null if not found
 */
function getPalette(paletteId) {
    return CHORD_PALETTES[paletteId] || null;
}

/**
 * Check if a chord type is in a specific palette
 * @param {string} chordType - The chord type to check
 * @param {string} paletteId - The palette identifier
 * @returns {boolean} True if the chord type is in the palette
 */
function isChordInPalette(chordType, paletteId) {
    const palette = CHORD_PALETTES[paletteId];
    if (!palette) return false;
    return palette.chordTypes.includes(chordType);
}

/**
 * Get all chord types that match the current filters
 * @param {string|null} paletteId - Optional palette filter
 * @param {string|null} scaleFilter - Optional scale filter
 * @param {string} rootNote - The root note for scale calculations
 * @returns {Array} Array of chord type strings
 */
function getFilteredChordTypes(paletteId, scaleFilter, rootNote) {
    // Start with all chord types from CHORD_GROUPS
    let types = CHORD_GROUPS.flatMap(group => group.types);

    // Filter by palette if specified
    if (paletteId && CHORD_PALETTES[paletteId]) {
        const paletteTypes = CHORD_PALETTES[paletteId].chordTypes;
        types = types.filter(type => paletteTypes.includes(type));
    }

    // Scale filter is applied separately in the UI (isChordInScale)
    // This function just handles palette filtering

    return types;
}

// ============ CHORD SUBSTITUTION TYPES ============
// Educational descriptions explaining when and why each substitution works

const SUBSTITUTION_TYPES = {
    tritoneSub: {
        label: 'Tritone Substitution',
        shortLabel: 'Tritone Sub',
        color: 'from-purple-500 to-indigo-600',
        icon: '🔄',
        description: 'Replace a dominant 7th chord with another dominant 7th a tritone (6 semitones) away. Both chords share the same tritone interval (3rd and 7th are swapped), creating the same tension that resolves similarly.',
        howToUse: 'Works best with dominant 7th chords. G7 → Db7 both resolve smoothly to C.',
        example: 'Instead of G7 → C, try Db7 → C for a jazzy chromatic bass line.',
        appliesTo: ['Dominant 7th', 'Dominant 9th', 'Dominant 11th', 'Dominant 13th', '7b5', '7#5', '7b9', '7#9']
    },
    relativeMinor: {
        label: 'Relative Minor/Major',
        shortLabel: 'Relative',
        color: 'from-emerald-500 to-teal-600',
        icon: '👥',
        description: 'Major and minor chords built on notes 3 semitones apart share many common tones. The relative minor of a major chord has the same key signature and similar harmonic function.',
        howToUse: 'Substitute vi for I (Am for C) or I for vi. Both have tonic function and share 2 of 3 notes.',
        example: 'C major (C-E-G) shares E and G with A minor (A-C-E). Try Am instead of C for a darker color.',
        appliesTo: ['Major', 'Minor', 'Major 7th', 'Minor 7th', 'Major 9th', 'Minor 9th']
    },
    diatonicThird: {
        label: 'Diatonic Third Substitution',
        shortLabel: 'Third Sub',
        color: 'from-blue-500 to-cyan-600',
        icon: '3️⃣',
        description: 'Chords a third apart in a key share 2 common tones. iii can substitute for I, vi for IV, etc. This creates subtle harmonic variety while maintaining similar function.',
        howToUse: 'Replace a chord with the diatonic chord a 3rd above or below. Em for C, Am for F, Dm for F.',
        example: 'In C major: Em (E-G-B) shares G and E with C (C-E-G). Use Em for a more delicate sound.',
        appliesTo: ['Major', 'Minor', 'Major 7th', 'Minor 7th', 'Diminished', 'Half-Diminished 7th']
    },
    parallelMode: {
        label: 'Parallel Mode (Modal Interchange)',
        shortLabel: 'Modal',
        color: 'from-violet-500 to-purple-600',
        icon: '🎭',
        description: 'Borrow chords from the parallel major or minor key. If you\'re in C major, you can use chords from C minor (and vice versa) for color and surprise.',
        howToUse: 'In a major key, try bVII, iv, or bVI from the parallel minor. In minor, try IV or I from parallel major.',
        example: 'In C major, use Bb (bVII from C minor) or Fm (iv) for an unexpected emotional shift.',
        appliesTo: ['Major', 'Minor', 'Major 7th', 'Minor 7th', 'Dominant 7th']
    },
    secondaryDominant: {
        label: 'Secondary Dominant',
        shortLabel: 'V of',
        color: 'from-amber-500 to-orange-600',
        icon: '🎯',
        description: 'Any chord can be preceded by its own V7 chord. This "dominant of the dominant" creates strong forward motion by temporarily tonicizing the target chord.',
        howToUse: 'Before any diatonic chord, insert the dominant 7th a fifth above it. Before Dm, use A7. Before Am, use E7.',
        example: 'C → A7 → Dm → G7 → C. The A7 is the V7 of Dm, creating a stronger pull.',
        appliesTo: ['Major', 'Minor', 'Major 7th', 'Minor 7th', 'Dominant 7th']
    },
    diminishedPassing: {
        label: 'Diminished Passing Chord',
        shortLabel: 'Dim Pass',
        color: 'from-gray-500 to-slate-600',
        icon: '📍',
        description: 'Diminished 7th chords can connect chords a whole step apart. Their symmetrical structure means they function like rootless dominant 7b9 chords from 4 different roots.',
        howToUse: 'Insert a dim7 between chords a step apart. The dim7 is built on the note between them.',
        example: 'C → C#dim7 → Dm. The C#dim7 acts like A7b9 (V7 of Dm) without the root.',
        appliesTo: ['Diminished 7th']
    },
    qualityChange: {
        label: 'Quality Change',
        shortLabel: 'Quality',
        color: 'from-rose-500 to-pink-600',
        icon: '🎨',
        description: 'Keep the same root but change the chord quality (major↔minor, add 7th, etc.). This creates harmonic interest while maintaining the same bass note.',
        howToUse: 'Try major instead of minor (or vice versa), or add/remove 7ths. Same root, different color.',
        example: 'C → Cm → C7 → Cmaj7. The root stays on C but the mood shifts dramatically.',
        appliesTo: ['Major', 'Minor', 'Major 7th', 'Minor 7th', 'Dominant 7th', 'Diminished', 'Augmented']
    },
    commonTone: {
        label: 'Common Tone Substitution',
        shortLabel: 'Common Tone',
        color: 'from-teal-500 to-emerald-600',
        icon: '🔗',
        description: 'Any chord that shares one or more important notes (especially the 3rd or 7th) can potentially substitute. The shared tones create a smooth voice-leading connection.',
        howToUse: 'Look for chords sharing the melody note or a characteristic tone. Eb maj7 and C min7 both contain G and Bb.',
        example: 'Cmaj7 (C-E-G-B) shares E and B with Emaj. Use E or Em for an unexpected but smooth change.',
        appliesTo: ['Major', 'Minor', 'Major 7th', 'Minor 7th', 'Major 9th', 'Minor 9th', 'Add9']
    }
};

/**
 * Calculate all possible substitutions for a given chord
 * @param {string} root - The chord root note (e.g., 'C', 'F#')
 * @param {string} chordType - The chord type (e.g., 'Dominant 7th', 'Major')
 * @param {Array} noteArray - Array of note names to use for calculations
 * @returns {Array} Array of substitution objects with type, chord info, and explanation
 */
function calculateChordSubstitutions(root, chordType, noteArray) {
    const substitutions = [];
    const rootIndex = noteArray.indexOf(root);
    if (rootIndex === -1) return substitutions;

    const chordDef = CHORD_DEFINITIONS[chordType];
    if (!chordDef) return substitutions;

    // 1. TRITONE SUBSTITUTION (for dominant chords)
    if (SUBSTITUTION_TYPES.tritoneSub.appliesTo.includes(chordType)) {
        const tritoneIndex = (rootIndex + 6) % 12;
        const tritoneRoot = noteArray[tritoneIndex];
        substitutions.push({
            type: 'tritoneSub',
            root: tritoneRoot,
            chordType: chordType, // Same type
            label: `${tritoneRoot}${chordDef.symbol}`,
            reason: `Shares the same tritone interval (guide tones). Both resolve to the same target.`
        });
    }

    // 2. RELATIVE MINOR/MAJOR
    if (SUBSTITUTION_TYPES.relativeMinor.appliesTo.includes(chordType)) {
        if (chordType.includes('Major') && !chordType.includes('Minor')) {
            // Major chord → relative minor (down 3 semitones)
            const relMinorIndex = (rootIndex + 9) % 12; // Same as -3
            const relMinorRoot = noteArray[relMinorIndex];
            const relMinorType = chordType.replace('Major', 'Minor');
            const relMinorDef = CHORD_DEFINITIONS[relMinorType];
            if (relMinorDef) {
                substitutions.push({
                    type: 'relativeMinor',
                    root: relMinorRoot,
                    chordType: relMinorType,
                    label: `${relMinorRoot}${relMinorDef.symbol}`,
                    reason: `Relative minor - shares 2 common tones and has similar tonic function.`
                });
            }
        } else if (chordType.includes('Minor') && !chordType.includes('Major')) {
            // Minor chord → relative major (up 3 semitones)
            const relMajorIndex = (rootIndex + 3) % 12;
            const relMajorRoot = noteArray[relMajorIndex];
            const relMajorType = chordType.replace('Minor', 'Major');
            const relMajorDef = CHORD_DEFINITIONS[relMajorType];
            if (relMajorDef) {
                substitutions.push({
                    type: 'relativeMinor',
                    root: relMajorRoot,
                    chordType: relMajorType,
                    label: `${relMajorRoot}${relMajorDef.symbol}`,
                    reason: `Relative major - shares 2 common tones and has similar tonic function.`
                });
            }
        }
    }

    // 3. DIATONIC THIRD SUBSTITUTION (chord a 3rd up or down)
    if (SUBSTITUTION_TYPES.diatonicThird.appliesTo.includes(chordType)) {
        // Third up (4 semitones for major third, 3 for minor)
        const thirdUpIndex = (rootIndex + 4) % 12;
        const thirdUpRoot = noteArray[thirdUpIndex];
        // Use minor if original is major, for diatonic compatibility
        const thirdUpType = chordType.includes('Major') ? chordType.replace('Major', 'Minor') :
                           chordType.includes('Minor') ? chordType : 'Minor';
        const thirdUpDef = CHORD_DEFINITIONS[thirdUpType];
        if (thirdUpDef) {
            substitutions.push({
                type: 'diatonicThird',
                root: thirdUpRoot,
                chordType: thirdUpType,
                label: `${thirdUpRoot}${thirdUpDef.symbol}`,
                reason: `Third above - shares 2 common tones for smooth voice leading.`
            });
        }

        // Third down (8 semitones up = 4 down)
        const thirdDownIndex = (rootIndex + 8) % 12;
        const thirdDownRoot = noteArray[thirdDownIndex];
        const thirdDownType = chordType.includes('Major') ? chordType.replace('Major', 'Minor') :
                             chordType.includes('Minor') ? chordType : 'Minor';
        const thirdDownDef = CHORD_DEFINITIONS[thirdDownType];
        if (thirdDownDef) {
            substitutions.push({
                type: 'diatonicThird',
                root: thirdDownRoot,
                chordType: thirdDownType,
                label: `${thirdDownRoot}${thirdDownDef.symbol}`,
                reason: `Third below - shares 2 common tones for smooth voice leading.`
            });
        }
    }

    // 4. PARALLEL MODE (modal interchange)
    if (SUBSTITUTION_TYPES.parallelMode.appliesTo.includes(chordType)) {
        // If major, suggest parallel minor and borrowed chords
        if (chordType === 'Major' || chordType === 'Major 7th') {
            const minorType = chordType === 'Major' ? 'Minor' : 'Minor 7th';
            const minorDef = CHORD_DEFINITIONS[minorType];
            substitutions.push({
                type: 'parallelMode',
                root: root,
                chordType: minorType,
                label: `${root}${minorDef.symbol}`,
                reason: `Parallel minor - same root, borrowed from parallel minor key for darker color.`
            });

            // bVII chord (borrowed from parallel minor)
            const bVIIIndex = (rootIndex + 10) % 12;
            const bVIIRoot = noteArray[bVIIIndex];
            substitutions.push({
                type: 'parallelMode',
                root: bVIIRoot,
                chordType: 'Major',
                label: `${bVIIRoot}`,
                reason: `bVII chord - borrowed from parallel minor, creates a rock/pop sound.`
            });
        } else if (chordType === 'Minor' || chordType === 'Minor 7th') {
            const majorType = chordType === 'Minor' ? 'Major' : 'Major 7th';
            const majorDef = CHORD_DEFINITIONS[majorType];
            substitutions.push({
                type: 'parallelMode',
                root: root,
                chordType: majorType,
                label: `${root}${majorDef.symbol}`,
                reason: `Parallel major - same root, borrowed from parallel major for brighter color.`
            });
        }
    }

    // 5. SECONDARY DOMINANT (V7 of this chord)
    if (SUBSTITUTION_TYPES.secondaryDominant.appliesTo.includes(chordType)) {
        // The V7 of this chord is a perfect 5th above (7 semitones)
        const secDomIndex = (rootIndex + 7) % 12;
        const secDomRoot = noteArray[secDomIndex];
        substitutions.push({
            type: 'secondaryDominant',
            root: secDomRoot,
            chordType: 'Dominant 7th',
            label: `${secDomRoot}7`,
            reason: `Secondary dominant - the V7 of ${root}, use BEFORE ${root} to create strong pull.`,
            isPrefix: true // This goes BEFORE the original chord
        });
    }

    // 6. QUALITY CHANGE (same root, different quality)
    if (SUBSTITUTION_TYPES.qualityChange.appliesTo.includes(chordType)) {
        const qualityOptions = [];

        if (chordType === 'Major') {
            qualityOptions.push('Minor', 'Major 7th', 'Dominant 7th', 'Sus4', 'Add9');
        } else if (chordType === 'Minor') {
            qualityOptions.push('Major', 'Minor 7th', 'Minor 9th', 'Sus2');
        } else if (chordType === 'Major 7th') {
            qualityOptions.push('Dominant 7th', 'Major 9th', '6/9');
        } else if (chordType === 'Minor 7th') {
            qualityOptions.push('Minor 9th', 'Minor 6th', 'Minor 11th');
        } else if (chordType === 'Dominant 7th') {
            qualityOptions.push('Dominant 9th', '7#9', '7b9', 'Sus4');
        }

        qualityOptions.forEach(newType => {
            const def = CHORD_DEFINITIONS[newType];
            if (def) {
                substitutions.push({
                    type: 'qualityChange',
                    root: root,
                    chordType: newType,
                    label: `${root}${def.symbol}`,
                    reason: `Same root with ${newType} quality - different color, same bass note.`
                });
            }
        });
    }

    return substitutions;
}

/**
 * Get the substitution type info
 * @param {string} typeId - The substitution type ID
 * @returns {Object} The substitution type definition
 */
function getSubstitutionType(typeId) {
    return SUBSTITUTION_TYPES[typeId] || null;
}

const INTERVAL_GROUPS = [
    { title: '2nds', types: ['Major 2nd', 'Minor 2nd'] }, { title: '3rds', types: ['Major 3rd', 'Minor 3rd'] },
    { title: '4ths & 5ths', types: ['Perfect 4th', 'Tritone', 'Perfect 5th'] }, { title: '6ths', types: ['Major 6th', 'Minor 6th'] },
    { title: '7ths', types: ['Major 7th', 'Minor 7th'] }, { title: 'Compound', types: ['Octave', 'Major 9th', 'Minor 9th'] }
];

const SCALE_DEFINITIONS = {
    // ============ BASIC SCALES ============
    'Major (Ionian)': {
        intervals: [0, 2, 4, 5, 7, 9, 11],
        category: 'basic',
        difficulty: 'beginner',
        description: 'The foundation of Western music. Bright, happy sound.',
        commonUses: ['Pop', 'Classical', 'Folk', 'Most Western music'],
        relatedChords: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
    },
    'Natural Minor (Aeolian)': {
        intervals: [0, 2, 3, 5, 7, 8, 10],
        category: 'basic',
        difficulty: 'beginner',
        description: 'The relative minor of major. Sad, introspective quality.',
        commonUses: ['Rock', 'Pop ballads', 'Classical', 'Folk'],
        relatedChords: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']
    },
    'Major Pentatonic': {
        intervals: [0, 2, 4, 7, 9],
        category: 'basic',
        difficulty: 'beginner',
        description: 'Five-note scale. Universally pleasant, impossible to sound bad.',
        commonUses: ['Country', 'Rock solos', 'Folk', 'World music'],
        relatedChords: ['I', 'IV', 'V']
    },
    'Minor Pentatonic': {
        intervals: [0, 3, 5, 7, 10],
        category: 'basic',
        difficulty: 'beginner',
        description: 'The go-to scale for rock and blues solos.',
        commonUses: ['Rock', 'Blues', 'Metal', 'Pop solos'],
        relatedChords: ['i', 'IV', 'v']
    },
    'Blues': {
        intervals: [0, 3, 5, 6, 7, 10],
        category: 'basic',
        difficulty: 'beginner',
        description: 'Minor pentatonic with added "blue note" (b5). Soulful, expressive.',
        commonUses: ['Blues', 'Rock', 'Jazz', 'R&B'],
        relatedChords: ['I7', 'IV7', 'V7']
    },
    'Major Blues': {
        intervals: [0, 2, 3, 4, 7, 9],
        category: 'basic',
        difficulty: 'beginner',
        description: 'Major pentatonic with added b3. Bright blues sound.',
        commonUses: ['Happy blues', 'Country', 'Gospel', 'Jazz'],
        relatedChords: ['I', 'IV', 'V']
    },

    // ============ MODES ============
    'Dorian (Mode 2)': {
        intervals: [0, 2, 3, 5, 7, 9, 10],
        category: 'modes',
        difficulty: 'intermediate',
        description: 'Minor with raised 6th. Jazzy, sophisticated minor sound.',
        commonUses: ['Jazz', 'Funk', 'Rock', 'Modal compositions'],
        relatedChords: ['i', 'ii', 'III', 'IV', 'v', 'vi°', 'VII']
    },
    'Phrygian (Mode 3)': {
        intervals: [0, 1, 3, 5, 7, 8, 10],
        category: 'modes',
        difficulty: 'intermediate',
        description: 'Minor with b2. Spanish/Flamenco flavor, dark and exotic.',
        commonUses: ['Flamenco', 'Metal', 'Film scores', 'World music'],
        relatedChords: ['i', 'II', 'III', 'iv', 'v°', 'VI', 'vii']
    },
    'Lydian (Mode 4)': {
        intervals: [0, 2, 4, 6, 7, 9, 11],
        category: 'modes',
        difficulty: 'intermediate',
        description: 'Major with #4. Dreamy, floating, ethereal quality.',
        commonUses: ['Film scores', 'Jazz', 'Progressive rock', 'New Age'],
        relatedChords: ['I', 'II', 'iii', '#iv°', 'V', 'vi', 'vii']
    },
    'Mixolydian (Mode 5)': {
        intervals: [0, 2, 4, 5, 7, 9, 10],
        category: 'modes',
        difficulty: 'intermediate',
        description: 'Major with b7. Bluesy major sound, rock anthem feel.',
        commonUses: ['Rock', 'Blues', 'Country', 'Funk'],
        relatedChords: ['I', 'ii', 'iii°', 'IV', 'v', 'vi', 'VII']
    },
    'Locrian (Mode 7)': {
        intervals: [0, 1, 3, 5, 6, 8, 10],
        category: 'modes',
        difficulty: 'advanced',
        description: 'Diminished tonic. Unstable, rarely used alone.',
        commonUses: ['Jazz', 'Metal', 'Avant-garde', 'Tension passages'],
        relatedChords: ['i°', 'II', 'iii', 'iv', 'V', 'VI', 'vii']
    },

    // ============ MINOR VARIANTS ============
    'Harmonic Minor': {
        intervals: [0, 2, 3, 5, 7, 8, 11],
        category: 'minor-variants',
        difficulty: 'intermediate',
        description: 'Natural minor with raised 7th. Creates strong V-i cadence.',
        commonUses: ['Classical', 'Flamenco', 'Metal', 'Middle Eastern'],
        relatedChords: ['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°']
    },
    'Melodic Minor': {
        intervals: [0, 2, 3, 5, 7, 9, 11],
        category: 'minor-variants',
        difficulty: 'intermediate',
        description: 'Minor with raised 6th and 7th. Smooth melodic motion.',
        commonUses: ['Jazz', 'Classical melody', 'Film scores'],
        relatedChords: ['i', 'ii', 'III+', 'IV', 'V', 'vi°', 'vii°'],
        modes: ['Melodic Minor', 'Dorian b2', 'Lydian Augmented', 'Lydian Dominant', 'Mixolydian b6', 'Locrian #2', 'Altered']
    },

    // ============ SYMMETRIC SCALES ============
    'Whole Tone': {
        intervals: [0, 2, 4, 6, 8, 10],
        category: 'symmetric',
        difficulty: 'advanced',
        description: 'All whole steps. Dreamy, floating, no clear resolution.',
        commonUses: ['Impressionism (Debussy)', 'Dream sequences', 'Film transitions'],
        relatedChords: ['aug', '7#5'],
        note: 'Only 2 unique whole tone scales exist (C and Db)'
    },
    'Diminished (WH)': {
        intervals: [0, 2, 3, 5, 6, 8, 9, 11],
        category: 'symmetric',
        difficulty: 'advanced',
        description: 'Alternating W-H pattern. Tension, suspense, mystery.',
        commonUses: ['Diminished chord improv', 'Film suspense', 'Jazz'],
        relatedChords: ['dim7'],
        note: 'Only 3 unique diminished scales exist'
    },
    'Diminished (HW)': {
        intervals: [0, 1, 3, 4, 6, 7, 9, 10],
        category: 'symmetric',
        difficulty: 'advanced',
        description: 'Alternating H-W pattern. Dominant function, jazz tension.',
        commonUses: ['Over dominant 7th chords', 'Jazz improvisation', 'Fusion'],
        relatedChords: ['7b9', '13b9']
    },
    'Chromatic': {
        intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        category: 'symmetric',
        difficulty: 'beginner',
        description: 'All 12 notes. Used for chromatic passing tones.',
        commonUses: ['Exercises', 'Chromatic runs', 'Atonal music'],
        relatedChords: ['Any']
    },

    // ============ BEBOP SCALES ============
    'Bebop Major': {
        intervals: [0, 2, 4, 5, 7, 8, 9, 11],
        category: 'bebop',
        difficulty: 'advanced',
        description: 'Major with added #5. Keeps chord tones on beats.',
        commonUses: ['Jazz walking bass', 'Bebop improvisation', 'Swing'],
        relatedChords: ['maj7', '6']
    },
    'Bebop Dominant': {
        intervals: [0, 2, 4, 5, 7, 9, 10, 11],
        category: 'bebop',
        difficulty: 'advanced',
        description: 'Mixolydian with added natural 7. The jazz standard.',
        commonUses: ['Over dominant 7th chords', 'Jazz solos', 'Bebop lines'],
        relatedChords: ['7', '9', '13']
    },
    'Bebop Minor': {
        intervals: [0, 2, 3, 4, 5, 7, 9, 10],
        category: 'bebop',
        difficulty: 'advanced',
        description: 'Dorian with added major 3rd. Smooth voice leading.',
        commonUses: ['Over minor 7th chords', 'Jazz', 'Fusion'],
        relatedChords: ['m7', 'm9']
    },

    // ============ EXOTIC/WORLD SCALES ============
    'Phrygian Dominant': {
        intervals: [0, 1, 4, 5, 7, 8, 10],
        category: 'exotic',
        difficulty: 'intermediate',
        description: 'Flamenco/Middle Eastern flavor. Exotic tension.',
        commonUses: ['Flamenco', 'Middle Eastern', 'Metal', 'Film scores'],
        relatedChords: ['I', 'ii°', 'iii', 'iv', 'V', 'VI', 'vii°'],
        aliases: ['Spanish Gypsy', 'Freygish', 'Ahava Rabbah']
    },
    'Hungarian Minor': {
        intervals: [0, 2, 3, 6, 7, 8, 11],
        category: 'exotic',
        difficulty: 'advanced',
        description: 'Double harmonic minor. Dramatic, exotic character.',
        commonUses: ['Eastern European folk', 'Film scores', 'Metal'],
        aliases: ['Gypsy Minor', 'Double Harmonic Minor']
    },
    'Double Harmonic Major': {
        intervals: [0, 1, 4, 5, 7, 8, 11],
        category: 'exotic',
        difficulty: 'advanced',
        description: 'Byzantine scale. Middle Eastern, mysterious.',
        commonUses: ['Middle Eastern music', 'Byzantine chant', 'Film scores'],
        aliases: ['Arabic', 'Byzantine', 'Gypsy Major']
    },
    'Hirajoshi': {
        intervals: [0, 2, 3, 7, 8],
        category: 'exotic',
        difficulty: 'intermediate',
        description: 'Japanese pentatonic. Serene, contemplative feel.',
        commonUses: ['Japanese music', 'Meditation', 'Video game soundtracks', 'Ambient'],
        relatedChords: ['m', 'sus2']
    },
    'In Sen': {
        intervals: [0, 1, 5, 7, 10],
        category: 'exotic',
        difficulty: 'intermediate',
        description: 'Japanese scale. Dark, mysterious Japanese flavor.',
        commonUses: ['Japanese traditional', 'Film scores', 'Ambient'],
        relatedChords: ['m7', 'sus4']
    },

    // ============ JAZZ EXTENSIONS ============
    'Lydian Dominant': {
        intervals: [0, 2, 4, 6, 7, 9, 10],
        category: 'jazz',
        difficulty: 'advanced',
        description: 'Lydian with b7. Sophisticated jazz tension.',
        commonUses: ['Over 7#11 chords', 'Jazz fusion', 'Tritone subs'],
        relatedChords: ['7#11', '9#11'],
        derivation: '4th mode of melodic minor'
    },
    'Altered': {
        intervals: [0, 1, 3, 4, 6, 8, 10],
        category: 'jazz',
        difficulty: 'advanced',
        description: 'Maximum tension. All alterations on dominant chord.',
        commonUses: ['Over altered dominant chords', 'Jazz resolution', 'Fusion'],
        relatedChords: ['7alt', '7b9#9', '7b5#5'],
        derivation: '7th mode of melodic minor',
        aliases: ['Super Locrian', 'Diminished Whole Tone']
    },
    'Lydian Augmented': {
        intervals: [0, 2, 4, 6, 8, 9, 11],
        category: 'jazz',
        difficulty: 'advanced',
        description: 'Lydian with #5. Dreamy augmented sound.',
        commonUses: ['Over maj7#5 chords', 'Jazz', 'Fusion'],
        relatedChords: ['maj7#5'],
        derivation: '3rd mode of melodic minor'
    },
    'Locrian #2': {
        intervals: [0, 2, 3, 5, 6, 8, 10],
        category: 'jazz',
        difficulty: 'advanced',
        description: 'Locrian with natural 2. More usable half-diminished scale.',
        commonUses: ['Over m7b5 chords', 'Jazz ii-V-i in minor'],
        relatedChords: ['m7b5'],
        derivation: '6th mode of melodic minor'
    }
};

// Scale category metadata for UI filtering
const SCALE_CATEGORIES = {
    'basic': { name: 'Basic', icon: '🎵', description: 'Essential scales for beginners' },
    'modes': { name: 'Modes', icon: '🎭', description: 'The 7 modes of the major scale' },
    'minor-variants': { name: 'Minor Variants', icon: '🌙', description: 'Harmonic and melodic minor scales' },
    'symmetric': { name: 'Symmetric', icon: '🔷', description: 'Scales with repeating interval patterns' },
    'bebop': { name: 'Bebop', icon: '🎷', description: '8-note scales for jazz improvisation' },
    'exotic': { name: 'World/Exotic', icon: '🌍', description: 'Scales from various musical traditions' },
    'jazz': { name: 'Jazz Extensions', icon: '🎹', description: 'Advanced scales for jazz harmony' }
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

/**
 * Determines the chord type (Major, Minor, Diminished, Augmented) based on
 * the intervals from a scale degree to its 3rd and 5th
 * @param {number} third - Interval in semitones to the 3rd (3 = minor, 4 = major)
 * @param {number} fifth - Interval in semitones to the 5th (6 = dim, 7 = perfect, 8 = aug)
 * @returns {Object} { triad: string, seventh: string, romanPrefix: string, romanSuffix: string }
 */
function determineChordQuality(third, fifth) {
    // Triads: Major (4,7), Minor (3,7), Diminished (3,6), Augmented (4,8)
    if (third === 4 && fifth === 7) {
        return { triad: 'Major', seventh: 'Major 7th', romanPrefix: '', romanCase: 'upper' };
    } else if (third === 3 && fifth === 7) {
        return { triad: 'Minor', seventh: 'Minor 7th', romanPrefix: '', romanCase: 'lower' };
    } else if (third === 3 && fifth === 6) {
        return { triad: 'Diminished', seventh: 'Half-Diminished 7th', romanPrefix: '', romanCase: 'lower', romanSuffix: '°' };
    } else if (third === 4 && fifth === 8) {
        return { triad: 'Augmented', seventh: 'Augmented 7th', romanPrefix: '', romanCase: 'upper', romanSuffix: '+' };
    }
    // Fallback for unusual intervals
    return { triad: 'Major', seventh: 'Major 7th', romanPrefix: '', romanCase: 'upper' };
}

/**
 * Roman numerals for scale degrees
 */
const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/**
 * Generates diatonic chords for any scale based on its intervals
 * Builds triads, 7ths, 9ths, 6ths, 11ths, and extensions by stacking thirds from each scale degree
 *
 * @param {string} rootNote - The tonic note (e.g., 'C', 'D', 'F#')
 * @param {string} scaleName - The scale name from SCALE_DEFINITIONS (e.g., 'Natural Minor (Aeolian)')
 * @param {Array} noteArray - The note array to use (SHARP_NOTES or FLAT_NOTES)
 * @returns {Array} Array of chord groups with notes and types
 */
function generateScaleDiatonicChords(rootNote, scaleName, noteArray) {
    const rootIndex = noteArray.indexOf(rootNote);
    if (rootIndex === -1) return [];

    const scaleDef = SCALE_DEFINITIONS[scaleName];
    if (!scaleDef || !scaleDef.intervals) return [];

    const intervals = scaleDef.intervals;
    const numDegrees = intervals.length;

    // For scales with fewer than 7 notes (pentatonic, blues, etc.),
    // we still generate chords but with limited degrees
    const triads = [];
    const sixths = [];
    const sevenths = [];
    const ninths = [];
    const elevenths = [];
    const extensions = [];

    for (let degree = 0; degree < numDegrees; degree++) {
        const chordRootInterval = intervals[degree];
        const chordRoot = noteArray[(rootIndex + chordRootInterval) % 12];

        // Find the 3rd (2 scale degrees up) and 5th (4 scale degrees up)
        const thirdDegree = (degree + 2) % numDegrees;
        const fifthDegree = (degree + 4) % numDegrees;

        // Calculate semitone intervals from chord root to 3rd and 5th
        let thirdInterval = intervals[thirdDegree] - intervals[degree];
        if (thirdInterval < 0) thirdInterval += 12;

        let fifthInterval = intervals[fifthDegree] - intervals[degree];
        if (fifthInterval < 0) fifthInterval += 12;

        // Determine chord quality based on intervals
        const quality = determineChordQuality(thirdInterval, fifthInterval);

        // Generate roman numeral
        const romanBase = quality.romanCase === 'lower'
            ? ROMAN_NUMERALS[degree].toLowerCase()
            : ROMAN_NUMERALS[degree];
        const romanSuffix = quality.romanSuffix || '';

        // Add triad
        triads.push({
            root: chordRoot,
            type: quality.triad,
            roman: romanBase + romanSuffix,
            degree: degree + 1
        });

        // Calculate 6th, 7th, 9th, and 11th intervals for extended chords
        // 6th is 5 scale degrees up (same as 13th in jazz, but we use 6th for simpler chords)
        const sixthDegree = (degree + 5) % numDegrees;
        let sixthInterval = intervals[sixthDegree] - intervals[degree];
        if (sixthInterval < 0) sixthInterval += 12;

        // 7th is 6 scale degrees up
        const seventhDegree = (degree + 6) % numDegrees;
        let seventhInterval = intervals[seventhDegree] - intervals[degree];
        if (seventhInterval < 0) seventhInterval += 12;

        // 9th is 1 scale degree up (wraps around = 2nd + octave)
        const ninthDegree = (degree + 1) % numDegrees;
        let ninthInterval = intervals[ninthDegree] - intervals[degree];
        if (ninthInterval < 0) ninthInterval += 12;

        // 11th is 3 scale degrees up (wraps around = 4th + octave)
        const eleventhDegree = (degree + 3) % numDegrees;
        let eleventhInterval = intervals[eleventhDegree] - intervals[degree];
        if (eleventhInterval < 0) eleventhInterval += 12;

        // === 6th Chords ===
        // Only add 6th chords for Major and Minor triads (not diminished/augmented)
        if (quality.triad === 'Major' || quality.triad === 'Minor') {
            const sixthType = quality.triad === 'Major' ? 'Major 6th' : 'Minor 6th';
            const sixthRoman = romanBase + '6';
            sixths.push({
                root: chordRoot,
                type: sixthType,
                roman: sixthRoman,
                degree: degree + 1
            });
        }

        // === 7th Chords ===
        if (numDegrees >= 5) {
            // Determine 7th chord type based on all intervals
            let seventhType = quality.seventh;

            // Special cases for dominant 7th (major triad + minor 7th)
            if (quality.triad === 'Major' && seventhInterval === 10) {
                seventhType = 'Dominant 7th';
            }
            // Minor-major 7th (minor triad + major 7th)
            else if (quality.triad === 'Minor' && seventhInterval === 11) {
                seventhType = 'Minor-Major 7th';
            }
            // Diminished 7th (diminished triad + diminished 7th = 9 semitones)
            else if (quality.triad === 'Diminished' && seventhInterval === 9) {
                seventhType = 'Diminished 7th';
            }

            // Generate 7th chord roman numeral
            let seventhRoman = romanBase;
            if (seventhType === 'Major 7th') {
                seventhRoman += 'maj7';
            } else if (seventhType === 'Minor 7th') {
                seventhRoman += '7';
            } else if (seventhType === 'Dominant 7th') {
                seventhRoman += '7';
            } else if (seventhType === 'Half-Diminished 7th') {
                seventhRoman += 'ø7';
            } else if (seventhType === 'Diminished 7th') {
                seventhRoman += 'o7';
            } else if (seventhType === 'Minor-Major 7th') {
                seventhRoman += 'mM7';
            } else {
                seventhRoman += '7';
            }

            sevenths.push({
                root: chordRoot,
                type: seventhType,
                roman: seventhRoman,
                degree: degree + 1
            });

            // === 9th Chords ===
            // 9th chords are 7th chords + the 9th
            // Skip for diminished chords (they don't typically have 9ths)
            if (quality.triad !== 'Diminished') {
                let ninthType;
                let ninthRoman = romanBase;

                if (seventhType === 'Major 7th') {
                    ninthType = 'Major 9th';
                    ninthRoman += 'maj9';
                } else if (seventhType === 'Minor 7th') {
                    ninthType = 'Minor 9th';
                    ninthRoman += '9';
                } else if (seventhType === 'Dominant 7th') {
                    ninthType = 'Dominant 9th';
                    ninthRoman += '9';
                } else if (seventhType === 'Half-Diminished 7th') {
                    // Half-dim 9 is less common but valid
                    ninthType = 'Minor 9th';
                    ninthRoman += 'ø9';
                } else {
                    ninthType = 'Minor 9th';
                    ninthRoman += '9';
                }

                ninths.push({
                    root: chordRoot,
                    type: ninthType,
                    roman: ninthRoman,
                    degree: degree + 1
                });
            }

            // === 11th Chords ===
            // 11th chords extend 9th chords
            // Typically used on minor chords and dominant chords
            // Major chords with natural 11 clash (major 3rd vs perfect 4th), so we include #11 versions
            if (quality.triad === 'Minor') {
                elevenths.push({
                    root: chordRoot,
                    type: 'Minor 11th',
                    roman: romanBase + '11',
                    degree: degree + 1
                });
            } else if (seventhType === 'Dominant 7th') {
                elevenths.push({
                    root: chordRoot,
                    type: 'Dominant 11th',
                    roman: romanBase + '11',
                    degree: degree + 1
                });
            }
        }

        // === Add9 Extensions ===
        // Add9 = triad + 9th (no 7th) - works on Major and Minor triads
        if (quality.triad === 'Major' || quality.triad === 'Minor') {
            extensions.push({
                root: chordRoot,
                type: 'Add9',
                roman: romanBase + 'add9',
                degree: degree + 1
            });
        }
    }

    // Build result with all chord groups
    const result = [{ title: 'Triads', chords: triads }];

    if (sixths.length > 0) {
        result.push({ title: 'Sixths', chords: sixths });
    }
    if (sevenths.length > 0) {
        result.push({ title: 'Sevenths', chords: sevenths });
    }
    if (ninths.length > 0) {
        result.push({ title: 'Ninths', chords: ninths });
    }
    if (elevenths.length > 0) {
        result.push({ title: 'Elevenths', chords: elevenths });
    }
    if (extensions.length > 0) {
        result.push({ title: 'Extensions', chords: extensions });
    }

    return result;
}

/**
 * Supported time signatures
 * Each entry has:
 * - value: string format for UI dropdowns ("4/4")
 * - num: numerator (beats per measure)
 * - denom: denominator (note value that gets one beat)
 * - label: display label (optional, defaults to value)
 */
const TIME_SIGNATURES = [
    { value: '4/4', num: 4, denom: 4, label: '4/4 (Common)' },
    { value: '3/4', num: 3, denom: 4, label: '3/4 (Waltz)' },
    { value: '2/4', num: 2, denom: 4, label: '2/4 (March)' },
    { value: '6/8', num: 6, denom: 8, label: '6/8 (Compound)' },
    { value: '2/2', num: 2, denom: 2, label: '2/2 (Cut Time)' },
    { value: '9/8', num: 9, denom: 8, label: '9/8 (Compound)' },
    { value: '12/8', num: 12, denom: 8, label: '12/8 (Compound)' },
];

/** Default time signature */
const DEFAULT_TIME_SIGNATURE = { num: 4, denom: 4 };

// Export all constants for ES6 module usage
export {
    ALL_NOTES,
    SHARP_NOTES,
    FLAT_NOTES,
    MAJOR_SCALE_STEPS,
    ROMAN_MAP_BASE,
    CHORD_DEFINITIONS,
    INVERSION_NAMES,
    INTERVAL_DEFINITIONS,
    CHORD_GROUPS,
    INTERVAL_GROUPS,
    SCALE_DEFINITIONS,
    SCALE_CATEGORIES,
    ENHARMONIC_MAP,
    KEY_SIGNATURE_TEXT,
    KEY_SIGNATURE_IMAGES,
    RELATIVE_MINOR_MAP,
    DIATONIC_CHORD_GROUPS,
    generateDiatonicChords,
    generateScaleDiatonicChords,
    TIME_SIGNATURES,
    DEFAULT_TIME_SIGNATURE,
    // Chord ID utilities for bass preservation system
    generateChordId,
    ensureChordId,
    // Chord Palettes
    CHORD_PALETTE_CATEGORIES,
    CHORD_PALETTES,
    getPalettesByCategory,
    getPalette,
    isChordInPalette,
    getFilteredChordTypes,
    // Chord Substitutions
    SUBSTITUTION_TYPES,
    calculateChordSubstitutions,
    getSubstitutionType
};
