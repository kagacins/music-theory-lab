/**
 * Music Theory Concepts Database
 *
 * Core concept definitions with multi-level explanations for users of all skill levels.
 * Each concept has three levels of explanation:
 * - simple: For complete beginners (ELI5 style)
 * - intermediate: For users who know basics
 * - advanced: For theory enthusiasts
 */

export const theoryConcepts = {
  // ===========================================
  // FUNDAMENTAL CONCEPTS
  // ===========================================

  "chord": {
    id: "chord",
    category: "fundamentals",

    simple: {
      title: "What is a Chord?",
      explanation: "A chord is when you play multiple notes at the same time. It's like a team of notes working together to create one sound.",
      analogy: "Think of it like mixing colors - when you combine red and yellow, you get orange. When you combine certain notes, you get a chord with its own unique sound.",
      hearIt: "Listen to these notes played one at a time, then together as a chord."
    },

    intermediate: {
      title: "Chord Construction",
      explanation: "A chord is built by stacking notes in specific intervals. The most common chords use thirds - every other note in a scale. A C major chord is C-E-G: the 1st, 3rd, and 5th notes of the C major scale.",
      terminology: "The notes in a chord are called 'chord tones'. The bottom note is the 'root', which gives the chord its name.",
      examples: ["C-E-G = C major", "D-F-A = D minor", "G-B-D-F = G7 (dominant seventh)"]
    },

    advanced: {
      title: "Harmonic Structure and Voicings",
      explanation: "Chords are constructed from intervallic relationships above a root. Tertian harmony (built in thirds) dominates Western music, though quartal (fourths) and secundal (seconds) structures exist. The quality of intervals determines chord type: major 3rd + minor 3rd = major triad; minor 3rd + major 3rd = minor triad.",
      technicalDetail: "Chord inversions redistribute the bass note while maintaining the same pitch classes. Extended chords (7ths, 9ths, 11ths, 13ths) add color through upper structure tensions.",
      history: "Triadic harmony emerged in the Renaissance, solidified in the Baroque, and was systematically expanded through jazz in the 20th century."
    }
  },

  "major-vs-minor": {
    id: "major-vs-minor",
    category: "fundamentals",

    simple: {
      title: "Happy vs Sad Chords",
      explanation: "Major chords sound happy, bright, and cheerful. Minor chords sound sad, dark, or emotional. It's all about one tiny note being moved!",
      analogy: "It's like the difference between a sunny day (major) and a cloudy day (minor). Both are beautiful, just different moods.",
      hearIt: "Listen to C major, then C minor. Notice how just one note changes everything."
    },

    intermediate: {
      title: "Major and Minor Quality",
      explanation: "The difference between major and minor is the 3rd degree. In C major (C-E-G), the E is 4 half-steps above C (major 3rd). In C minor (C-Eb-G), the Eb is only 3 half-steps above C (minor 3rd). This small change dramatically alters the emotional quality.",
      terminology: "The 3rd is called the 'quality-defining' interval. A chord with a major 3rd sounds 'major'; a chord with a minor 3rd sounds 'minor'.",
      examples: ["Happy Birthday is in major", "Greensleeves is in minor", "Many songs switch between both for emotional effect"]
    },

    advanced: {
      title: "Modal Quality and the Third",
      explanation: "The major/minor dichotomy stems from the harmonic series and cultural conditioning. The major 3rd (5:4 ratio) appears earlier in the overtone series than the minor 3rd (6:5), giving it a more 'stable' acoustic foundation. However, the perceived emotional qualities are largely culturally constructed.",
      technicalDetail: "The minor 3rd creates a more dissonant relationship with the root due to closer beating frequencies. This acoustic tension contributes to the 'darker' sound, though non-Western cultures don't always associate minor with sadness.",
      history: "The major/minor system dominated from ~1600-1900 (Common Practice Period). Modal music and 20th-century techniques often blur or transcend this binary."
    }
  },

  "scale": {
    id: "scale",
    category: "fundamentals",

    simple: {
      title: "What is a Scale?",
      explanation: "A scale is like a family of notes that sound good together. When you're in a key, you're using notes from that family. It's your musical 'palette' of colors to choose from.",
      analogy: "Think of a scale like a box of crayons. You can use any crayon in the box and they'll look good together on your picture.",
      hearIt: "Listen to the C major scale - these are all the 'white key' notes that belong to the key of C."
    },

    intermediate: {
      title: "Scale Structure and Keys",
      explanation: "A scale is a sequence of notes arranged by pitch following a specific pattern of whole steps (W) and half steps (H). The major scale follows: W-W-H-W-W-W-H. The natural minor scale follows: W-H-W-W-H-W-W. The starting note (root) determines the key.",
      terminology: "Each note in a scale has a 'degree' (1st through 7th). These degrees have functional names: tonic (1), supertonic (2), mediant (3), subdominant (4), dominant (5), submediant (6), leading tone (7).",
      examples: ["C major scale: C-D-E-F-G-A-B-C", "A minor scale: A-B-C-D-E-F-G-A", "The same notes, different starting point!"]
    },

    advanced: {
      title: "Scalar Systems and Modal Theory",
      explanation: "Scales are pitch collections that define a tonal center and available melodic/harmonic material. Beyond major and minor, the seven diatonic modes (Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian) offer different 'shades' using the same notes but different tonics.",
      technicalDetail: "Each mode has characteristic intervals: Dorian's raised 6th, Lydian's raised 4th, Mixolydian's lowered 7th. Non-diatonic scales include melodic minor modes, harmonic minor modes, symmetric scales (diminished, whole-tone), and pentatonics.",
      history: "Modal music preceded tonal harmony. The church modes were systematized in medieval music, then largely superseded by major/minor tonality, only to be revived in jazz, rock, and contemporary classical music."
    }
  },

  "key": {
    id: "key",
    category: "fundamentals",

    simple: {
      title: "What is a Key?",
      explanation: "A key is like your musical home base. It tells you which notes and chords will sound good together. When someone says 'this song is in the key of C', they mean C is home base.",
      analogy: "It's like choosing a language - once you pick English, you use English words. Once you pick a key, you use that key's notes and chords.",
      hearIt: "Listen to how this melody feels settled when it ends on C (home), versus unsettled when it ends elsewhere."
    },

    intermediate: {
      title: "Keys and Tonal Centers",
      explanation: "A key establishes a tonal center (the note that feels like 'home') and provides a set of diatonic chords built on each scale degree. In C major, the diatonic triads are: C, Dm, Em, F, G, Am, B°. Each has a specific function in creating musical phrases.",
      terminology: "The 'key signature' indicates which notes are sharp or flat throughout the piece. 'Modulation' means changing to a different key mid-song.",
      examples: ["C major has no sharps or flats", "G major has one sharp (F#)", "Songs often modulate up a half-step for emotional lift"]
    },

    advanced: {
      title: "Tonality and Key Relationships",
      explanation: "Keys exist in a network of relationships defined by the Circle of Fifths. Closely related keys share most scale degrees; distant keys share few. Functional harmony within a key creates expectations (V wants I) that composers exploit through confirmation, delay, and deception.",
      technicalDetail: "Secondary dominants, borrowed chords, and pivot chord modulations expand harmonic vocabulary while maintaining tonal coherence. The 'axis system' (Ernő Lendvai) reveals deeper relationships between keys a tritone apart.",
      history: "Tonality emerged around 1600, dominated until ~1900, and remains fundamental to most popular music. Atonality, pantonality, and extended tonality represent various responses to tonal 'exhaustion'."
    }
  },

  // ===========================================
  // CHORD FUNCTION CONCEPTS
  // ===========================================

  "tonic-function": {
    id: "tonic-function",
    category: "chord-function",

    simple: {
      title: "Home Base Chords",
      explanation: "Some chords feel like 'home' - stable, resting, complete. Songs usually start and end on these chords. When you hear them, you feel like you've arrived.",
      analogy: "It's like reaching your house after a journey. You can relax - you're home!",
      hearIt: "Listen to how the C chord feels complete and resting, like the end of a story."
    },

    intermediate: {
      title: "Tonic Function (I, vi, iii)",
      explanation: "Tonic-function chords provide stability and resolution. The I chord is the primary tonic - the ultimate 'home'. The vi chord (relative minor) and iii chord share notes with the tonic, giving them a similar stable feeling, though less conclusive.",
      terminology: "Musicians call this 'tonic function'. These chords resolve tension rather than create it.",
      examples: ["C major (I) - primary home", "Am (vi) - minor home, shares C and E with C major", "Em (iii) - secondary tonic, shares E and G"]
    },

    advanced: {
      title: "Tonic Function and Substitute Chords",
      explanation: "Tonic function encompasses chords that contain the tonic pitch and share at least one tone with the I chord. The vi chord's effectiveness as a 'deceptive' resolution relies on this functional overlap. In jazz, any chord with tonic function can substitute for I in certain contexts.",
      technicalDetail: "The iii chord's tonic function is weakest due to its leading tone content. The Imaj7's added 7th still maintains full tonic function. ♭VI (borrowed from parallel minor) can serve tonic function in certain contexts.",
      history: "Rameau's fundamental bass theory (1722) first systematically described chord functions. Riemann later formalized T-S-D (Tonic-Subdominant-Dominant) theory."
    }
  },

  "dominant-function": {
    id: "dominant-function",
    category: "chord-function",

    simple: {
      title: "Tension Chords (Want to Go Home)",
      explanation: "Some chords feel tense and unfinished. They really WANT to move to the home chord. It's like asking a question - you need an answer!",
      analogy: "It's like standing on one foot - you naturally want to put your other foot down. These chords naturally want to 'land' on home.",
      hearIt: "Listen to G7, then G7 → C. Hear how the tension releases when it goes to C?"
    },

    intermediate: {
      title: "Dominant Function (V, vii°)",
      explanation: "Dominant-function chords create maximum tension that resolves to the tonic. The V chord contains the leading tone (7th scale degree) which pulls strongly toward the tonic. Adding a 7th (V7) includes the tritone - the most dissonant interval - which creates even stronger pull.",
      terminology: "The V chord is called the 'dominant'. The vii° chord shares three notes with V7 (minus the root), so it functions similarly.",
      examples: ["G → C (V → I, 'authentic cadence')", "G7 → C (stronger resolution)", "B° → C (same function as G7 without the G)"]
    },

    advanced: {
      title: "Dominant Function and Tritone Resolution",
      explanation: "Dominant function stems from the tritone between scale degrees 4 and 7 (the 3rd and 7th of V7). This inherently unstable interval resolves by half-step in contrary motion to degrees 3 and 1 of the tonic. Tritone substitution (♭II7 for V7) works because both chords share the same tritone.",
      technicalDetail: "The dominant's 5th is the least essential tone and can be omitted. The 3rd (leading tone) and 7th (scale degree 4) define the function. Extended dominants (9, 13, altered) maintain function while adding color.",
      history: "The V-I cadence became the cornerstone of tonal music by the Baroque era. Jazz expanded dominant vocabulary extensively through substitutions and alterations."
    }
  },

  "subdominant-function": {
    id: "subdominant-function",
    category: "chord-function",

    simple: {
      title: "Traveling Chords (Moving Away from Home)",
      explanation: "These chords feel like you're on a journey - not quite home, not super tense, just... moving somewhere. They often come before the tension chords.",
      analogy: "It's like the middle of a road trip - you've left home and you're heading toward something exciting.",
      hearIt: "Listen to C → F → G → C. The F is the 'traveling' chord - it moves you from home toward the tension."
    },

    intermediate: {
      title: "Subdominant Function (IV, ii)",
      explanation: "Subdominant-function chords move away from the tonic and typically lead to dominant chords. The IV chord and ii chord both contain the 4th scale degree, which wants to resolve down to 3. This creates gentle motion rather than strong tension.",
      terminology: "The 'plagal cadence' (IV → I, the 'Amen' cadence) resolves directly to tonic without dominant tension. The ii chord often precedes V in the common ii-V-I progression.",
      examples: ["F → C (IV → I, plagal/Amen cadence)", "Dm → G → C (ii → V → I, very common)", "F → G → C (IV → V → I, strong progression)"]
    },

    advanced: {
      title: "Subdominant Function and Pre-Dominant Harmony",
      explanation: "Subdominant function (also called 'pre-dominant') prepares dominant harmony. The characteristic subdominant pitch is scale degree 4, which forms a dissonance against the dominant root that must resolve downward. Both IV and ii contain this pitch.",
      technicalDetail: "The ii chord is often preferred over IV because it shares a common tone with V (scale degree 5), enabling smoother voice leading. Neapolitan (♭II) and augmented 6th chords serve intensified subdominant functions.",
      history: "Rameau identified subdominant function, though he initially emphasized IV. The ii-V-I progression became paramount in jazz, representing the archetype of functional harmony."
    }
  },

  // ===========================================
  // RESOLUTION & CADENCE CONCEPTS
  // ===========================================

  "resolution": {
    id: "resolution",
    category: "resolution",

    simple: {
      title: "When Tension Becomes Rest",
      explanation: "Resolution is when a tense, unstable sound moves to a stable, resting sound. It's like finally scratching an itch - ahhhh, relief!",
      analogy: "It's like the ending of a story where everything gets wrapped up. The question gets answered, the problem gets solved.",
      hearIt: "Listen to G7 → C. The G7 is the tension, the C is the resolution. Feel that relief?"
    },

    intermediate: {
      title: "Harmonic Resolution",
      explanation: "Resolution occurs when dissonant intervals move to consonant ones. In G7 → C, the B (leading tone) resolves up to C, and the F (7th) resolves down to E. These half-step movements are the most satisfying resolutions.",
      terminology: "Tendency tones are notes that 'want' to move in a specific direction. The leading tone resolves up; the 7th of a dominant chord resolves down.",
      examples: ["V7 → I (strongest resolution)", "vii° → I (similar voice leading)", "Any dissonance moving to consonance"]
    },

    advanced: {
      title: "Voice Leading and Resolution Principles",
      explanation: "Resolution fundamentally involves the movement from acoustic tension to stability. The tritone in dominant seventh chords resolves inward (m2) or outward (M2) to form the consonant interval of a third or sixth. Non-chord tones resolve by step to chord tones.",
      technicalDetail: "The 'pull' of resolution is partly acoustic (dissonance → consonance) and partly learned expectation. Deceptive resolutions (V7 → vi) exploit these expectations for emotional effect.",
      history: "Resolution principles developed alongside the system of functional harmony. Contemporary music often deliberately avoids or delays resolution for stylistic effect."
    }
  },

  "cadence": {
    id: "cadence",
    category: "resolution",

    simple: {
      title: "Musical Punctuation",
      explanation: "A cadence is like punctuation in a sentence. It can be a full stop (complete ending), a comma (pause, but more to come), or a question mark (unfinished, expecting more).",
      analogy: "Just like sentences need periods and commas, music needs cadences to organize phrases and show when thoughts are complete or continuing.",
      hearIt: "Listen to different cadences - some feel finished, some feel like there's more coming."
    },

    intermediate: {
      title: "Types of Cadences",
      explanation: "Different cadences create different effects: Authentic (V → I) sounds conclusive and final. Plagal (IV → I) sounds gentle and 'Amen'-like. Half cadence (→ V) stops on tension, expecting more. Deceptive (V → vi) surprises by going somewhere unexpected.",
      terminology: "A 'Perfect Authentic Cadence' (PAC) has both chords in root position with the melody ending on the tonic - the strongest possible ending.",
      examples: ["Happy Birthday ends with V → I", "Hymns end with IV → I (Amen)", "Classical pieces often pause on a half cadence between sections"]
    },

    advanced: {
      title: "Cadential Formulas and Formal Structure",
      explanation: "Cadences articulate musical form by marking phrase endings with varying degrees of finality. The hierarchy (PAC > IAC > HC > DC > PC) correlates with structural importance. Cadential 6/4 (I6/4 → V) intensifies the dominant through dissonant suspension.",
      technicalDetail: "The Phrygian half cadence (iv6 → V in minor) has unique color. Evaded cadences (V → vi6/4) and abandoned cadences extend phrases. Post-tonal music often replaces functional cadences with other markers.",
      history: "Cadential formulas were codified in the Renaissance and became increasingly standardized through the Baroque. Mozart's cadences are considered exemplary of Classical-era practice."
    }
  },

  "authentic-cadence": {
    id: "authentic-cadence",
    category: "resolution",

    simple: {
      title: "The Perfect Ending",
      explanation: "This is the most satisfying, complete-sounding ending in music. It's the 'and they lived happily ever after' of music. When you hear V → I, it sounds final and complete.",
      analogy: "It's like when a ball you threw finally lands - that satisfying 'thunk'. The music has landed home.",
      hearIt: "Listen to G → C at the end of this phrase. Notice how final and complete it sounds."
    },

    intermediate: {
      title: "Authentic Cadence (V → I)",
      explanation: "The authentic cadence is the strongest resolution in tonal music. The dominant chord (V or V7) moves to the tonic (I). It's called 'authentic' because it's the true, genuine way to end a phrase. Adding the 7th to V makes it even stronger.",
      terminology: "'Perfect Authentic Cadence' (PAC) = V → I with both in root position and melody on tonic. 'Imperfect Authentic Cadence' (IAC) = any other V → I.",
      examples: ["End of 'Happy Birthday'", "End of 'Twinkle Twinkle Little Star'", "End of virtually every Classical-era piece"]
    },

    advanced: {
      title: "Perfect and Imperfect Authentic Cadences",
      explanation: "The PAC (root position V → I, soprano on tonic) represents maximum closure. IACs vary in strength: root position IAC with soprano on 3rd or 5th, inverted V → I, or V → I6 all provide less conclusive endings suitable for interior phrases.",
      technicalDetail: "The cadential 6/4 (I6/4 → V7 → I) delays resolution through suspension of bass tones 4 and 6 to the dominant. This intensification is common at final cadences.",
      history: "The authentic cadence became the cornerstone of tonal closure by 1700. Its ubiquity led some 20th-century composers to avoid it entirely as a cliché."
    }
  },

  "plagal-cadence": {
    id: "plagal-cadence",
    category: "resolution",

    simple: {
      title: "The 'Amen' Ending",
      explanation: "This is a softer, gentler ending than the V → I. It's called the 'Amen' cadence because church music often ends this way. IV → I sounds peaceful and settled, like a calm 'amen'.",
      analogy: "If the authentic cadence is landing after a jump, the plagal cadence is gently sitting down - still arriving, but more peacefully.",
      hearIt: "Listen to F → C. Notice how it's conclusive but softer than G → C."
    },

    intermediate: {
      title: "Plagal Cadence (IV → I)",
      explanation: "The plagal cadence (IV → I) resolves without dominant tension. The 4th scale degree in the IV chord moves down to the 3rd, but there's no leading tone pull. This creates a gentler, more 'resigned' resolution often associated with sacred music.",
      terminology: "Also called the 'Amen cadence' due to its use at the end of hymns. In minor keys, iv → i (with the minor iv chord) is common.",
      examples: ["The 'Amen' at the end of hymns", "End of 'Let It Be' by The Beatles", "Often used after an authentic cadence as a final 'settling'"]
    },

    advanced: {
      title: "Plagal Motion and Subdominant Resolution",
      explanation: "The plagal cadence's subdominant-to-tonic motion lacks the tritone resolution that drives authentic cadences. Its weaker pull makes it unsuitable for primary structural articulations in Classical music but valuable for post-cadential extension or specific stylistic effects.",
      technicalDetail: "The plagal cadence often follows an authentic cadence, providing additional confirmation. In popular music, IV functions more independently and the plagal motion is a legitimate primary cadence.",
      history: "Medieval modal music used plagal motion freely. The term comes from the Greek 'plagios' (oblique). Gospel and rock music revived the plagal cadence as a primary structural device."
    }
  },

  "deceptive-cadence": {
    id: "deceptive-cadence",
    category: "resolution",

    simple: {
      title: "The Surprise Ending",
      explanation: "Sometimes when you expect the music to go home, it goes somewhere else instead! V usually goes to I, but when it goes to vi instead, you get a surprise - a deceptive cadence.",
      analogy: "It's like when you're walking home and suddenly turn down a different street. You didn't go where expected, but it's still a nice destination.",
      hearIt: "Listen: G → Am instead of G → C. Notice the surprise? You expected C but got Am."
    },

    intermediate: {
      title: "Deceptive Cadence (V → vi)",
      explanation: "The deceptive cadence tricks your ear. V sets up the expectation of I, but vi arrives instead. This works because vi shares two notes with I (in C: Am has A-C-E, sharing C and E with C-E-G). The resolution is 'close enough' to satisfy, but surprising.",
      terminology: "Also called an 'interrupted cadence' or 'false cadence'. It extends phrases by delaying true resolution.",
      examples: ["Often used to extend emotional passages", "Creates a 'not yet finished' feeling", "Common in romantic classical music"]
    },

    advanced: {
      title: "Deceptive Motion and Phrase Extension",
      explanation: "The deceptive cadence exploits tonic-vi functional overlap. The leading tone still resolves to tonic (B → C) even as the bass moves to submediant. This 'substitution' allows harmonic-rhythmic elision, extending what would otherwise be a closed phrase.",
      technicalDetail: "V → vi is most common, but V → ♭VI, V → IV6, and other 'deceptions' exist. The effectiveness depends on harmonic context establishing dominant-tonic expectation.",
      history: "Deceptive cadences appear in Renaissance music and were codified in Baroque practice. They became a primary tool for phrase extension in Classical and Romantic eras."
    }
  },

  // ===========================================
  // VOICE LEADING CONCEPTS
  // ===========================================

  "voice-leading": {
    id: "voice-leading",
    category: "voice-leading",

    simple: {
      title: "How Notes Move Between Chords",
      explanation: "Voice leading is about how each note in one chord moves to a note in the next chord. Good voice leading means smooth, small movements - no big jumps!",
      analogy: "Think of each note as a person walking. It's easier and smoother to take small steps than to keep jumping around. Same with notes!",
      hearIt: "Listen to these two versions of C → G. In the smooth one, notes move by small steps. In the jumpy one, notes leap around."
    },

    intermediate: {
      title: "Voice Leading Principles",
      explanation: "Good voice leading minimizes the distance each voice travels. Common tones should be held (G stays when going C → G). Moving voices should move by step when possible. Avoid parallel 5ths and octaves, and always resolve tendency tones in their expected direction.",
      terminology: "'Contrary motion' = voices moving in opposite directions (best). 'Oblique motion' = one voice moves, one stays. 'Similar motion' = same direction, different distances. 'Parallel motion' = same direction, same distance (be careful!).",
      examples: ["C(C-E-G) → G(B-D-G): G stays, E→D, C→B - all steps!", "Hold common tones whenever possible", "Resolve leading tones up, 7ths down"]
    },

    advanced: {
      title: "Voice Leading as Counterpoint",
      explanation: "Voice leading derives from contrapuntal principles where each voice is a semi-independent melodic line. The prohibition of parallel 5ths/octaves preserves voice independence. Neo-Riemannian theory models voice leading efficiency as the total semitone displacement between chords.",
      technicalDetail: "Optimal voice leading minimizes the 'voice-leading distance' (sum of semitone movements). Parsimonious voice leading (single semitone moves) enables smooth chromatic progressions like those in late Romantic music.",
      history: "Voice leading rules evolved from Renaissance counterpoint. Schenker's theory views pieces as elaborations of fundamental voice-leading patterns (Ursätze)."
    }
  },

  "common-tone": {
    id: "common-tone",
    category: "voice-leading",

    simple: {
      title: "Notes That Stay Put",
      explanation: "A common tone is a note that's in both chords - so it doesn't have to move! It's like a bridge connecting two chords, making the transition super smooth.",
      analogy: "It's like two friends who know the same person - that shared connection makes meeting easier.",
      hearIt: "Listen to C → Am. The notes C and E are in both chords - they stay put while only A needs to come in."
    },

    intermediate: {
      title: "Common Tones and Smooth Connections",
      explanation: "When two chords share notes (common tones), holding those notes creates the smoothest possible connection. C (C-E-G) and Am (A-C-E) share C and E - hold them! This is why C and Am sound so related, and why vi can substitute for I.",
      terminology: "Related keys and chords are partly defined by how many common tones they share. The more common tones, the smoother the relationship.",
      examples: ["I and vi share 2 notes", "I and IV share 1 note", "I and V share 1 note", "More common tones = smoother connection"]
    },

    advanced: {
      title: "Common-Tone Theory and Harmonic Distance",
      explanation: "Common-tone retention is a primary voice-leading principle and a measure of harmonic proximity. Chords with multiple common tones (like I-vi, I-IV) feel closely related; those with none (like I-II) feel more distant. This underpins both functional substitution and modulation techniques.",
      technicalDetail: "Common-tone diminished 7th chords (CT°7) are ornamental dominants that share a tone with both preceding and following chords. The common-tone relationship enables smooth chromatic voice leading even with non-functional harmony.",
      history: "Common-tone relationships became increasingly important as chromatic harmony developed in the 19th century. Parsimonious voice leading (maximizing common tones) is central to neo-Riemannian analysis."
    }
  },

  // ===========================================
  // ADVANCED HARMONY CONCEPTS
  // ===========================================

  "secondary-dominant": {
    id: "secondary-dominant",
    category: "advanced-harmony",

    simple: {
      title: "Borrowing Tension from Other Keys",
      explanation: "Normally only one chord (V) has that special 'wants to go home' tension toward I. But you can give ANY chord that special tension by playing ITS V chord before it. It's like pointing a spotlight at a chord - 'Look! This one's important!'",
      analogy: "It's like giving someone a royal introduction. Instead of just saying 'Here's John', you say 'Ladies and gentlemen... JOHN!' The buildup makes John feel more important.",
      hearIt: "Listen to C → D7 → G → C. That D7 makes G feel super important - D7 is G's personal 'wants to go home' chord."
    },

    intermediate: {
      title: "Secondary Dominants (V/x)",
      explanation: "A secondary dominant is a V or V7 chord that resolves to a chord other than I. Written as V/x ('five of x'), it temporarily tonicizes that chord. D7 → G in C major is V/V - the 'five of five'. A7 → Dm is V/ii. Any diatonic chord except vii° can be tonicized.",
      terminology: "'Tonicization' = temporarily treating a chord as tonic. It's not a key change (modulation), just a brief emphasis.",
      examples: ["V/V (D7 → G in C major)", "V/ii (A7 → Dm in C major)", "V/vi (E7 → Am in C major)", "Creates momentary key feelings"]
    },

    advanced: {
      title: "Secondary Dominant Functions and Chain Dominants",
      explanation: "Secondary dominants expand tonal vocabulary while maintaining overall key integrity. They introduce chromatic pitches as applied leading tones. Chain dominants (V/V/V → V/V → V → I) create extended tension sequences. The 'tritone substitution' replaces any V7 with a ♭II7.",
      technicalDetail: "Secondary dominants can be extended (V9/x), altered (V7♭9/x), or replaced by their tritone subs. Applied viio7 chords function similarly (viio7/ii → ii). These techniques enabled the chromatic saturation of late Romantic harmony.",
      history: "Secondary dominants appeared in Baroque music and became systematic in Classical practice. Wagner's extensive use led to the 'crisis' of tonality that spurred atonal developments."
    }
  },

  "modal-interchange": {
    id: "modal-interchange",
    category: "advanced-harmony",

    simple: {
      title: "Borrowing Chords for Surprise",
      explanation: "You can 'borrow' chords from the parallel minor (or major) key to add surprise and emotion. Playing in C major? Borrow the Ab chord from C minor - it sounds mysterious and unexpected!",
      analogy: "It's like using a word from another language because it expresses something your language doesn't have. The borrowed word adds flavor.",
      hearIt: "Listen to C → Ab → G → C. That Ab is borrowed from C minor - hear how it adds something special?"
    },

    intermediate: {
      title: "Modal Interchange (Borrowed Chords)",
      explanation: "Modal interchange means borrowing chords from parallel modes. In C major, you can use chords from C minor, C Dorian, C Lydian, etc. The most common: ♭VII (B♭), ♭VI (A♭), ♭III (E♭), iv (Fm). These add color while maintaining C as tonic.",
      terminology: "Also called 'mode mixture' or 'borrowed chords'. The ♭ symbol indicates a chromatically lowered root. Parallel = same tonic, different mode.",
      examples: ["♭VII in rock (C → B♭ → F → C)", "♭VI for drama (C → A♭ → G → C)", "iv for sadness (C → Fm → C)", "The 'creep' chord (G → B) - borrowed from E minor"]
    },

    advanced: {
      title: "Mode Mixture and Chromatic Mediant Relations",
      explanation: "Modal interchange extends harmonic vocabulary by treating parallel modes as a single expanded pitch collection. This enables chromatic third relations (C - A♭, C - E) that became central to Romantic harmony. The Picardy third (minor i → major I) is an early example.",
      technicalDetail: "Common borrowed chords include ♭VII, ♭VI, ♭III, iv, and ♭ii (Neapolitan). The double-flat VII (♭♭VII, enharmonic to VI) and other borrowings enable extensive chromatic voice leading. Some theorists view all diatonic modes as equally available.",
      history: "Modal borrowing increased throughout the Common Practice Period. Schubert and Brahms used it extensively. Rock and pop music made ♭VII and ♭VI standard vocabulary."
    }
  },

  "tritone-substitution": {
    id: "tritone-substitution",
    category: "advanced-harmony",

    simple: {
      title: "The Magic Chord Swap",
      explanation: "Here's a cool trick: you can replace a 'wants to go home' chord (V7) with a chord that's exactly half an octave away (a tritone). They share the same tension notes! G7 → C can become D♭7 → C. Same feeling, different color!",
      analogy: "It's like two keys that open the same door. Different key, same result.",
      hearIt: "Listen to G7 → C, then D♭7 → C. Notice they both resolve to C with a similar 'ahh' feeling?"
    },

    intermediate: {
      title: "Tritone Substitution",
      explanation: "A tritone sub replaces a V7 with a ♭II7 (a tritone/6 half-steps away). G7 (G-B-D-F) and D♭7 (D♭-F-A♭-C♭) share the tritone B-F (enharmonic to C♭-F). This critical interval defines dominant function, so both chords resolve similarly to C.",
      terminology: "The ♭II7 chord is also called a 'flat-five substitution' since it's a ♭5 away from V. It creates chromatic bass motion: G → D♭ → C is smoother than G → C.",
      examples: ["Dm7 → D♭7 → Cmaj7 (jazz ii-V-I with sub)", "Any V7 can be replaced by its tritone sub", "Creates sophisticated chromatic movement"]
    },

    advanced: {
      title: "Tritone Substitution and Extended Dominants",
      explanation: "Tritone substitution exploits the enharmonic equivalence of tritone intervals: B-F (G7's 3rd-7th) = C♭-F (D♭7's 7th-3rd). Since the tritone defines dominant function, both chords resolve identically. The sub's root provides chromatic ♭2-1 bass motion to tonic.",
      technicalDetail: "Tritone subs can be extended and altered (D♭9, D♭7♯11). Chain tritone subs enable chromatic bass lines. The technique relates to augmented sixth chords (Ger+6 = tritone sub of V7/V).",
      history: "Tritone substitution emerged from jazz practice in the 1940s (bebop era). It's functionally similar to the German augmented sixth chord, linking jazz harmony to Classical practice."
    }
  },

  // ===========================================
  // PROGRESSION CONCEPTS
  // ===========================================

  "tension-release": {
    id: "tension-release",
    category: "progressions",

    simple: {
      title: "The Music Rollercoaster",
      explanation: "Great music is like a rollercoaster - it builds up tension (going up the hill), then releases it (going down!). Without tension and release, music feels flat and boring.",
      analogy: "It's like a good story - you need problems and solutions, questions and answers. The tension is the problem, the release is the solution.",
      hearIt: "Listen to how this progression builds tension, then releases it. Feel that satisfaction when it resolves?"
    },

    intermediate: {
      title: "Harmonic Tension and Release",
      explanation: "Tension comes from dissonance, dominant function, and departure from tonic. Release comes from consonance, resolution, and return to tonic. The cycle T → PD → D → T (Tonic → Pre-Dominant → Dominant → Tonic) is the fundamental tension-release pattern.",
      terminology: "The 'tension curve' shows how tension builds and releases over time. Strong beats typically get more resolution; weak beats can handle more tension.",
      examples: ["I → IV → V → I (basic tension-release cycle)", "i → iv → V7 → i (minor version, more dramatic)", "Building multiple V7s in a row increases tension before release"]
    },

    advanced: {
      title: "Tension Management and Phrase Rhythm",
      explanation: "Tension-release patterns operate at multiple structural levels: chord-to-chord, phrase-level, section-level, and piece-level. Large-scale tonal structure involves departure from and return to tonic over extended timeframes. Harmonic rhythm affects local tension perception.",
      technicalDetail: "Tension quantification involves measuring dissonance, distance from tonic, rhythmic placement, and registral distribution. Delay of resolution through deceptive cadences, extensions, and evaded cadences increases eventual release satisfaction.",
      history: "Tension-release as structural principle underpins most Western music theory. Schenkerian analysis reveals background tension-release patterns beneath surface complexity."
    }
  },

  "circle-of-fifths-progression": {
    id: "circle-of-fifths-progression",
    category: "progressions",

    simple: {
      title: "The Magic Circle",
      explanation: "One of music's most powerful patterns is chords moving in fifths - each chord naturally leads to the next. It's like dominoes falling: one chord 'points' to the next one.",
      analogy: "It's like a round-robin tournament where each team plays the next. There's a natural order that keeps things moving.",
      hearIt: "Listen to Am → Dm → G → C. Each chord points to the next like an arrow!"
    },

    intermediate: {
      title: "Circle of Fifths Motion",
      explanation: "Root movement by descending fifth (or ascending fourth) is the strongest progression. Each chord becomes the V of the next: Am → Dm (Am is 'V' of Dm), Dm → G (Dm is 'V' of G), G → C (G is V of C). This chain creates constant forward motion.",
      terminology: "Full diatonic circle: I → IV → viio → iii → vi → ii → V → I. Each root is a fifth below the previous (or fourth above). Jazz uses this extensively.",
      examples: ["iii → vi → ii → V → I (common in jazz)", "vi → ii → V → I (super common)", "Full circle takes you through all seven diatonic chords"]
    },

    advanced: {
      title: "Fifth Motion and Harmonic Syntax",
      explanation: "Root motion by descending fifth represents the strongest 'syntactical' progression due to the V-I relationship it constantly invokes. This creates interlocking dominant-tonic cells (each chord is the dominant of the next). The full diatonic circle touches all scale degrees.",
      technicalDetail: "Applied dominants make each circle step even stronger (A7 → D7 → G7 → C). The 'cycle of dominants' or 'chain of dominants' fully exploits this. Descending fifth motion is 'strong'; ascending fifth (I → V → ii → vi) is 'retrogressive'.",
      history: "Circle-of-fifths bass lines were common in Baroque music (Pachelbel, Vivaldi). Jazz elevated the ii-V-I (partial circle) to its primary cadential formula."
    }
  }
};

/**
 * Get a concept by ID
 * @param {string} id - The concept ID
 * @returns {Object|undefined} The concept object or undefined if not found
 */
export function getConcept(id) {
  return theoryConcepts[id];
}

/**
 * Get all concepts in a category
 * @param {string} category - The category name
 * @returns {Object[]} Array of concepts in that category
 */
export function getConceptsByCategory(category) {
  return Object.values(theoryConcepts).filter(c => c.category === category);
}

/**
 * Get explanation at appropriate level
 * @param {string} id - The concept ID
 * @param {string} level - 'simple', 'intermediate', or 'advanced'
 * @returns {Object|undefined} The explanation object at that level
 */
export function getExplanation(id, level = 'simple') {
  const concept = theoryConcepts[id];
  if (!concept) return undefined;
  return concept[level];
}

/**
 * Search concepts by keyword
 * @param {string} keyword - Search term
 * @returns {Object[]} Matching concepts
 */
export function searchConcepts(keyword) {
  const lowerKeyword = keyword.toLowerCase();
  return Object.values(theoryConcepts).filter(concept => {
    const searchableText = JSON.stringify(concept).toLowerCase();
    return searchableText.includes(lowerKeyword);
  });
}

// Export category constants
export const CONCEPT_CATEGORIES = {
  FUNDAMENTALS: 'fundamentals',
  CHORD_FUNCTION: 'chord-function',
  RESOLUTION: 'resolution',
  VOICE_LEADING: 'voice-leading',
  ADVANCED_HARMONY: 'advanced-harmony',
  PROGRESSIONS: 'progressions'
};
