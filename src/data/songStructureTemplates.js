/**
 * Song Structure Templates
 *
 * Provides pre-defined song structures for the structure-first songwriting workflow.
 * These templates define section sequences with expected chord counts and bar lengths.
 */

/**
 * Song structure templates
 * Each template defines a sequence of sections with metadata
 */
export const SONG_STRUCTURE_TEMPLATES = {
    simple: {
        id: 'simple',
        name: 'Simple',
        description: 'Verse - Chorus - Verse - Chorus',
        sections: [
            { type: 'verse', targetBars: 8, expectedChordCount: 4 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
            { type: 'verse', targetBars: 8, expectedChordCount: 4 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
        ],
        totalBars: 32,
        genres: ['pop', 'folk', 'rock'],
        examples: ['Simple pop songs', 'Folk ballads']
    },
    standard: {
        id: 'standard',
        name: 'Standard',
        description: 'Verse - Chorus - Verse - Chorus - Bridge - Chorus',
        sections: [
            { type: 'verse', targetBars: 8, expectedChordCount: 4 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
            { type: 'verse', targetBars: 8, expectedChordCount: 4 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
            { type: 'bridge', targetBars: 8, expectedChordCount: 4 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
        ],
        totalBars: 48,
        genres: ['pop', 'rock', 'country'],
        examples: ['Let It Be', 'Hotel California']
    },
    extended: {
        id: 'extended',
        name: 'Extended',
        description: 'Intro - Verse - Pre-Chorus - Chorus - Verse - Pre-Chorus - Chorus - Bridge - Chorus - Outro',
        sections: [
            { type: 'intro', targetBars: 4, expectedChordCount: 2 },
            { type: 'verse', targetBars: 8, expectedChordCount: 4 },
            { type: 'pre-chorus', targetBars: 4, expectedChordCount: 2 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
            { type: 'verse', targetBars: 8, expectedChordCount: 4 },
            { type: 'pre-chorus', targetBars: 4, expectedChordCount: 2 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
            { type: 'bridge', targetBars: 8, expectedChordCount: 4 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
            { type: 'outro', targetBars: 4, expectedChordCount: 2 },
        ],
        totalBars: 64,
        genres: ['pop', 'modern rock'],
        examples: ['Rolling in the Deep', 'Shake It Off']
    },
    verseHeavy: {
        id: 'verseHeavy',
        name: 'Verse-Heavy',
        description: 'Verse - Verse - Chorus - Verse - Chorus - Verse',
        sections: [
            { type: 'verse', targetBars: 8, expectedChordCount: 4 },
            { type: 'verse', targetBars: 8, expectedChordCount: 4 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
            { type: 'verse', targetBars: 8, expectedChordCount: 4 },
            { type: 'chorus', targetBars: 8, expectedChordCount: 4 },
            { type: 'verse', targetBars: 8, expectedChordCount: 4 },
        ],
        totalBars: 48,
        genres: ['folk', 'singer-songwriter', 'storytelling'],
        examples: ['Bob Dylan songs', 'Joni Mitchell songs']
    },
    aaba: {
        id: 'aaba',
        name: 'AABA (Jazz Standard)',
        description: 'A - A - B - A (32-bar form)',
        sections: [
            { type: 'verse', targetBars: 8, expectedChordCount: 4, label: 'A' },
            { type: 'verse', targetBars: 8, expectedChordCount: 4, label: 'A' },
            { type: 'bridge', targetBars: 8, expectedChordCount: 4, label: 'B' },
            { type: 'verse', targetBars: 8, expectedChordCount: 4, label: 'A' },
        ],
        totalBars: 32,
        genres: ['jazz', 'standards', 'showtunes'],
        examples: ['Over the Rainbow', 'Body and Soul']
    },
    blues: {
        id: 'blues',
        name: '12-Bar Blues',
        description: 'Classic I-IV-V blues progression',
        sections: [
            { type: 'verse', targetBars: 12, expectedChordCount: 12 },
        ],
        totalBars: 12,
        genres: ['blues', 'rock', 'jazz'],
        examples: ['Sweet Home Chicago', 'Pride and Joy']
    },
    custom: {
        id: 'custom',
        name: 'Custom',
        description: 'Build your own structure',
        sections: [],
        totalBars: 0,
        genres: ['any'],
        examples: []
    }
};

/**
 * Section type characteristics and common progressions
 * Used for context-aware chord suggestions
 */
export const SECTION_TYPE_PROGRESSIONS = {
    verse: {
        characteristics: [
            'Sets up the story/mood',
            'Feels more "open" or unresolved',
            'Often avoids resolving to I until end'
        ],
        commonStartingChords: ['vi', 'I', 'ii'],
        commonProgressions: [
            { numerals: ['vi', 'IV', 'I', 'V'], feel: 'Sensitive/Emotional', example: 'Someone Like You' },
            { numerals: ['I', 'vi', 'IV', 'V'], feel: 'Hopeful/Building', example: 'Let It Be' },
            { numerals: ['I', 'V', 'vi', 'IV'], feel: 'Anthemic', example: 'With or Without You' },
            { numerals: ['ii', 'V', 'I', 'vi'], feel: 'Jazz-influenced', example: 'Fly Me to the Moon' },
            { numerals: ['I', 'IV', 'vi', 'V'], feel: 'Warm/Open', example: 'Counting Stars' },
            { numerals: ['I', 'iii', 'vi', 'IV'], feel: 'Introspective', example: 'Creep (Radiohead)' },
            { numerals: ['vi', 'V', 'IV', 'III'], feel: 'Andalusian/Dramatic', example: 'Hit The Road Jack' },
            { numerals: ['I', 'bVII', 'IV', 'I'], feel: 'Rock/Modal', example: 'Sweet Child O Mine' },
            { numerals: ['ii', 'IV', 'I', 'V'], feel: 'Smooth/R&B', example: 'No Scrubs' },
            { numerals: ['I', 'V/vi', 'vi', 'IV'], feel: 'Secondary Dominant', example: 'Modern pop' },
        ]
    },
    chorus: {
        characteristics: [
            'Emotional peak of the song',
            'Most memorable/singable',
            'Strong resolution to I chord'
        ],
        commonStartingChords: ['I', 'IV', 'vi'],
        commonProgressions: [
            { numerals: ['I', 'V', 'vi', 'IV'], feel: 'Anthemic/Uplifting', example: 'Let It Go' },
            { numerals: ['I', 'IV', 'V', 'I'], feel: 'Classic/Strong', example: 'Twist and Shout' },
            { numerals: ['IV', 'I', 'V', 'vi'], feel: 'Emotional Lift', example: 'Firework' },
            { numerals: ['I', 'iii', 'IV', 'V'], feel: 'Warm/Nostalgic', example: 'Stand By Me' },
            { numerals: ['vi', 'IV', 'I', 'V'], feel: 'Bittersweet', example: 'What Makes You Beautiful' },
            { numerals: ['I', 'V', 'IV', 'V'], feel: 'Driving/Energetic', example: 'Livin on a Prayer' },
            { numerals: ['I', 'bVII', 'IV', 'V'], feel: 'Rock Power', example: 'Born To Run' },
            { numerals: ['IV', 'V', 'I', 'I'], feel: 'Gospel/Triumphant', example: 'Oh Happy Day' },
            { numerals: ['I', 'ii', 'IV', 'V'], feel: 'Building/Hopeful', example: 'Hey Jude' },
            { numerals: ['vi', 'V', 'IV', 'V'], feel: 'Tension/Release', example: 'Rolling in the Deep' },
        ]
    },
    bridge: {
        characteristics: [
            'Provides contrast to verse/chorus',
            'Often uses different chord set',
            'Creates tension before final chorus'
        ],
        commonStartingChords: ['IV', 'vi', 'iii', 'ii'],
        commonProgressions: [
            { numerals: ['IV', 'V', 'iii', 'vi'], feel: 'Climbing/Building', example: 'Common bridge' },
            { numerals: ['vi', 'IV', 'V', 'V'], feel: 'Suspenseful', example: 'Builds tension' },
            { numerals: ['ii', 'V', 'iii', 'vi'], feel: 'Jazz-touched', example: 'Sophisticated' },
            { numerals: ['IV', 'I', 'ii', 'V'], feel: 'Resolution-seeking', example: 'Classic pop bridge' },
            { numerals: ['iii', 'vi', 'ii', 'V'], feel: 'Circle of Fifths', example: 'Jazz standard' },
            { numerals: ['bVI', 'bVII', 'I', 'I'], feel: 'Epic/Borrowed', example: 'Bon Jovi style' },
            { numerals: ['IV', 'iv', 'I', 'V'], feel: 'Minor IV twist', example: 'Creep bridge' },
            { numerals: ['ii', 'iii', 'IV', 'V'], feel: 'Ascending', example: 'Stepwise climb' },
        ]
    },
    'pre-chorus': {
        characteristics: [
            'Builds anticipation for chorus',
            'Creates lift/energy increase',
            'Often ends on V chord'
        ],
        commonStartingChords: ['IV', 'ii', 'vi'],
        commonProgressions: [
            { numerals: ['IV', 'V'], feel: 'Simple Lift', example: 'Basic pre-chorus' },
            { numerals: ['ii', 'IV', 'V'], feel: 'Building', example: 'Standard pop' },
            { numerals: ['vi', 'IV', 'V'], feel: 'Emotional Build', example: 'Ballad style' },
            { numerals: ['IV', 'V', 'vi', 'V'], feel: 'Extended Build', example: 'Modern pop' },
            { numerals: ['ii', 'V', 'V'], feel: 'Jazz Turnaround', example: 'Tension builder' },
            { numerals: ['iii', 'IV', 'V'], feel: 'Stepwise Rise', example: 'Climbing energy' },
            { numerals: ['vi', 'V/V', 'V'], feel: 'Secondary Dominant', example: 'Strong push' },
        ]
    },
    intro: {
        characteristics: [
            'Sets the mood',
            'Often instrumental',
            'Can preview chorus or verse chords'
        ],
        commonStartingChords: ['I', 'vi', 'IV'],
        commonProgressions: [
            { numerals: ['I', 'V'], feel: 'Simple/Clean', example: 'Many rock songs' },
            { numerals: ['I', 'vi', 'IV', 'V'], feel: 'Full Preview', example: 'Pop standard' },
            { numerals: ['vi', 'IV'], feel: 'Moody/Atmospheric', example: 'Ballad intro' },
            { numerals: ['I'], feel: 'Minimal/Dramatic', example: 'Single chord intro' },
            { numerals: ['I', 'bVII', 'IV'], feel: 'Rock Opening', example: 'Classic rock' },
            { numerals: ['vi', 'IV', 'I', 'V'], feel: 'Emotional Hook', example: 'Pop ballad' },
            { numerals: ['I', 'iii', 'IV'], feel: 'Dreamy/Soft', example: 'Indie style' },
        ]
    },
    outro: {
        characteristics: [
            'Wraps up the song',
            'Often fades or resolves strongly',
            'Can repeat chorus chords'
        ],
        commonStartingChords: ['I', 'IV', 'V'],
        commonProgressions: [
            { numerals: ['I', 'IV', 'V', 'I'], feel: 'Strong Resolution', example: 'Classic ending' },
            { numerals: ['IV', 'I'], feel: 'Plagal Cadence', example: 'Amen ending' },
            { numerals: ['I', 'V', 'vi', 'IV'], feel: 'Fade Out', example: 'Repeat and fade' },
            { numerals: ['I'], feel: 'Final Resolution', example: 'End on tonic' },
            { numerals: ['IV', 'iv', 'I'], feel: 'Minor IV Resolution', example: 'Bittersweet end' },
            { numerals: ['I', 'bVII', 'IV', 'I'], feel: 'Rock Finale', example: 'Power ending' },
            { numerals: ['vi', 'IV', 'I'], feel: 'Emotional Close', example: 'Soft landing' },
        ]
    },
    custom: {
        characteristics: [
            'User-defined section',
            'Flexible purpose',
            'Any chord progression'
        ],
        commonStartingChords: ['I', 'IV', 'vi'],
        commonProgressions: [
            { numerals: ['I', 'IV', 'V', 'I'], feel: 'Standard', example: 'Basic progression' },
            { numerals: ['I', 'V', 'vi', 'IV'], feel: 'Pop Standard', example: 'Axis progression' },
            { numerals: ['ii', 'V', 'I'], feel: 'Jazz Turnaround', example: 'ii-V-I' },
            { numerals: ['I', 'bVII', 'IV'], feel: 'Rock Modal', example: 'Mixolydian feel' },
        ]
    }
};

/**
 * Get a template by ID
 * @param {string} templateId - Template ID
 * @returns {Object|null} Template or null
 */
export function getTemplate(templateId) {
    return SONG_STRUCTURE_TEMPLATES[templateId] || null;
}

/**
 * Get all templates as an array
 * @returns {Array} Array of template objects
 */
export function getAllTemplates() {
    return Object.values(SONG_STRUCTURE_TEMPLATES);
}

/**
 * Get progression suggestions for a section type
 * @param {string} sectionType - Section type (verse, chorus, etc.)
 * @returns {Object|null} Section progressions data or null
 */
export function getSectionProgressions(sectionType) {
    return SECTION_TYPE_PROGRESSIONS[sectionType] || SECTION_TYPE_PROGRESSIONS.custom;
}

/**
 * Get characteristics for a section type
 * @param {string} sectionType - Section type
 * @returns {Array} Array of characteristic strings
 */
export function getSectionCharacteristics(sectionType) {
    const data = SECTION_TYPE_PROGRESSIONS[sectionType];
    return data ? data.characteristics : [];
}

/**
 * Get common starting chords for a section type
 * @param {string} sectionType - Section type
 * @returns {Array} Array of Roman numeral strings
 */
export function getCommonStartingChords(sectionType) {
    const data = SECTION_TYPE_PROGRESSIONS[sectionType];
    return data ? data.commonStartingChords : ['I', 'IV', 'vi'];
}

export default {
    SONG_STRUCTURE_TEMPLATES,
    SECTION_TYPE_PROGRESSIONS,
    getTemplate,
    getAllTemplates,
    getSectionProgressions,
    getSectionCharacteristics,
    getCommonStartingChords
};
