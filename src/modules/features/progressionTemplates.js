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
        tags: ['pop', 'beginner', 'common', '4-chord'],
        examples: ['"Let It Be" - Beatles', '"Don\'t Stop Believin\'" - Journey', '"Someone Like You" - Adele'],
        arrangement: {
            tempo: 120,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-fifth',
            melodyGuide: 'chord-tones-ascending',
            style: 'pop'
        },
        usage: 'Perfect for uplifting, anthemic choruses and verses.'
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
        description: 'Rock progression using the flat-7th for modal flavor.',
        tags: ['rock', 'modal', 'mixolydian', 'intermediate'],
        examples: ['"Sweet Home Alabama"', '"Sympathy for the Devil"'],
        arrangement: {
            tempo: 110,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'root-note',
            melodyGuide: 'mixolydian-scale',
            style: 'rock'
        },
        usage: 'Southern rock and classic rock with modal flavor.'
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
        tags: ['classical', 'spanish', 'descending', 'advanced'],
        examples: ['"Hit the Road Jack"', 'Common in flamenco'],
        arrangement: {
            tempo: 100,
            timeSignature: { num: 4, denom: 4 },
            measuresPerChord: 2,
            bassPattern: 'descending',
            melodyGuide: 'phrygian-scale',
            style: 'classical'
        },
        usage: 'Dramatic, Spanish-flavored pieces.'
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
