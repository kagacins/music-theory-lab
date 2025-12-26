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
      explanation: "The {vi} chord shares two notes with {I}, giving it tonic function - it can 'substitute' for {I}. This is why {V} → {vi} sounds like a resolution (deceptive cadence). In pop, {vi} often starts progressions for emotional effect.",
      function: "Secondary tonic function. Can resolve dominant. Popular starting chord.",
      extensions: "vi7 (m7) is common in jazz and R&B. Starting on {vi} creates immediate emotional investment."
    },

    advanced: {
      title: "Relative Minor and Deceptive Resolution",
      explanation: "The {vi} chord is the relative minor - it shares the same key signature and pitch collection as {I}. This relationship enables functional substitution: {V} → {vi} 'deceives' because {vi} provides enough tonic function to partially resolve the dominant, but not enough for complete closure.",
      voiceLeading: "In {V} → {vi}, the leading tone still resolves to the 6th scale degree, maintaining some resolution while the bass moves deceptively.",
      substitutes: "{vi} can substitute for {I}. It relates to {iii} by fifths. {vi} → {IV} → {I} → {V} is the 'Axis' or 'Sensitive' progression depending on rotation."
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
      explanation: "The {vii°} is a diminished triad built on the leading tone. It contains the same crucial notes as {V}7 (leading tone and 4th scale degree) minus the dominant root. This is why {vii°} → {I} functions almost identically to {V} → {I}.",
      function: "Dominant function (shares critical tones with {V}7). Often in first inversion for smoother bass.",
      extensions: "vii°7 (fully diminished 7th) intensifies the tension. vii°7 is enharmonically versatile."
    },

    advanced: {
      title: "Diminished as Rootless Dominant",
      explanation: "The {vii°} chord can be understood as {V}7 without its root, containing the complete tritone (scale degrees 7 and 4) that defines dominant function. The diminished fifth adds further instability. The fully diminished 7th is symmetrical and can resolve to four different keys.",
      voiceLeading: "The diminished fifth contracts to the tonic and mediant. First inversion enables smooth stepwise bass motion.",
      substitutes: "{V}7 effectively substitutes (same function, plus root). Applied vii° chords function as secondary dominants without their roots."
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
      title: "The Borrowed Subtonic ({bVII})",
      explanation: "{bVII} is borrowed from the parallel minor (or Mixolydian mode). It creates a modal flavor and avoids the strong leading-tone pull, giving progressions a more 'grounded' feel.",
      function: "Borrowed subdominant/pre-dominant. Can also resolve directly to {I} in plagal fashion.",
      extensions: "{bVII}7 (dom7) adds bluesy color. {bVII} common in Mixolydian-based rock."
    },

    advanced: {
      title: "Mixolydian {bVII} and Rock Harmony",
      explanation: "The {bVII} chord eliminates the leading tone from the harmony, creating modal rather than tonal movement. This gives rock its characteristic 'rooted' sound versus Classical's 'goal-directed' drive. {bVII} relates to {IV} by fifth.",
      voiceLeading: "{bVII} → {I} involves whole-step root motion. The lowered 7th scale degree moving to tonic is weaker than the natural leading tone, hence the modal effect.",
      substitutes: "{v} (minor dominant) has similar function. {bVII} → {IV} → {I} is functionally similar to {IV} → {I} → {V}."
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
      title: "The Borrowed Flat Six ({bVI})",
      explanation: "{bVI} is borrowed from the parallel minor. It creates a chromatic third relation with {I} - a key aspect of Romantic harmony. Very effective in {bVI} → {bVII} → {I} ('Mario cadence').",
      function: "Borrowed subdominant. Creates chromatic voice leading to {V} or {I}.",
      extensions: "{bVI}maj7 is common in neo-soul and R&B. {bVI}6 enables smooth voice leading."
    },

    advanced: {
      title: "Chromatic Mediants and {bVI}",
      explanation: "The {bVI} chord exemplifies chromatic third relations - chords whose roots are a third apart with unexpected quality. {I} → {bVI} spans a major third but both are major. This creates maximal voice-leading color with minimal movement.",
      voiceLeading: "The 3rd of {I} moves by chromatic semitone to the 5th of {bVI} - highly expressive. The {bVI} → {V} progression features augmented 6th-style voice leading.",
      substitutes: "{IV} can substitute (both subdominant). {bVI} relates to {IV} by descending third, similar to {I}-{vi} relationship."
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
      title: "The Borrowed Flat Three ({bIII})",
      explanation: "{bIII} is borrowed from parallel minor. It's the relative major of the parallel minor. It provides tonic substitute function (shares a third with {i}) but with major brightness.",
      function: "Borrowed tonic substitute. Creates chromatic motion. Common in rock and pop.",
      extensions: "{bIII}maj7 adds jazz color. {bIII} works in chromatic mediant sequences."
    },

    advanced: {
      title: "{bIII} and Chromatic Mediant Relations",
      explanation: "{bIII} shares two tones with {i} (the parallel minor tonic), enabling its tonic-substitute function. The chromatic relationship {I} → {bIII} (minor third, both major) exemplifies Romantic-era third relations that break from fifth-based harmony.",
      voiceLeading: "The 3rd of {I} moves chromatically to the root of {bIII}. The {bIII} → {bVI} → {bVII} → {I} progression descends by whole and half steps.",
      substitutes: "Can substitute for {I} in some contexts (weak). {iii} and {bIII} are chromatic equivalents."
    },

    commonNextChords: ["♭VI", "IV", "♭VII"],
    commonPrevChords: ["I", "V"],
    famousSongs: ["'Space Oddity'", "'Creep' intro (B to C)"]
  },

  // ===========================================
  // 7TH CHORD VARIANTS
  // ===========================================

  "I7": {
    numeral: "I7",
    name: "Tonic Dominant 7th",
    function: "tonic",
    color: "#22c55e",

    simple: {
      title: "Home with a Bluesy Edge",
      explanation: "This is your home chord with a dominant 7th added - common in blues and jazz! It adds a slightly unstable, bluesy color while still feeling like home.",
      feeling: "Stable but with bluesy tension, funky",
      whenToUse: "Use in blues progressions, funk, and jazz when you want home base to have more color and movement."
    },

    intermediate: {
      title: "The Blues Tonic (I7)",
      explanation: "The I7 adds a minor 7th to the tonic, creating the characteristic blues sound. In blues, every chord is often a dominant 7th, blurring traditional function. This chord both resolves AND creates motion.",
      function: "Tonic function with added tension. Characteristic of blues harmony.",
      extensions: "I9, I13 add more color while maintaining the blues tonic feel."
    },

    advanced: {
      title: "Dominant 7th on Tonic",
      explanation: "The {I}7 defies traditional harmony where dominant 7ths resolve. In blues, the minor 7th on {I} creates a 'constant tension' aesthetic. The tritone (scale degrees 3 and ♭7) doesn't resolve but becomes part of the tonic color.",
      voiceLeading: "The ♭7 creates voice-leading motion even on tonic. Can move chromatically to major 7th for color.",
      substitutes: "{I}maj7 for jazz contexts. {I}6 or {I}6/9 for softer tonic extensions."
    },

    commonNextChords: ["IV", "IV7", "V", "V7"],
    commonPrevChords: ["V", "V7", "IV", "IV7"],
    famousSongs: ["Every blues song ever", "'Johnny B. Goode'", "'Pride and Joy'"]
  },

  "Imaj7": {
    numeral: "Imaj7",
    name: "Tonic Major 7th",
    function: "tonic",
    color: "#22c55e",

    simple: {
      title: "Home with Jazz Elegance",
      explanation: "This is your home chord with a dreamy, sophisticated major 7th added. It's still home, but with an elegant, jazzy, slightly floating quality.",
      feeling: "Dreamy, sophisticated, elegant home",
      whenToUse: "Use for a sophisticated, jazzy sound. Great for bossa nova, smooth jazz, and romantic ballads."
    },

    intermediate: {
      title: "The Jazz Tonic (Imaj7)",
      explanation: "The Imaj7 adds the major 7th (leading tone) to the tonic triad. Unlike the dominant 7th, the major 7th creates a sweet, consonant sound that maintains full tonic stability.",
      function: "Full tonic function with added color. The standard jazz tonic chord.",
      extensions: "Imaj9, Imaj13, I6/9 all extend this sound while keeping tonic function."
    },

    advanced: {
      title: "Major 7th Tonic Voicing",
      explanation: "The {I}maj7 adds the leading tone as a chord member, but harmonized against the root creates a major 7th interval - one of the most consonant extensions. The chord is fully stable, unlike {I}7.",
      voiceLeading: "The major 7th is the leading tone, giving subtle upward tendency while the chord remains stable.",
      substitutes: "{I}6 for more vintage sound. {iii}7 can substitute (shares 3 tones). {I}maj9 for more color."
    },

    commonNextChords: ["ii7", "IV", "IVmaj7", "vi7"],
    commonPrevChords: ["ii7", "V7", "IV"],
    famousSongs: ["'Girl from Ipanema'", "'Misty'", "'Autumn Leaves'"]
  },

  "ii7": {
    numeral: "ii7",
    name: "Supertonic Minor 7th",
    function: "subdominant",
    color: "#3b82f6",

    simple: {
      title: "The Jazz Bridge Chord",
      explanation: "This is the bridge chord with a 7th added - THE essential jazz chord! The ii7-V7-I progression is the foundation of jazz harmony.",
      feeling: "Smooth, sophisticated, forward-moving",
      whenToUse: "Use before V7 for the classic jazz ii-V-I. This is THE sound of jazz and sophisticated pop."
    },

    intermediate: {
      title: "The {ii}7 Chord",
      explanation: "The minor 7th chord built on the 2nd scale degree. Adding the 7th to {ii} creates even smoother voice leading to {V}7 - the 7th of {ii}7 becomes the 3rd of {V}7. {ii}7 → {V}7 → {I} is the most common progression in jazz.",
      function: "Pre-dominant function. Essential part of the {ii}-{V}-{I} cadence.",
      extensions: "{ii}9, {ii}11 add more color. The 9th of {ii}7 becomes the 13th of {V}7."
    },

    advanced: {
      title: "{ii}7 Voice Leading Mastery",
      explanation: "The {ii}7 chord shares the tritone with {V}7, as the 3rd and 7th of {ii}7 become the 7th and 3rd of {V}7. This tritone continuity is why {ii}7 → {V}7 is so smooth.",
      voiceLeading: "3rd of {ii}7 → 7th of {V}7 (common tone). 7th of {ii}7 → 3rd of {V}7 (half-step). The guide tones stay connected.",
      substitutes: "{IV} can substitute (both pre-dominant). {bII}7 (tritone sub of {V}7) can replace {ii}7 → {V}7 entirely."
    },

    commonNextChords: ["V7", "V"],
    commonPrevChords: ["I", "Imaj7", "vi7", "iii7"],
    famousSongs: ["Every jazz standard", "'All of Me'", "'Take the A Train'"]
  },

  "V7": {
    numeral: "V7",
    name: "Dominant 7th",
    function: "dominant",
    color: "#ef4444",

    simple: {
      title: "The Tension Chord with Extra Pull",
      explanation: "This is the tension chord supercharged! The 7th adds even MORE pull toward home. When V7 goes to I, it's one of the most satisfying sounds in all of music!",
      feeling: "Strong tension, demanding resolution, powerful pull",
      whenToUse: "Use before I for a strong cadence. The 7th makes the resolution even more satisfying than plain V."
    },

    intermediate: {
      title: "The Dominant 7th ({V}7)",
      explanation: "{V}7 contains a tritone - the interval between the 3rd (leading tone) and ♭7th (4th scale degree). This tritone is unstable and wants to resolve inward to the tonic chord. It's why {V}7 → {I} is the strongest resolution.",
      function: "Maximum dominant function. The tritone creates irresistible pull to tonic.",
      extensions: "{V}9, {V}13 add color. {V}7alt (♭9, ♯9, ♭5, ♯5) intensifies tension in jazz."
    },

    advanced: {
      title: "Tritone Resolution and Dominant Function",
      explanation: "The {V}7 contains the defining tritone (scale degrees 7 and 4). This interval, exactly half an octave, is maximally unstable. It resolves by half-steps: leading tone → tonic and chord 7th → 3rd of {I}. This voice leading defines tonal music.",
      voiceLeading: "Leading tone (7) → tonic (1). Chord 7th (4) → mediant (3). This contrary motion resolves the tritone.",
      substitutes: "{vii°}7 shares the same tritone. {bII}7 (tritone sub) shares the same tritone (enharmonically). These are functionally equivalent."
    },

    commonNextChords: ["I", "Imaj7", "vi", "vi7"],
    commonPrevChords: ["ii7", "ii", "IV", "IVmaj7"],
    famousSongs: ["The backbone of all Western music", "'Fly Me to the Moon'", "Every jazz standard"]
  },

  "IV7": {
    numeral: "IV7",
    name: "Subdominant Dominant 7th",
    function: "subdominant",
    color: "#3b82f6",

    simple: {
      title: "The Journey Chord Goes Blues",
      explanation: "This is the journey chord (IV) with a bluesy dominant 7th. It's essential in blues - the move from I7 to IV7 is THE classic blues sound!",
      feeling: "Bluesy journey, soulful traveling",
      whenToUse: "Essential for blues! The I7-IV7 move is the heart of 12-bar blues. Also great in gospel and soul."
    },

    intermediate: {
      title: "The Blues {IV}7",
      explanation: "In blues, {IV}7 maintains subdominant function while adding the characteristic dominant 7th color. Unlike classical harmony, blues treats every chord as potentially a dominant 7th for color.",
      function: "Subdominant function with blues coloring. Essential in 12-bar blues.",
      extensions: "{IV}9 adds more soul. {IV}7#9 adds funk edge."
    },

    advanced: {
      title: "{IV}7 and Blues Harmony",
      explanation: "The {IV}7 creates a non-functional dominant 7th - it doesn't resolve like a {V}7 would. The tritone exists but resolves deceptively or not at all. This 'frozen tension' is central to blues aesthetics.",
      voiceLeading: "The tritone in {IV}7 doesn't resolve traditionally. Blues embraces this unresolved tension.",
      substitutes: "{iv}7 for minor blues. {IV}maj7 for jazz/soul crossover."
    },

    commonNextChords: ["I7", "I", "V7", "V"],
    commonPrevChords: ["I7", "I", "V7"],
    famousSongs: ["'Sweet Home Chicago'", "Every 12-bar blues", "'The Thrill Is Gone'"]
  },

  "vi7": {
    numeral: "vi7",
    name: "Submediant Minor 7th",
    function: "tonic",
    color: "#22c55e",

    simple: {
      title: "The Emotional Cousin with Depth",
      explanation: "This is the emotional chord (vi) with a 7th that adds even more depth and sophistication. It's the starting point of many beautiful jazz and R&B progressions.",
      feeling: "Deep emotion, sophisticated sadness, soulful",
      whenToUse: "Great for emotional jazz and R&B. The vi7-ii7-V7-I is a classic turnaround."
    },

    intermediate: {
      title: "The {vi}7 Chord",
      explanation: "Adding the 7th to {vi} creates a minor 7th chord that leads beautifully to {ii}7 (roots move by 4th/5th). The {vi}7 → {ii}7 → {V}7 → {I} progression is a cornerstone of jazz harmony.",
      function: "Tonic substitute function. Starting point for circle-of-fifths progressions.",
      extensions: "{vi}9 and {vi}11 add more color while keeping the emotional quality."
    },

    advanced: {
      title: "{vi}7 in Jazz Harmony",
      explanation: "The {vi}7 chord can begin a chain of descending fifths: {vi}7 → {ii}7 → {V}7 → {I}. Each chord is a {ii}-{V} of the next. This 'chaining' of {ii}-{V} relationships is how jazz extends and elaborates harmony.",
      voiceLeading: "7th of {vi}7 → 3rd of {ii}7. Smooth voice leading through the chain.",
      substitutes: "{IV} can substitute (both lead to {ii}). {bVI}maj7 (borrowed) adds chromatic color."
    },

    commonNextChords: ["ii7", "IV", "IVmaj7", "V7"],
    commonPrevChords: ["I", "Imaj7", "iii7", "V7"],
    famousSongs: ["'Autumn Leaves'", "'All The Things You Are'", "Every rhythm changes tune"]
  },

  "iii7": {
    numeral: "iii7",
    name: "Mediant Minor 7th",
    function: "tonic",
    color: "#22c55e",

    simple: {
      title: "The Floating 7th",
      explanation: "This dreamy chord adds a 7th to the mysterious iii chord. It has a floating, ethereal quality and often moves to vi7 in jazz progressions.",
      feeling: "Dreamy, floating, ethereal",
      whenToUse: "Use for a mysterious, floating quality. Works beautifully moving to vi7 or as a tonic substitute."
    },

    intermediate: {
      title: "The {iii}7 Chord",
      explanation: "Adding the 7th to {iii} creates a minor 7th chord that can substitute for {I}maj7 (they share 3 notes). In jazz, {iii}7 → {vi}7 → {ii}7 → {V}7 → {I} is an extended circle-of-fifths progression.",
      function: "Weak tonic function. Often starts circle-of-fifths chains to {vi}7.",
      extensions: "{iii}9 adds more color while maintaining the floating quality."
    },

    advanced: {
      title: "{iii}7 as Tonic Substitute",
      explanation: "The {iii}7 shares three notes with {I}maj7, enabling tonic substitution. It can also begin an extended {ii}-{V} chain: {iii}7 → {vi}7 → {ii}7 → {V}7 → {I} (each pair is a {ii}-{V} of the next).",
      voiceLeading: "The 3rd and 7th of {iii}7 become guide tones through the cycle. Smooth step-wise motion throughout.",
      substitutes: "{I}maj7 substitutes directly. {iii}7 can replace {I} in some contexts for added motion."
    },

    commonNextChords: ["vi7", "vi", "IV", "IVmaj7"],
    commonPrevChords: ["I", "Imaj7", "V7"],
    famousSongs: ["Jazz turnarounds", "'All The Things You Are'", "Extended ii-V sequences"]
  },

  "IVmaj7": {
    numeral: "IVmaj7",
    name: "Subdominant Major 7th",
    function: "subdominant",
    color: "#3b82f6",

    simple: {
      title: "The Dreamy Journey",
      explanation: "This is the journey chord with an elegant major 7th. It's sophisticated and beautiful, common in jazz, bossa nova, and R&B.",
      feeling: "Elegant, dreamy, sophisticated journey",
      whenToUse: "Use for a sophisticated, lush sound. Beautiful in jazz and R&B progressions."
    },

    intermediate: {
      title: "The {IV}maj7 Chord",
      explanation: "The major 7th on {IV} creates a lush, sophisticated chord. Unlike {IV}7 (bluesy), {IV}maj7 is smooth and jazzy. It's standard in bossa nova and smooth jazz.",
      function: "Subdominant function with added elegance. Common in jazz and sophisticated pop.",
      extensions: "{IV}6/9 is another common extension with similar function."
    },

    advanced: {
      title: "Lydian Color on {IV}",
      explanation: "{IV}maj7 often implies Lydian mode (raised 4th) in jazz contexts. The major 7th is the natural 7th of Lydian and creates no avoid notes, making {IV}maj7 one of the most stable extended chords.",
      voiceLeading: "The major 7th provides smooth connection to {V} or back to {I}. {IV}maj7 → {V}7 is a classic jazz pre-dominant motion.",
      substitutes: "{IV}6 for a more vintage sound. {ii}7 is the primary pre-dominant alternative."
    },

    commonNextChords: ["V7", "V", "iii7", "I", "Imaj7"],
    commonPrevChords: ["I", "Imaj7", "vi7", "iii7"],
    famousSongs: ["'Girl from Ipanema'", "'Alfie'", "Bossa nova standards"]
  },

  // ===========================================
  // NON-DIATONIC / SECONDARY DOMINANTS
  // ===========================================

  "II": {
    numeral: "II",
    name: "Major Supertonic",
    function: "dominant",
    color: "#f59e0b", // Amber - secondary dominant

    simple: {
      title: "The Surprise Major",
      explanation: "This is {II} when you'd expect {ii}! It's usually acting as the 'V of V' - it creates extra tension that wants to resolve to {V}, then to {I}.",
      feeling: "Bright surprise, strong pull forward",
      whenToUse: "Use when you want to really emphasize the {V} chord. {II} → {V} → {I} is a powerful extended cadence."
    },

    intermediate: {
      title: "Secondary Dominant (V/V)",
      explanation: "The major II chord is typically the 'dominant of the dominant' (V/V). It has a leading tone that pulls to {V}, just like {V} pulls to {I}. This creates an extended, intensified cadence.",
      function: "Secondary dominant function. Tonicizes {V} temporarily.",
      extensions: "II7 (dominant 7th) is even more common and adds the characteristic dominant pull."
    },

    advanced: {
      title: "V/V and Applied Dominants",
      explanation: "The {II} chord temporarily tonicizes {V} by providing its leading tone. This is the most common 'applied' or 'secondary' dominant. The chromatic pitch creates momentary tension before resolving to {V}.",
      voiceLeading: "The raised 4th scale degree is the leading tone of {V} and resolves up to the 5th scale degree. This chromatic voice leading intensifies the cadence.",
      substitutes: "vii°/V has similar function. {bVI} can approach {V} from the other side."
    },

    commonNextChords: ["V", "V7"],
    commonPrevChords: ["I", "IV", "vi"],
    famousSongs: ["Common in classical cadences", "'Circle of Life'", "Many gospel songs"]
  },

  "II7": {
    numeral: "II7",
    name: "Secondary Dominant 7th",
    function: "dominant",
    color: "#f59e0b",

    simple: {
      title: "Extra Pull to V",
      explanation: "This dominant 7th chord on the 2nd degree really wants to go to {V}! It's like a preview of the tension - creating a chain of resolutions: {II}7 → {V}7 → {I}.",
      feeling: "Strong forward motion, anticipatory tension",
      whenToUse: "Use to really emphasize your {V} chord. Creates a powerful double-resolution effect."
    },

    intermediate: {
      title: "V7/V - Dominant of the Dominant",
      explanation: "The II7 is the dominant 7th of {V}. It contains a leading tone that resolves to {V}'s root, and a 7th that resolves down. The tritone in II7 resolves to {V} just as {V}7's tritone resolves to {I}.",
      function: "Secondary dominant with full tritone tension. Intensifies the approach to {V}.",
      extensions: "II9, II13 add color. II7♭9 adds intensity in jazz contexts."
    },

    advanced: {
      title: "Applied Dominant Chains",
      explanation: "II7 is the prototypical applied dominant. Its tritone resolves to the root and 3rd of {V}. This enables chains: VI7-II7-V7-I, where each dominant resolves to the next.",
      voiceLeading: "The raised 4th resolves up to the 5th (leading tone resolution). The 7th resolves down. The tritone contracts to {V}.",
      substitutes: "{bVI}7 (tritone sub of II7) offers chromatic bass motion to {V}. vii°7/V shares the tritone."
    },

    commonNextChords: ["V", "V7"],
    commonPrevChords: ["I", "vi", "IV"],
    famousSongs: ["Standard jazz turnarounds", "'I Got Rhythm' bridge"]
  },

  "III": {
    numeral: "III",
    name: "Major Mediant",
    function: "dominant",
    color: "#f59e0b",

    simple: {
      title: "The Dramatic Surprise",
      explanation: "This is {III} when you'd expect {iii}! It's usually acting as V/vi - it creates strong pull toward the {vi} chord, adding drama and intensity.",
      feeling: "Dramatic, intense, surprising",
      whenToUse: "Use before {vi} for dramatic effect. {III} → {vi} → {IV} → {V} is a powerful, emotional sequence."
    },

    intermediate: {
      title: "Secondary Dominant to vi (V/vi)",
      explanation: "The major III chord is the dominant of {vi}. It contains a leading tone that creates a strong pull to the relative minor. This is very common in emotional, dramatic music.",
      function: "Secondary dominant function targeting {vi}. Tonicizes the relative minor.",
      extensions: "III7 adds full dominant tension toward {vi}."
    },

    advanced: {
      title: "V/vi and Minor Tonicization",
      explanation: "The {III} chord temporarily tonicizes {vi} by providing its leading tone. This momentary shift toward the relative minor creates emotional intensity without full modulation.",
      voiceLeading: "The raised 5th scale degree resolves to the 6th (leading tone to {vi}). The chromatic alteration creates expressive tension.",
      substitutes: "vii°/vi has similar function. {vi} itself often follows without the applied dominant."
    },

    commonNextChords: ["vi", "vi7"],
    commonPrevChords: ["I", "IV", "ii"],
    famousSongs: ["'Bohemian Rhapsody'", "'Yesterday' - Beatles", "Many dramatic pop songs"]
  },

  "III7": {
    numeral: "III7",
    name: "Secondary Dominant 7th to vi",
    function: "dominant",
    color: "#f59e0b",

    simple: {
      title: "Full Pull to the Emotional Chord",
      explanation: "This dominant 7th really pulls hard toward {vi} (the emotional chord). When {III}7 resolves to {vi}, it creates a powerful, dramatic moment.",
      feeling: "Intense pull, dramatic tension, emotional resolution coming",
      whenToUse: "Use for maximum drama before {vi}. Common in gospel, soul, and dramatic pop."
    },

    intermediate: {
      title: "V7/vi - Full Secondary Dominant",
      explanation: "{III}7 adds the full tritone tension pointing at {vi}. The tritone resolves to the root and 3rd of {vi}. This is the strongest pull to {vi} possible.",
      function: "Complete secondary dominant with tritone tension. Maximum pull to {vi}.",
      extensions: "III7♭9 adds even more intensity in jazz and gospel."
    },

    advanced: {
      title: "Applied V7 to Relative Minor",
      explanation: "The {III}7 contains a tritone that resolves to the root and minor 3rd of {vi}. This is the exact mechanism of V7-I, applied to the relative minor relationship.",
      voiceLeading: "The leading tone resolves to {vi}'s root. The 7th resolves down. The tritone contracts to the root and 3rd of {vi}.",
      substitutes: "{bVII}7 (tritone sub) approaches {vi} from above. vii°7/vi shares the tritone."
    },

    commonNextChords: ["vi", "vi7"],
    commonPrevChords: ["I", "IV", "ii"],
    famousSongs: ["'Creep' - Radiohead", "'Space Oddity' - Bowie", "Gospel turnarounds"]
  },

  "VII": {
    numeral: "VII",
    name: "Major Subtonic",
    function: "dominant",
    color: "#f59e0b",

    simple: {
      title: "The Secondary Pull to iii",
      explanation: "This is {VII} when you'd expect {vii°}! It's acting as V/iii - creating pull toward the mysterious {iii} chord.",
      feeling: "Unexpected brightness, forward pull",
      whenToUse: "Rare but effective before {iii}. Creates an unusual chromatic moment."
    },

    intermediate: {
      title: "V/iii - Dominant of the Mediant",
      explanation: "The VII chord is the dominant of {iii}. It contains a leading tone to {iii}, creating a secondary dominant relationship with the mediant chord.",
      function: "Secondary dominant targeting {iii}. Temporarily tonicizes the mediant.",
      extensions: "VII7 adds tritone tension."
    },

    advanced: {
      title: "Applied Dominant to iii",
      explanation: "{VII} tonicizes {iii} by providing a leading tone. This is less common than other secondary dominants because {iii} itself has weak tonal function.",
      voiceLeading: "The raised 4th scale degree resolves to the 3rd. The chromatic alteration creates voice-leading intensity.",
      substitutes: "{iii} can be approached diatonically from {I} or {vi} instead."
    },

    commonNextChords: ["iii"],
    commonPrevChords: ["I", "IV"],
    famousSongs: ["Rare in pop, more common in classical sequences"]
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
