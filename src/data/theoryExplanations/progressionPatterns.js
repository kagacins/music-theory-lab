/**
 * Progression Patterns Database
 *
 * Common chord progressions with multi-level explanations.
 * Each pattern includes why it works, famous examples, and variations.
 */

export const progressionPatterns = {

  // ===========================================
  // FOUNDATIONAL PROGRESSIONS
  // ===========================================

  "I-IV-V-I": {
    id: "I-IV-V-I",
    name: "The Three-Chord Wonder",
    numerals: ["I", "IV", "V", "I"],
    category: "foundational",
    difficulty: "beginner",
    genres: ["Rock", "Country", "Blues", "Folk", "Pop"],

    simple: {
      title: "The Three-Chord Wonder",
      explanation: "This is the most basic and universal progression in Western music! Just three chords - home, journey, tension, home. It's simple, powerful, and millions of songs use it.",
      whyItWorks: "It has everything: a stable start (I), movement away (IV), building tension (V), and a satisfying return home (I). Your ears naturally expect this pattern.",
      feeling: "Complete, satisfying, energetic"
    },

    intermediate: {
      title: "The I-IV-V Progression",
      explanation: "This progression uses the three primary triads of any key - the only major triads in a major scale. Each has a distinct function: I (tonic), IV (subdominant), V (dominant). Together they define the key completely.",
      harmonicAnalysis: "I establishes tonic. IV creates subdominant motion (away from tonic). V creates dominant tension. I resolves. This is the complete T-S-D-T functional cycle.",
      variations: ["I-IV-V (no return)", "I-V-IV-I (reversed subdominant-dominant)", "I-IV-I-V (alternating)"]
    },

    advanced: {
      title: "Primary Triads and Functional Harmony",
      explanation: "The I, IV, and V chords contain all seven scale degrees between them. This complete coverage, combined with the fundamental bass motion by fourths/fifths, makes this progression harmonically self-sufficient.",
      voiceLeading: "Optimal voice leading: IV-V shares no common tone (bass moves by step). V-I shares one tone (5). The authentic cadence (V-I) provides strong closure.",
      historicalContext: "This pattern predates functional harmony theory. Its ubiquity in folk traditions worldwide suggests deep cognitive/acoustic foundations."
    },

    famousSongs: [
      { title: "La Bamba", artist: "Ritchie Valens" },
      { title: "Twist and Shout", artist: "The Beatles" },
      { title: "Wild Thing", artist: "The Troggs" },
      { title: "Louie Louie", artist: "The Kingsmen" },
      { title: "Good Riddance", artist: "Green Day" }
    ],

    keyExamples: {
      "C": ["C", "F", "G", "C"],
      "G": ["G", "C", "D", "G"],
      "D": ["D", "G", "A", "D"],
      "A": ["A", "D", "E", "A"]
    }
  },

  "I-V-vi-IV": {
    id: "I-V-vi-IV",
    name: "The Axis Progression",
    numerals: ["I", "V", "vi", "IV"],
    category: "foundational",
    difficulty: "beginner",
    genres: ["Pop", "Rock", "Country", "Anthem"],

    simple: {
      title: "The 'Four Chord Song'",
      explanation: "This might be the most popular progression of all time! Thousands of hit songs use these exact four chords in this order. It just WORKS - it's catchy, emotional, and endlessly singable.",
      whyItWorks: "It starts strong (I), builds energy (V), adds emotion (vi), then warms up (IV) before repeating. The emotional journey keeps you hooked!",
      feeling: "Anthemic, uplifting, emotional, universal"
    },

    intermediate: {
      title: "The Axis/Sensitive Progression",
      explanation: "Each chord has a distinct emotional role: I (confident home), V (energizing tension), vi (emotional depth - it's minor!), IV (warm return). The vi chord's minor quality adds crucial emotional weight without being 'sad'.",
      harmonicAnalysis: "I-V is strong but expectant. V-vi is a deceptive cadence (surprise!). vi-IV moves to subdominant. IV-I is plagal motion. Each move serves the emotional arc.",
      variations: ["vi-IV-I-V (starting on vi - more vulnerable)", "I-IV-vi-V (subdominant before relative minor)", "Endless rotations of the same 4 chords"]
    },

    advanced: {
      title: "The Axis System in Popular Music",
      explanation: "This progression cycles through all three functional areas: I (tonic), V (dominant), vi (tonic substitute), IV (subdominant). The deceptive motion V-vi extends the progression beyond a simple T-D-T arc, creating space for melodic development.",
      voiceLeading: "Strong common-tone connections throughout: I-V share one tone, V-vi share one, vi-IV share two, IV-I share one. Smooth throughout.",
      historicalContext: "Became dominant in pop music from the 2000s onward, though roots trace to 1950s doo-wop and earlier."
    },

    famousSongs: [
      { title: "Let It Be", artist: "The Beatles" },
      { title: "No Woman No Cry", artist: "Bob Marley" },
      { title: "With or Without You", artist: "U2" },
      { title: "Someone Like You", artist: "Adele" },
      { title: "Poker Face", artist: "Lady Gaga" }
    ],

    keyExamples: {
      "C": ["C", "G", "Am", "F"],
      "G": ["G", "D", "Em", "C"],
      "D": ["D", "A", "Bm", "G"],
      "A": ["A", "E", "F#m", "D"]
    }
  },

  "vi-IV-I-V": {
    id: "vi-IV-I-V",
    name: "The Sensitive Rotation",
    numerals: ["vi", "IV", "I", "V"],
    category: "foundational",
    difficulty: "beginner",
    genres: ["Pop", "Emo", "Ballad"],

    simple: {
      title: "Starting From Emotion",
      explanation: "Same four chords as the 'Axis' progression, but starting on the sad chord (vi). This immediately creates a vulnerable, emotional feeling right from the first note!",
      whyItWorks: "Starting on the minor chord creates instant emotional investment. You feel something right away. Then the progression builds toward hope (I) before V keeps it moving.",
      feeling: "Vulnerable, emotional, yearning, hopeful"
    },

    intermediate: {
      title: "The Emo/Sensitive Progression",
      explanation: "By starting on vi instead of I, tonic arrival is delayed until the third chord. This creates tension and anticipation from the start. The major I chord, when it arrives, feels like a ray of hope emerging from the minor opening.",
      harmonicAnalysis: "vi (tonic substitute, minor) → IV (subdominant) → I (tonic - relief!) → V (dominant). The delayed tonic and minor opening create the 'sensitive' character.",
      variations: ["IV-I-V-vi (neutral start)", "Adding 7ths for more sophistication"]
    },

    advanced: {
      title: "Rotation and Tonic Delay",
      explanation: "This rotation of the axis progression demonstrates how starting position affects perception. The vi start establishes minor mode expectation, making the major I arrival a form of deceptive brightness. Modal ambiguity (is it minor or major?) creates emotional richness.",
      voiceLeading: "Same voice-leading efficiency as other rotations. The emotional difference comes entirely from starting position and resulting phrase structure.",
      historicalContext: "Became associated with emo and alternative rock in the 2000s, but the rotation appears in earlier soul and R&B."
    },

    famousSongs: [
      { title: "Grenade", artist: "Bruno Mars" },
      { title: "Complicated", artist: "Avril Lavigne" },
      { title: "Numb", artist: "Linkin Park" },
      { title: "When I Was Your Man", artist: "Bruno Mars" }
    ],

    keyExamples: {
      "C": ["Am", "F", "C", "G"],
      "G": ["Em", "C", "G", "D"],
      "D": ["Bm", "G", "D", "A"]
    }
  },

  "ii-V-I": {
    id: "ii-V-I",
    name: "The Jazz Cadence",
    numerals: ["ii", "V", "I"],
    category: "foundational",
    difficulty: "intermediate",
    genres: ["Jazz", "Bossa Nova", "R&B", "Sophisticated Pop"],

    simple: {
      title: "The Sophisticated Sound",
      explanation: "This is THE jazz progression! Three chords that sound smooth, sophisticated, and inevitable. The ii chord sets up V perfectly, and V resolves to I perfectly. It's like a well-oiled machine.",
      whyItWorks: "Each chord flows into the next: ii (bridge) → V (tension) → I (home). The roots move by fifths - the strongest motion in music!",
      feeling: "Smooth, sophisticated, inevitable, jazzy"
    },

    intermediate: {
      title: "The ii-V-I Progression",
      explanation: "Root movement by descending fifth (D-G-C in C major) is the strongest harmonic motion. The ii chord shares a common tone with V (the 5th of ii = root of V), making the connection smooth. V7-I provides the classic dominant resolution.",
      harmonicAnalysis: "ii (pre-dominant) → V (dominant) → I (tonic). This is the complete functional cadence in its most efficient form. Adding 7ths (ii7-V7-Imaj7) is standard in jazz.",
      variations: ["ii-V (turnaround, doesn't resolve)", "ii-V-I in minor (ii°-V-i)", "Multiple ii-V's targeting different chords"]
    },

    advanced: {
      title: "ii-V-I as Harmonic Foundation",
      explanation: "The ii-V-I represents the archetype of circle-of-fifths motion within a key. It can be modified extensively: tritone subs (ii-♭II7-I), altered dominants (ii-V7alt-I), extended chords, and chromatic approach. Every jazz musician internalizes this as the fundamental harmonic unit.",
      voiceLeading: "Optimal: 3rd of ii → 7th of V, 7th of ii → 3rd of V (guide tones). V7's tritone resolves to I's 3rd and root. Minimal motion, maximum function.",
      historicalContext: "Though implied in Classical music, ii-V-I became the primary cadence of jazz in the 1930s-40s and remains foundational."
    },

    famousSongs: [
      { title: "Autumn Leaves", artist: "Jazz Standard" },
      { title: "Fly Me to the Moon", artist: "Frank Sinatra" },
      { title: "All The Things You Are", artist: "Jazz Standard" },
      { title: "Girl From Ipanema", artist: "Stan Getz" }
    ],

    keyExamples: {
      "C": ["Dm7", "G7", "Cmaj7"],
      "G": ["Am7", "D7", "Gmaj7"],
      "F": ["Gm7", "C7", "Fmaj7"],
      "Bb": ["Cm7", "F7", "Bbmaj7"]
    }
  },

  // ===========================================
  // CLASSIC ROCK & BLUES PROGRESSIONS
  // ===========================================

  "12-bar-blues": {
    id: "12-bar-blues",
    name: "12-Bar Blues",
    numerals: ["I", "I", "I", "I", "IV", "IV", "I", "I", "V", "IV", "I", "V"],
    category: "blues",
    difficulty: "beginner",
    genres: ["Blues", "Rock", "Jazz", "R&B"],

    simple: {
      title: "The Blueprint of American Music",
      explanation: "This 12-bar pattern is the foundation of blues, rock, jazz, and R&B. It's been used for over 100 years and thousands of songs! Learn this and you can jam with anyone.",
      whyItWorks: "The pattern tells a story: state something (I), emphasize it (IV), return (I), create tension (V), resolve (I). It's the musical equivalent of call-and-response.",
      feeling: "Bluesy, soulful, groovy, foundational"
    },

    intermediate: {
      title: "The 12-Bar Blues Form",
      explanation: "Four bars of I (the 'statement'), two bars of IV then two bars of I (the 'response'), then V-IV-I-V (the 'turnaround'). The V at the end sets up the repeat. Using dominant 7th chords (I7, IV7, V7) throughout adds the bluesy sound.",
      harmonicAnalysis: "I7 throughout suggests modal mixture. The movement to IV in bar 5 is the characteristic 'blues change'. The V-IV-I turnaround reverses expected dominant-subdominant order for bluesy effect.",
      variations: ["Quick-change blues (IV in bar 2)", "Jazz blues (ii-V substitutions)", "Minor blues (i-iv-V)", "8-bar blues (compressed form)"]
    },

    advanced: {
      title: "Blues Form and Harmonic Extensions",
      explanation: "The 12-bar blues allows extensive harmonic substitution while maintaining form recognition. Jazz blues commonly uses: I7 | IV7 | I7 | #I°7 | IV7 | #IV°7 | I7 | VI7 | ii7 | V7 | I7 | V7. The form accommodates bebop complexity while retaining blues feeling.",
      voiceLeading: "Dominant 7ths throughout blur functional expectations. The IV-I motion at bars 6-7 is a 'blues cadence' distinct from authentic cadence. Chromatic voice leading enables sophisticated variations.",
      historicalContext: "Emerged from African-American folk music in the late 19th century. Became the foundation for jazz, rhythm and blues, and rock and roll."
    },

    famousSongs: [
      { title: "Sweet Home Chicago", artist: "Robert Johnson" },
      { title: "The Thrill Is Gone", artist: "B.B. King" },
      { title: "Pride and Joy", artist: "Stevie Ray Vaughan" },
      { title: "Johnny B. Goode", artist: "Chuck Berry" },
      { title: "Hound Dog", artist: "Elvis Presley" }
    ],

    keyExamples: {
      "A": ["A7", "A7", "A7", "A7", "D7", "D7", "A7", "A7", "E7", "D7", "A7", "E7"],
      "E": ["E7", "E7", "E7", "E7", "A7", "A7", "E7", "E7", "B7", "A7", "E7", "B7"],
      "G": ["G7", "G7", "G7", "G7", "C7", "C7", "G7", "G7", "D7", "C7", "G7", "D7"]
    }
  },

  "I-bVII-IV": {
    id: "I-bVII-IV",
    name: "The Rock Anthem",
    numerals: ["I", "♭VII", "IV"],
    category: "rock",
    difficulty: "intermediate",
    genres: ["Rock", "Alternative", "Grunge"],

    simple: {
      title: "The Power Rock Sound",
      explanation: "This progression has powered countless rock anthems! The ♭VII chord (borrowed from minor) gives it that powerful, earthy sound. It feels grounded and rebellious.",
      whyItWorks: "The ♭VII chord avoids the 'classical' V-I sound. It creates forward motion without the strong pull of dominant harmony. Rock thrives on this modal, non-resolving energy.",
      feeling: "Powerful, anthemic, driving, rebellious"
    },

    intermediate: {
      title: "Modal Rock Progression",
      explanation: "♭VII is borrowed from the parallel minor (or Mixolydian mode). This creates a 'modal' sound that's characteristic of rock. Without a leading tone, the progression feels more 'planted' than Classical harmony.",
      harmonicAnalysis: "I (tonic) → ♭VII (borrowed chord, whole step below) → IV (subdominant). The ♭VII-IV motion is descending by whole steps, creating strong forward momentum.",
      variations: ["I-♭VII-IV-I (returning home)", "I-♭VII-IV-♭VII (staying modal)", "Adding ♭III for more color"]
    },

    advanced: {
      title: "Mixolydian Harmony in Rock",
      explanation: "This progression exemplifies the Mixolydian mode's influence on rock. The ♭7 scale degree (root of ♭VII) replaces the leading tone, eliminating dominant function. Rock progressions often move by whole steps or fourths rather than fifths.",
      voiceLeading: "I → ♭VII involves chromatic descent (B → Bb in C). ♭VII → IV moves by fourth. The overall motion is 'plagal' in character - no dominant tension.",
      historicalContext: "Emerged from blues-rock fusion in the 1960s. Became defining sound of classic rock, carried into grunge and alternative."
    },

    famousSongs: [
      { title: "Sweet Home Alabama", artist: "Lynyrd Skynyrd" },
      { title: "Sweet Child O' Mine", artist: "Guns N' Roses" },
      { title: "Hey Jude (ending)", artist: "The Beatles" },
      { title: "Born to Run", artist: "Bruce Springsteen" }
    ],

    keyExamples: {
      "D": ["D", "C", "G"],
      "G": ["G", "F", "C"],
      "A": ["A", "G", "D"],
      "E": ["E", "D", "A"]
    }
  },

  // ===========================================
  // EMOTIONAL & DRAMATIC PROGRESSIONS
  // ===========================================

  "i-bVI-bIII-bVII": {
    id: "i-bVI-bIII-bVII",
    name: "The Epic Minor",
    numerals: ["i", "♭VI", "♭III", "♭VII"],
    category: "dramatic",
    difficulty: "intermediate",
    genres: ["Film Score", "Metal", "Dramatic Pop"],

    simple: {
      title: "The Movie Soundtrack Sound",
      explanation: "This progression sounds EPIC and dramatic - perfect for movie trailers and emotional moments. It stays in minor but visits powerful, major-sounding chords borrowed from the minor scale.",
      whyItWorks: "Starting on minor (i) sets a serious tone. Then each chord is a major chord from the minor scale, creating brightness within darkness. Dramatic!",
      feeling: "Epic, cinematic, dramatic, triumphant"
    },

    intermediate: {
      title: "Natural Minor Progression",
      explanation: "All chords come from natural minor: i (minor tonic), ♭VI (major, a third above), ♭III (relative major), ♭VII (subtonic). The major chords provide 'light' moments within the minor context.",
      harmonicAnalysis: "The progression avoids dominant function entirely - no V or vii°. This creates a 'modal' minor sound that's open and expansive rather than tension-driven.",
      variations: ["i-♭VII-♭VI-♭VII (ending on ♭VII)", "i-♭VI-♭VII-i (returning home)", "Adding iv for more minor color"]
    },

    advanced: {
      title: "Aeolian Mode and Film Scoring",
      explanation: "This progression uses only Aeolian (natural minor) harmonies, avoiding harmonic minor's raised 7th. The lack of leading tone creates an 'ancient' or 'modal' quality. Film composers use this to evoke epic, timeless feelings.",
      voiceLeading: "The bass moves by thirds throughout (A-F-C-G in A minor). This creates large-scale arpeggiation of Am7 extended chord. Very smooth despite the drama.",
      historicalContext: "Became prominent in film scoring from the 1970s onward. Hans Zimmer and others use it extensively for epic, dramatic cues."
    },

    famousSongs: [
      { title: "Stairway to Heaven (verse)", artist: "Led Zeppelin" },
      { title: "All Along the Watchtower", artist: "Bob Dylan/Hendrix" },
      { title: "My Heart Will Go On", artist: "Celine Dion" },
      { title: "Game of Thrones Theme", artist: "Ramin Djawadi" }
    ],

    keyExamples: {
      "Am": ["Am", "F", "C", "G"],
      "Em": ["Em", "C", "G", "D"],
      "Dm": ["Dm", "Bb", "F", "C"]
    }
  },

  "i-iv-v-i": {
    id: "i-iv-v-i",
    name: "Minor Key Classic",
    numerals: ["i", "iv", "v", "i"],
    category: "minor",
    difficulty: "beginner",
    genres: ["Classical", "Film", "Pop"],

    simple: {
      title: "The Sad Journey",
      explanation: "This is the minor key version of I-IV-V-I. It sounds darker, more serious, and more emotional. The journey is the same, but the mood is completely different!",
      whyItWorks: "Same structure as the major version - home, away, tension, home - but the minor quality makes everything more emotional and dramatic.",
      feeling: "Melancholy, serious, dramatic, emotional"
    },

    intermediate: {
      title: "Minor Key I-IV-V",
      explanation: "In natural minor, the v chord is also minor (less tension). Using harmonic minor (V instead of v) adds the leading tone for stronger resolution. Many songs mix both approaches.",
      harmonicAnalysis: "i (minor tonic) → iv (minor subdominant) → v or V (natural or harmonic minor dominant) → i. The V chord choice affects the 'classical' vs 'modal' sound.",
      variations: ["i-iv-V-i (harmonic minor V for strong resolution)", "i-iv-v-i (natural minor, more modal)", "i-iv-VII-i (avoiding dominant entirely)"]
    },

    advanced: {
      title: "Minor Mode and Dominant Variants",
      explanation: "The tension between natural minor (v) and harmonic minor (V) defines minor key harmony. V provides Classical-era 'closure'; v provides modal 'openness'. Minor-mode composers navigate this choice constantly.",
      voiceLeading: "With V: raised 7th creates leading tone → tonic resolution. With v: whole step 7th-8th motion is weaker. Both are valid depending on stylistic intent.",
      historicalContext: "Classical music typically uses V in minor for cadences (harmonic minor). Folk and rock often prefer the modal v chord (natural minor)."
    },

    famousSongs: [
      { title: "House of the Rising Sun", artist: "The Animals" },
      { title: "Eleanor Rigby", artist: "The Beatles" },
      { title: "Summertime", artist: "George Gershwin" }
    ],

    keyExamples: {
      "Am": ["Am", "Dm", "Em/E", "Am"],
      "Em": ["Em", "Am", "Bm/B", "Em"],
      "Dm": ["Dm", "Gm", "Am/A", "Dm"]
    }
  },

  "I-bVI-bVII-I": {
    id: "I-bVI-bVII-I",
    name: "The Mario Cadence",
    numerals: ["I", "♭VI", "♭VII", "I"],
    category: "dramatic",
    difficulty: "intermediate",
    genres: ["Video Games", "Film", "Pop"],

    simple: {
      title: "The Video Game Sound",
      explanation: "Named after Super Mario Bros, this progression sounds triumphant and heroic! The ♭VI and ♭VII are borrowed from minor, creating a dramatic climb back to home.",
      whyItWorks: "The ♭VI is a surprise - it's not in the major key! Then ♭VII walks up to I by whole step. It feels like climbing stairs to victory!",
      feeling: "Triumphant, heroic, victorious, energetic"
    },

    intermediate: {
      title: "The Double Plagal Cadence",
      explanation: "Both ♭VI and ♭VII are borrowed from parallel minor. The progression creates stepwise bass motion: up a half-step (I-♭VI), then whole step (♭VI-♭VII), then whole step (♭VII-I). This 'walking up' feeling is the victory sound.",
      harmonicAnalysis: "I → ♭VI (modal mixture, chromatic mediant) → ♭VII (borrowed subtonic) → I (plagal-like return). No dominant function - pure modal voice leading.",
      variations: ["♭VI-♭VII-I (starting from ♭VI)", "I-♭VII-♭VI-I (descending version)", "Adding V before return to I"]
    },

    advanced: {
      title: "Chromatic Mediants and Video Game Harmony",
      explanation: "The ♭VI chord creates chromatic third relation with I (C-Ab spans major 3rd, both major). This is characteristic of film/game scoring. The ♭VII-I motion avoids leading-tone resolution, creating modal 'triumph' rather than classical resolution.",
      voiceLeading: "I-♭VI: 3rd of I (E) descends chromatically to 5th of ♭VI (Eb). ♭VI-♭VII: root rises by whole step. ♭VII-I: another whole step. Stepwise bass motion throughout.",
      historicalContext: "Video game music (Koji Kondo, Nobuo Uematsu) drew from film scoring techniques. This progression became associated with triumph/victory moments."
    },

    famousSongs: [
      { title: "Super Mario Bros Theme", artist: "Koji Kondo" },
      { title: "Final Fantasy Victory Theme", artist: "Nobuo Uematsu" },
      { title: "Livin' on a Prayer (chorus)", artist: "Bon Jovi" },
      { title: "Eye of the Tiger", artist: "Survivor" }
    ],

    keyExamples: {
      "C": ["C", "Ab", "Bb", "C"],
      "G": ["G", "Eb", "F", "G"],
      "D": ["D", "Bb", "C", "D"]
    }
  },

  // ===========================================
  // JAZZ & SOPHISTICATED PROGRESSIONS
  // ===========================================

  "I-vi-ii-V": {
    id: "I-vi-ii-V",
    name: "The 50s Progression",
    numerals: ["I", "vi", "ii", "V"],
    category: "jazz",
    difficulty: "intermediate",
    genres: ["Doo-wop", "Jazz", "50s Pop", "Standards"],

    simple: {
      title: "The Doo-Wop Sound",
      explanation: "This progression defined 1950s music! It's smooth, romantic, and timeless. Every chord flows perfectly into the next, creating that classic 'golden oldies' sound.",
      whyItWorks: "Each chord shares notes with the next, making it super smooth. It cycles through tonic (I), relative minor (vi), then the classic ii-V setup.",
      feeling: "Romantic, nostalgic, smooth, classic"
    },

    intermediate: {
      title: "The Doo-Wop / Turnaround",
      explanation: "Also called the '50s progression' or 'ice cream changes'. Each chord is a fifth below the next: I (C) - vi (Am) - ii (Dm) - V (G). This descending-fifths motion is the smoothest possible cycle.",
      harmonicAnalysis: "I (tonic) → vi (tonic substitute) → ii (pre-dominant) → V (dominant). Can repeat indefinitely or resolve to I. Circle-of-fifths root motion throughout.",
      variations: ["I-vi-IV-V (50s with IV instead of ii)", "iii-vi-ii-V (extended cycle)", "Adding 7ths for jazz feel"]
    },

    advanced: {
      title: "Circle Progression and Jazz Standards",
      explanation: "This progression demonstrates pure circle-of-fifths motion within the diatonic scale. It's the basis for countless jazz standards' 'A' sections and 'rhythm changes' bridge. Each chord can be extended or substituted while maintaining the cycle.",
      voiceLeading: "Each root falls by fifth. Common tones connect adjacent chords: I-vi share 3rd and 5th, vi-ii share root and 3rd, ii-V share 5th/root. Maximum smoothness.",
      historicalContext: "Predates doo-wop in jazz (Gershwin, Cole Porter). Became the signature sound of early rock and roll through doo-wop groups."
    },

    famousSongs: [
      { title: "Earth Angel", artist: "The Penguins" },
      { title: "Stand By Me", artist: "Ben E. King" },
      { title: "Heart and Soul", artist: "Standard" },
      { title: "Blue Moon", artist: "Standard" }
    ],

    keyExamples: {
      "C": ["C", "Am", "Dm", "G"],
      "G": ["G", "Em", "Am", "D"],
      "F": ["F", "Dm", "Gm", "C"]
    }
  },

  "iii-vi-ii-V-I": {
    id: "iii-vi-ii-V-I",
    name: "Extended Circle of Fifths",
    numerals: ["iii", "vi", "ii", "V", "I"],
    category: "jazz",
    difficulty: "advanced",
    genres: ["Jazz", "Broadway", "Great American Songbook"],

    simple: {
      title: "The Jazziest Journey",
      explanation: "This progression goes even further than ii-V-I! It starts way back at iii and walks through the entire circle of fifths: iii → vi → ii → V → I. Each chord points to the next like dominos.",
      whyItWorks: "Every chord is the 'V' of the next chord (almost). This creates constant forward motion toward home. It's musical inevitability!",
      feeling: "Sophisticated, inevitable, jazzy, satisfying"
    },

    intermediate: {
      title: "Full Diatonic Circle",
      explanation: "This chain descends by fifths through almost all diatonic chords: iii-vi-ii-V-I. To complete the full cycle, add vii°: I-IV-vii°-iii-vi-ii-V-I. Each step is the same strong motion: root falls a fifth (or rises a fourth).",
      harmonicAnalysis: "iii (weak tonic) → vi (tonic substitute) → ii (pre-dominant) → V (dominant) → I (tonic). Natural sequence maximizes forward drive.",
      variations: ["Starting anywhere in the cycle", "Adding 7ths throughout", "Using secondary dominants for stronger pulls"]
    },

    advanced: {
      title: "Sequential Harmony and Sequences",
      explanation: "This progression is a diatonic sequence - the same pattern (descending fifth) applied repeatedly. It can be intensified with secondary dominants: E7-A7-D7-G7-C. This 'chain of dominants' is fundamental to jazz harmony.",
      voiceLeading: "Guide tone lines (3rds and 7ths) move by step throughout the sequence: 7→3→7→3→7. This stepwise voice leading provides coherence across changing chords.",
      historicalContext: "Sequences appear in Baroque music (Vivaldi, Pachelbel). Jazz extended them with seventh chords and alterations."
    },

    famousSongs: [
      { title: "All the Things You Are", artist: "Jerome Kern" },
      { title: "Autumn Leaves", artist: "Joseph Kosma" },
      { title: "I Will Survive (partial)", artist: "Gloria Gaynor" }
    ],

    keyExamples: {
      "C": ["Em7", "Am7", "Dm7", "G7", "Cmaj7"],
      "G": ["Bm7", "Em7", "Am7", "D7", "Gmaj7"],
      "F": ["Am7", "Dm7", "Gm7", "C7", "Fmaj7"]
    }
  }
};

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Get a progression by ID
 * @param {string} id - Progression ID
 * @returns {Object|undefined} Progression data
 */
export function getProgression(id) {
  return progressionPatterns[id];
}

/**
 * Get all progressions in a category
 * @param {string} category - Category name
 * @returns {Object[]} Array of progressions
 */
export function getProgressionsByCategory(category) {
  return Object.values(progressionPatterns).filter(p => p.category === category);
}

/**
 * Get progressions by difficulty
 * @param {string} difficulty - 'beginner', 'intermediate', or 'advanced'
 * @returns {Object[]} Array of progressions
 */
export function getProgressionsByDifficulty(difficulty) {
  return Object.values(progressionPatterns).filter(p => p.difficulty === difficulty);
}

/**
 * Get progressions by genre
 * @param {string} genre - Genre name
 * @returns {Object[]} Array of progressions
 */
export function getProgressionsByGenre(genre) {
  return Object.values(progressionPatterns).filter(p =>
}

/**
 * Get example in a specific key
 * @param {string} progressionId - Progression ID
 * @param {string} key - Key name (e.g., "C", "G", "Am")
 * @returns {string[]|undefined} Array of chord names or undefined
 */
export function getKeyExample(progressionId, key) {
  const progression = progressionPatterns[progressionId];
  return progression?.keyExamples?.[key];
}

/**
 * Search progressions by keyword
 * @param {string} keyword - Search term
 * @returns {Object[]} Matching progressions
 */
export function searchProgressions(keyword) {
  const lower = keyword.toLowerCase();
  return Object.values(progressionPatterns).filter(p => {
    return p.name.toLowerCase().includes(lower) ||
           p.numerals.join('-').toLowerCase().includes(lower) ||
           p.genres.some(g => g.toLowerCase().includes(lower)) ||
           p.famousSongs.some(s => s.title.toLowerCase().includes(lower) || s.artist.toLowerCase().includes(lower));
  });
}

// Export category and difficulty constants
export const PROGRESSION_CATEGORIES = {
  FOUNDATIONAL: 'foundational',
  BLUES: 'blues',
  ROCK: 'rock',
  DRAMATIC: 'dramatic',
  MINOR: 'minor',
  JAZZ: 'jazz'
};

export const PROGRESSION_DIFFICULTIES = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced'
};
