/**
 * Constants and Configuration for Unified Recommendation Modal
 *
 * All constant data structures used by the modal system.
 * These are read-only configuration objects with no logic.
 */

/**
 * Modal DOM ID
 */
export const MODAL_ID = 'unified-recommendation-modal';

/**
 * Section type configurations for section generation tab
 */
export const SECTION_TYPES = [
    { id: 'intro', name: 'Intro', icon: '🎬' },
    { id: 'verse', name: 'Verse', icon: '📝' },
    { id: 'prechorus', name: 'Pre-Chorus', icon: '⬆️' },
    { id: 'chorus', name: 'Chorus', icon: '🎵' },
    { id: 'bridge', name: 'Bridge', icon: '🌉' },
    { id: 'instrumental', name: 'Instrumental', icon: '🎸' },
    { id: 'outro', name: 'Outro', icon: '🎬' }
];

/**
 * Harmony styles for harmonize tab
 */
export const HARMONY_STYLES = {
    pop: { name: 'Pop', description: 'Simple, catchy chord choices' },
    rock: { name: 'Rock', description: 'Power chords and basic progressions' },
    jazz: { name: 'Jazz', description: 'Complex harmonies with 7ths and extensions' },
    classical: { name: 'Classical', description: 'Traditional harmony with strict voice leading' },
    folk: { name: 'Folk', description: 'Simple diatonic harmonies' },
    rnbSoul: { name: 'R&B/Soul', description: 'Smooth, colorful harmonies' },
    gospel: { name: 'Gospel', description: 'Rich, emotional harmonies' },
    blues: { name: 'Blues', description: 'Dominant 7ths and blues progressions' }
};

/**
 * Section type descriptions for harmonize tab
 */
export const HARMONIZE_SECTION_TYPES = {
    intro: { name: 'Intro', description: 'Sets the mood, establishes key' },
    verse: { name: 'Verse', description: 'Moderate tension, storytelling' },
    prechorus: { name: 'Pre-Chorus', description: 'Building tension toward chorus' },
    chorus: { name: 'Chorus', description: 'Peak energy, memorable hook' },
    bridge: { name: 'Bridge', description: 'Contrast, harmonic exploration' },
    interlude: { name: 'Interlude', description: 'Instrumental break, ambient' },
    solo: { name: 'Solo', description: 'Featured instrument, varied tension' },
    breakdown: { name: 'Breakdown', description: 'Energy drop, sparse texture' },
    outro: { name: 'Outro', description: 'Resolution, winding down' },
    custom: { name: 'Custom', description: 'General purpose section' }
};

/**
 * Bass pattern categories for texture/polyphony tab
 */
export const BASS_STYLE_CATEGORIES = {
    'Simple Patterns': {
        'whole-note': 'Whole Note',
        'root-fifth': 'Root-Fifth',
        'half-time': 'Half Time',
        'pedal': 'Pedal Pulse'
    },
    'Arpeggiated Patterns': {
        'arpeggio': 'Arpeggio',
        'alberti': 'Alberti Bass',
        'broken-octave': 'Broken Octave'
    },
    'Walking & Melodic': {
        'walking': 'Walking Bass',
        'chromatic-approach': 'Chromatic Approach',
        'scalar-walk': 'Scalar Walk',
        'bebop': 'Bebop'
    },
    'Rhythmic Patterns': {
        'dotted-rhythm': 'Dotted Rhythm',
        'syncopated': 'Syncopated',
        'anticipation': 'Anticipation',
        'shuffle': 'Shuffle',
        'driving-rock': 'Driving Rock',
        'boogie': 'Boogie-Woogie'
    },
    'Style Patterns': {
        'country': 'Country',
        'bossa-nova': 'Bossa Nova',
        'disco-octave': 'Disco Octave',
        'motown': 'Motown',
        'reggae': 'Reggae',
        'funk': 'Funk'
    }
};

/**
 * Melody category colors for note classification display
 */
export const MELODY_CATEGORY_COLORS = {
    chordTone: { bg: '#dcfce7', text: '#166534' },
    scaleTone: { bg: '#dbeafe', text: '#1e40af' },
    stepwiseMotion: { bg: '#cffafe', text: '#0e7490' },
    approachTone: { bg: '#fef3c7', text: '#92400e' },
    passingTone: { bg: '#fed7aa', text: '#9a3412' },
    tension: { bg: '#e9d5ff', text: '#7c3aed' },
    avoid: { bg: '#fee2e2', text: '#dc2626' }
};

/**
 * Texture types for polyphony/texture tab
 */
export const TEXTURE_TYPES = {
    PARALLEL_THIRDS: {
        id: 'parallel_thirds',
        name: 'Parallel Thirds',
        description: 'Follows melody a third below - classic warm harmony',
        icon: '🎵'
    },
    PARALLEL_SIXTHS: {
        id: 'parallel_sixths',
        name: 'Parallel Sixths',
        description: 'Follows melody a sixth below - rich, full sound',
        icon: '🎶'
    },
    CONTRARY_MOTION: {
        id: 'contrary',
        name: 'Contrary Motion',
        description: 'Moves opposite to melody - creates interesting counterpoint',
        icon: '↕️'
    },
    PEDAL_ROOT: {
        id: 'pedal_root',
        name: 'Pedal Tone (Root)',
        description: 'Sustained chord root - grounding effect',
        icon: '🔊'
    },
    PEDAL_FIFTH: {
        id: 'pedal_fifth',
        name: 'Pedal Tone (Fifth)',
        description: 'Sustained fifth - adds depth without dissonance',
        icon: '🎹'
    },
    RHYTHMIC_COMPLEMENT: {
        id: 'rhythmic',
        name: 'Rhythmic Fill',
        description: 'Fills gaps where main voice has rests',
        icon: '🥁'
    },
    HARMONIC_ACCOMPANIMENT: {
        id: 'harmonic_accompaniment',
        name: 'Harmonic Accompaniment',
        description: 'Chord tones following the melody rhythm',
        icon: '🎹'
    },
    COUNTER_MELODY: {
        id: 'counter',
        name: 'Counter-Melody',
        description: 'Independent complementary line with rhythmic interest',
        icon: '🎼'
    },
    OBLIQUE_MOTION: {
        id: 'oblique',
        name: 'Oblique Motion',
        description: 'One voice holds a chord tone while melody moves',
        icon: '➡️'
    },
    OCTAVE_DOUBLING: {
        id: 'octave_doubling',
        name: 'Octave Doubling',
        description: 'Doubles the melody an octave below',
        icon: '8️⃣'
    },
    CALL_RESPONSE: {
        id: 'call_response',
        name: 'Call & Response',
        description: 'Second voice echoes the melody with delay',
        icon: '🗣️'
    },
    DRONE: {
        id: 'drone',
        name: 'Drone/Sustained',
        description: 'Sustained harmony note throughout the measure',
        icon: '🔉'
    },
    ARPEGGIATED: {
        id: 'arpeggiated',
        name: 'Arpeggiated Harmony',
        description: 'Broken chord accompaniment following melody rhythm',
        icon: '🎹'
    },
    SUSPENSION: {
        id: 'suspension',
        name: 'Suspension/Resolution',
        description: 'Creates tension by holding notes, then resolves stepwise',
        icon: '⏸️'
    },
    PASSING_TONES: {
        id: 'passing_tones',
        name: 'Passing Tones',
        description: 'Fills melodic gaps with scale-wise motion',
        icon: '🚶'
    },
    NEIGHBOR_TONES: {
        id: 'neighbor_tones',
        name: 'Neighbor Tones',
        description: 'Embellishes melody with upper/lower neighbors',
        icon: '🔄'
    },
    PEDAL_WITH_MOTION: {
        id: 'pedal_motion',
        name: 'Pedal + Motion',
        description: 'Bass pedal while inner voice moves melodically',
        icon: '🎚️'
    },
    IMITATION: {
        id: 'imitation',
        name: 'Imitation/Canon',
        description: 'Delayed melodic imitation at a different pitch',
        icon: '🪞'
    }
};

/**
 * Bass pattern categories for curated pattern selection
 */
export const BASS_PATTERN_CATEGORIES = {
    ESSENTIAL: {
        name: 'Essential',
        description: 'Start here - fundamental patterns for any style',
        patterns: ['whole-note', 'root-fifth', 'arpeggio']
    },
    CLASSICAL: {
        name: 'Classical',
        description: 'Traditional piano accompaniment patterns',
        patterns: ['alberti', 'waltz', 'hymn']
    },
    JAZZ: {
        name: 'Jazz',
        description: 'Swing, bebop, and jazz piano styles',
        patterns: ['walking', 'stride', 'shell-voicing', 'bebop']
    },
    ROCK_POP: {
        name: 'Rock/Pop',
        description: 'Modern rock, pop, and dance styles',
        patterns: ['driving-rock', 'power-chord', 'syncopated']
    },
    LATIN: {
        name: 'Latin',
        description: 'Brazilian, Cuban, and Latin American grooves',
        patterns: ['bossa-nova', 'montuno', 'habanera']
    },
    SOUL_FUNK: {
        name: 'Soul/Funk',
        description: 'R&B, Motown, and gospel feels',
        patterns: ['motown', 'funk', 'gospel']
    }
};

/**
 * Tab info descriptions for help dialogs
 */
export const TAB_INFO = {
    chord: {
        title: '🎹 Chords Tab',
        description: 'Get intelligent chord suggestions based on music theory and your selected style. ' +
            'Use Quick Suggest for fast recommendations, Compare to see alternatives side-by-side, ' +
            'or Transform to modify existing chords with substitutions, extensions, and borrowed chords. ' +
            'The AI considers voice leading, harmonic function, and genre conventions.'
    },
    melody: {
        title: '🎵 Melody Tab',
        description: 'Generate melodic ideas that fit your chord progression. ' +
            'Choose between single notes for step-by-step composition or phrases for complete melodic fragments. ' +
            'The generator considers chord tones, passing tones, and rhythmic patterns appropriate for your selected style and mood.'
    },
    section: {
        title: '📝 Section Tab',
        description: 'Plan your song structure with section suggestions. ' +
            'Get recommendations for what section should come next (verse, chorus, bridge, etc.) based on common song forms. ' +
            'You can also generate complete chord progressions for new sections that complement your existing material.'
    },
    harmonize: {
        title: '🎼 Harmonize Tab',
        description: 'Automatically generate chord progressions that harmonize your existing melody. ' +
            'The system analyzes your melody notes and suggests chords that support them musically. ' +
            'Great for when you have a melody idea but need help finding the right chords to accompany it.'
    },
    polyphony: {
        title: '🎭 Texture Tab',
        description: 'Add a second voice to complement your existing melody or bass line. ' +
            'Choose from texture types like parallel thirds, contrary motion, or counter-melody. ' +
            'The generated notes follow voice leading principles and are added to Voice 2 of your selected staff.'
    }
};
