/**
 * Music Theory Glossary
 *
 * Term definitions for tooltips and explanations throughout the app.
 * Each term has simple and technical definitions, plus usage examples.
 */

export const glossary = {

  // ===========================================
  // FUNDAMENTAL TERMS
  // ===========================================

  "chord": {
    term: "Chord",
    simple: "Multiple notes played at the same time that work together as one sound.",
    technical: "Three or more pitches sounded simultaneously, typically built by stacking intervals (usually thirds) above a root note.",
    example: "C major chord = C, E, and G played together",
    related: ["triad", "seventh-chord", "root", "voicing"]
  },

  "triad": {
    term: "Triad",
    simple: "A basic three-note chord - the simplest kind of chord.",
    technical: "A chord consisting of three notes: a root, a third, and a fifth. The four types are major, minor, diminished, and augmented.",
    example: "C major triad = C-E-G, C minor triad = C-Eb-G",
    related: ["chord", "major", "minor", "root"]
  },

  "root": {
    term: "Root",
    simple: "The 'name' note of a chord - the note the chord is built on.",
    technical: "The fundamental pitch upon which a chord is constructed, typically the lowest note in root position.",
    example: "In a C major chord, C is the root",
    related: ["chord", "bass-note", "inversion"]
  },

  "scale": {
    term: "Scale",
    simple: "A family of notes that sound good together - your musical 'color palette'.",
    technical: "An ordered sequence of pitches within an octave, defined by a specific pattern of intervals (whole and half steps).",
    example: "C major scale = C-D-E-F-G-A-B-C",
    related: ["key", "mode", "interval"]
  },

  "key": {
    term: "Key",
    simple: "The home base of a song - which note and scale everything is built around.",
    technical: "The tonal center of a piece, determining which pitch class serves as 'home' and which scale degrees are used.",
    example: "'This song is in the key of G major' means G is home and we use the G major scale",
    related: ["scale", "tonic", "key-signature"]
  },

  "interval": {
    term: "Interval",
    simple: "The distance between two notes.",
    technical: "The ratio of frequencies between two pitches, measured in half steps or by quality and number (e.g., 'major third').",
    example: "C to E is a major third (4 half steps)",
    related: ["half-step", "whole-step", "octave"]
  },

  "half-step": {
    term: "Half Step (Semitone)",
    simple: "The smallest step you can take between notes - moving one key on the piano (including black keys).",
    technical: "The smallest interval in Western music, equal to one twelfth of an octave or a frequency ratio of approximately 1.059.",
    example: "E to F is a half step, as is C to C#",
    related: ["whole-step", "interval", "chromatic"]
  },

  "whole-step": {
    term: "Whole Step (Whole Tone)",
    simple: "A step of two half steps - skipping one key on the piano.",
    technical: "An interval equal to two half steps, or a major second.",
    example: "C to D is a whole step",
    related: ["half-step", "interval"]
  },

  "octave": {
    term: "Octave",
    simple: "The same note, but higher or lower. An octave up is like the same note 'doubled'.",
    technical: "An interval spanning eight diatonic scale degrees, with a frequency ratio of 2:1.",
    example: "Middle C to the next C up is one octave",
    related: ["interval", "unison", "pitch"]
  },

  // ===========================================
  // CHORD QUALITY TERMS
  // ===========================================

  "major": {
    term: "Major",
    simple: "The 'happy' or 'bright' sound. Major chords and scales sound cheerful and open.",
    technical: "A chord or scale quality characterized by a major third above the root. In a major triad: root, major third, perfect fifth.",
    example: "C major chord (C-E-G) sounds bright compared to C minor (C-Eb-G)",
    related: ["minor", "triad", "quality"]
  },

  "minor": {
    term: "Minor",
    simple: "The 'sad' or 'dark' sound. Minor chords and scales sound emotional and serious.",
    technical: "A chord or scale quality characterized by a minor third above the root. In a minor triad: root, minor third, perfect fifth.",
    example: "A minor chord (A-C-E) sounds sad compared to A major (A-C#-E)",
    related: ["major", "triad", "quality"]
  },

  "diminished": {
    term: "Diminished",
    simple: "A tense, unstable chord that sounds like it really needs to go somewhere else.",
    technical: "A chord quality with a minor third and diminished fifth above the root. The diminished triad has two minor thirds stacked.",
    example: "B diminished (B-D-F) in C major sounds very tense",
    related: ["augmented", "seventh-chord", "tension"]
  },

  "augmented": {
    term: "Augmented",
    simple: "A dreamy, floaty chord that sounds unstable and magical.",
    technical: "A chord quality with a major third and augmented fifth above the root. The augmented triad has two major thirds stacked.",
    example: "C augmented (C-E-G#) has a shimmering, unresolved sound",
    related: ["diminished", "triad", "chromatic"]
  },

  "seventh-chord": {
    term: "Seventh Chord",
    simple: "A four-note chord that adds extra color or tension to a basic triad.",
    technical: "A chord consisting of a triad plus a note a seventh above the root. Types include major 7th, minor 7th, dominant 7th, etc.",
    example: "Cmaj7 (C-E-G-B) adds a dreamy quality to C major",
    related: ["triad", "dominant-seventh", "extended-chord"]
  },

  "dominant-seventh": {
    term: "Dominant Seventh",
    simple: "A chord that REALLY wants to resolve. It's tense and pulls strongly toward home.",
    technical: "A major triad with a minor seventh added. The tritone between the 3rd and 7th creates strong pull toward resolution.",
    example: "G7 (G-B-D-F) pulls strongly toward C",
    related: ["seventh-chord", "dominant", "tritone", "resolution"]
  },

  // ===========================================
  // FUNCTION TERMS
  // ===========================================

  "tonic": {
    term: "Tonic",
    simple: "The 'home base' chord - stable, resting, complete. Songs usually start and end here.",
    technical: "The chord built on the first scale degree (I or i), representing the tonal center and point of maximum stability.",
    example: "In the key of C, the C major chord is the tonic",
    related: ["dominant", "subdominant", "function", "resolution"]
  },

  "dominant": {
    term: "Dominant",
    simple: "The 'tension' chord that wants to go home. It creates excitement that needs to resolve.",
    technical: "The chord built on the fifth scale degree (V), characterized by the leading tone's pull toward tonic. V7 adds the tritone for stronger tension.",
    example: "G or G7 is the dominant in C major - it wants to resolve to C",
    related: ["tonic", "subdominant", "resolution", "leading-tone"]
  },

  "subdominant": {
    term: "Subdominant",
    simple: "The 'traveling' or 'away' chord. It moves away from home without creating strong tension.",
    technical: "The chord built on the fourth scale degree (IV). Pre-dominant function, typically moves toward dominant.",
    example: "F is the subdominant in C major",
    related: ["tonic", "dominant", "pre-dominant"]
  },

  "pre-dominant": {
    term: "Pre-dominant",
    simple: "Chords that set up the tension chord. They prepare your ear for what's coming.",
    technical: "A functional category including IV and ii chords, which typically precede and prepare dominant harmony.",
    example: "In the progression F → G → C, F is functioning as pre-dominant",
    related: ["subdominant", "dominant", "function"]
  },

  // ===========================================
  // CADENCE TERMS
  // ===========================================

  "cadence": {
    term: "Cadence",
    simple: "Musical punctuation - how a phrase ends. Like periods and commas in sentences.",
    technical: "A harmonic or melodic formula marking the end of a phrase, section, or piece. Creates varying degrees of finality.",
    example: "The V-I cadence at the end of a song is like a period at the end of a sentence",
    related: ["authentic-cadence", "plagal-cadence", "deceptive-cadence"]
  },

  "authentic-cadence": {
    term: "Authentic Cadence",
    simple: "The most satisfying ending - V to I. It sounds complete and final.",
    technical: "A cadence moving from dominant to tonic (V-I or V7-I). 'Perfect' when both chords are in root position with the melody ending on tonic.",
    example: "G → C at the end of a phrase in C major",
    related: ["cadence", "dominant", "resolution"]
  },

  "plagal-cadence": {
    term: "Plagal Cadence",
    simple: "The soft 'Amen' ending - IV to I. Gentle and settled, like hymns in church.",
    technical: "A cadence moving from subdominant to tonic (IV-I). Less conclusive than authentic cadence due to lack of leading tone resolution.",
    example: "F → C (the 'Amen' at the end of hymns)",
    related: ["cadence", "subdominant"]
  },

  "deceptive-cadence": {
    term: "Deceptive Cadence",
    simple: "A surprise! When V goes to vi instead of I. You expect home but get something else.",
    technical: "A cadence where the dominant resolves to vi (or another non-tonic chord) instead of the expected I, extending the phrase.",
    example: "G → Am instead of G → C in C major",
    related: ["cadence", "resolution", "vi-chord"]
  },

  "half-cadence": {
    term: "Half Cadence",
    simple: "A pause on tension (V). Like a comma - there's definitely more coming.",
    technical: "A cadence ending on the dominant chord (V), creating harmonic incompleteness that requires continuation.",
    example: "A phrase ending on G in the key of C, waiting to resolve",
    related: ["cadence", "dominant", "phrase"]
  },

  // ===========================================
  // VOICE LEADING TERMS
  // ===========================================

  "voice-leading": {
    term: "Voice Leading",
    simple: "How each note moves smoothly from one chord to the next. Small steps = smooth!",
    technical: "The art of moving individual voices (lines) from chord to chord with minimal distance and maximum smoothness.",
    example: "In C → G, holding the G note while E goes to D and C goes to B",
    related: ["common-tone", "contrary-motion", "parallel-motion"]
  },

  "common-tone": {
    term: "Common Tone",
    simple: "A note that's in both chords - it stays put while other notes move. Super smooth!",
    technical: "A pitch shared by two consecutive chords, typically held in the same voice to create smooth connection.",
    example: "G is a common tone between C (C-E-G) and G (G-B-D)",
    related: ["voice-leading", "smooth"]
  },

  "contrary-motion": {
    term: "Contrary Motion",
    simple: "When voices move in opposite directions - one up while another goes down.",
    technical: "Voice movement where one part ascends while another descends. Creates independence and smooth voice leading.",
    example: "Bass moves C → G (up) while melody moves G → D (down)",
    related: ["voice-leading", "parallel-motion", "oblique-motion"]
  },

  "parallel-motion": {
    term: "Parallel Motion",
    simple: "When voices move in the same direction by the same amount.",
    technical: "Voice movement where parts move in the same direction by the same interval. Parallel fifths and octaves are traditionally avoided.",
    example: "Both voices moving up by a third at the same time",
    related: ["voice-leading", "contrary-motion", "parallel-fifths"]
  },

  // ===========================================
  // ADVANCED HARMONY TERMS
  // ===========================================

  "secondary-dominant": {
    term: "Secondary Dominant",
    simple: "Giving any chord its own special 'wants to resolve' chord. Like a spotlight!",
    technical: "A dominant chord that resolves to a chord other than I. Written V/x, where x is the chord being tonicized.",
    example: "D7 → G in C major. D7 is V/V (the 'five of five')",
    related: ["dominant", "tonicization", "applied-chord"]
  },

  "tonicization": {
    term: "Tonicization",
    simple: "Briefly making a chord feel like 'home' without actually changing keys.",
    technical: "The momentary treatment of a non-tonic chord as a local tonic through use of its secondary dominant or leading tone chord.",
    example: "D7 → G momentarily makes G feel like home in the key of C",
    related: ["secondary-dominant", "modulation"]
  },

  "modal-interchange": {
    term: "Modal Interchange (Borrowed Chords)",
    simple: "Borrowing chords from parallel keys for surprise and color. Like using a 'foreign' word!",
    technical: "Using chords from the parallel major or minor mode (or other modes) to add harmonic color while maintaining the same tonic.",
    example: "Using Fm (from C minor) in a C major song",
    related: ["borrowed-chord", "mode", "parallel"]
  },

  "borrowed-chord": {
    term: "Borrowed Chord",
    simple: "A chord that doesn't belong in your key, 'borrowed' from the parallel mode. Surprise!",
    technical: "A chord from the parallel mode (usually minor chords borrowed into major). Common borrowings include ♭VI, ♭VII, iv.",
    example: "Ab major (♭VI) in C major is borrowed from C minor",
    related: ["modal-interchange", "chromatic"]
  },

  "tritone": {
    term: "Tritone",
    simple: "The most tense interval - exactly half an octave. It REALLY wants to resolve!",
    technical: "An interval spanning three whole steps (six half steps), equal to a diminished fifth or augmented fourth. Creates maximum dissonance.",
    example: "B to F (in G7) is a tritone that resolves to C and E",
    related: ["interval", "dominant-seventh", "resolution"]
  },

  "tritone-substitution": {
    term: "Tritone Substitution",
    simple: "A jazz trick: replacing V7 with a chord a tritone away. Same tension, different color!",
    technical: "Replacing a dominant seventh chord with another dominant seventh a tritone away. Both share the same tritone, so both resolve similarly.",
    example: "Replacing G7 with Db7 (both resolve to C)",
    related: ["tritone", "dominant-seventh", "substitution"]
  },

  "leading-tone": {
    term: "Leading Tone",
    simple: "The note that really wants to go to home. It's a half step below tonic and pulls up to it.",
    technical: "The seventh scale degree in major (and harmonic/melodic minor), a half step below tonic with strong tendency to resolve upward.",
    example: "B is the leading tone in C major - it wants to go to C",
    related: ["tonic", "resolution", "dominant"]
  },

  // ===========================================
  // SCALE & MODE TERMS
  // ===========================================

  "mode": {
    term: "Mode",
    simple: "Different 'flavors' of scales using the same notes but starting on different notes.",
    technical: "A type of scale characterized by its arrangement of intervals. The seven diatonic modes are Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian.",
    example: "D Dorian uses the same notes as C major but starts on D",
    related: ["scale", "modal", "ionian", "dorian"]
  },

  "ionian": {
    term: "Ionian Mode",
    simple: "The regular major scale. Bright and happy - the most common mode.",
    technical: "The first mode of the major scale (W-W-H-W-W-W-H). Equivalent to the major scale.",
    example: "C Ionian = C-D-E-F-G-A-B-C (same as C major scale)",
    related: ["mode", "major", "scale"]
  },

  "dorian": {
    term: "Dorian Mode",
    simple: "Minor-ish but with a brighter 6th. Popular in jazz, funk, and Santana!",
    technical: "The second mode of the major scale (W-H-W-W-W-H-W). Like natural minor with a raised 6th.",
    example: "D Dorian = D-E-F-G-A-B-C-D",
    related: ["mode", "minor", "modal"]
  },

  "mixolydian": {
    term: "Mixolydian Mode",
    simple: "Major-ish but with a flat 7th. Super common in rock and blues!",
    technical: "The fifth mode of the major scale (W-W-H-W-W-H-W). Like major with a lowered 7th.",
    example: "G Mixolydian = G-A-B-C-D-E-F-G (F is natural, not F#)",
    related: ["mode", "major", "rock"]
  },

  "aeolian": {
    term: "Aeolian Mode (Natural Minor)",
    simple: "The natural minor scale. Sad, serious, and dramatic.",
    technical: "The sixth mode of the major scale (W-H-W-W-H-W-W). The natural minor scale.",
    example: "A Aeolian = A-B-C-D-E-F-G-A (same as A natural minor)",
    related: ["mode", "minor", "natural-minor"]
  },

  // ===========================================
  // PROGRESSION & STRUCTURE TERMS
  // ===========================================

  "progression": {
    term: "Chord Progression",
    simple: "A sequence of chords that creates a musical journey.",
    technical: "An ordered series of chords creating harmonic motion, typically following functional harmonic principles.",
    example: "C → G → Am → F is a chord progression",
    related: ["harmony", "cadence", "function"]
  },

  "turnaround": {
    term: "Turnaround",
    simple: "The chords at the end that lead you back to the beginning.",
    technical: "A chord progression that leads from the end of one section back to the beginning, often ending on V.",
    example: "I → vi → ii → V at the end of a blues or jazz form",
    related: ["progression", "form", "dominant"]
  },

  "resolution": {
    term: "Resolution",
    simple: "When tension moves to rest. The 'ahhhh' moment when a tense chord goes to a stable one.",
    technical: "The movement from a dissonant or unstable harmony to a consonant or stable one.",
    example: "G7 resolving to C is a resolution",
    related: ["tension", "cadence", "dominant", "tonic"]
  },

  "tension": {
    term: "Tension",
    simple: "The sense that something needs to change or resolve. The 'wanting' feeling in music.",
    technical: "Harmonic or melodic instability that creates the need for resolution. Created by dissonance, dominant function, or departure from tonic.",
    example: "The tension in G7 that wants to resolve to C",
    related: ["resolution", "dissonance", "dominant"]
  },

  // ===========================================
  // NOTATION & ANALYSIS TERMS
  // ===========================================

  "roman-numeral": {
    term: "Roman Numeral",
    simple: "A way to write chords that works in any key. I, IV, V instead of C, F, G.",
    technical: "A system of harmonic analysis using Roman numerals (I-VII) to represent scale degree-based chord roots. Upper case = major, lower case = minor.",
    example: "I-IV-V-I = C-F-G-C in C major, or G-C-D-G in G major",
    related: ["analysis", "scale-degree", "transposition"]
  },

  "inversion": {
    term: "Inversion",
    simple: "A chord with a note other than the root in the bass. Same notes, different order!",
    technical: "A chord voicing where a note other than the root is the lowest pitch. First inversion has the 3rd in bass; second has the 5th.",
    example: "C/E (C major with E in the bass) is first inversion",
    related: ["voicing", "bass-note", "chord"]
  },

  "voicing": {
    term: "Voicing",
    simple: "HOW you play a chord - which notes in which order, how spread out, etc.",
    technical: "The specific arrangement of a chord's notes, including spacing, register, and doubling choices.",
    example: "C-E-G (close voicing) vs. C-G-E (open voicing) are different voicings of C major",
    related: ["inversion", "chord", "arrangement"]
  },

  "bass-note": {
    term: "Bass Note",
    simple: "The lowest note being played - not always the root!",
    technical: "The lowest pitch in a chord or texture. May or may not be the chord's root (slash chords, inversions).",
    example: "In C/G, C is the chord but G is the bass note",
    related: ["root", "inversion", "slash-chord"]
  },

  // ===========================================
  // RHYTHM & TIME TERMS
  // ===========================================

  "harmonic-rhythm": {
    term: "Harmonic Rhythm",
    simple: "How fast the chords change - one chord per bar? Per beat? Per phrase?",
    technical: "The rate of chord changes in a piece, a fundamental element of pacing and style.",
    example: "Slow harmonic rhythm = one chord per measure. Fast = one chord per beat.",
    related: ["rhythm", "progression", "tempo"]
  },

  "syncopation": {
    term: "Syncopation",
    simple: "Putting accents where you don't expect them - off the beat!",
    technical: "Rhythmic emphasis on weak beats or between beats, creating tension against the meter.",
    example: "Accenting the 'and' between beats rather than beats 1, 2, 3, 4",
    related: ["rhythm", "beat", "groove"]
  },

  // ===========================================
  // STYLE & GENRE TERMS
  // ===========================================

  "jazz-harmony": {
    term: "Jazz Harmony",
    simple: "Richer, more colorful chords than pop/rock - lots of 7ths, 9ths, altered notes.",
    technical: "A harmonic language emphasizing extended and altered chords, ii-V-I motion, tritone substitution, and sophisticated voice leading.",
    example: "Dm7-G7-Cmaj7 instead of Dm-G-C",
    related: ["seventh-chord", "extended-chord", "ii-V-I"]
  },

  "blues-harmony": {
    term: "Blues Harmony",
    simple: "The sound of blues: I7, IV7, V7 chords and that unmistakable 12-bar form.",
    technical: "Characterized by dominant 7th chords on I, IV, and V, the 12-bar form, and blue notes (♭3, ♭5, ♭7).",
    example: "The 12-bar blues: I7-I7-I7-I7-IV7-IV7-I7-I7-V7-IV7-I7-V7",
    related: ["dominant-seventh", "blue-notes", "12-bar"]
  }
};

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Get a glossary entry by term key
 * @param {string} key - The term key (lowercase, hyphenated)
 * @returns {Object|undefined} Glossary entry
 */
export function getTerm(key) {
  return glossary[key];
}

/**
 * Get simple definition for a term
 * @param {string} key - The term key
 * @returns {string|undefined} Simple definition
 */
export function getSimpleDefinition(key) {
  return glossary[key]?.simple;
}

/**
 * Get technical definition for a term
 * @param {string} key - The term key
 * @returns {string|undefined} Technical definition
 */
export function getTechnicalDefinition(key) {
  return glossary[key]?.technical;
}

/**
 * Search glossary by keyword
 * @param {string} keyword - Search term
 * @returns {Object[]} Matching glossary entries
 */
export function searchGlossary(keyword) {
  const lower = keyword.toLowerCase();
  return Object.values(glossary).filter(entry => {
    return entry.term.toLowerCase().includes(lower) ||
           entry.simple.toLowerCase().includes(lower) ||
           entry.technical.toLowerCase().includes(lower);
  });
}

/**
 * Get related terms for a given term
 * @param {string} key - The term key
 * @returns {string[]} Array of related term keys
 */
export function getRelatedTerms(key) {
  return glossary[key]?.related || [];
}

/**
 * Get all terms in a category (based on naming patterns)
 * @param {string} category - Category hint (e.g., 'cadence', 'mode', 'chord')
 * @returns {Object[]} Matching entries
 */
export function getTermsByCategory(category) {
  const lower = category.toLowerCase();
  return Object.entries(glossary)
    .filter(([key, value]) =>
      key.includes(lower) ||
      value.related?.some(r => r.includes(lower))
    )
    .map(([key, value]) => ({ key, ...value }));
}

// Export all terms as array for iteration
export const allTerms = Object.entries(glossary).map(([key, value]) => ({
  key,
  ...value
}));

// Export term count for stats
export const termCount = Object.keys(glossary).length;
