/**
 * Chord Function Explanations Database
 *
 * Explains WHY specific chords work in different contexts.
 * Organized by chord type and function within progressions.
 */

// ===========================================
// CHORD FUNCTION DEFINITIONS
// ===========================================

export const chordFunctions = {

  // ===========================================
  // MAJOR KEY CHORD FUNCTIONS
  // ===========================================

  "I": {
    numeral: "I",
    name: "Tonic Major",
    function: "tonic",
    color: "#22c55e", // Green - home

    simple: {
      title: "Home Base",
      explanation: "This is your home chord! Songs start here, end here, and keep coming back here. It feels stable, complete, and resting.",
      feeling: "Stable, complete, at rest",
      whenToUse: "Start your song here, end your song here, or come back here whenever you want to feel grounded."
    },

    intermediate: {
      title: "The Tonic (I)",
      explanation: "The I chord (built on the first scale degree) is the tonal center - all other chords relate to it. It represents complete stability and resolution. The strongest cadences end on I.",
      function: "Provides resolution and tonal grounding. Can start or end phrases.",
      extensions: "Imaj7 adds warmth while maintaining tonic function. I6 and I6/9 add color in jazz contexts."
    },

    advanced: {
      title: "Tonic Function and Stability",
      explanation: "The I chord contains scale degrees 1, 3, and 5 - the most stable pitches in the key. Its root is the tonal center by definition. I can appear in any inversion, though root position is strongest for cadential resolution.",
      voiceLeading: "Leading tone (7) resolves to root. 4th scale degree resolves to 3rd. These resolutions define tonic arrival.",
      substitutes: "vi and iii can substitute for I due to shared tones. Imaj7 maintains function despite added dissonance."
    },

    commonNextChords: ["IV", "V", "vi", "ii"],
    commonPrevChords: ["V", "IV", "vi", "ii"],
    famousSongs: ["First chord of most songs", "Last chord of most songs"]
  },

  "ii": {
    numeral: "ii",
    name: "Supertonic Minor",
    function: "subdominant",
    color: "#3b82f6", // Blue - traveling

    simple: {
      title: "The Bridge Chord",
      explanation: "This chord is like a bridge - it smoothly connects home (I) to the tension chord (V). It's the middle step in many great progressions!",
      feeling: "Moving forward, gentle motion",
      whenToUse: "Use it before V to create a smooth, sophisticated sound. The ii-V-I is one of the most beautiful progressions!"
    },

    intermediate: {
      title: "The Supertonic (ii)",
      explanation: "The ii chord prepares the dominant (V). It shares the 4th scale degree with IV but has stronger voice leading to V because they share a common tone (the 5th of ii = root of V). This makes ii-V smoother than IV-V.",
      function: "Pre-dominant function. Leads naturally to V. Creates the ubiquitous ii-V-I progression.",
      extensions: "ii7 (m7) is extremely common in jazz. ii-V-I is THE jazz cadence."
    },

    advanced: {
      title: "Pre-Dominant Function of ii",
      explanation: "The ii chord's pre-dominant function derives from its subdominant scale degree (4) and its fifth-relation to V. Root movement by descending fifth (ii → V) is the strongest progression, making ii → V → I more compelling than IV → V → I.",
      voiceLeading: "The 3rd of ii (4th scale degree) moves to 3rd of V (leading tone). Root of ii moves to 5th of V (common tone often held).",
      substitutes: "IV can substitute for ii (both are pre-dominant). ii°/ii can substitute for ii in minor contexts. ♭II (Neapolitan) intensifies pre-dominant function."
    },

    commonNextChords: ["V", "V7"],
    commonPrevChords: ["I", "vi", "iii"],
    famousSongs: ["'Autumn Leaves' - The quintessential ii-V-I", "'Fly Me to the Moon'"]
  },

  "iii": {
    numeral: "iii",
    name: "Mediant Minor",
    function: "tonic",
    color: "#22c55e", // Green (weak tonic)

    simple: {
      title: "The Mysterious Middle",
      explanation: "This chord has a dreamy, ambiguous quality. It's related to home but has a wandering feel. Use it when you want something slightly mysterious.",
      feeling: "Dreamy, ambiguous, floating",
      whenToUse: "Use it to add color between I and IV, or to create a sense of mystery and openness."
    },

    intermediate: {
      title: "The Mediant (iii)",
      explanation: "The iii chord is the weakest tonic-function chord. It shares two notes with I but includes the leading tone, giving it some dominant characteristics. It often moves to vi (descending fifths) or IV.",
      function: "Weak tonic function. Can act as dominant substitute in some contexts. Often leads to vi.",
      extensions: "iii7 (m7) adds jazz color. Can substitute for I in deceptive-like resolutions."
    },

    advanced: {
      title: "Mediant's Dual Nature",
      explanation: "The iii chord's position is theoretically complex. It contains the leading tone (suggesting dominant function) but shares two tones with I (suggesting tonic function). Riemann classified it as tonic; others see it as dominant substitute.",
      voiceLeading: "iii → vi completes a fifth-cycle step. iii → IV moves by step, common in pop. The leading tone in iii can resolve to I.",
      substitutes: "Can substitute for I (deceptive-like) or V (very weak dominant). Its ambiguity makes it versatile but uncommitted."
    },

    commonNextChords: ["vi", "IV", "ii"],
    commonPrevChords: ["I", "V"],
    famousSongs: ["'Mad World' progression uses iii", "'Space Oddity' - David Bowie"]
  },

  "IV": {
    numeral: "IV",
    name: "Subdominant Major",
    function: "subdominant",
    color: "#3b82f6", // Blue - traveling

    simple: {
      title: "The Journey Chord",
      explanation: "This chord moves you away from home on a journey. It's bright and moving, not tense - just traveling. IV to I is the gentle 'Amen' ending at church!",
      feeling: "Bright, open, journeying",
      whenToUse: "Use after I to 'leave home', before V for a IV-V-I cadence, or go directly IV → I for a soft, hymn-like ending."
    },

    intermediate: {
      title: "The Subdominant (IV)",
      explanation: "The IV chord creates 'plagal' motion - movement that doesn't involve the leading tone. The 4th scale degree (root of IV) wants to resolve down to 3, creating gentle pull toward tonic. IV → I is the 'plagal' or 'Amen' cadence.",
      function: "Pre-dominant (leads to V) or plagal resolution (goes to I). Less driving than ii.",
      extensions: "IVmaj7 is common in jazz and pop. IV6/9 adds sophistication."
    },

    advanced: {
      title: "Subdominant Function and Plagal Motion",
      explanation: "The IV chord's function is defined by scale degree 4 (its root), which creates a dissonance against 5 (dominant) and resolves to 3 (mediant). Unlike ii, IV doesn't share a tone with V, making IV-V slightly less smooth but more 'open' sounding.",
      voiceLeading: "In plagal cadence, 4 resolves to 3, 6 to 5, and 1 is common. Some theorists consider IV → I as expansion rather than true cadence.",
      substitutes: "ii can substitute for IV (both subdominant). iv (borrowed from minor) adds emotional weight."
    },

    commonNextChords: ["V", "I", "ii"],
    commonPrevChords: ["I", "V", "vi"],
    famousSongs: ["'Let It Be' - Beatles (constant IV-I)", "'With or Without You' - U2"]
  },

  "V": {
    numeral: "V",
    name: "Dominant Major",
    function: "dominant",
    color: "#ef4444", // Red - tension

    simple: {
      title: "The 'Wants to Go Home' Chord",
      explanation: "This is THE tension chord! It feels unstable and really, really wants to go back to home (I). When V goes to I, it's the most satisfying sound in music!",
      feeling: "Tense, expectant, pulling toward home",
      whenToUse: "Use before I for a strong ending. The tension in V makes the resolution to I feel amazing!"
    },

    intermediate: {
      title: "The Dominant (V)",
      explanation: "The V chord contains the leading tone (7th scale degree), which is a half-step below the tonic and strongly pulls toward it. Adding a 7th (V7) creates a tritone with scale degree 4, adding even more tension that must resolve.",
      function: "Creates maximum tension that resolves to tonic. V-I is the 'authentic cadence' - the strongest resolution.",
      extensions: "V7 is stronger than V. V9, V13 add color in jazz. Altered dominants (V7♯9, V7♭9) add intensity."
    },

    advanced: {
      title: "Dominant Function and Tritone Resolution",
      explanation: "Dominant function is defined by the tritone between scale degrees 7 and 4 (in V7). This interval, spanning 6 semitones, is maximally unstable and resolves by contrary half-steps to degrees 1 and 3. This voice leading creates the 'pull' of V to I.",
      voiceLeading: "Leading tone (7) → tonic (1). Seventh of V (4) → third of I (3). Fifth of V can move to root or fifth of I.",
      substitutes: "vii° shares three tones with V7 (same function, no root). Tritone sub (♭II7) shares the same tritone. Applied dominants extend this to other chords."
    },

    commonNextChords: ["I", "vi"],
    commonPrevChords: ["ii", "IV", "I"],
    famousSongs: ["End of virtually every Classical piece", "'Twist and Shout' - Beatles"]
  },

  "vi": {
    numeral: "vi",
    name: "Submediant Minor",
    function: "tonic",
    color: "#22c55e", // Green (secondary tonic)

    simple: {
      title: "The Emotional Cousin",
      explanation: "This chord is related to home (I) but has a sad, emotional quality. It's used constantly in pop music! The famous 'four chord' songs use vi all the time.",
      feeling: "Emotional, bittersweet, reflective",
      whenToUse: "Use after I for emotional depth, or as a surprise after V (the 'deceptive' cadence). vi-IV-I-V is one of the most popular progressions ever!"
    },

    intermediate: {
      title: "The Submediant (vi)",
      explanation: "The vi chord shares two notes with I (C-E-G and A-C-E share C and E), giving it tonic function - it can 'substitute' for I. This is why V-vi sounds like a resolution (deceptive cadence). In pop, vi often starts progressions for emotional effect.",
      function: "Secondary tonic function. Can resolve dominant. Popular starting chord.",
      extensions: "vi7 (m7) is common in jazz and R&B. Starting on vi creates immediate emotional investment."
    },

    advanced: {
      title: "Relative Minor and Deceptive Resolution",
      explanation: "The vi chord is the relative minor - it shares the same key signature and pitch collection as I. This relationship enables functional substitution: V-vi 'deceives' because vi provides enough tonic function to partially resolve the dominant, but not enough for complete closure.",
      voiceLeading: "In V-vi, the leading tone still resolves (B→C in G-Am), maintaining some resolution while the bass moves deceptively.",
      substitutes: "vi can substitute for I. It relates to iii by fifths. vi-IV-I-V is the 'Axis' or 'Sensitive' progression depending on rotation."
    },

    commonNextChords: ["IV", "ii", "V"],
    commonPrevChords: ["I", "V", "iii"],
    famousSongs: ["'Despacito'", "'Someone Like You' - Adele", "'Africa' - Toto"]
  },

  "vii°": {
    numeral: "vii°",
    name: "Leading Tone Diminished",
    function: "dominant",
    color: "#ef4444", // Red - tension (dominant)

    simple: {
      title: "The Super-Tense Chord",
      explanation: "This chord is VERY tense and unstable - even more than V! It's rarely used on its own in modern music but understanding it helps you understand harmony.",
      feeling: "Very unstable, tense, urgent",
      whenToUse: "Use sparingly for dramatic effect, or understand it as 'V7 without the root' to see why V7 is so powerful."
    },

    intermediate: {
      title: "The Leading Tone Triad (vii°)",
      explanation: "The vii° is a diminished triad built on the leading tone. It contains the same crucial notes as V7 (leading tone and 4th scale degree) minus the dominant root. This is why vii° → I functions almost identically to V → I.",
      function: "Dominant function (shares critical tones with V7). Often in first inversion (viio6) for smoother bass.",
      extensions: "viio7 (fully diminished 7th) intensifies the tension. vii°7 is enharmonically versatile."
    },

    advanced: {
      title: "Diminished as Rootless Dominant",
      explanation: "The vii° chord can be understood as V7 without its root, containing the complete tritone (7-4) that defines dominant function. The diminished fifth adds further instability. viio7 (B-D-F-Ab) is symmetrical and can resolve to four different keys.",
      voiceLeading: "The diminished fifth B-F contracts to C-E. First inversion (viio6) enables smooth 7-6 bass motion.",
      substitutes: "V7 effectively substitutes (same function, plus root). Applied vii° chords function as secondary dominants without their roots."
    },

    commonNextChords: ["I"],
    commonPrevChords: ["IV", "ii"],
    famousSongs: ["Used in passing motion", "Common in Bach chorales"]
  },

  // ===========================================
  // MINOR KEY CHORD FUNCTIONS
  // ===========================================

  "i": {
    numeral: "i",
    name: "Tonic Minor",
    function: "tonic",
    color: "#22c55e",

    simple: {
      title: "The Sad Home",
      explanation: "This is home base for minor keys - it's stable and complete, but with a sad, serious, or mysterious quality instead of happy.",
      feeling: "Stable but melancholy, resolved but dark",
      whenToUse: "Start and end minor key songs here. It's your emotional home base."
    },

    intermediate: {
      title: "The Minor Tonic (i)",
      explanation: "The i chord provides the same tonal center as I but with minor quality. The lowered 3rd gives it emotional weight. Minor keys often use a raised 7th (from harmonic minor) in the V chord for stronger resolution back to i.",
      function: "Tonic function in minor keys. Represents complete resolution.",
      extensions: "im7, im9 add depth while maintaining tonic function."
    },

    advanced: {
      title: "Minor Tonic and Modal Considerations",
      explanation: "The minor tonic exists in multiple scalar contexts: natural minor (Aeolian), harmonic minor (raised 7), melodic minor (raised 6 and 7 ascending). Each scale affects surrounding chord possibilities.",
      voiceLeading: "In harmonic minor, the raised 7th creates a strong leading tone. Natural minor's subtonic (♭7) creates weaker dominant function.",
      substitutes: "♭III (relative major) can substitute, sharing tones. Picardy third (ending on I instead of i) was historically common."
    },

    commonNextChords: ["iv", "V", "♭VII", "♭VI"],
    commonPrevChords: ["V", "iv", "♭VII"],
    famousSongs: ["'House of the Rising Sun'", "'Stairway to Heaven' (verse)"]
  },

  "iv": {
    numeral: "iv",
    name: "Subdominant Minor",
    function: "subdominant",
    color: "#3b82f6",

    simple: {
      title: "The Dark Journey",
      explanation: "Like IV in major but sadder. It moves away from home with a dark, emotional quality. Often borrowed into major keys for a moment of sadness!",
      feeling: "Dark, moving, melancholy",
      whenToUse: "Use in minor keys before V or i. Borrow it into major keys for emotional impact!"
    },

    intermediate: {
      title: "The Minor Subdominant (iv)",
      explanation: "In minor keys, iv is naturally minor. It often precedes V (with raised 7th) for a strong minor-key cadence: iv → V → i. Borrowed iv in major keys creates beautiful moments of modal interchange.",
      function: "Pre-dominant function in minor keys. Powerful borrowed chord in major keys.",
      extensions: "ivm6 is particularly poignant. iv7 works in jazz minor contexts."
    },

    advanced: {
      title: "Minor iv and Modal Borrowing",
      explanation: "The iv chord is one of the most commonly borrowed chords, moving from parallel minor into major contexts. Its minor 3rd (♭6 of the key) creates the characteristic 'borrowed' sound. The iv-I plagal cadence has distinct character from IV-I.",
      voiceLeading: "In iv-I, the ♭6 can move chromatically to 5, adding emotional weight. iv-V-I combines borrowing with authentic cadence.",
      substitutes: "ii° serves similar function in minor. ♭II (Neapolitan) intensifies pre-dominant function."
    },

    commonNextChords: ["V", "i", "♭VII"],
    commonPrevChords: ["i", "♭VI"],
    famousSongs: ["'Creep' - Radiohead (uses IV then iv)", "'My Heart Will Go On'"]
  },

  // ===========================================
  // BORROWED / MODAL INTERCHANGE CHORDS
  // ===========================================

  "♭VII": {
    numeral: "♭VII",
    name: "Subtonic Major",
    function: "subdominant",
    color: "#8b5cf6", // Purple - borrowed

    simple: {
      title: "The Rock Chord",
      explanation: "This chord is borrowed from the parallel minor key and it's EVERYWHERE in rock music! It has a powerful, earthy sound that doesn't want to resolve - it just is.",
      feeling: "Powerful, grounded, rock-solid",
      whenToUse: "Use it in rock and pop for power! ♭VII → IV → I is a classic rock progression."
    },

    intermediate: {
      title: "The Borrowed Subtonic (♭VII)",
      explanation: "♭VII is borrowed from the parallel minor (or Mixolydian mode). In C major, that's B♭ major (B♭-D-F). It creates a modal flavor and avoids the strong leading-tone pull, giving progressions a more 'grounded' feel.",
      function: "Borrowed subdominant/pre-dominant. Can also resolve directly to I in plagal fashion.",
      extensions: "♭VII7 (dom7) adds bluesy color. ♭VII common in Mixolydian-based rock."
    },

    advanced: {
      title: "Mixolydian ♭VII and Rock Harmony",
      explanation: "The ♭VII chord eliminates the leading tone from the harmony, creating modal rather than tonal movement. This gives rock its characteristic 'rooted' sound versus Classical's 'goal-directed' drive. ♭VII relates to IV by fifth.",
      voiceLeading: "♭VII → I involves whole-step root motion. ♭7 → 1 (B♭ → C) is weaker than 7 → 1 (B → C), hence the modal effect.",
      substitutes: "v (minor dominant) has similar function. ♭VII → IV → I is functionally similar to IV → I → V."
    },

    commonNextChords: ["IV", "I", "♭VI"],
    commonPrevChords: ["IV", "I", "v"],
    famousSongs: ["'Sweet Home Alabama'", "'Hey Jude' (ending vamp)", "'With or Without You'"]
  },

  "♭VI": {
    numeral: "♭VI",
    name: "Flat Submediant Major",
    function: "subdominant",
    color: "#8b5cf6", // Purple - borrowed

    simple: {
      title: "The Dramatic Surprise",
      explanation: "This chord is borrowed from minor and sounds dramatic, mysterious, and emotional. It adds an unexpected twist that immediately grabs attention!",
      feeling: "Dramatic, mysterious, epic",
      whenToUse: "Use for dramatic moments! ♭VI → ♭VII → I is a powerful, cinematic progression."
    },

    intermediate: {
      title: "The Borrowed Flat Six (♭VI)",
      explanation: "♭VI is borrowed from the parallel minor (A♭ major in C). It creates chromatic third relation with I (C-A♭) - a key aspect of Romantic harmony. Very effective in ♭VI → ♭VII → I ('Mario cadence').",
      function: "Borrowed subdominant. Creates chromatic voice leading to V or I.",
      extensions: "♭VImaj7 is common in neo-soul and R&B. ♭VI6 enables smooth voice leading."
    },

    advanced: {
      title: "Chromatic Mediants and ♭VI",
      explanation: "The ♭VI chord exemplifies chromatic third relations - chords whose roots are a third apart with unexpected quality. C → A♭ spans a major third but both are major. This creates maximal voice-leading color with minimal movement.",
      voiceLeading: "E (3rd of I) → E♭ (5th of ♭VI) is a chromatic semitone - highly expressive. The ♭VI → V progression features augmented 6th-style voice leading.",
      substitutes: "IV can substitute (both subdominant). ♭VI relates to IV by descending third, similar to I-vi relationship."
    },

    commonNextChords: ["♭VII", "V", "iv"],
    commonPrevChords: ["I", "V"],
    famousSongs: ["'Africa' - Toto", "'Bohemian Rhapsody'", "'Somebody That I Used to Know'"]
  },

  "♭III": {
    numeral: "♭III",
    name: "Flat Mediant Major",
    function: "tonic",
    color: "#8b5cf6", // Purple - borrowed

    simple: {
      title: "The Relative Major Borrowed",
      explanation: "This is the relative major chord borrowed into a major key. It sounds bright but unexpected - like a ray of sunshine from another world!",
      feeling: "Bright, expansive, unexpected",
      whenToUse: "Use for a surprising lift or to transition. It works great before ♭VI or IV."
    },

    intermediate: {
      title: "The Borrowed Flat Three (♭III)",
      explanation: "♭III is borrowed from parallel minor (E♭ in C major). It's the relative major of the parallel minor. It provides tonic substitute function (shares a third with i) but with major brightness.",
      function: "Borrowed tonic substitute. Creates chromatic motion. Common in rock and pop.",
      extensions: "♭IIImaj7 adds jazz color. ♭III works in chromatic mediant sequences."
    },

    advanced: {
      title: "♭III and Chromatic Mediant Relations",
      explanation: "♭III shares two tones with i (the parallel minor tonic), enabling its tonic-substitute function. The chromatic relationship C → E♭ (minor third, both major) exemplifies Romantic-era third relations that break from fifth-based harmony.",
      voiceLeading: "E (3rd of I) → E♭ (root of ♭III) is chromatic motion. The ♭III → ♭VI → ♭VII → I progression descends by whole and half steps.",
      substitutes: "Can substitute for I in some contexts (weak). iii and ♭III are chromatic equivalents."
    },

    commonNextChords: ["♭VI", "IV", "♭VII"],
    commonPrevChords: ["I", "V"],
    famousSongs: ["'Space Oddity'", "'Creep' intro (B to C)"]
  }
};

// ===========================================
// CHORD RELATIONSHIPS AND TRANSITIONS
// ===========================================

export const chordTransitions = {
  "V-I": {
    name: "Authentic Cadence",
    strength: "strongest",

    simple: "The most satisfying resolution in music! V really wants to go to I, and when it does - ahhh!",
    intermediate: "The dominant-tonic resolution. The tritone in V7 resolves by half-steps to the stable third of I.",
    advanced: "Voice-leading archetype: 7→1, 4→3, 2→1/5. The fundamental motion of tonal music.",

    feeling: "Complete resolution, finality, satisfaction",
    usage: "End phrases, end songs, arrive at important moments"
  },

  "IV-I": {
    name: "Plagal Cadence",
    strength: "medium",

    simple: "The gentle 'Amen' ending. Softer than V-I but still feels like coming home.",
    intermediate: "Subdominant to tonic without dominant tension. The 4th scale degree drops to the 3rd.",
    advanced: "Plagal motion lacks leading-tone drive. Often used as confirmation after authentic cadence.",

    feeling: "Soft arrival, peaceful, hymn-like",
    usage: "Gentle endings, post-cadential 'amen', softer resolution"
  },

  "V-vi": {
    name: "Deceptive Cadence",
    strength: "medium",

    simple: "A surprise! You expect home but get somewhere else. Still works because vi is related to home.",
    intermediate: "The leading tone still resolves (to the 3rd of vi), but the bass 'deceives' by going to vi instead of I.",
    advanced: "Exploits vi's tonic function (shared tones with I) while denying full resolution. Extends phrases.",

    feeling: "Surprise, 'not quite done yet', emotional continuation",
    usage: "Extend emotional phrases, avoid predictability, create yearning"
  },

  "ii-V": {
    name: "ii-V Motion",
    strength: "strong",

    simple: "The smoothest way to get to V! The ii chord sets up V perfectly.",
    intermediate: "Root motion by descending fifth - the strongest progression. ii and V share a common tone.",
    advanced: "Circle-of-fifths motion with optimal voice-leading. Foundation of jazz harmony.",

    feeling: "Forward momentum, inevitability, sophistication",
    usage: "Approach dominant chords, create jazz cadences, add sophistication"
  },

  "ii-V-I": {
    name: "ii-V-I Progression",
    strength: "strongest",

    simple: "The most common chord progression in jazz and sophisticated pop! It's the complete journey: bridge, tension, home.",
    intermediate: "Combines pre-dominant (ii), dominant (V), and tonic (I). Each chord leads naturally to the next.",
    advanced: "The archetype of functional harmony. Can be embellished, extended, substituted endlessly.",

    feeling: "Complete harmonic journey, sophisticated, inevitable",
    usage: "Jazz standards, sophisticated pop, anywhere you want a complete harmonic statement"
  },

  "I-IV": {
    name: "Tonic to Subdominant",
    strength: "medium",

    simple: "Leaving home on a journey. Moving away to somewhere new and open.",
    intermediate: "Root rises by fourth (or drops by fifth). Opens the harmonic 'space' away from tonic.",
    advanced: "I-IV is 'progressive' motion, opening phrase structure. Reciprocal of V-I resolution.",

    feeling: "Opening up, moving forward, beginning a journey",
    usage: "Start a progression, create movement away from home, open up space"
  },

  "I-V": {
    name: "Tonic to Dominant",
    strength: "medium",

    simple: "Going straight to tension! Creates expectation - something needs to happen next.",
    intermediate: "Root motion by fifth. Sets up the need for resolution back to I.",
    advanced: "Opens dominant prolongation zone. I-V-I is the fundamental tonal structure.",

    feeling: "Creating expectation, building tension",
    usage: "Set up resolutions, create tension, establish dominant area"
  },

  "vi-IV-I-V": {
    name: "Axis Progression",
    strength: "n/a",

    simple: "One of the most popular progressions ever! Start emotional (vi), journey (IV), home briefly (I), tension (V), repeat!",
    intermediate: "Also called the 'Sensitive' or 'Pop-punk' progression. vi provides emotional opening; cycle continues through subdominant, tonic, dominant.",
    advanced: "Each rotation creates a different song feel while maintaining the same chord relationships. I-V-vi-IV is the 'Axis' rotation.",

    feeling: "Emotional, anthemic, universal",
    usage: "Countless pop hits, emotional songs, singalong choruses"
  }
};

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Get chord function data by Roman numeral
 * @param {string} numeral - Roman numeral (e.g., "V", "ii", "♭VII")
 * @returns {Object|undefined} Chord function data
 */
export function getChordFunction(numeral) {
  return chordFunctions[numeral];
}

/**
 * Get transition/relationship data
 * @param {string} transition - Transition name (e.g., "V-I", "ii-V-I")
 * @returns {Object|undefined} Transition data
 */
export function getTransition(transition) {
  return chordTransitions[transition];
}

/**
 * Get all chords with a specific function
 * @param {string} func - Function type ("tonic", "dominant", "subdominant")
 * @returns {Object[]} Array of chord function objects
 */
export function getChordsByFunction(func) {
  return Object.values(chordFunctions).filter(chord => chord.function === func);
}

/**
 * Get the function color for display
 * @param {string} numeral - Roman numeral
 * @returns {string} Hex color code
 */
export function getFunctionColor(numeral) {
  const chord = chordFunctions[numeral];
  return chord ? chord.color : "#888888";
}

/**
 * Get common next chords for a given chord
 * @param {string} numeral - Roman numeral
 * @returns {string[]} Array of Roman numerals
 */
export function getCommonNextChords(numeral) {
  const chord = chordFunctions[numeral];
  return chord ? chord.commonNextChords : [];
}

// Export function types for use in UI
export const FUNCTION_TYPES = {
  TONIC: 'tonic',
  DOMINANT: 'dominant',
  SUBDOMINANT: 'subdominant'
};

export const FUNCTION_COLORS = {
  tonic: '#22c55e',      // Green - home
  dominant: '#ef4444',    // Red - tension
  subdominant: '#3b82f6', // Blue - traveling
  borrowed: '#8b5cf6'     // Purple - borrowed
};
