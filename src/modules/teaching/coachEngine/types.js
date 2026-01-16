/**
 * Coach Engine Type Definitions
 *
 * Defines the structure of coach items (observations, suggestions, opportunities)
 * and related configuration objects.
 */

// ============================================================================
// COACH ITEM CATEGORIES
// ============================================================================

/**
 * Main categories of coach items
 */
export const COACH_ITEM_TYPES = {
    OBSERVATION: 'observation',  // "You just created..."
    SUGGESTION: 'suggestion',    // "You might try..."
    OPPORTUNITY: 'opportunity'   // "Did you know..." / "What's missing"
};

/**
 * Sub-categories for more specific classification
 */
export const COACH_CATEGORIES = {
    // Observation categories
    CADENCE: 'cadence',
    BORROWED_CHORD: 'borrowed-chord',
    SECONDARY_DOMINANT: 'secondary-dominant',
    SEQUENCE: 'sequence',
    MODAL_PATTERN: 'modal-pattern',
    CHROMATIC_MEDIANT: 'chromatic-mediant',
    VOICE_LEADING: 'voice-leading',
    TENSION: 'tension',
    MOTIF: 'motif',

    // Suggestion categories
    INVERSION: 'inversion',
    VOICE_LEADING_FIX: 'voice-leading-fix',
    HARMONIC_ENRICHMENT: 'harmonic-enrichment',
    RESOLUTION: 'resolution',
    RHYTHM: 'rhythm',

    // Opportunity categories
    MISSING_PATTERN: 'missing-pattern',
    VARIETY: 'variety',
    STRUCTURE: 'structure'
};

// ============================================================================
// PRESENTATION TARGETS
// ============================================================================

/**
 * Where a coach item can be presented
 */
export const PRESENTATION_TARGETS = {
    FLOATING_NUDGE: 'floating-nudge',     // Tier 1: Auto-appearing card
    THEORY_PANEL: 'theory-panel',          // Tier 2: Theory Insights panel
    BORROWED_PANEL: 'borrowed-panel',      // Tier 2: Borrowed Chords panel
    VOICE_LEADING_PANEL: 'voice-leading-panel', // Tier 2: Voice Leading panel
    MODAL_CHORD: 'modal-chord',            // Tier 3: Unified Modal - Chord tab
    MODAL_MELODY: 'modal-melody',          // Tier 3: Unified Modal - Melody tab
    MODAL_SECTION: 'modal-section'         // Tier 3: Unified Modal - Section tab
};

/**
 * Modal deep link intents (for Chord tab)
 */
export const MODAL_INTENTS = {
    SUGGEST: 'suggest',
    COMPARE: 'compare',
    TRANSFORM: 'transform',
    OPTIMIZE: 'optimize',
    SEQUENCE: 'sequence'
};

// ============================================================================
// COACH ITEM DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} CoachItemMessage
 * @property {string} simple - Beginner-friendly explanation
 * @property {string} intermediate - Music theory vocabulary
 * @property {string} advanced - Technical details
 */

/**
 * @typedef {Object} CoachItemActions
 * @property {boolean} [preview] - Show "Hear it" button
 * @property {boolean} [apply] - Show "Apply" button
 * @property {boolean} [compare] - Show "Compare" button
 * @property {string} [learnMore] - Lesson ID for "Learn More" link
 * @property {string} [explorePanel] - Panel ID to highlight/open
 * @property {Object} [deepDive] - Modal deep link config
 * @property {string} deepDive.tab - Modal tab to open
 * @property {string} [deepDive.intent] - Chord tab intent
 * @property {Object} [deepDive.context] - Pre-selection context
 */

/**
 * @typedef {Object} CoachItem
 * @property {string} type - COACH_ITEM_TYPES value
 * @property {string} category - COACH_CATEGORIES value
 * @property {string} id - Unique identifier for this item type
 * @property {number} priority - Base priority score (0-100)
 * @property {Object} data - Detection-specific data
 * @property {string} emoji - Display emoji
 * @property {string} title - Short title
 * @property {CoachItemMessage} message - Skill-level messages
 * @property {CoachItemActions} actions - Available actions
 * @property {number} [timestamp] - When this was detected
 * @property {number} [score] - Computed priority score after modifiers
 */

// ============================================================================
// OBSERVATION DEFINITIONS
// ============================================================================

/**
 * Observation type definitions
 * These celebrate/educate about what the user created
 */
export const OBSERVATION_TYPES = {
    // Cadences
    'deceptive-cadence': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.CADENCE,
        id: 'deceptive-cadence',
        priority: 85,
        emoji: '🎉',
        title: 'Deceptive Cadence!',
        message: {
            simple: "Surprise! The V chord went to vi instead of I - that's a plot twist in music!",
            intermediate: "Deceptive cadence (V→vi) - the listener expects I but gets vi, creating emotional depth.",
            advanced: "V→vi deceptive resolution. The vi shares scale degrees 1 and 3 with I, providing harmonic continuity despite the surprise."
        },
        actions: {
            learnMore: 'lesson-cadences',
            explorePanel: 'theory'
        },
        cooldown: 60000
    },

    'plagal-cadence': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.CADENCE,
        id: 'plagal-cadence',
        priority: 70,
        emoji: '🙏',
        title: 'Plagal Cadence!',
        message: {
            simple: "The 'Amen' cadence! IV to I sounds peaceful and hymn-like.",
            intermediate: "Plagal cadence (IV→I) - a softer resolution than V→I, common in hymns and pop.",
            advanced: "Plagal motion provides subdominant-to-tonic resolution without leading tone, creating a gentler sense of closure."
        },
        actions: {
            learnMore: 'lesson-cadences',
            explorePanel: 'theory'
        },
        cooldown: 60000
    },

    'perfect-cadence': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.CADENCE,
        id: 'perfect-cadence',
        priority: 50,
        emoji: '✅',
        title: 'Perfect Authentic Cadence',
        message: {
            simple: "The strongest ending in music! V to I says 'we're home.'",
            intermediate: "Perfect authentic cadence (V→I) - the definitive resolution in tonal music.",
            advanced: "PAC with leading tone resolving to tonic and root motion by fifth provides maximum harmonic closure."
        },
        actions: {
            learnMore: 'lesson-cadences',
            explorePanel: 'theory'
        },
        cooldown: 120000  // Show less often since it's common
    },

    'half-cadence': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.CADENCE,
        id: 'half-cadence',
        priority: 60,
        emoji: '❓',
        title: 'Half Cadence',
        message: {
            simple: "Ending on V creates suspense - like a musical question mark!",
            intermediate: "Half cadence - ending on V creates an incomplete feeling, perfect for mid-phrase pauses.",
            advanced: "Half cadence on V creates dominant prolongation, setting up expectation for tonic resolution."
        },
        actions: {
            learnMore: 'lesson-cadences',
            explorePanel: 'theory'
        },
        cooldown: 90000
    },

    // Borrowed Chords
    'borrowed-bVI': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.BORROWED_CHORD,
        id: 'borrowed-bVI',
        priority: 85,
        emoji: '🎭',
        title: 'Borrowed bVI!',
        message: {
            simple: "Dramatic! This chord is borrowed from the parallel minor key.",
            intermediate: "bVI (flat-six) borrowed from parallel minor - creates an epic, cinematic sound.",
            advanced: "Modal interchange via bVI provides chromatic voice leading (♭6→5) while maintaining tonic function through shared scale degree 1."
        },
        actions: {
            learnMore: 'lesson-borrowed-chords',
            explorePanel: 'borrowed'
        },
        cooldown: 45000
    },

    'borrowed-bVII': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.BORROWED_CHORD,
        id: 'borrowed-bVII',
        priority: 85,
        emoji: '🎸',
        title: 'Borrowed bVII!',
        message: {
            simple: "Rock and roll! bVII has that classic rock/folk flavor.",
            intermediate: "bVII (flat-seven) from Mixolydian - the sound of classic rock and folk music.",
            advanced: "Mixolydian bVII provides plagal-adjacent motion without the subdominant function, common in modal rock."
        },
        actions: {
            learnMore: 'lesson-borrowed-chords',
            explorePanel: 'borrowed'
        },
        cooldown: 45000
    },

    'borrowed-iv': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.BORROWED_CHORD,
        id: 'borrowed-iv',
        priority: 80,
        emoji: '😢',
        title: 'Minor iv!',
        message: {
            simple: "Beautiful melancholy! The minor iv adds a touch of sadness.",
            intermediate: "Minor iv borrowed from parallel minor - creates a bittersweet plagal sound.",
            advanced: "Minor subdominant provides chromatic ♭6 while maintaining subdominant function, common in 'sad' plagal cadences."
        },
        actions: {
            learnMore: 'lesson-borrowed-chords',
            explorePanel: 'borrowed'
        },
        cooldown: 45000
    },

    'borrowed-bIII': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.BORROWED_CHORD,
        id: 'borrowed-bIII',
        priority: 75,
        emoji: '🌈',
        title: 'Borrowed bIII!',
        message: {
            simple: "Colorful! bIII opens up new harmonic territory.",
            intermediate: "bIII (flat-three) from parallel minor - adds unexpected brightness in minor context.",
            advanced: "bIII provides mediant relationship with chromatic root, often functioning as dominant preparation or tonic substitute."
        },
        actions: {
            learnMore: 'lesson-borrowed-chords',
            explorePanel: 'borrowed'
        },
        cooldown: 45000
    },

    // Secondary Dominants
    'secondary-dominant': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.SECONDARY_DOMINANT,
        id: 'secondary-dominant',
        priority: 80,
        emoji: '🔥',
        title: 'Secondary Dominant!',
        message: {
            simple: "Nice! This chord really wants to pull somewhere specific.",
            intermediate: "Secondary dominant (V/x) - creates temporary tonicization of a non-tonic chord.",
            advanced: "Secondary dominant provides chromatic alteration and applied dominant function, intensifying motion to the target chord."
        },
        actions: {
            learnMore: 'lesson-secondary-dominants',
            explorePanel: 'theory'
        },
        cooldown: 45000
    },

    // Sequences
    'circle-of-fifths': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.SEQUENCE,
        id: 'circle-of-fifths',
        priority: 80,
        emoji: '🔄',
        title: 'Circle of Fifths!',
        message: {
            simple: "Classic! Your chords are following the circle of fifths - super smooth.",
            intermediate: "Circle of fifths progression - one of the smoothest harmonic movements in music.",
            advanced: "Descending fifths sequence provides strong root motion with consistent voice leading patterns across all voices."
        },
        actions: {
            learnMore: 'lesson-circle-of-fifths',
            explorePanel: 'theory'
        },
        cooldown: 90000
    },

    'harmonic-sequence': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.SEQUENCE,
        id: 'harmonic-sequence',
        priority: 70,
        emoji: '📐',
        title: 'Harmonic Sequence!',
        message: {
            simple: "Pattern detected! You're repeating a chord pattern at different pitches.",
            intermediate: "Harmonic sequence - a pattern repeated at different pitch levels creates unity and direction.",
            advanced: "Sequential repetition provides motivic coherence while creating directional harmonic motion through transposition."
        },
        actions: {
            learnMore: 'lesson-sequences',
            explorePanel: 'theory'
        },
        cooldown: 90000
    },

    // Modal Patterns
    'dorian-pattern': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.MODAL_PATTERN,
        id: 'dorian-pattern',
        priority: 75,
        emoji: '🎷',
        title: 'Dorian Mode!',
        message: {
            simple: "Jazzy! That i-IV movement is the sound of Dorian mode.",
            intermediate: "Dorian i-IV pattern - the characteristic sound of jazz, funk, and soul.",
            advanced: "Dorian mode's raised 6th degree enables major IV chord over minor tonic, creating the distinctive 'So What' sound."
        },
        actions: {
            learnMore: 'lesson-modes-intro',
            explorePanel: 'theory'
        },
        cooldown: 60000
    },

    'mixolydian-pattern': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.MODAL_PATTERN,
        id: 'mixolydian-pattern',
        priority: 75,
        emoji: '🎸',
        title: 'Mixolydian Mode!',
        message: {
            simple: "Rock on! That I-bVII movement is classic Mixolydian.",
            intermediate: "Mixolydian I-bVII pattern - the backbone of rock, blues, and folk music.",
            advanced: "Mixolydian's lowered 7th enables bVII major chord, avoiding leading tone tension for a more relaxed modal feel."
        },
        actions: {
            learnMore: 'lesson-modes-intro',
            explorePanel: 'theory'
        },
        cooldown: 60000
    },

    // Chromatic Relationships
    'chromatic-mediant': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.CHROMATIC_MEDIANT,
        id: 'chromatic-mediant',
        priority: 70,
        emoji: '✨',
        title: 'Chromatic Mediant!',
        message: {
            simple: "Colorful! These chords are a third apart with chromatic alterations - very cinematic!",
            intermediate: "Chromatic mediant relationship - chords a third apart with altered quality, common in film scores.",
            advanced: "Chromatic mediant preserves one common tone while chromatically altering others, creating dramatic color shift without functional progression."
        },
        actions: {
            learnMore: 'lesson-chromatic-harmony',
            explorePanel: 'theory'
        },
        cooldown: 60000
    },

    // Voice Leading Achievements
    'smooth-voice-leading': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.VOICE_LEADING,
        id: 'smooth-voice-leading',
        priority: 55,
        emoji: '🌊',
        title: 'Smooth Voice Leading!',
        message: {
            simple: "Beautiful flow! Your voices are moving smoothly between chords.",
            intermediate: "Excellent voice leading - stepwise motion and common tones create smooth connections.",
            advanced: "Voice leading score above 90% indicates minimal aggregate voice movement with good contrary motion."
        },
        actions: {
            explorePanel: 'voice-leading'
        },
        cooldown: 120000
    },

    // Tension
    'tension-climax': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.TENSION,
        id: 'tension-climax',
        priority: 60,
        emoji: '📈',
        title: 'Tension Peak!',
        message: {
            simple: "Maximum drama! This is the most tense moment in your progression.",
            intermediate: "Tension climax reached - this is your emotional peak before resolution.",
            advanced: "Tension score peaked at this point through accumulated dominant function, dissonance, and rhythmic activity."
        },
        actions: {
            deepDive: { tab: 'chord', intent: 'optimize' }
        },
        cooldown: 90000
    }
};

// ============================================================================
// SUGGESTION DEFINITIONS
// ============================================================================

/**
 * Suggestion type definitions
 * These recommend specific improvements the user could make
 */
export const SUGGESTION_TYPES = {
    // Voice Leading Improvements
    'try-inversion': {
        type: COACH_ITEM_TYPES.SUGGESTION,
        category: COACH_CATEGORIES.INVERSION,
        id: 'try-inversion',
        priority: 70,
        emoji: '✨',
        title: 'Smoother Voice Leading?',
        message: {
            simple: "Using a different position of this chord would sound smoother.",
            intermediate: "{{chord}} in {{suggestedInversion}} inversion creates stepwise bass motion.",
            advanced: "{{suggestedInversion}} inversion yields {{interval}} bass motion vs {{currentInterval}}, improving VL score by ~{{improvement}}%."
        },
        actions: {
            preview: true,
            apply: true,
            compare: true,
            explorePanel: 'voice-leading',
            deepDive: { tab: 'chord', intent: 'transform' }
        },
        cooldown: 120000
    },

    'fix-parallel-fifths': {
        type: COACH_ITEM_TYPES.SUGGESTION,
        category: COACH_CATEGORIES.VOICE_LEADING_FIX,
        id: 'fix-parallel-fifths',
        priority: 80,
        emoji: '⚠️',
        title: 'Parallel Fifths',
        message: {
            simple: "These voices are moving together in a way that classical music avoids.",
            intermediate: "Parallel fifths between {{voice1}} and {{voice2}} - common in rock, avoided in classical.",
            advanced: "Parallel P5 motion ({{notes}}) weakens voice independence. Consider contrary motion or different voicing."
        },
        actions: {
            preview: true,
            apply: true,
            explorePanel: 'voice-leading'
        },
        cooldown: 30000
    },

    'fix-parallel-octaves': {
        type: COACH_ITEM_TYPES.SUGGESTION,
        category: COACH_CATEGORIES.VOICE_LEADING_FIX,
        id: 'fix-parallel-octaves',
        priority: 80,
        emoji: '⚠️',
        title: 'Parallel Octaves',
        message: {
            simple: "Two voices are doubling each other - this reduces independence.",
            intermediate: "Parallel octaves reduce voice independence - the voices merge into one.",
            advanced: "Parallel P8 motion merges two voices into one perceived line, reducing textural richness."
        },
        actions: {
            preview: true,
            apply: true,
            explorePanel: 'voice-leading'
        },
        cooldown: 30000
    },

    'fix-voice-crossing': {
        type: COACH_ITEM_TYPES.SUGGESTION,
        category: COACH_CATEGORIES.VOICE_LEADING_FIX,
        id: 'fix-voice-crossing',
        priority: 75,
        emoji: '🔀',
        title: 'Voice Crossing',
        message: {
            simple: "Your melody went below the bass - this can sound muddy.",
            intermediate: "Voice crossing at M{{measure}} - voices swap registers, potentially muddying texture.",
            advanced: "Voice crossing disrupts registral stratification. Consider voice exchange or re-voicing to maintain clarity."
        },
        actions: {
            preview: true,
            apply: true,
            explorePanel: 'voice-leading'
        },
        cooldown: 45000
    },

    // Harmonic Enrichment
    'try-borrowed-chord': {
        type: COACH_ITEM_TYPES.SUGGESTION,
        category: COACH_CATEGORIES.HARMONIC_ENRICHMENT,
        id: 'try-borrowed-chord',
        priority: 65,
        emoji: '🎨',
        title: 'Add Some Color?',
        message: {
            simple: "Try borrowing a chord from the parallel minor for more emotion!",
            intermediate: "Your progression is all diatonic - a borrowed {{suggestion}} here would add color.",
            advanced: "Modal interchange via {{suggestion}} would provide chromatic interest without leaving the tonal center."
        },
        actions: {
            preview: true,
            apply: true,
            explorePanel: 'borrowed',
            deepDive: { tab: 'chord', intent: 'transform' }
        },
        cooldown: 120000
    },

    'try-secondary-dominant': {
        type: COACH_ITEM_TYPES.SUGGESTION,
        category: COACH_CATEGORIES.HARMONIC_ENRICHMENT,
        id: 'try-secondary-dominant',
        priority: 65,
        emoji: '🔥',
        title: 'Intensify the Pull?',
        message: {
            simple: "Adding a chord that really wants to go to your next chord!",
            intermediate: "Try {{suggestion}} before {{target}} - it creates a stronger pull.",
            advanced: "Secondary dominant {{suggestion}} provides applied dominant function to {{target}}, intensifying the arrival."
        },
        actions: {
            preview: true,
            apply: true,
            deepDive: { tab: 'chord', intent: 'transform' }
        },
        cooldown: 120000
    },

    'add-seventh': {
        type: COACH_ITEM_TYPES.SUGGESTION,
        category: COACH_CATEGORIES.HARMONIC_ENRICHMENT,
        id: 'add-seventh',
        priority: 55,
        emoji: '🎹',
        title: 'Add a 7th?',
        message: {
            simple: "Adding a 7th to this chord would make it richer!",
            intermediate: "Try {{chord}}7 instead of {{chord}} - adds color and tension.",
            advanced: "Seventh extension adds dissonance requiring resolution, increasing harmonic momentum."
        },
        actions: {
            preview: true,
            apply: true,
            deepDive: { tab: 'chord', intent: 'transform' }
        },
        cooldown: 90000
    },

    // Resolution Suggestions
    'resolve-dominant': {
        type: COACH_ITEM_TYPES.SUGGESTION,
        category: COACH_CATEGORIES.RESOLUTION,
        id: 'resolve-dominant',
        priority: 85,
        emoji: '🏠',
        title: 'Resolve to Home?',
        message: {
            simple: "That V chord really wants to go home to I!",
            intermediate: "Your dominant (V) is unresolved - it creates strong expectation for I.",
            advanced: "Unresolved dominant function creates harmonic tension. Consider authentic resolution or deceptive alternative."
        },
        actions: {
            preview: true,
            apply: true,
            deepDive: { tab: 'chord', intent: 'suggest' }
        },
        cooldown: 30000
    },

    'try-deceptive-cadence': {
        type: COACH_ITEM_TYPES.SUGGESTION,
        category: COACH_CATEGORIES.RESOLUTION,
        id: 'try-deceptive-cadence',
        priority: 60,
        emoji: '🎭',
        title: 'Try a Surprise?',
        message: {
            simple: "Instead of going to I, try vi for a surprise ending!",
            intermediate: "Your V→I could become V→vi (deceptive cadence) for emotional depth.",
            advanced: "Deceptive resolution to vi provides surprise while maintaining common tones with expected I."
        },
        actions: {
            preview: true,
            apply: true,
            compare: true
        },
        cooldown: 180000
    },

    // Rhythm Suggestions
    'vary-harmonic-rhythm': {
        type: COACH_ITEM_TYPES.SUGGESTION,
        category: COACH_CATEGORIES.RHYTHM,
        id: 'vary-harmonic-rhythm',
        priority: 55,
        emoji: '⏱️',
        title: 'Vary the Rhythm?',
        message: {
            simple: "Your chords all have the same length - try mixing it up!",
            intermediate: "Uniform harmonic rhythm ({{duration}} beats each) - varying durations adds interest.",
            advanced: "Consider accelerating harmonic rhythm toward cadences or decelerating for prolongation effects."
        },
        actions: {
            deepDive: { tab: 'chord', intent: 'optimize' }
        },
        cooldown: 180000
    }
};

// ============================================================================
// OPPORTUNITY DEFINITIONS
// ============================================================================

/**
 * Opportunity type definitions
 * These point out patterns or techniques the user hasn't tried yet
 */
export const OPPORTUNITY_TYPES = {
    'no-borrowed-chords': {
        type: COACH_ITEM_TYPES.OPPORTUNITY,
        category: COACH_CATEGORIES.MISSING_PATTERN,
        id: 'no-borrowed-chords',
        priority: 50,
        emoji: '🎨',
        title: 'All Diatonic',
        message: {
            simple: "Your progression stays in-key. Borrowed chords add drama and color!",
            intermediate: "{{count}} chords, all diatonic. Modal interchange (bVII, bVI, iv) adds emotional depth.",
            advanced: "Consider chromatic mediants or mode mixture for coloristic variety within your tonal framework."
        },
        actions: {
            explorePanel: 'borrowed',
            deepDive: { tab: 'chord', intent: 'transform' }
        },
        cooldown: 180000
    },

    'no-cadence': {
        type: COACH_ITEM_TYPES.OPPORTUNITY,
        category: COACH_CATEGORIES.MISSING_PATTERN,
        id: 'no-cadence',
        priority: 55,
        emoji: '🏁',
        title: 'No Cadence Yet',
        message: {
            simple: "Try ending with V→I or IV→I to create a sense of arrival!",
            intermediate: "No cadential pattern detected. Consider V→I (authentic) or IV→I (plagal) for phrase closure.",
            advanced: "Cadential articulation creates formal clarity. Consider PAC for strongest closure or HC for continuation."
        },
        actions: {
            learnMore: 'lesson-cadences',
            deepDive: { tab: 'chord', intent: 'suggest' }
        },
        cooldown: 120000
    },

    'no-secondary-dominants': {
        type: COACH_ITEM_TYPES.OPPORTUNITY,
        category: COACH_CATEGORIES.MISSING_PATTERN,
        id: 'no-secondary-dominants',
        priority: 45,
        emoji: '🔥',
        title: 'Try Secondary Dominants?',
        message: {
            simple: "Secondary dominants add extra 'pull' to your chord progressions!",
            intermediate: "No secondary dominants used. V/V or V/ii could intensify harmonic motion.",
            advanced: "Applied dominants provide chromatic enrichment and tonicization of non-tonic harmonies."
        },
        actions: {
            learnMore: 'lesson-secondary-dominants',
            deepDive: { tab: 'chord', intent: 'transform' }
        },
        cooldown: 180000
    },

    'flat-tension': {
        type: COACH_ITEM_TYPES.OPPORTUNITY,
        category: COACH_CATEGORIES.VARIETY,
        id: 'flat-tension',
        priority: 50,
        emoji: '📊',
        title: 'Flat Tension Curve',
        message: {
            simple: "Your tension stays pretty even - try building to a climax!",
            intermediate: "Tension variance is low ({{variance}}%). Consider building toward a peak.",
            advanced: "Low tension variance suggests static harmonic rhythm. Consider arc-based planning with clear climax."
        },
        actions: {
            deepDive: { tab: 'chord', intent: 'optimize' }
        },
        cooldown: 180000
    },

    'bass-always-root': {
        type: COACH_ITEM_TYPES.OPPORTUNITY,
        category: COACH_CATEGORIES.VARIETY,
        id: 'bass-always-root',
        priority: 50,
        emoji: '🎸',
        title: 'All Root Position',
        message: {
            simple: "Your bass always plays the root note. Inversions create melodic bass lines!",
            intermediate: "{{percent}}% root position chords. First inversions create stepwise bass motion.",
            advanced: "Consistent root position limits bass voice melodic potential. Consider 6 and 6/4 positions for voice leading."
        },
        actions: {
            explorePanel: 'voice-leading',
            deepDive: { tab: 'chord', intent: 'transform' }
        },
        cooldown: 180000
    },

    'no-extensions': {
        type: COACH_ITEM_TYPES.OPPORTUNITY,
        category: COACH_CATEGORIES.VARIETY,
        id: 'no-extensions',
        priority: 40,
        emoji: '🎹',
        title: 'Try Extensions?',
        message: {
            simple: "All triads! 7ths and 9ths add sophistication.",
            intermediate: "Your progression uses only triads. Seventh chords add color and tension.",
            advanced: "Consider diatonic 7ths (ii7, V7, vii°7) or extended harmonies (9ths, 11ths) for richer voicings."
        },
        actions: {
            deepDive: { tab: 'chord', intent: 'transform' }
        },
        cooldown: 180000
    },

    'function-imbalance': {
        type: COACH_ITEM_TYPES.OPPORTUNITY,
        category: COACH_CATEGORIES.VARIETY,
        id: 'function-imbalance',
        priority: 45,
        emoji: '⚖️',
        title: 'Harmonic Balance',
        message: {
            simple: "Your progression leans heavily on {{dominant}} chords. Try more variety!",
            intermediate: "Function distribution: {{breakdown}}. Consider balancing tonic, subdominant, and dominant.",
            advanced: "Functional imbalance ({{percent}}% {{dominant}}) may limit harmonic interest. T-S-D-T provides balanced motion."
        },
        actions: {
            explorePanel: 'theory',
            deepDive: { tab: 'chord', intent: 'suggest' }
        },
        cooldown: 180000
    }
};

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Get all coach item definitions combined
 */
export function getAllCoachItemTypes() {
    return {
        ...OBSERVATION_TYPES,
        ...SUGGESTION_TYPES,
        ...OPPORTUNITY_TYPES
    };
}

/**
 * Get coach item definition by ID
 * @param {string} id - Coach item ID
 * @returns {Object|null} Coach item definition or null
 */
export function getCoachItemType(id) {
    return getAllCoachItemTypes()[id] || null;
}
