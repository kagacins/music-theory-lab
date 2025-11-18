/**
 * Progression Templates Module
 * Enhanced progression templates with categorization, metadata, and arrangement suggestions
 * Part of Phase 3.1: Advanced Harmony Features
 */

import { savePreset, getAllPresets } from '../storage/presetManager.js';

/**
 * Template categories for organization
 */
export const TEMPLATE_CATEGORIES = {
    POP: 'Pop',
    JAZZ: 'Jazz',
    CLASSICAL: 'Classical',
    ROCK: 'Rock',
    BLUES: 'Blues',
    GOSPEL: 'Gospel/Soul',
    WORLD: 'World',
    EDM: 'EDM/Modern',
    CUSTOM: 'Custom'
};

/**
 * Difficulty levels
 */
export const DIFFICULTY_LEVELS = {
    BEGINNER: { level: 1, label: 'Beginner', color: '#10b981' },
    INTERMEDIATE: { level: 2, label: 'Intermediate', color: '#f59e0b' },
    ADVANCED: { level: 3, label: 'Advanced', color: '#ef4444' }
};

/**
 * Enhanced progression templates with full metadata
 */
export const PROGRESSION_TEMPLATES = {
    // ============================================================================
    // POP PROGRESSIONS
    // ============================================================================
    'pop-axis': {
        id: 'pop-axis',
        name: 'I-V-vi-IV (Pop Axis)',
        category: TEMPLATE_CATEGORIES.POP,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['I', 'V', 'vi', 'IV'],
        description: 'The most popular chord progression in modern pop music. Found in countless hits across decades.',
        tags: ['pop', 'beginner', 'common', '4-chord', 'edm', 'anthem'],
        examples: ['"Let It Be" - Beatles', '"Don\'t Stop Believin\'" - Journey', '"Someone Like You" - Adele'],
        alsoKnownAs: [
            {
                name: 'EDM Anthem',
                tempo: 128,
                timeSignature: { num: 4, denom: 4 },
                examples: ['Festival builds', 'Big room drops']
            },
            {
                name: 'Festival Drop',
                tempo: 128,
                timeSignature: { num: 4, denom: 4 },
                examples: ['Tiësto', 'Martin Garrix']
            },
            {
                name: 'Axis of Awesome',
                tempo: 120,
                timeSignature: { num: 4, denom: 4 },
                examples: ['"4 Chords" - Axis of Awesome']
            }
        ],
        arrangement: {
            tempo: 120,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-fifth',
            melodyGuide: 'chord-tones-ascending',
            style: 'pop'
        },
        usage: 'Perfect for uplifting, anthemic choruses and verses. Also commonly used in EDM builds and drops at 128 BPM.'
    },

    'pop-doo-wop': {
        id: 'pop-doo-wop',
        name: 'I-vi-IV-V (Doo-Wop)',
        category: TEMPLATE_CATEGORIES.POP,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['I', 'vi', 'IV', 'V'],
        description: 'Classic 1950s/60s progression with nostalgic, romantic feel.',
        tags: ['pop', '50s', '60s', 'retro', 'beginner'],
        examples: ['"Stand By Me" - Ben E. King', '"In the Still of the Night" - Five Satins'],
        arrangement: {
            tempo: 100,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-fifth',
            melodyGuide: 'stepwise',
            style: 'pop'
        },
        usage: 'Great for romantic ballads and retro-style songs.'
    },

    'pop-sensitive': {
        id: 'pop-sensitive',
        name: 'vi-IV-I-V (Sensitive)',
        category: TEMPLATE_CATEGORIES.POP,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['vi', 'IV', 'I', 'V'],
        description: 'Emotional variation starting on minor chord. More introspective than I-V-vi-IV.',
        tags: ['pop', 'emotional', 'minor-start', 'beginner'],
        examples: ['"Grenade" - Bruno Mars', '"Apologize" - OneRepublic'],
        arrangement: {
            tempo: 85,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-fifth',
            melodyGuide: 'chord-tones-descending',
            style: 'pop'
        },
        usage: 'Perfect for emotional verses and introspective sections.'
    },

    // ============================================================================
    // JAZZ PROGRESSIONS
    // ============================================================================
    'jazz-ii-v-i': {
        id: 'jazz-ii-v-i',
        name: 'ii-V-I (Jazz Turnaround)',
        category: TEMPLATE_CATEGORIES.JAZZ,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['ii7', 'V7', 'Imaj7'],
        description: 'The most fundamental progression in jazz. Creates strong pull to resolution.',
        tags: ['jazz', 'turnaround', 'functional', 'intermediate'],
        examples: ['Found in virtually every jazz standard'],
        arrangement: {
            tempo: 140,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'walking',
            melodyGuide: 'approach-tones',
            style: 'jazz'
        },
        usage: 'Use for turnarounds, cadences, and creating forward motion.'
    },

    'jazz-circle': {
        id: 'jazz-circle',
        name: 'I-vi-ii-V (Circle Progression)',
        category: TEMPLATE_CATEGORIES.JAZZ,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['Imaj7', 'vi7', 'ii7', 'V7'],
        description: 'Classic jazz progression moving through circle of fifths.',
        tags: ['jazz', 'circle-of-fifths', 'smooth', 'intermediate'],
        examples: ['"Blue Moon"', '"Heart and Soul"', '"I Got Rhythm"'],
        arrangement: {
            tempo: 130,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'walking',
            melodyGuide: 'bebop-scale',
            style: 'jazz'
        },
        usage: 'Excellent for verses and A sections in jazz standards.'
    },

    'jazz-rhythm-changes': {
        id: 'jazz-rhythm-changes',
        name: 'Rhythm Changes (A)',
        category: TEMPLATE_CATEGORIES.JAZZ,
        difficulty: DIFFICULTY_LEVELS.ADVANCED,
        progressions: ['Imaj7', 'vi7', 'ii7', 'V7', 'Imaj7', 'vi7', 'ii7', 'V7'],
        description: 'Based on "I Got Rhythm". Foundation for hundreds of jazz tunes.',
        tags: ['jazz', 'bebop', 'standard', 'advanced'],
        examples: ['"Anthropology"', '"Oleo"', '"Moose the Mooche"'],
        arrangement: {
            tempo: 200,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'walking',
            melodyGuide: 'bebop-scale',
            style: 'jazz'
        },
        usage: 'Fast-tempo bebop tunes and solo vehicles.'
    },

    'jazz-minor-ii-v': {
        id: 'jazz-minor-ii-v',
        name: 'ii°-V7-i (Minor ii-V-i)',
        category: TEMPLATE_CATEGORIES.JAZZ,
        difficulty: DIFFICULTY_LEVELS.ADVANCED,
        progressions: ['ii°7', 'V7', 'i7'],
        description: 'Minor version of the jazz turnaround with darker, moodier sound.',
        tags: ['jazz', 'minor', 'turnaround', 'advanced'],
        examples: ['Common in minor jazz tunes and modal compositions'],
        arrangement: {
            tempo: 120,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'walking',
            melodyGuide: 'melodic-minor',
            style: 'jazz'
        },
        usage: 'Minor key jazz pieces and modal compositions.'
    },

    // ============================================================================
    // BLUES PROGRESSIONS
    // ============================================================================
    'blues-12-bar': {
        id: 'blues-12-bar',
        name: '12-Bar Blues',
        category: TEMPLATE_CATEGORIES.BLUES,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
        description: 'The classic 12-bar blues form. Foundation of blues, rock, and jazz.',
        tags: ['blues', 'classic', '12-bar', 'beginner'],
        examples: ['"Sweet Home Chicago"', '"Crossroads"', '"The Thrill Is Gone"'],
        arrangement: {
            tempo: 96,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'shuffle',
            melodyGuide: 'blues-scale',
            style: 'blues'
        },
        usage: 'Blues songs, blues-rock, and boogie-woogie.'
    },

    'blues-12-bar-minor': {
        id: 'blues-12-bar-minor',
        name: '12-Bar Blues (Minor)',
        category: TEMPLATE_CATEGORIES.BLUES,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['i7', 'i7', 'i7', 'i7', 'iv7', 'iv7', 'i7', 'i7', 'V7', 'iv7', 'i7', 'V7'],
        description: 'Minor blues with moodier, more introspective feel.',
        tags: ['blues', 'minor', '12-bar', 'intermediate'],
        examples: ['"St. James Infirmary"', '"Summertime"'],
        arrangement: {
            tempo: 80,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'walking',
            melodyGuide: 'blues-scale',
            style: 'blues'
        },
        usage: 'Moody blues and jazz-blues fusion.'
    },

    'blues-quick-change': {
        id: 'blues-quick-change',
        name: '12-Bar Blues (Quick Change)',
        category: TEMPLATE_CATEGORIES.BLUES,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I7', 'IV7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
        description: 'Blues variation with IV chord in bar 2 for quicker harmonic movement.',
        tags: ['blues', 'variation', '12-bar', 'intermediate'],
        examples: ['Common in Chicago blues and R&B'],
        arrangement: {
            tempo: 120,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'shuffle',
            melodyGuide: 'blues-scale',
            style: 'blues'
        },
        usage: 'Uptempo blues with more harmonic interest.'
    },

    // ============================================================================
    // ROCK PROGRESSIONS
    // ============================================================================
    'rock-i-iv-v': {
        id: 'rock-i-iv-v',
        name: 'I-IV-V (Rock Classic)',
        category: TEMPLATE_CATEGORIES.ROCK,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['I', 'IV', 'V'],
        description: 'The foundation of rock and roll. Simple, powerful, and timeless.',
        tags: ['rock', 'classic', 'power', 'beginner'],
        examples: ['"Louie Louie"', '"Wild Thing"', '"La Bamba"'],
        arrangement: {
            tempo: 140,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-note',
            melodyGuide: 'pentatonic',
            style: 'rock'
        },
        usage: 'Rock anthems and high-energy sections.'
    },

    'rock-mixolydian': {
        id: 'rock-mixolydian',
        name: 'I-bVII-IV (Mixolydian Rock)',
        category: TEMPLATE_CATEGORIES.ROCK,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I', 'bVII', 'IV', 'I'],
        description: 'Rock progression using the flat-7th for modal flavor. Also common in Celtic/folk music.',
        tags: ['rock', 'modal', 'mixolydian', 'intermediate', 'celtic', 'folk'],
        examples: ['"Sweet Home Alabama"', '"Sympathy for the Devil"', 'Traditional Irish music'],
        alsoKnownAs: [
            {
                name: 'Celtic Modal',
                tempo: 90,
                timeSignature: { num: 4, denom: 4 },
                examples: ['Traditional Celtic tunes', 'Celtic rock']
            },
            {
                name: 'Irish Folk',
                tempo: 100,
                timeSignature: { num: 4, denom: 4 },
                examples: ['Traditional Irish music', 'The Dubliners']
            },
            {
                name: 'Mixolydian Vamp',
                tempo: 110,
                timeSignature: { num: 4, denom: 4 },
                examples: ['Southern rock jams', 'Grateful Dead']
            }
        ],
        arrangement: {
            tempo: 110,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-note',
            melodyGuide: 'mixolydian-scale',
            style: 'rock'
        },
        usage: 'Southern rock and classic rock with modal flavor. Also used in Celtic music with drone bass.'
    },

    'rock-power-ballad': {
        id: 'rock-power-ballad',
        name: 'I-V-vi-iii-IV (Power Ballad)',
        category: TEMPLATE_CATEGORIES.ROCK,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'],
        description: 'Extended progression for dramatic rock ballads.',
        tags: ['rock', 'ballad', 'dramatic', 'intermediate'],
        examples: ['Common in 80s rock ballads'],
        arrangement: {
            tempo: 72,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-fifth',
            melodyGuide: 'chord-tones-ascending',
            style: 'rock'
        },
        usage: 'Epic rock ballads and emotional choruses.'
    },

    // ============================================================================
    // CLASSICAL PROGRESSIONS
    // ============================================================================
    'classical-authentic-cadence': {
        id: 'classical-authentic-cadence',
        name: 'I-IV-V-I (Authentic Cadence)',
        category: TEMPLATE_CATEGORIES.CLASSICAL,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['I', 'IV', 'V', 'I'],
        description: 'Perfect authentic cadence. The most conclusive ending in tonal music.',
        tags: ['classical', 'cadence', 'resolution', 'beginner'],
        examples: ['Found in virtually all classical music'],
        arrangement: {
            tempo: 90,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-note',
            melodyGuide: 'scale-stepwise',
            style: 'classical'
        },
        usage: 'Final cadences and strong resolutions.'
    },

    'classical-andalusian': {
        id: 'classical-andalusian',
        name: 'i-bVII-bVI-V (Andalusian)',
        category: TEMPLATE_CATEGORIES.CLASSICAL,
        difficulty: DIFFICULTY_LEVELS.ADVANCED,
        progressions: ['i', 'bVII', 'bVI', 'V'],
        description: 'Spanish-influenced descending progression with dramatic flair.',
        tags: ['classical', 'spanish', 'descending', 'advanced', 'flamenco'],
        examples: ['"Hit the Road Jack"', 'Common in flamenco'],
        alsoKnownAs: [
            {
                name: 'Flamenco Cadence',
                tempo: 120,
                timeSignature: { num: 4, denom: 4 },
                examples: ['Flamenco guitar', 'Paco de Lucía']
            },
            {
                name: 'Spanish Progression',
                tempo: 100,
                timeSignature: { num: 4, denom: 4 },
                examples: ['Spanish classical', 'Rodrigo']
            },
            {
                name: 'Phrygian Descent',
                tempo: 80,
                timeSignature: { num: 4, denom: 4 },
                examples: ['Metal intros', 'Dramatic passages']
            }
        ],
        arrangement: {
            tempo: 100,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'descending',
            melodyGuide: 'phrygian-scale',
            style: 'classical'
        },
        usage: 'Dramatic, Spanish-flavored pieces. Also extensively used in Flamenco and World music.'
    },

    'classical-circle-fifths': {
        id: 'classical-circle-fifths',
        name: 'I-IV-vii°-iii-vi-ii-V-I (Circle of 5ths)',
        category: TEMPLATE_CATEGORIES.CLASSICAL,
        difficulty: DIFFICULTY_LEVELS.ADVANCED,
        progressions: ['I', 'IV', 'vii°', 'iii', 'vi', 'ii', 'V', 'I'],
        description: 'Complete circle of fifths progression. Maximum harmonic movement.',
        tags: ['classical', 'circle-of-fifths', 'comprehensive', 'advanced'],
        examples: ['Common in Baroque music, especially Bach'],
        arrangement: {
            tempo: 80,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'descending-fifths',
            melodyGuide: 'contrapuntal',
            style: 'classical'
        },
        usage: 'Baroque-style pieces and comprehensive harmonic journeys.'
    },

    'classical-minor-progression': {
        id: 'classical-minor-progression',
        name: 'i-iv-V-i (Minor Basic)',
        category: TEMPLATE_CATEGORIES.CLASSICAL,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['i', 'iv', 'V', 'i'],
        description: 'Basic minor key progression with harmonic minor V chord.',
        tags: ['classical', 'minor', 'basic', 'beginner'],
        examples: ['Common in classical minor key pieces'],
        arrangement: {
            tempo: 90,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-note',
            melodyGuide: 'harmonic-minor',
            style: 'classical'
        },
        usage: 'Minor key compositions and melancholic pieces.'
    },

    // ============================================================================
    // NON-4/4 TIME SIGNATURE PROGRESSIONS
    // ============================================================================
    'waltz-3-4': {
        id: 'waltz-3-4',
        name: 'I-V-I Waltz (3/4)',
        category: TEMPLATE_CATEGORIES.CLASSICAL,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['I', 'V', 'I'],
        description: 'Classic waltz progression in 3/4 time. The quintessential dance feel.',
        tags: ['waltz', '3/4', 'dance', 'classical', '3-4'],
        examples: ['"The Blue Danube" - Strauss', 'Most Viennese waltzes'],
        arrangement: {
            tempo: 180,
            timeSignature: { num: 3, denom: 4 },
            measuresPerChord: 4,
            bassPattern: 'oom-pah-pah',
            melodyGuide: 'waltz-style',
            style: 'classical'
        },
        usage: 'Waltzes, dance music, and elegant classical pieces.'
    },

    'folk-waltz-3-4': {
        id: 'folk-waltz-3-4',
        name: 'I-IV-I-V Waltz (3/4)',
        category: TEMPLATE_CATEGORIES.CLASSICAL,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I', 'IV', 'I', 'V', 'I'],
        description: 'Extended waltz progression with subdominant movement.',
        tags: ['waltz', '3/4', 'folk', 'classical', '3-4'],
        examples: ['Folk waltzes, country waltzes'],
        arrangement: {
            tempo: 160,
            timeSignature: { num: 3, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'oom-pah-pah',
            melodyGuide: 'stepwise',
            style: 'classical'
        },
        usage: 'Folk music, country waltzes, and traditional dance.'
    },

    'jazz-waltz-3-4': {
        id: 'jazz-waltz-3-4',
        name: 'Jazz Waltz (3/4)',
        category: TEMPLATE_CATEGORIES.JAZZ,
        difficulty: DIFFICULTY_LEVELS.ADVANCED,
        progressions: ['Imaj7', 'vi7', 'ii7', 'V7'],
        description: 'Jazz waltz with sophisticated harmony. Elegant and swinging in 3/4.',
        tags: ['jazz', 'waltz', '3/4', 'sophisticated', 'advanced', '3-4'],
        examples: ['"Alice in Wonderland"', '"Someday My Prince Will Come"'],
        arrangement: {
            tempo: 140,
            timeSignature: { num: 3, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'walking-waltz',
            melodyGuide: 'bebop-scale',
            style: 'jazz'
        },
        usage: 'Jazz waltzes, sophisticated ballads.'
    },

    'irish-jig-6-8': {
        id: 'irish-jig-6-8',
        name: 'Irish Jig (6/8)',
        category: TEMPLATE_CATEGORIES.ROCK,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I', 'IV', 'I', 'V'],
        description: 'Traditional Irish jig in 6/8 time. Lively and dance-like.',
        tags: ['irish', 'jig', '6/8', 'folk', 'dance', '6-8'],
        examples: ['Traditional Irish jigs and reels'],
        arrangement: {
            tempo: 120,
            timeSignature: { num: 6, denom: 8 },
            measuresPerChord: 2,
            bassPattern: 'oom-pah-pah-oom-pah-pah',
            melodyGuide: 'celtic-scale',
            style: 'folk'
        },
        usage: 'Celtic music, jigs, and folk dances.'
    },

    'take-five-5-4': {
        id: 'take-five-5-4',
        name: 'Take Five Style (5/4)',
        category: TEMPLATE_CATEGORIES.JAZZ,
        difficulty: DIFFICULTY_LEVELS.ADVANCED,
        progressions: ['ii7', 'V7', 'Imaj7', 'Imaj7'],
        description: 'Jazz progression in 5/4 time, inspired by "Take Five".',
        tags: ['jazz', '5/4', 'modal', 'advanced', 'brubeck', '5-4'],
        examples: ['"Take Five" - Dave Brubeck'],
        arrangement: {
            tempo: 168,
            timeSignature: { num: 5, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'walking',
            melodyGuide: 'modal-jazz',
            style: 'jazz'
        },
        usage: 'Modal jazz, experimental compositions.'
    },

    'progressive-7-4': {
        id: 'progressive-7-4',
        name: 'Progressive Rock (7/4)',
        category: TEMPLATE_CATEGORIES.ROCK,
        difficulty: DIFFICULTY_LEVELS.ADVANCED,
        progressions: ['i', 'bVII', 'IV', 'i'],
        description: 'Progressive rock progression in 7/4 time. Complex and hypnotic.',
        tags: ['prog-rock', '7/4', 'complex', 'advanced', 'experimental', '7-4'],
        examples: ['"Money" - Pink Floyd (7/4 sections)'],
        arrangement: {
            tempo: 100,
            timeSignature: { num: 7, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-note',
            melodyGuide: 'modal',
            style: 'rock'
        },
        usage: 'Progressive rock, art rock, experimental music.'
    },

    // ============================================================================
    // ADDITIONAL POP PROGRESSIONS
    // ============================================================================
    'pop-happy': {
        id: 'pop-happy',
        name: 'I-IV-vi-V (Pop Happy)',
        category: TEMPLATE_CATEGORIES.POP,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['I', 'IV', 'vi', 'V'],
        description: 'Bright, optimistic progression that delays the minor chord for maximum uplift.',
        tags: ['pop', 'happy', 'upbeat', 'chorus'],
        examples: ['"Shut Up and Dance" - Walk the Moon', '"Roar" - Katy Perry'],
        arrangement: {
            tempo: 128,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'driving-eighths',
            melodyGuide: 'chord-tones-ascending',
            style: 'dance-pop'
        },
        usage: 'Perfect for upbeat choruses and feel-good anthems.'
    },

    'pop-journey': {
        id: 'pop-journey',
        name: 'I-V-vi-iii-IV (Journey)',
        category: TEMPLATE_CATEGORIES.POP,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I', 'V', 'vi', 'iii', 'IV'],
        description: 'Extended pop progression with the iii chord adding sophistication.',
        tags: ['pop', 'emotional', 'extended', '5-chord'],
        examples: ['"Demons" - Imagine Dragons', '"Mirrors" - Justin Timberlake'],
        arrangement: {
            tempo: 90,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-fifth',
            melodyGuide: 'stepwise',
            style: 'power-ballad'
        },
        usage: 'Good for verses that need more harmonic movement before a simple chorus.'
    },

    'pop-80s-power': {
        id: 'pop-80s-power',
        name: '80s Power Ballad',
        category: TEMPLATE_CATEGORIES.POP,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I', 'V', 'vi', 'IV', 'I', 'V', 'IV'],
        description: 'Extended 80s-style progression with repeated resolution.',
        tags: ['80s', 'power-ballad', 'anthemic', 'retro'],
        examples: ['"Total Eclipse of the Heart" - Bonnie Tyler', '"Alone" - Heart'],
        arrangement: {
            tempo: 76,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-octave',
            melodyGuide: 'dramatic-arc',
            style: '80s-ballad'
        },
        usage: 'Ideal for dramatic, building sections with emotional peaks.'
    },

    'pop-millenial-whoop': {
        id: 'pop-millenial-whoop',
        name: 'I-V-vi-V (Millennial)',
        category: TEMPLATE_CATEGORIES.POP,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['I', 'V', 'vi', 'V'],
        description: 'Variation that returns to V for continuous momentum.',
        tags: ['pop', 'modern', '2010s', 'chorus'],
        examples: ['"California Gurls" - Katy Perry', '"Good Time" - Owl City'],
        arrangement: {
            tempo: 126,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'driving-eighths',
            melodyGuide: 'pentatonic',
            style: 'summer-pop'
        },
        usage: 'Creates an infectious, endless loop feel perfect for hooks.'
    },

    'pop-chromatic-mediant': {
        id: 'pop-chromatic-mediant',
        name: 'I-bVI-IV-V (Chromatic)',
        category: TEMPLATE_CATEGORIES.POP,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I', 'bVI', 'IV', 'V'],
        description: 'Borrowed bVI chord adds unexpected color and drama.',
        tags: ['pop', 'dramatic', 'borrowed-chord', 'cinematic'],
        examples: ['"Radioactive" - Imagine Dragons', '"Rolling in the Deep" - Adele'],
        arrangement: {
            tempo: 92,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-fifth',
            melodyGuide: 'dramatic-arc',
            style: 'epic-pop'
        },
        usage: 'Creates a dramatic, cinematic quality. The bVI is a striking moment.'
    },

    'pop-singer-songwriter': {
        id: 'pop-singer-songwriter',
        name: 'I-V7-vi-IV (Singer-Songwriter)',
        category: TEMPLATE_CATEGORIES.POP,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I', 'V7', 'vi', 'IV'],
        description: 'Classic with dominant 7th for rootsy, organic feel.',
        tags: ['acoustic', 'folk-pop', 'intimate', 'organic'],
        examples: ['"Riptide" - Vance Joy', '"Ho Hey" - Lumineers'],
        arrangement: {
            tempo: 108,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-fifth',
            melodyGuide: 'singable',
            style: 'acoustic-pop'
        },
        usage: 'Perfect for acoustic performances and singer-songwriter material.'
    },

    // ============================================================================
    // ADDITIONAL JAZZ PROGRESSIONS
    // ============================================================================
    'jazz-autumn-leaves': {
        id: 'jazz-autumn-leaves',
        name: 'Autumn Leaves Changes',
        category: TEMPLATE_CATEGORIES.JAZZ,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['ii7', 'V7', 'Imaj7', 'IVmaj7', 'vii°7', 'III7', 'vi7'],
        description: 'The famous Autumn Leaves A section progression.',
        tags: ['jazz', 'standard', 'autumn-leaves', 'essential'],
        examples: ['"Autumn Leaves" - Joseph Kosma'],
        arrangement: {
            tempo: 140,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'walking',
            melodyGuide: 'bebop-lines',
            style: 'swing'
        },
        usage: 'One of the most important jazz progressions to learn. Cycles through related keys.'
    },

    'jazz-coltrane-changes': {
        id: 'jazz-coltrane-changes',
        name: 'Coltrane Changes',
        category: TEMPLATE_CATEGORIES.JAZZ,
        difficulty: DIFFICULTY_LEVELS.ADVANCED,
        progressions: ['Imaj7', 'bIII7', 'bVImaj7', 'VII7', 'bIImaj7', 'bV7'],
        description: 'Giant Steps-inspired movement by major thirds.',
        tags: ['jazz', 'advanced', 'coltrane', 'giant-steps'],
        examples: ['"Giant Steps" - John Coltrane', '"Countdown" - John Coltrane'],
        arrangement: {
            tempo: 280,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'walking-fast',
            melodyGuide: 'arpeggios',
            style: 'bebop'
        },
        usage: 'Advanced harmony moving through major third cycles. Very challenging to improvise over.'
    },

    'jazz-tritone-sub': {
        id: 'jazz-tritone-sub',
        name: 'ii-bII7-I (Tritone Sub)',
        category: TEMPLATE_CATEGORIES.JAZZ,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['ii7', 'bII7', 'Imaj7'],
        description: 'Classic tritone substitution replacing V7 with bII7.',
        tags: ['jazz', 'substitution', 'chromatic', 'bebop'],
        examples: ['Common bebop device'],
        arrangement: {
            tempo: 140,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'chromatic-descent',
            melodyGuide: 'bebop-lines',
            style: 'bebop'
        },
        usage: 'Creates smooth chromatic bass line (D-Db-C in key of C). Very hip sound.'
    },

    'jazz-backdoor': {
        id: 'jazz-backdoor',
        name: 'iv7-bVII7-I (Backdoor)',
        category: TEMPLATE_CATEGORIES.JAZZ,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['iv7', 'bVII7', 'Imaj7'],
        description: 'Approach tonic from a step above instead of below.',
        tags: ['jazz', 'backdoor', 'surprise', 'sophisticated'],
        examples: ['"There Will Never Be Another You"', '"Stella by Starlight"'],
        arrangement: {
            tempo: 130,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'walking',
            melodyGuide: 'mixolydian',
            style: 'swing'
        },
        usage: 'Unexpected resolution that sounds fresh. Great for endings and turnarounds.'
    },

    'jazz-bird-blues': {
        id: 'jazz-bird-blues',
        name: 'Bird Blues (Bebop)',
        category: TEMPLATE_CATEGORIES.JAZZ,
        difficulty: DIFFICULTY_LEVELS.ADVANCED,
        progressions: ['I7', 'bVII7', 'VI7', 'bVI7', 'V7', 'bV7', 'IV7', '#IVdim7', 'I7', 'VI7', 'ii7', 'V7'],
        description: 'Charlie Parker\'s sophisticated reharmonization of the 12-bar blues.',
        tags: ['jazz', 'bebop', 'blues', 'advanced', 'parker'],
        examples: ['"Blues for Alice" - Charlie Parker', '"Chi Chi" - Charlie Parker'],
        arrangement: {
            tempo: 180,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'walking',
            melodyGuide: 'bebop-scales',
            style: 'bebop'
        },
        usage: 'Advanced blues with chromatic ii-V patterns. Essential for bebop vocabulary.'
    },

    'jazz-modal-so-what': {
        id: 'jazz-modal-so-what',
        name: 'So What Changes',
        category: TEMPLATE_CATEGORIES.JAZZ,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['i7', 'i7', 'i7', 'i7', 'bii7', 'bii7', 'i7', 'i7'],
        description: 'Modal jazz - 8 bars of Dm7, 8 bars transposed, simplified from full form.',
        tags: ['jazz', 'modal', 'miles-davis', 'kind-of-blue'],
        examples: ['"So What" - Miles Davis', '"Impressions" - John Coltrane'],
        arrangement: {
            tempo: 136,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'modal-vamp',
            melodyGuide: 'dorian',
            style: 'modal-jazz'
        },
        usage: 'Focus on melodic development over static harmony. Use Dorian mode.'
    },

    'jazz-lady-bird': {
        id: 'jazz-lady-bird',
        name: 'Lady Bird Turnaround',
        category: TEMPLATE_CATEGORIES.JAZZ,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['Imaj7', 'bIIImaj7', 'bVImaj7', 'bIImaj7'],
        description: 'Tadd Dameron\'s famous turnaround moving down by minor thirds.',
        tags: ['jazz', 'turnaround', 'dameron', 'chromatic'],
        examples: ['"Lady Bird" - Tadd Dameron'],
        arrangement: {
            tempo: 140,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'walking',
            melodyGuide: 'major-7-arpeggios',
            style: 'swing'
        },
        usage: 'Beautiful chromatic major 7th movement. Can substitute for a standard turnaround.'
    },

    'jazz-bossa-nova': {
        id: 'jazz-bossa-nova',
        name: 'Bossa Nova Progression',
        category: TEMPLATE_CATEGORIES.JAZZ,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['Imaj7', 'vii°7', 'II7', 'ii7', 'bII7', 'Imaj7', 'bVImaj7', 'V7'],
        description: 'Brazilian jazz progression with chromatic movement.',
        tags: ['jazz', 'bossa', 'brazilian', 'latin'],
        examples: ['"The Girl from Ipanema"', '"Wave" - Antonio Carlos Jobim'],
        arrangement: {
            tempo: 140,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'bossa',
            melodyGuide: 'smooth-lines',
            style: 'bossa-nova'
        },
        usage: 'Use the bossa nova rhythmic pattern. Smooth, sophisticated harmony.'
    },

    'jazz-rhythm-bridge': {
        id: 'jazz-rhythm-bridge',
        name: 'Rhythm Changes Bridge',
        category: TEMPLATE_CATEGORIES.JAZZ,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['III7', 'III7', 'VI7', 'VI7', 'II7', 'II7', 'V7', 'V7'],
        description: 'The bridge section of Rhythm Changes (dominants descending in fourths).',
        tags: ['jazz', 'rhythm-changes', 'bridge', 'dominants'],
        examples: ['Any Rhythm Changes tune bridge'],
        arrangement: {
            tempo: 200,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'walking',
            melodyGuide: 'mixolydian',
            style: 'bebop'
        },
        usage: 'Classic dominant chain. Each chord is the V7 of the next.'
    },

    // ============================================================================
    // ADDITIONAL BLUES PROGRESSIONS
    // ============================================================================
    'blues-jazz': {
        id: 'blues-jazz',
        name: 'Jazz Blues',
        category: TEMPLATE_CATEGORIES.BLUES,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I7', 'IV7', 'I7', 'vi7', 'ii7', 'V7', 'I7', 'VI7', 'ii7', 'V7', 'I7', 'V7'],
        description: 'Jazzed up blues with ii-V patterns and passing chords.',
        tags: ['blues', 'jazz', 'bebop', 'sophisticated'],
        examples: ['"Billie\'s Bounce" - Charlie Parker', '"Now\'s the Time" - Charlie Parker'],
        arrangement: {
            tempo: 140,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'walking',
            melodyGuide: 'bebop-blues',
            style: 'bebop'
        },
        usage: 'Standard bebop blues form. Practice ii-V vocabulary in bars 4 and 9-10.'
    },

    'blues-stormy-monday': {
        id: 'blues-stormy-monday',
        name: 'Stormy Monday Blues',
        category: TEMPLATE_CATEGORIES.BLUES,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I9', 'IV9', 'I9', 'I9', 'IV9', '#IVdim7', 'I9', 'VI7', 'ii9', 'V9', 'I9', 'II9'],
        description: 'T-Bone Walker\'s sophisticated blues with 9th chords and diminished passing chord.',
        tags: ['blues', 'sophisticated', 't-bone-walker', '9th-chords'],
        examples: ['"Stormy Monday" - T-Bone Walker'],
        arrangement: {
            tempo: 60,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'slow-blues',
            melodyGuide: 'bluesy-9ths',
            style: 'slow-blues'
        },
        usage: 'Slow, sophisticated blues with extended chords. The #IVdim7 is iconic.'
    },

    'blues-eight-bar': {
        id: 'blues-eight-bar',
        name: '8-Bar Blues',
        category: TEMPLATE_CATEGORIES.BLUES,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['I7', 'I7', 'IV7', 'IV7', 'V7', 'IV7', 'I7', 'V7'],
        description: 'Compact 8-bar blues form.',
        tags: ['blues', '8-bar', 'compact'],
        examples: ['"Key to the Highway"', '"Worried Life Blues"'],
        arrangement: {
            tempo: 100,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'shuffle',
            melodyGuide: 'blues-scale',
            style: 'traditional-blues'
        },
        usage: 'Quicker blues form. Works well for certain traditional blues songs.'
    },

    'blues-16-bar': {
        id: 'blues-16-bar',
        name: '16-Bar Blues',
        category: TEMPLATE_CATEGORIES.BLUES,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'V7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
        description: 'Extended 16-bar blues form with doubled measures.',
        tags: ['blues', '16-bar', 'extended'],
        examples: ['"Watermelon Man" - Herbie Hancock', '"Hoochie Coochie Man"'],
        arrangement: {
            tempo: 100,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'funky',
            melodyGuide: 'blues-scale',
            style: 'funk-blues'
        },
        usage: 'Extended form gives more space for development. Common in funk and soul.'
    },

    // ============================================================================
    // ADDITIONAL ROCK PROGRESSIONS
    // ============================================================================
    'rock-power-chord': {
        id: 'rock-power-chord',
        name: 'I-bVII-IV (Power Rock)',
        category: TEMPLATE_CATEGORIES.ROCK,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['I', 'bVII', 'IV'],
        description: 'Classic rock riff using Mixolydian bVII.',
        tags: ['rock', 'power-chords', 'riff', 'mixolydian'],
        examples: ['"Sweet Child O\' Mine" - GNR', '"You Really Got Me" - The Kinks'],
        arrangement: {
            tempo: 120,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-octave',
            melodyGuide: 'pentatonic',
            style: 'hard-rock'
        },
        usage: 'Classic rock sound with the bVII giving that rock edge. Use power chords.'
    },

    'rock-grunge': {
        id: 'rock-grunge',
        name: 'i-bVI-bIII-bVII (Grunge)',
        category: TEMPLATE_CATEGORIES.ROCK,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['i', 'bVI', 'bIII', 'bVII'],
        description: 'Natural minor/Aeolian progression used in 90s grunge and modern EDM.',
        tags: ['grunge', '90s', 'alternative', 'minor', 'dubstep', 'edm'],
        examples: ['"Come as You Are" - Nirvana', '"Black Hole Sun" - Soundgarden', 'Skrillex drops'],
        alsoKnownAs: [
            {
                name: 'Dubstep Build',
                tempo: 140,
                timeSignature: { num: 4, denom: 4 },
                examples: ['Skrillex', 'Excision', 'Bass drops']
            },
            {
                name: 'Aeolian Vamp',
                tempo: 100,
                timeSignature: { num: 4, denom: 4 },
                examples: ['Modal rock', 'Ambient metal']
            },
            {
                name: 'Epic Minor',
                tempo: 90,
                timeSignature: { num: 4, denom: 4 },
                examples: ['Trailer music', 'Epic orchestral']
            }
        ],
        arrangement: {
            tempo: 116,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-fifth',
            melodyGuide: 'aeolian',
            style: 'grunge'
        },
        usage: 'Dark, moody sound using all chords from natural minor scale. Also popular for dubstep builds at 140 BPM with 4 measures per chord.'
    },

    'rock-metal-doom': {
        id: 'rock-metal-doom',
        name: 'i-bII-i-bVI (Doom Metal)',
        category: TEMPLATE_CATEGORIES.ROCK,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['i', 'bII', 'i', 'bVI'],
        description: 'Phrygian-influenced heavy metal progression.',
        tags: ['metal', 'doom', 'phrygian', 'heavy'],
        examples: ['"Black Sabbath" - Black Sabbath', '"South of Heaven" - Slayer'],
        arrangement: {
            tempo: 60,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 4,
            bassPattern: 'slow-root',
            melodyGuide: 'phrygian',
            style: 'doom-metal'
        },
        usage: 'The bII creates extreme darkness. Play slow and heavy.'
    },

    'rock-blues-rock': {
        id: 'rock-blues-rock',
        name: 'I-IV-I-V-IV-I (Blues Rock)',
        category: TEMPLATE_CATEGORIES.ROCK,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['I', 'IV', 'I', 'V', 'IV', 'I'],
        description: 'Straight-ahead blues-rock shuffle pattern.',
        tags: ['rock', 'blues-rock', 'shuffle', 'classic'],
        examples: ['"La Grange" - ZZ Top', '"Rock and Roll" - Led Zeppelin'],
        arrangement: {
            tempo: 170,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'shuffle-bass',
            melodyGuide: 'pentatonic',
            style: 'blues-rock'
        },
        usage: 'High energy blues-rock. Use the shuffle rhythm and pentatonic licks.'
    },

    'rock-anthemic': {
        id: 'rock-anthemic',
        name: 'I-V-bVII-IV (Stadium Rock)',
        category: TEMPLATE_CATEGORIES.ROCK,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['I', 'V', 'bVII', 'IV'],
        description: 'Big, anthemic progression for arena rock.',
        tags: ['rock', 'anthem', 'stadium', 'uplifting'],
        examples: ['"Livin\' on a Prayer" - Bon Jovi', '"Don\'t Stop Believin\'" - Journey'],
        arrangement: {
            tempo: 124,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'driving-eighths',
            melodyGuide: 'singable',
            style: 'arena-rock'
        },
        usage: 'The bVII gives that triumphant, fist-pumping feel. Build to big chorus.'
    },

    // ============================================================================
    // ADDITIONAL CLASSICAL PROGRESSIONS
    // ============================================================================
    'classical-romanesca': {
        id: 'classical-romanesca',
        name: 'Romanesca',
        category: TEMPLATE_CATEGORIES.CLASSICAL,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I', 'V', 'vi', 'III', 'IV', 'I', 'IV', 'V'],
        description: 'Renaissance-era ground bass pattern, ancestor of the pop progression.',
        tags: ['classical', 'renaissance', 'ground-bass', 'historical'],
        examples: ['Greensleeves (modified)', 'Many Renaissance dances'],
        arrangement: {
            tempo: 72,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'descending-bass',
            melodyGuide: 'counterpoint',
            style: 'renaissance'
        },
        usage: 'Historical progression showing the origin of modern pop harmony.'
    },

    'classical-lament': {
        id: 'classical-lament',
        name: 'Lament Bass',
        category: TEMPLATE_CATEGORIES.CLASSICAL,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['i', 'vii°', 'III', 'VII', 'iv', 'i', 'V', 'i'],
        description: 'Descending chromatic bass line expressing grief.',
        tags: ['classical', 'baroque', 'lament', 'chromatic'],
        examples: ['"Dido\'s Lament" - Purcell', '"Crucifixus" - Bach'],
        arrangement: {
            tempo: 54,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'chromatic-descent',
            melodyGuide: 'expressive',
            style: 'baroque'
        },
        usage: 'Expresses deep sorrow through chromatically descending bass. Very powerful.'
    },

    'classical-deceptive': {
        id: 'classical-deceptive',
        name: 'Deceptive Expansion',
        category: TEMPLATE_CATEGORIES.CLASSICAL,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I', 'IV', 'V', 'vi', 'IV', 'V', 'I'],
        description: 'Uses deceptive cadence to extend the phrase.',
        tags: ['classical', 'deceptive', 'cadence', 'extension'],
        examples: ['Common classical phrase structure'],
        arrangement: {
            tempo: 100,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'classical-bass',
            melodyGuide: 'melodic-arc',
            style: 'classical'
        },
        usage: 'The V-vi deceptive cadence surprises, requiring another V-I to resolve.'
    },

    'classical-baroque-sequence': {
        id: 'classical-baroque-sequence',
        name: 'Baroque Sequence',
        category: TEMPLATE_CATEGORIES.CLASSICAL,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I', 'IV', 'vii°', 'iii', 'vi', 'ii', 'V', 'I'],
        description: 'Descending thirds sequence through all diatonic chords.',
        tags: ['classical', 'baroque', 'sequence', 'diatonic'],
        examples: ['Bach, Vivaldi sequences'],
        arrangement: {
            tempo: 80,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'arpeggiated',
            melodyGuide: 'sequences',
            style: 'baroque'
        },
        usage: 'Pattern moves down by thirds, up by fourth. Classic Baroque idiom.'
    },

    'classical-pachelbel': {
        id: 'classical-pachelbel',
        name: 'Pachelbel Canon',
        category: TEMPLATE_CATEGORIES.CLASSICAL,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'],
        description: 'The famous Canon in D progression.',
        tags: ['classical', 'baroque', 'pachelbel', 'canon'],
        examples: ['"Canon in D" - Pachelbel'],
        arrangement: {
            tempo: 60,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'descending-bass',
            melodyGuide: 'counterpoint',
            style: 'baroque'
        },
        usage: 'One of the most famous classical progressions. Used in countless modern songs.'
    },

    // ============================================================================
    // GOSPEL/SOUL PROGRESSIONS
    // ============================================================================
    'gospel-amen': {
        id: 'gospel-amen',
        name: 'IV-I (Amen Cadence)',
        category: TEMPLATE_CATEGORIES.GOSPEL,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['IV', 'I', 'IV', 'I'],
        description: 'The plagal "Amen" cadence repeated for gospel feel.',
        tags: ['gospel', 'church', 'plagal', 'worship'],
        examples: ['Church hymns', 'Traditional gospel endings'],
        arrangement: {
            tempo: 76,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'gospel-bass',
            melodyGuide: 'pentatonic',
            style: 'gospel'
        },
        usage: 'The fundamental gospel sound. Repeat for church ending feel.'
    },

    'gospel-shout': {
        id: 'gospel-shout',
        name: 'I-IV-I-V-IV-I (Gospel Shout)',
        category: TEMPLATE_CATEGORIES.GOSPEL,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['I', 'IV', 'I', 'V', 'IV', 'I'],
        description: 'High-energy gospel progression for praise sections.',
        tags: ['gospel', 'praise', 'shout', 'energetic'],
        examples: ['Traditional gospel music', 'Kirk Franklin'],
        arrangement: {
            tempo: 140,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'gospel-walking',
            melodyGuide: 'call-response',
            style: 'gospel-shout'
        },
        usage: 'Used during high-energy praise moments. Add 7ths and 9ths for color.'
    },

    'gospel-modern': {
        id: 'gospel-modern',
        name: 'I-iii7-vi7-IV (Contemporary Gospel)',
        category: TEMPLATE_CATEGORIES.GOSPEL,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['Imaj7', 'iii7', 'vi7', 'IVmaj7'],
        description: 'Modern worship/gospel progression with 7th chords throughout.',
        tags: ['gospel', 'contemporary', 'worship', 'modern'],
        examples: ['Hillsong', 'Elevation Worship', 'Maverick City'],
        arrangement: {
            tempo: 72,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'sustained',
            melodyGuide: 'soaring',
            style: 'modern-worship'
        },
        usage: 'Smooth, modern worship sound. Let chords ring with extensions.'
    },

    'gospel-soul-turnaround': {
        id: 'gospel-soul-turnaround',
        name: 'I-vi-ii-V (Soul Turnaround)',
        category: TEMPLATE_CATEGORIES.GOSPEL,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['I', 'vi', 'ii', 'V'],
        description: 'Classic soul/R&B turnaround.',
        tags: ['soul', 'r&b', 'turnaround', 'motown'],
        examples: ['"Stand by Me" - Ben E. King', '"Earth Angel"'],
        arrangement: {
            tempo: 76,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-fifth',
            melodyGuide: 'soulful',
            style: 'soul'
        },
        usage: 'The classic doo-wop/soul progression. Add 7ths for more sophistication.'
    },

    'gospel-rb-vamp': {
        id: 'gospel-rb-vamp',
        name: 'Imaj9-IVmaj9 (R&B Vamp)',
        category: TEMPLATE_CATEGORIES.GOSPEL,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['Imaj9', 'IVmaj9', 'Imaj9', 'IVmaj9'],
        description: 'Two-chord R&B vamp with lush extensions.',
        tags: ['r&b', 'neo-soul', 'vamp', 'smooth'],
        examples: ['"No Diggity"', 'D\'Angelo', 'Erykah Badu'],
        arrangement: {
            tempo: 90,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'syncopated',
            melodyGuide: 'melismatic',
            style: 'neo-soul'
        },
        usage: 'Hypnotic two-chord groove. Focus on rhythm and vocal runs.'
    },

    'gospel-neo-soul': {
        id: 'gospel-neo-soul',
        name: 'vi9-V9-IVmaj9-Imaj9 (Neo-Soul)',
        category: TEMPLATE_CATEGORIES.GOSPEL,
        difficulty: DIFFICULTY_LEVELS.ADVANCED,
        progressions: ['vi9', 'V9', 'IVmaj9', 'Imaj9'],
        description: 'Sophisticated neo-soul with 9th chords.',
        tags: ['neo-soul', 'r&b', 'sophisticated', 'modern'],
        examples: ['"Untitled (How Does It Feel)" - D\'Angelo'],
        arrangement: {
            tempo: 75,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'electric-bass',
            melodyGuide: 'jazzy-r&b',
            style: 'neo-soul'
        },
        usage: 'Lush, jazzy R&B sound. All 9th chords for that modern vibe.'
    },

    'gospel-worship-build': {
        id: 'gospel-worship-build',
        name: 'IV-V-vi-I (Worship Build)',
        category: TEMPLATE_CATEGORIES.GOSPEL,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['IV', 'V', 'vi', 'I'],
        description: 'Reordered pop progression common in worship music.',
        tags: ['worship', 'contemporary', 'building', 'anthemic'],
        examples: ['"Oceans" - Hillsong', '"Good Good Father"'],
        arrangement: {
            tempo: 68,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'sustained',
            melodyGuide: 'ascending',
            style: 'modern-worship'
        },
        usage: 'Starting on IV creates lift. Great for building worship sections.'
    },

    'gospel-soul-bridge': {
        id: 'gospel-soul-bridge',
        name: 'iii7-vi7-ii7-V7 (Soul Bridge)',
        category: TEMPLATE_CATEGORIES.GOSPEL,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['iii7', 'vi7', 'ii7', 'V7'],
        description: 'Descending diatonic 7th chords for soul bridges.',
        tags: ['soul', 'bridge', 'sophisticated', 'descending'],
        examples: ['Classic Motown bridges'],
        arrangement: {
            tempo: 88,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'walking',
            melodyGuide: 'soulful',
            style: 'soul'
        },
        usage: 'Smooth descending 7th chords. Great for contrasting bridge sections.'
    },

    // ============================================================================
    // WORLD PROGRESSIONS
    // ============================================================================
    'world-flamenco': {
        id: 'world-flamenco',
        name: 'i-VII-VI-V (Andalusian)',
        category: TEMPLATE_CATEGORIES.WORLD,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['i', 'VII', 'VI', 'V'],
        description: 'Descending flamenco/Spanish progression. One of the oldest and most recognizable patterns.',
        tags: ['flamenco', 'spanish', 'phrygian', 'mediterranean', 'classical'],
        examples: ['"Hit the Road Jack"', '"Smooth" - Santana', 'Flamenco music'],
        alsoKnownAs: [
            {
                name: 'Andalusian Cadence',
                tempo: 100,
                timeSignature: { num: 4, denom: 4 },
                examples: ['Classical guitar', 'Spanish music']
            },
            {
                name: 'Spanish Cadence',
                tempo: 90,
                timeSignature: { num: 4, denom: 4 },
                examples: ['Flamenco', 'Latin classical']
            },
            {
                name: 'Phrygian Turnaround',
                tempo: 80,
                timeSignature: { num: 4, denom: 4 },
                examples: ['Metal', 'Progressive rock']
            }
        ],
        arrangement: {
            tempo: 120,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'flamenco',
            melodyGuide: 'phrygian-dominant',
            style: 'flamenco'
        },
        usage: 'The classic Spanish sound. Use Phrygian dominant scale over V. Also found in Classical repertoire.'
    },

    'world-reggae': {
        id: 'world-reggae',
        name: 'I-IV-I-V (Reggae)',
        category: TEMPLATE_CATEGORIES.WORLD,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['I', 'IV', 'I', 'V'],
        description: 'Basic reggae progression with emphasis on offbeats.',
        tags: ['reggae', 'jamaican', 'one-drop', 'roots'],
        examples: ['"No Woman No Cry" - Bob Marley', '"Three Little Birds"'],
        arrangement: {
            tempo: 75,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'reggae-bass',
            melodyGuide: 'offbeat',
            style: 'reggae'
        },
        usage: 'Emphasize the offbeat (skank) and bass on beats 1 and 3.'
    },

    'world-latin-montuno': {
        id: 'world-latin-montuno',
        name: 'I-IV-V-IV (Son Montuno)',
        category: TEMPLATE_CATEGORIES.WORLD,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['I', 'IV', 'V', 'IV'],
        description: 'Cuban son/salsa progression.',
        tags: ['latin', 'salsa', 'cuban', 'montuno'],
        examples: ['Salsa music', 'Buena Vista Social Club'],
        arrangement: {
            tempo: 180,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 1,
            bassPattern: 'tumbao',
            melodyGuide: 'clave-based',
            style: 'salsa'
        },
        usage: 'Use clave rhythm pattern. Piano plays montuno pattern.'
    },

    'world-middle-eastern': {
        id: 'world-middle-eastern',
        name: 'i-bII-i-V (Hijaz)',
        category: TEMPLATE_CATEGORIES.WORLD,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['i', 'bII', 'i', 'V'],
        description: 'Middle Eastern/North African progression using Hijaz mode.',
        tags: ['middle-eastern', 'arabic', 'hijaz', 'phrygian'],
        examples: ['Traditional Arabic music', 'Klezmer'],
        arrangement: {
            tempo: 100,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'drone',
            melodyGuide: 'hijaz',
            style: 'middle-eastern'
        },
        usage: 'Use Hijaz/Phrygian dominant scale. The bII is characteristic.'
    },

    // ============================================================================
    // EDM/MODERN PROGRESSIONS
    // ============================================================================
    'edm-trance': {
        id: 'edm-trance',
        name: 'i-VI-III-VII (Trance)',
        category: TEMPLATE_CATEGORIES.EDM,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['i', 'VI', 'III', 'VII'],
        description: 'Uplifting trance progression in minor.',
        tags: ['trance', 'uplifting', 'emotional', 'electronic'],
        examples: ['Classic trance anthems', 'Armin van Buuren'],
        arrangement: {
            tempo: 138,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 4,
            bassPattern: 'rolling-bass',
            melodyGuide: 'supersaw',
            style: 'trance'
        },
        usage: 'Long chord holds with building supersaw. Very emotional, euphoric sound.'
    },

    'edm-future-bass': {
        id: 'edm-future-bass',
        name: 'Imaj7-vi7-IVmaj7-V7 (Future Bass)',
        category: TEMPLATE_CATEGORIES.EDM,
        difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
        progressions: ['Imaj7', 'vi7', 'IVmaj7', 'V7'],
        description: 'Modern future bass with 7th chords and pitch bends.',
        tags: ['future-bass', 'modern', 'chords', 'flume'],
        examples: ['Flume', 'San Holo', 'Illenium'],
        arrangement: {
            tempo: 150,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'wobbly',
            melodyGuide: 'pitch-bent',
            style: 'future-bass'
        },
        usage: 'Use chord stabs with sidechain and pitch modulation on synths.'
    },

    'edm-house': {
        id: 'edm-house',
        name: 'i7-IV7 (Deep House)',
        category: TEMPLATE_CATEGORIES.EDM,
        difficulty: DIFFICULTY_LEVELS.BEGINNER,
        progressions: ['i7', 'IV7', 'i7', 'IV7'],
        description: 'Minimal two-chord deep house progression.',
        tags: ['house', 'deep-house', 'minimal', 'groove'],
        examples: ['Disclosure', 'Kaytranada'],
        arrangement: {
            tempo: 124,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'four-on-floor',
            melodyGuide: 'rhodes-stabs',
            style: 'deep-house'
        },
        usage: 'Minimal chords, maximum groove. Let the rhythm drive the track.'
    }
};

/**
 * Get all templates for a specific category
 * @param {string} category - Category name
 * @returns {Array} Array of template objects
 */
export function getTemplatesByCategory(category) {
    return Object.values(PROGRESSION_TEMPLATES).filter(
        template => template.category === category
    );
}

/**
 * Get templates by difficulty level
 * @param {number} level - Difficulty level (1-3)
 * @returns {Array} Array of template objects
 */
export function getTemplatesByDifficulty(level) {
    return Object.values(PROGRESSION_TEMPLATES).filter(
        template => template.difficulty.level === level
    );
}

/**
 * Search templates by name, description, or tags
 * @param {string} query - Search query
 * @returns {Array} Array of matching template objects
 */
export function searchTemplates(query) {
    const lowerQuery = query.toLowerCase();
    return Object.values(PROGRESSION_TEMPLATES).filter(template => {
        return (
            template.name.toLowerCase().includes(lowerQuery) ||
            template.description.toLowerCase().includes(lowerQuery) ||
            template.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
            template.examples.some(ex => ex.toLowerCase().includes(lowerQuery))
        );
    });
}

/**
 * Get template by ID
 * @param {string} templateId - Template ID
 * @returns {object|null} Template object or null
 */
export function getTemplateById(templateId) {
    return PROGRESSION_TEMPLATES[templateId] || null;
}

/**
 * Get all custom user templates from localStorage
 * @returns {Array} Array of custom template objects
 */
export function getCustomTemplates() {
    const presets = getAllPresets();
    return presets.filter(preset => preset.category === 'progression-template');
}

/**
 * Save a custom template to localStorage
 * @param {object} templateData - Template data
 * @returns {object|null} Saved template or null
 */
export function saveCustomTemplate(templateData) {
    return savePreset({
        name: templateData.name,
        description: templateData.description || '',
        category: 'progression-template',
        tags: templateData.tags || [],
        data: {
            progressions: templateData.progressions,
            arrangement: templateData.arrangement,
            key: templateData.key
        },
        metadata: {
            key: templateData.key || 'C',
            tempo: templateData.arrangement?.tempo || 120,
            timeSignature: templateData.arrangement?.timeSignature || { num: 4, denom: 4 }
        }
    });
}

/**
 * Convert template to progression data format
 * @param {object} template - Template object
 * @param {string} key - Musical key (e.g., 'C', 'D', 'F#')
 * @returns {Array} Array of roman numeral strings
 */
export function templateToProgression(template, key = 'C') {
    return template.progressions;
}

/**
 * Get categorized template groups for UI display
 * @returns {object} Object with categories as keys
 */
export function getTemplateGroups() {
    const groups = {};

    Object.values(TEMPLATE_CATEGORIES).forEach(category => {
        groups[category] = getTemplatesByCategory(category);
    });

    // Add custom templates
    const customTemplates = getCustomTemplates();
    if (customTemplates.length > 0) {
        groups[TEMPLATE_CATEGORIES.CUSTOM] = customTemplates.map(preset => ({
            id: preset.id,
            name: preset.name,
            category: TEMPLATE_CATEGORIES.CUSTOM,
            difficulty: { level: 2, label: 'Custom', color: '#8b5cf6' },
            progressions: preset.data.progressions,
            description: preset.description,
            tags: preset.tags,
            examples: [],
            arrangement: preset.data.arrangement || {},
            usage: 'User-created custom template'
        }));
    }

    return groups;
}
