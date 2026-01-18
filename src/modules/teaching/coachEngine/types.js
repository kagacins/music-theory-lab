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
        title: 'Deceptive Cadence',
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
        title: 'Plagal Cadence',
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
        title: 'Borrowed bVI',
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
        title: 'Borrowed bVII',
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
        title: 'Minor iv',
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
        title: 'Borrowed bIII',
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
        title: 'Secondary Dominant',
        message: {
            simple: "Nice! This is {{label}} - it really wants to pull to {{target}}.",
            intermediate: "Secondary dominant {{label}} - creates temporary tonicization, pulling strongly toward {{target}}.",
            advanced: "{{label}} provides chromatic alteration and applied dominant function, intensifying motion to {{target}}."
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
        title: 'Circle of Fifths',
        message: {
            simple: "Classic! {{sequence}} follows the circle of fifths - super smooth root motion.",
            intermediate: "Circle of fifths progression: {{sequence}} - each chord is a fifth below the previous.",
            advanced: "Descending fifths sequence ({{sequence}}) provides strong root motion with consistent voice leading patterns."
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
        title: 'Harmonic Sequence',
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
        title: 'Dorian Mode',
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
        title: 'Mixolydian Mode',
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
        title: 'Chromatic Mediant',
        message: {
            simple: "Colorful! {{from}} to {{to}} are a third apart with chromatic alterations - very cinematic!",
            intermediate: "Chromatic mediant: {{from}} → {{to}} - chords a third apart with altered quality, common in film scores.",
            advanced: "{{from}} → {{to}} preserves one common tone while chromatically altering others, creating dramatic color shift without functional progression."
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
        title: 'Smooth Voice Leading',
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
        title: 'Tension Peak',
        message: {
            simple: "Maximum drama! This is the most tense moment in your progression.",
            intermediate: "Tension climax reached - this is your emotional peak before resolution.",
            advanced: "Tension score peaked at this point through accumulated dominant function, dissonance, and rhythmic activity."
        },
        actions: {
            deepDive: { tab: 'chord', intent: 'optimize' }
        },
        cooldown: 90000
    },

    // Harmonic Rhythm
    'harmonic-rhythm-change': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.RHYTHM,
        id: 'harmonic-rhythm-change',
        priority: 55,
        emoji: '⏱️',
        title: 'Harmonic Rhythm Shift',
        message: {
            simple: "Nice! Your chords started moving {{direction}} here - that adds energy!",
            intermediate: "Harmonic rhythm {{direction}} at chord {{chordIndex}}: from {{fromRate}} to {{toRate}} chords per measure.",
            advanced: "Harmonic rhythm acceleration toward cadences or deceleration for prolongation creates formal articulation and dramatic effect."
        },
        actions: {
            deepDive: { tab: 'chord', intent: 'optimize' }
        },
        cooldown: 120000
    },

    // Leading Tone Resolution (proper upward resolution)
    'leading-tone-resolution': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.VOICE_LEADING,
        id: 'leading-tone-resolution',
        priority: 70,
        emoji: '🎯',
        title: 'Leading Tone Resolution',
        message: {
            simple: "Nice! The leading tone ({{leadingToneNote}}) {{resolutionDescription}} the tonic ({{tonicNote}}).",
            intermediate: "Leading tone resolution: {{leadingToneNote}} → {{tonicNote}}. This half-step pull is the strongest melodic tendency in tonal music.",
            advanced: "Ti-Do resolution ({{leadingToneNote}}→{{tonicNote}}) provides tonal confirmation. The tritone between ^4 and ^7 resolves inward."
        },
        actions: {
            explorePanel: 'voice-leading'
        },
        cooldown: 90000
    },

    // Leading Tone Resolution - Octave Shift Suggestion
    'leading-tone-octave-suggestion': {
        type: COACH_ITEM_TYPES.SUGGESTION,
        category: COACH_CATEGORIES.VOICE_LEADING,
        id: 'leading-tone-octave-suggestion',
        priority: 65,
        emoji: '🎹',
        title: 'Octave Shift for Better Resolution',
        message: {
            simple: "The leading tone ({{leadingToneNote}}) goes {{actualDirection}} to the tonic. {{suggestion}} for a smoother half-step up resolution.",
            intermediate: "Voice leading tip: {{leadingToneNote}} → {{tonicNote}} moves {{actualDirection}}. {{suggestion}} to get the classic Ti→Do half-step rise.",
            advanced: "Current voicing has {{leadingToneNote}}→{{tonicNote}} ({{intervalDescription}}). {{suggestion}} for optimal leading tone resolution with minimal voice motion."
        },
        actions: {
            explorePanel: 'voice-leading'
        },
        cooldown: 120000
    },

    // Tritone Usage (explicit tritone intervals in chord or between voices)
    'tritone-usage': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.TENSION,
        id: 'tritone-usage',
        priority: 75,
        emoji: '😈',
        title: 'Tritone Detected',
        message: {
            simple: "Spicy! That {{chord}} has a tritone - the most tense interval in music!",
            intermediate: "Tritone interval ({{notes}}) in {{chord}} creates maximum harmonic tension. It's called 'diabolus in musica' (devil in music)!",
            advanced: "The tritone (augmented 4th/diminished 5th) in {{chord}} creates instability that traditionally resolves inward to a third or outward to a sixth."
        },
        actions: {
            deepDive: true
        },
        cooldown: 60000
    },

    // Cadential 6-4
    'cadential-64': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.CADENCE,
        id: 'cadential-64',
        priority: 80,
        emoji: '👑',
        title: 'Cadential 6/4',
        message: {
            simple: "Classic! That I chord in second inversion before V is a 'cadential 6/4' - super classy!",
            intermediate: "Cadential 6/4: I⁶₄ → V creates a powerful pre-dominant effect. The 6th and 4th resolve down to the 5th and 3rd of V.",
            advanced: "The cadential 6/4 (I⁶₄→V) functions as dominant prolongation with double appoggiatura. 6→5 and 4→3 resolutions strengthen the cadence."
        },
        actions: {
            learnMore: 'lesson-cadences',
            explorePanel: 'theory'
        },
        cooldown: 90000
    },

    // Augmented 6th Chords
    'augmented-sixth': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.CHROMATIC_MEDIANT,
        id: 'augmented-sixth',
        priority: 85,
        emoji: '🎻',
        title: 'Augmented 6th Chord',
        message: {
            simple: "Fancy! That's an augmented 6th chord - it has a dramatic pull to V!",
            intermediate: "{{type}} augmented 6th chord! The augmented 6th interval ({{interval}}) expands outward to an octave on V.",
            advanced: "{{type}} ({{notes}}) provides chromatic approach to dominant via voice exchange: ♭6→5 and ♯4→5 resolve in contrary motion to the octave."
        },
        actions: {
            deepDive: true
        },
        cooldown: 60000
    },

    // Retrogression (backwards functional motion)
    'retrogression': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.SEQUENCE,
        id: 'retrogression',
        priority: 65,
        emoji: '⬅️',
        title: 'Retrogression',
        message: {
            simple: "Interesting! Going from {{from}} to {{to}} is 'backwards' - unexpected but it works!",
            intermediate: "Retrogression: {{from}}→{{to}} reverses typical functional motion (T→S→D→T). Creates surprise or modal flavor.",
            advanced: "{{from}}→{{to}} is retrograde functional motion. While atypical in common practice, it's effective for modal progressions and phrase extensions."
        },
        actions: {
            deepDive: true
        },
        cooldown: 120000
    },

    // Palindromic Progression
    'palindromic-progression': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.SEQUENCE,
        id: 'palindromic-progression',
        priority: 70,
        emoji: '🔁',
        title: 'Palindrome Pattern',
        message: {
            simple: "Cool symmetry! Your chords read the same forwards and backwards: {{pattern}}",
            intermediate: "Palindromic progression detected: {{pattern}}. This creates arch-form symmetry around the center.",
            advanced: "Palindromic structure ({{pattern}}) creates formal balance through retrograde symmetry. Common in classical development sections."
        },
        actions: {
            deepDive: true
        },
        cooldown: 180000
    },

    // Suspension Resolution (when sus chord resolves to major/minor)
    'suspension-resolution': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.VOICE_LEADING,
        id: 'suspension-resolution',
        priority: 72,
        emoji: '🎵',
        title: 'Suspension Resolved',
        message: {
            simple: "Beautiful! That {{susChord}} resolved to {{resolvedChord}} - the tension melted away!",
            intermediate: "Classic suspension resolution: {{susChord}}→{{resolvedChord}}. The {{suspendedNote}} resolved to the {{resolvedNote}}.",
            advanced: "Suspension figure: preparation ({{prep}}), suspension ({{susChord}}), resolution ({{resolvedChord}}). The {{suspendedNote}}→{{resolvedNote}} is a textbook example."
        },
        actions: {
            explorePanel: 'voice-leading'
        },
        cooldown: 60000
    },

    // Ostinato Pattern (celebrating repetition)
    'ostinato-pattern': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.MOTIF,
        id: 'ostinato-pattern',
        priority: 60,
        emoji: '🔄',
        title: 'Ostinato Pattern',
        message: {
            simple: "Nice groove! You're repeating {{pattern}} - this hypnotic repetition is called an ostinato!",
            intermediate: "Ostinato detected: {{pattern}} repeats {{count}} times. This creates a hypnotic, grounding effect.",
            advanced: "Harmonic ostinato ({{pattern}} × {{count}}) provides structural foundation while creating rhythmic/harmonic groove through strategic repetition."
        },
        actions: {
            deepDive: true
        },
        cooldown: 120000
    },

    // Chromatic Voice Motion
    'chromatic-voice-motion': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.VOICE_LEADING,
        id: 'chromatic-voice-motion',
        priority: 68,
        emoji: '🌈',
        title: 'Chromatic Voice Motion',
        message: {
            simple: "Smooth! One of your voices is moving in half steps - very expressive!",
            intermediate: "Chromatic line detected: {{notes}}. Half-step motion creates expressive tension and smooth voice leading.",
            advanced: "Chromatic linear motion ({{notes}}) provides voice-leading intensification through semitone inflection. Creates maximum melodic tension."
        },
        actions: {
            explorePanel: 'voice-leading'
        },
        cooldown: 90000
    },

    // Voice Range Achievement (when voices stay in good ranges)
    'voice-range-extreme': {
        type: COACH_ITEM_TYPES.OBSERVATION,
        category: COACH_CATEGORIES.VOICE_LEADING,
        id: 'voice-range-extreme',
        priority: 50,
        emoji: '📊',
        title: 'Register Expansion',
        message: {
            simple: "Wide range! Your {{voice}} voice is reaching {{direction}} - adds drama!",
            intermediate: "{{voice}} voice reaches {{extreme}} ({{note}}). This register {{direction === 'high' ? 'climax' : 'depth'}} adds emotional weight.",
            advanced: "Register extreme in {{voice}} ({{note}}) creates textural expansion. Consider this as a dramatic high/low point in your voicing."
        },
        actions: {
            explorePanel: 'voice-leading'
        },
        cooldown: 180000
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
            simple: "Try {{chord}} in {{inversionLabel}}{{octaveNote}} - the bass will move more smoothly from {{prevBass}} to {{newBass}}.",
            intermediate: "{{chord}} in {{inversionLabel}}{{octaveNote}} creates stepwise bass motion instead of the {{currentInterval}} jump.",
            advanced: "{{inversionLabel}} of {{chord}}{{octaveNote}} yields {{interval}} bass motion vs {{currentInterval}}, improving voice leading by ~{{improvement}}%."
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
            simple: "{{voice1}} and {{voice2}} move together in fifths from {{fromChordName}} to {{toChordName}} - classical music avoids this.",
            intermediate: "Parallel fifths between {{voice1}} and {{voice2}} ({{fromChordName}}→{{toChordName}}) - common in rock, avoided in classical.",
            advanced: "Parallel P5 motion ({{notes}}) from {{fromChordName}} to {{toChordName}} weakens voice independence. Consider contrary motion or different voicing."
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
            simple: "{{voice1}} and {{voice2}} double each other from {{fromChordName}} to {{toChordName}} - this reduces independence.",
            intermediate: "Parallel octaves between {{voice1}} and {{voice2}} ({{fromChordName}}→{{toChordName}}) - the voices merge into one.",
            advanced: "Parallel P8 motion ({{notes}}) from {{fromChordName}} to {{toChordName}} merges two voices into one perceived line, reducing textural richness."
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
            simple: "Voices cross from {{fromChordName}} to {{toChordName}} ({{crossingNotesSummary}}) - this can sound muddy.",
            intermediate: "Voice crossing: {{voice1}} goes {{crossingDirection}} {{voice2}} moving from {{fromChordName}} to {{toChordName}}. Notes: {{crossingNotesSummary}}",
            advanced: "Voice crossing ({{crossingNotesSummary}}) from {{fromChordName}} to {{toChordName}} disrupts registral stratification. Consider voice exchange or re-voicing."
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
            simple: "Try replacing {{currentChord}} with {{suggestionWithRoman}} - borrowed from parallel minor for more emotion!",
            intermediate: "Your progression is all diatonic - replacing {{currentChord}} ({{roman}}) with {{suggestionWithRoman}} would add color. {{reason}}",
            advanced: "Modal interchange: replace {{currentChord}} with {{suggestionWithRoman}} for chromatic interest. {{reason}}"
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
            simple: "Try adding {{suggestionChord}} before {{targetChord}} - it creates a stronger pull!",
            intermediate: "Try {{suggestionWithRoman}} before {{targetChord}} - it creates a stronger pull. {{reason}}",
            advanced: "Secondary dominant {{suggestionWithRoman}} provides applied dominant function to {{targetChord}}, intensifying the arrival. Pattern: {{pattern}}"
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
            simple: "Try changing {{currentChord}} to {{suggestionChord}} - the 7th makes it richer!",
            intermediate: "Try {{suggestionChord}} instead of {{currentChord}} - {{reason}}",
            advanced: "Converting {{currentChord}} to {{suggestionChord}} adds dissonance requiring resolution, increasing harmonic momentum."
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
            simple: "That {{currentChord}} chord really wants to go home to {{suggestionChord}}!",
            intermediate: "Your dominant ({{currentChord}}) is unresolved - it creates strong expectation for {{suggestionChord}}.",
            advanced: "Unresolved dominant function creates harmonic tension. Consider authentic resolution to {{suggestionChord}} or deceptive alternative."
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
            simple: "Instead of {{toChord}}, try {{suggestionChord}} for a surprise ending!",
            intermediate: "Your {{fromChord}}→{{toChord}} could become {{fromChord}}→{{suggestionWithRoman}} (deceptive cadence) for emotional depth.",
            advanced: "Deceptive resolution to {{suggestionWithRoman}} provides surprise while maintaining common tones with expected tonic."
        },
        actions: {
            preview: true,
            apply: true,
            compare: true
        },
        cooldown: 180000
    },

    'resolve-sus4': {
        type: COACH_ITEM_TYPES.SUGGESTION,
        category: COACH_CATEGORIES.RESOLUTION,
        id: 'resolve-sus4',
        priority: 75,
        emoji: '🎯',
        title: 'Resolve the Suspension?',
        message: {
            simple: "That {{currentChord}} has tension! Try {{suggestionChord}} to let it resolve.",
            intermediate: "Your {{currentChord}} suspends the 3rd - the 4th wants to fall down to create {{suggestionChord}}.",
            advanced: "The suspended 4th in {{currentChord}} creates melodic tension. Resolve to {{suggestionChord}} for satisfying voice leading (4→3)."
        },
        actions: {
            preview: true,
            apply: true
        },
        cooldown: 60000
    },

    'resolve-sus2': {
        type: COACH_ITEM_TYPES.SUGGESTION,
        category: COACH_CATEGORIES.RESOLUTION,
        id: 'resolve-sus2',
        priority: 70,
        emoji: '🎯',
        title: 'Resolve the Suspension?',
        message: {
            simple: "That {{currentChord}} sounds open! Try {{suggestionChord}} to complete it.",
            intermediate: "Your {{currentChord}} suspends the 3rd - the 2nd can rise up to create {{suggestionChord}}.",
            advanced: "The suspended 2nd in {{currentChord}} creates an open sonority. Resolve to {{suggestionChord}} for traditional voice leading (2→3)."
        },
        actions: {
            preview: true,
            apply: true
        },
        cooldown: 60000
    },

    'resolve-diminished': {
        type: COACH_ITEM_TYPES.SUGGESTION,
        category: COACH_CATEGORIES.RESOLUTION,
        id: 'resolve-diminished',
        priority: 80,
        emoji: '⚡',
        title: 'Resolve the Tension?',
        message: {
            simple: "That {{currentChord}} is very tense! It wants to resolve to {{suggestionChord}}.",
            intermediate: "Your {{currentChord}} contains a tritone that pulls strongly toward {{suggestionChord}}.",
            advanced: "The diminished chord {{currentChord}} functions as a leading-tone chord, resolving up by half-step to {{suggestionChord}}."
        },
        actions: {
            preview: true,
            apply: true
        },
        cooldown: 60000
    },

    'resolve-augmented': {
        type: COACH_ITEM_TYPES.SUGGESTION,
        category: COACH_CATEGORIES.RESOLUTION,
        id: 'resolve-augmented',
        priority: 75,
        emoji: '✨',
        title: 'Resolve the Augmented?',
        message: {
            simple: "That {{currentChord}} sounds restless! Try moving to {{suggestionChord}}.",
            intermediate: "Your {{currentChord}} has a raised 5th that wants to continue rising to {{suggestionChord}}.",
            advanced: "The augmented 5th in {{currentChord}} creates chromatic tension, typically resolving up by half-step."
        },
        actions: {
            preview: true,
            apply: true
        },
        cooldown: 60000
    },

    'resolve-dominant7': {
        type: COACH_ITEM_TYPES.SUGGESTION,
        category: COACH_CATEGORIES.RESOLUTION,
        id: 'resolve-dominant7',
        priority: 78,
        emoji: '🔥',
        title: 'Resolve the Seventh?',
        message: {
            simple: "That {{currentChord}} has a lot of pull! It wants to go to {{suggestionChord}}.",
            intermediate: "Your {{currentChord}} contains a tritone between the 3rd and 7th - it pulls strongly to {{suggestionChord}}.",
            advanced: "The tritone in {{currentChord}} (between scale degrees 4 and 7) resolves inward to the root and 3rd of {{suggestionChord}}."
        },
        actions: {
            preview: true,
            apply: true
        },
        cooldown: 45000
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
