/**
 * Intermediate Learning Path
 *
 * These lessons build on beginner concepts and introduce
 * more sophisticated theory concepts with in-depth explanations.
 *
 * LESSON ORDERING:
 * - Lessons are numbered automatically based on array position (see index.js)
 * - To reorder lessons, simply move them in this array
 * - IDs are semantic (no numbers) for stability when reordering
 */

export const intermediateLessons = [
  // =====================================================
  // Mastering Scale Types
  // =====================================================
  {
    id: 'lesson-scale-types',
    path: 'intermediate',
    title: 'Mastering Scale Types',
    subtitle: 'Understanding every scale in the Scale Explorer and when to use them',
    estimatedTime: '18 min',
    icon: '🎼',

    learn: {
      introduction: `You've learned about major and minor scales. But the musical world is far richer than just these two colors! The Scale Explorer contains 15 different scales, each with its own character, history, and purpose. Let's explore them all.

**Why Do Different Scales Exist?**

Scales evolved across different cultures and time periods to express different emotions and musical needs:
- **Diatonic scales** (7 notes) form the basis of Western harmony
- **Pentatonic scales** (5 notes) are ancient and universal across cultures
- **Modes** rearrange the same notes for different emotional colors
- **Exotic scales** create specific moods or emulate other musical traditions
- **Symmetric scales** create ambiguity and tension through equal divisions

**The Scale Explorer Categories:**

1. **Major/Minor Family** - The foundation of Western music
2. **Pentatonic Scales** - Ancient, universal, impossible to sound "wrong"
3. **The Seven Modes** - Same notes, different starting points, different emotions
4. **Exotic/Symmetric Scales** - Special colors for special moments

Let's explore each one in detail!

---

**THE MAJOR/MINOR FAMILY**

**Major (Ionian) Scale** - W-W-H-W-W-W-H
- Intervals: 0-2-4-5-7-9-11
- The "happy" scale, foundation of Western music
- Why it exists: The major scale naturally emerges from the harmonic series (overtones of a vibrating string). It's literally built into the physics of sound!
- Use it for: Happy songs, triumphant themes, folk music, pop choruses
- Famous examples: "Happy Birthday," "Let It Be," virtually all pop music

**Natural Minor (Aeolian) Scale** - W-H-W-W-H-W-W
- Intervals: 0-2-3-5-7-8-10
- The "sad" scale, relative minor of major
- Why it exists: Starting the major scale from its 6th degree creates this naturally darker sound. It's been used since ancient Greece for expressing sorrow.
- Use it for: Sad ballads, dramatic moments, rock and metal
- Famous examples: "Losing My Religion," "Stairway to Heaven" intro

**Harmonic Minor Scale** - W-H-W-W-H-3H-H
- Intervals: 0-2-3-5-7-8-11
- Natural minor with a raised 7th
- Why it exists: Composers needed a leading tone (note that pulls strongly to the tonic) in minor keys. Raising the 7th creates the V-i resolution that natural minor lacks.
- The 3-half-step gap (augmented 2nd) between ♭6 and 7 gives it an exotic, Middle Eastern flavor
- Use it for: Classical minor key harmony, dramatic passages, metal solos, Middle Eastern/Jewish music
- Famous examples: "Hava Nagila," Yngwie Malmsteen's neoclassical metal

**Melodic Minor Scale** - W-H-W-W-W-W-H
- Intervals: 0-2-3-5-7-9-11
- Minor with raised 6th AND 7th (ascending only in classical theory)
- Why it exists: The augmented 2nd in harmonic minor was considered awkward for singing. Raising the 6th smooths out the melody while keeping the leading tone.
- In jazz, it's used the same way ascending and descending
- Use it for: Jazz improvisation, sophisticated minor chord voicings, fusion
- Famous examples: Modern jazz standards, Wayne Shorter compositions

---

**PENTATONIC SCALES**

**Major Pentatonic** - W-W-3H-W-3H
- Intervals: 0-2-4-7-9 (degrees 1-2-3-5-6 of major)
- The universal "happy" scale
- Why it exists: Found independently in virtually every culture worldwide - from Chinese music to Celtic folk to African traditions. The 5-note structure removes all semitones (half steps), making it impossible to create harsh dissonance. It's the most naturally consonant scale.
- Use it for: Country, folk, rock solos, happy melodies, singalong hooks
- Famous examples: "My Girl," "Amazing Grace," "Auld Lang Syne," most country guitar solos

**Minor Pentatonic** - 3H-W-W-3H-W
- Intervals: 0-3-5-7-10 (degrees 1-♭3-4-5-♭7 of natural minor)
- The universal "blues/rock" scale
- Why it exists: Same principle as major pentatonic but starting from the minor - no semitones, no wrong notes. It's the foundation of blues, which emerged from African musical traditions meeting Western harmony.
- Use it for: Blues, rock, jazz, any improvisation over minor chords
- Famous examples: "Sunshine of Your Love," virtually every rock guitar solo

---

**THE BLUES SCALE**

**Blues Scale** - 3H-W-H-H-3H-W
- Intervals: 0-3-5-6-7-10
- Minor pentatonic + the "blue note" (♭5)
- Why it exists: African American musicians added the ♭5 (tritone) to the minor pentatonic, creating tension between the flat 5 and perfect 5. This "blue note" expresses the "bent" pitches of blues singing and became the signature of blues music.
- Use it for: Blues, rock, jazz, expressing raw emotion
- Famous examples: "The Thrill Is Gone," any BB King solo

---

**THE SEVEN MODES**

Modes are rotations of the major scale - same seven notes, different starting points. Each has a unique character determined by where the half steps fall.

**Dorian (Mode 2)** - W-H-W-W-W-H-W
- Intervals: 0-2-3-5-7-9-10
- Natural minor with a raised 6th
- Why it exists: Medieval church music used modes before major/minor became standard. Dorian survived because its character - minor but with a brighter 6th - creates a sophisticated, jazzy sound.
- Use it for: Jazz, funk, Santana-style rock, anything "minor but not sad"
- Famous examples: "So What" (Miles Davis), "Oye Como Va" (Santana)

**Phrygian (Mode 3)** - H-W-W-W-H-W-W
- Intervals: 0-1-3-5-7-8-10
- Natural minor with a ♭2
- Why it exists: The ♭2 creates that distinctive "Spanish" or "Middle Eastern" sound. Used in flamenco, metal, and anywhere you want dark, exotic tension.
- Use it for: Flamenco, metal, film scores for mysterious/exotic scenes
- Famous examples: "White Rabbit" (Jefferson Airplane), flamenco music

**Lydian (Mode 4)** - W-W-W-H-W-W-H
- Intervals: 0-2-4-6-7-9-11
- Major with a raised 4th (#4)
- Why it exists: The #4 removes the only dissonance between scale degrees 4 and 3, creating the "brightest" possible major sound - dreamy, floating, otherworldly.
- Use it for: Film scores (wonder/magic), jazz fusion, dreamy passages
- Famous examples: "Flying in a Blue Dream" (Satriani), The Simpsons theme

**Mixolydian (Mode 5)** - W-W-H-W-W-H-W
- Intervals: 0-2-4-5-7-9-10
- Major with a ♭7
- Why it exists: The ♭7 gives major a "bluesy" quality. It's the scale built on the V chord (dominant), so it naturally sounds like it wants to resolve, giving music a driving, forward quality.
- Use it for: Classic rock, blues-rock, jam bands, Irish folk
- Famous examples: "Sweet Home Alabama," "Norwegian Wood"

**Locrian (Mode 7)** - H-W-W-H-W-W-W
- Intervals: 0-1-3-5-6-8-10
- Diminished scale with ♭2, ♭3, ♭5, ♭6, ♭7
- Why it exists: Completing the set of modes. The ♭5 makes it very unstable - there's no perfect 5th to anchor the tonic. Rarely used as a key center but appears over half-diminished chords.
- Use it for: Brief passages of maximum instability, half-diminished chord moments
- Famous examples: "Army of Me" (Björk), metal transitions

---

**EXOTIC/SYMMETRIC SCALES**

**Whole Tone Scale** - W-W-W-W-W-W
- Intervals: 0-2-4-6-8-10
- Six notes, all whole steps apart
- Why it exists: Divides the octave into 6 equal parts, creating no sense of "home" - everything is equidistant. Debussy popularized it for impressionistic, floating, dreamlike passages.
- There are only 2 unique whole tone scales (C and C#)!
- Use it for: Dreamy transitions, underwater scenes, dissolving reality
- Famous examples: "Voiles" (Debussy), Star Trek transporter sound

**Diminished (Whole-Half)** - W-H-W-H-W-H-W-H
- Intervals: 0-2-3-5-6-8-9-11
- Eight notes alternating whole and half steps
- Why it exists: Symmetric scale with 3 unique transpositions. Used over diminished 7th chords and to create tension in jazz. The symmetry means any note can be a root, creating ambiguity.
- Use it for: Jazz improvisation over diminished chords, creating tension, transitional passages
- Famous examples: Jazz improvisations, Thelonious Monk

**Chromatic Scale** - H-H-H-H-H-H-H-H-H-H-H-H
- Intervals: 0-1-2-3-4-5-6-7-8-9-10-11
- All 12 notes
- Why it exists: Contains every pitch, allowing maximum melodic freedom or creating tension. Chromatic runs add excitement and virtuosity.
- Use it for: Passing tones, runs, creating tension, 12-tone music
- Famous examples: Classical virtuoso passages, jazz chromatic lines`,

      keyPoints: [
        {
          title: 'Diatonic vs Pentatonic vs Symmetric',
          explanation: 'Diatonic scales (7 notes) provide harmonic richness for chord progressions. Pentatonic scales (5 notes) are "foolproof" - no half steps means no wrong notes. Symmetric scales (whole tone, diminished) divide the octave equally, creating ambiguity where any note could be home.',
          analogy: 'Diatonic is a full sentence with grammar rules. Pentatonic is simple words that always work. Symmetric is abstract poetry where meaning floats.'
        },
        {
          title: 'Why Three Types of Minor?',
          explanation: 'Natural minor is the pure relative minor of major. Harmonic minor adds the leading tone (raised 7th) to create strong V-i cadences. Melodic minor smooths out the awkward augmented 2nd gap for singing. Jazz uses melodic minor ascending throughout; classical uses natural minor descending.',
          analogy: 'Like three versions of the same sad story: natural (pure grief), harmonic (dramatic with tension), melodic (sophisticated melancholy).'
        },
        {
          title: 'Modes Are Colors, Not Keys',
          explanation: 'All modes of C major use the same notes (C-D-E-F-G-A-B), but treating different notes as "home" creates completely different emotions. Dorian feels jazzy, Lydian feels dreamy, Mixolydian feels bluesy - all from the same seven notes!',
          analogy: 'Same paints, different paintings. The notes are colors; the mode is how you arrange them on canvas.'
        },
        {
          title: 'The Blue Note Changed Music',
          explanation: 'The ♭5 added to minor pentatonic (creating the blues scale) was a revolutionary fusion of African and Western music. This single note - creating tension between ♭5 and 5 - became the foundation of blues, jazz, rock, and virtually all modern popular music.',
          analogy: 'One note that bent the rules of Western music and created entire genres.'
        }
      ],

      summary: 'The 15 scales in the Scale Explorer represent different tools for different musical needs: Major and minor for standard Western harmony; pentatonic for foolproof melodies; modes for emotional variety; harmonic and melodic minor for sophisticated minor key writing; blues for raw emotion; and symmetric scales for ambiguity and tension. Each scale exists because musicians needed specific colors that other scales couldn\'t provide.'
    },

    hearIt: {
      title: 'Hear each scale\'s unique character',
      examples: [
        {
          label: 'Major (Ionian) - Bright and happy',
          description: 'The foundation of Western music. "Do-Re-Mi-Fa-Sol-La-Ti-Do."',
          playAction: { type: 'scale', root: 'C', scaleType: 'major' }
        },
        {
          label: 'Natural Minor (Aeolian) - Sad and serious',
          description: 'The relative minor. Darker, more somber than major.',
          playAction: { type: 'scale', root: 'C', scaleType: 'minor' }
        },
        {
          label: 'Harmonic Minor - Exotic and dramatic',
          description: 'The raised 7th creates that Middle Eastern/classical flavor.',
          playAction: { type: 'scale', root: 'C', scaleType: 'harmonic-minor' }
        },
        {
          label: 'Melodic Minor - Smooth jazz minor',
          description: 'Like harmonic minor but with raised 6th too. Very smooth.',
          playAction: { type: 'scale', root: 'C', scaleType: 'melodic-minor' }
        },
        {
          label: 'Major Pentatonic - Universal folk sound',
          description: 'Just 5 notes - no wrong notes possible. Pure and simple.',
          playAction: { type: 'scale', root: 'C', scaleType: 'major-pentatonic' }
        },
        {
          label: 'Minor Pentatonic - Rock/blues foundation',
          description: 'The scale of rock guitar solos worldwide.',
          playAction: { type: 'scale', root: 'C', scaleType: 'minor-pentatonic' }
        },
        {
          label: 'Blues Scale - Raw and soulful',
          description: 'Minor pentatonic + the "blue note" (♭5). Pure emotion.',
          playAction: { type: 'scale', root: 'C', scaleType: 'blues' }
        },
        {
          label: 'Dorian - Jazzy minor',
          description: 'Minor with a brighter 6th. The "So What" sound.',
          playAction: { type: 'scale', root: 'C', scaleType: 'dorian' }
        },
        {
          label: 'Phrygian - Spanish/dark',
          description: 'The ♭2 creates instant flamenco drama.',
          playAction: { type: 'scale', root: 'C', scaleType: 'phrygian' }
        },
        {
          label: 'Lydian - Dreamy/floating',
          description: 'Major with #4. Otherworldly and magical.',
          playAction: { type: 'scale', root: 'C', scaleType: 'lydian' }
        },
        {
          label: 'Mixolydian - Bluesy major/rock',
          description: 'Major with ♭7. Classic rock sound.',
          playAction: { type: 'scale', root: 'C', scaleType: 'mixolydian' }
        },
        {
          label: 'Locrian - Unstable/dark',
          description: 'The ♭5 makes it nearly impossible to use as a key center.',
          playAction: { type: 'scale', root: 'C', scaleType: 'locrian' }
        },
        {
          label: 'Whole Tone - Floating/dreamlike',
          description: 'No sense of home. Debussy\'s impressionist tool.',
          playAction: { type: 'scale', root: 'C', scaleType: 'whole-tone' }
        },
        {
          label: 'Diminished (W-H) - Tense/symmetric',
          description: 'Jazz tension scale. 8 notes, completely symmetric.',
          playAction: { type: 'scale', root: 'C', scaleType: 'diminished' }
        },
        {
          label: 'Chromatic - All 12 notes',
          description: 'Every pitch. Maximum freedom, maximum tension.',
          playAction: { type: 'scale', root: 'C', scaleType: 'chromatic' }
        }
      ],
      famousSongs: [
        'Major: "Let It Be" (Beatles) - pure major scale melody',
        'Minor: "Stairway to Heaven" intro - natural minor atmosphere',
        'Harmonic Minor: "Hava Nagila" - that distinctive Middle Eastern sound',
        'Pentatonic: "My Girl" (Temptations) - major pentatonic hook',
        'Blues: "The Thrill Is Gone" (BB King) - classic blues scale',
        'Dorian: "So What" (Miles Davis) - defining modal jazz',
        'Mixolydian: "Sweet Home Alabama" - rock with ♭7',
        'Whole Tone: "You Are the Sunshine of My Life" bridge - Stevie Wonder\'s floating sound'
      ]
    },

    // Try It is a guided exercise using Scale Explorer
    tryIt: null,

    experiment: {
      title: 'Compare scales in the Scale Explorer',
      prompt: 'Use the Scale Explorer to hear and compare different scale types:',
      challenges: [
        {
          label: 'Compare the three minors on A',
          hint: 'Play A Natural Minor, A Harmonic Minor, A Melodic Minor. Listen for the 6th and 7th degree differences.',
          solution: { explore: true }
        },
        {
          label: 'Compare Major vs Major Pentatonic on C',
          hint: 'Major has 7 notes, Pentatonic has 5. Which notes are removed? (4th and 7th)',
          solution: { explore: true }
        },
        {
          label: 'Play all 7 modes starting from C',
          hint: 'C Ionian, C Dorian, C Phrygian, etc. Hear how the same root creates different moods.',
          solution: { explore: true }
        },
        {
          label: 'Compare Blues scale vs Minor Pentatonic on A',
          hint: 'The blues scale adds just one note - the ♭5 (Eb). Hear the difference that one note makes!',
          solution: { explore: true }
        }
      ],
      freePlay: {
        prompt: 'Pick a mood you want to express, then find the scale that matches. Try: "dreamy" (Lydian), "dark Spanish" (Phrygian), "bluesy rock" (Mixolydian or Blues), "jazzy cool" (Dorian).',
        openScaleExplorer: true
      }
    },

    quiz: {
      title: 'Scale Types Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'What note is added to Minor Pentatonic to create the Blues Scale?',
          options: ['Major 7th', 'Flat 5th (tritone)', 'Sharp 4th', 'Major 3rd'],
          correctIndex: 1,
          explanation: 'The Blues Scale is Minor Pentatonic (1-♭3-4-5-♭7) plus the ♭5. This "blue note" creates tension between ♭5 and 5, giving blues its characteristic sound.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'Why was Harmonic Minor created?',
          options: [
            'To sound more exotic',
            'To create a leading tone (raised 7th) for strong V-i cadences',
            'To have 8 notes instead of 7',
            'To match the major scale'
          ],
          correctIndex: 1,
          explanation: 'Natural minor lacks a leading tone - the 7th is a whole step below the tonic. Raising the 7th creates the half-step pull that makes V-i cadences work properly in minor keys.'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'What makes Pentatonic scales "foolproof"?',
          options: [
            'They have more notes',
            'They have no half steps, so no note sounds "wrong"',
            'They\'re only used in Asia',
            'They\'re played faster'
          ],
          correctIndex: 1,
          explanation: 'Pentatonic scales remove the 4th and 7th degrees of the major scale - the notes that create half steps. Without half steps, you can\'t create harsh dissonance.'
        },
        {
          id: 'q4',
          type: 'multiple_choice',
          question: 'Which mode has a raised 4th (#4) and sounds "dreamy" or "magical"?',
          options: ['Dorian', 'Phrygian', 'Lydian', 'Mixolydian'],
          correctIndex: 2,
          explanation: 'Lydian mode has a #4, removing the only "dark" interval in major (the perfect 4th against the 3rd). This makes it the "brightest" mode - dreamy, floating, and otherworldly.'
        }
      ],
      passingScore: 3
    }
  },

  // =====================================================
  // The Power of 7th Chords
  // =====================================================
  {
    id: 'lesson-seventh-chords',
    path: 'intermediate',
    title: 'The Power of 7th Chords',
    subtitle: 'Adding sophistication with the four types of 7th chords',
    estimatedTime: '12 min',
    icon: '7️⃣',

    learn: {
      introduction: `Welcome to the world of 7th chords! You've mastered triads (3-note chords), and now it's time to add a fourth note that will transform your harmonic palette.

**What is a 7th chord?**
A 7th chord is a triad with one additional note stacked on top: the 7th scale degree from the root. This extra note adds richness, color, and emotional complexity that triads simply can't provide.

**The Four Main Types of 7th Chords:**

1. **Major 7th (maj7)** - Built: Root + Major 3rd + Perfect 5th + Major 7th
   - Formula: 1 - 3 - 5 - 7
   - Example: Cmaj7 = C - E - G - B
   - Sound: Dreamy, sophisticated, floating, romantic
   - The major 7th interval (11 half steps) creates a lush, open sound

2. **Dominant 7th (7)** - Built: Root + Major 3rd + Perfect 5th + Minor 7th
   - Formula: 1 - 3 - 5 - ♭7
   - Example: G7 = G - B - D - F
   - Sound: Tense, urgent, bluesy, wants to resolve
   - Contains a tritone (B to F) - the most unstable interval in music!

3. **Minor 7th (m7)** - Built: Root + Minor 3rd + Perfect 5th + Minor 7th
   - Formula: 1 - ♭3 - 5 - ♭7
   - Example: Am7 = A - C - E - G
   - Sound: Smooth, mellow, jazzy, sophisticated sadness
   - The "cool jazz" chord - less harsh than a plain minor triad

4. **Minor 7th Flat 5 / Half-Diminished (m7♭5 or ø)** - Built: Root + Minor 3rd + Diminished 5th + Minor 7th
   - Formula: 1 - ♭3 - ♭5 - ♭7
   - Example: Bm7♭5 = B - D - F - A
   - Sound: Dark, mysterious, unresolved, questioning
   - The "leading tone" chord in minor keys

**Why the Dominant 7th is Special:**
The dominant 7th chord is arguably the most important chord in Western music. Here's why:

- It contains a **tritone** (augmented 4th/diminished 5th) between the 3rd and 7th
- In G7, that's B and F - exactly 6 half steps apart
- This tritone is incredibly unstable and "wants" to resolve
- B wants to move up to C, F wants to move down to E
- When G7 resolves to C, both tritone notes resolve by half step - maximum satisfaction!

**The ii-V-I Progression:**
This is the most important progression in jazz, and it showcases 7th chords beautifully:
- **ii** = Dm7 (minor 7th on the 2nd degree)
- **V** = G7 (dominant 7th on the 5th degree)
- **I** = Cmaj7 (major 7th on the 1st degree)

Each chord flows naturally to the next, with voice leading that practically writes itself.`,

      keyPoints: [
        {
          title: 'The Tritone in Dominant 7ths',
          explanation: 'The dominant 7th chord (like G7) contains a tritone - the interval of 6 half steps between the 3rd and 7th (B and F in G7). This is the most dissonant interval in music, and it\'s why dominant 7ths create such strong tension. The tritone wants to resolve: B moves up to C, F moves down to E. This is why G7 → C feels so satisfying.',
          analogy: 'Think of the tritone like a compressed spring - it\'s storing energy that will be released when it resolves.'
        },
        {
          title: 'Major 7th vs Dominant 7th - One Note Changes Everything',
          explanation: 'Cmaj7 has a B natural (major 7th), while C7 has a B♭ (minor 7th). That one half-step difference completely changes the character. Cmaj7 is stable and dreamy - it can be a resting point. C7 is unstable and wants to move to F. Same root, dramatically different function!',
          analogy: 'It\'s like the difference between arriving home (maj7) versus being told "we\'re almost there" (dominant 7).'
        },
        {
          title: 'Minor 7ths Smooth Out Minor Chords',
          explanation: 'A plain Am can sound harsh or stark. Am7 adds a G on top, which softens the chord and gives it a more sophisticated, "cooler" sound. This is why jazz musicians almost always use m7 instead of plain minor chords - it\'s more pleasing to the ear and creates better voice leading.',
          analogy: 'Like adding cream to coffee - it smooths out the bitterness while keeping the essential character.'
        },
        {
          title: 'The Half-Diminished\'s Role',
          explanation: 'The m7♭5 (half-diminished) chord appears naturally on the 7th degree of major keys (Bm7♭5 in C major) and the 2nd degree of minor keys (Dm7♭5 in C minor). It\'s often used as a "ii" chord in minor key ii-V-i progressions. Its dark, questioning sound creates beautiful tension.',
          analogy: 'The half-diminished is like a question mark in music - it creates suspense and demands an answer.'
        }
      ],

      summary: '7th chords add a fourth note to triads, creating richer harmony. The four main types are: Major 7th (dreamy, stable), Dominant 7th (tense, resolving - contains a tritone), Minor 7th (smooth, jazzy), and Half-Diminished (dark, questioning). The dominant 7th is the most important because its tritone creates powerful tension that resolves satisfyingly. The ii-V-I progression (Dm7-G7-Cmaj7) is the foundation of jazz harmony.'
    },

    hearIt: {
      title: 'Hear the character of each 7th chord type',
      examples: [
        {
          label: 'Cmaj7 - The Dreamy One',
          description: 'Stable, floating, romantic. The major 7th interval creates an open, lush sound. This chord can end a song.',
          playAction: { type: 'chord', root: 'C', chordType: 'major7' }
        },
        {
          label: 'G7 - The Tense One',
          description: 'Urgent, bluesy, unstable. The tritone (B-F) creates tension that demands resolution to C.',
          playAction: { type: 'chord', root: 'G', chordType: 'dominant7' }
        },
        {
          label: 'G7 → C Resolution',
          description: 'Feel how the tension of G7 releases when it moves to C. This is the V-I resolution with a 7th.',
          playAction: { type: 'progression', chords: ['G7', 'C'] }
        },
        {
          label: 'Am7 - The Smooth One',
          description: 'Mellow, sophisticated, cool. The added 7th softens the minor chord\'s sadness.',
          playAction: { type: 'chord', root: 'A', chordType: 'minor7' }
        },
        {
          label: 'Bm7♭5 - The Mysterious One',
          description: 'Dark, questioning, suspenseful. The diminished 5th adds tension to an already minor chord.',
          playAction: { type: 'chord', root: 'B', chordType: 'halfDiminished7' }
        },
        {
          label: 'The Jazz ii-V-I: Dm7 → G7 → Cmaj7',
          description: 'The most important progression in jazz. Smooth voice leading, perfect tension and release.',
          playAction: { type: 'progression', chords: ['Dm7', 'G7', 'Cmaj7'] }
        },
        {
          label: 'Comparison: C vs Cmaj7 vs C7',
          description: 'Same root, three different worlds. Triad (neutral), maj7 (dreamy), dominant 7 (tense).',
          playAction: { type: 'progression', chords: ['C', 'Cmaj7', 'C7'] }
        }
      ],
      famousSongs: [
        '"Isn\'t She Lovely" (Stevie Wonder) - Maj7 chords create the warm, loving feel',
        '"Girl from Ipanema" (Jobim) - Classic bossa nova using maj7 and m7 throughout',
        '"What a Wonderful World" (Louis Armstrong) - Beautiful maj7 usage on "I see trees of green"',
        '"Ain\'t No Sunshine" (Bill Withers) - Minor 7ths create the smooth, soulful groove',
        '"Georgia On My Mind" (Ray Charles) - Dominant 7ths drive the blues changes',
        '"All Blues" (Miles Davis) - Dominant 7ths in a modal jazz context'
      ]
    },

    // Try It is a guided exercise - see interactiveTutorial.js
    tryIt: null,

    experiment: {
      title: 'Transform progressions with 7th chords',
      prompt: 'Take progressions you know and upgrade them with different 7th chord combinations:',
      challenges: [
        {
          label: 'Jazz up I-V-vi-IV: Cmaj7 - G7 - Am7 - Fmaj7',
          hint: 'Every chord becomes a 7th - notice how much richer it sounds',
          solution: { progression: ['Cmaj7', 'G7', 'Am7', 'Fmaj7'] }
        },
        {
          label: 'Full ii-V-I-vi: Dm7 - G7 - Cmaj7 - Am7',
          hint: 'The fundamental jazz turnaround - practice this in every key!',
          solution: { progression: ['Dm7', 'G7', 'Cmaj7', 'Am7'] }
        },
        {
          label: 'Minor ii-V-i: Dm7♭5 - G7 - Cm7',
          hint: 'The minor key version uses half-diminished on ii',
          solution: { progression: ['Dm7b5', 'G7', 'Cm7'] }
        },
        {
          label: 'Descending 7ths: Cmaj7 - Bm7♭5 - Am7 - Gm7 - Fmaj7',
          hint: 'Walk down the scale with 7th chords for a sophisticated sound',
          solution: { progression: ['Cmaj7', 'Bm7b5', 'Am7', 'Gm7', 'Fmaj7'] }
        }
      ],
      freePlay: {
        prompt: 'Try replacing triads with 7ths in any progression. Not every chord needs a 7th - sometimes mixing triads and 7ths creates the best texture. What combinations sound best to your ear?',
        openBuilder: true
      }
    },

    quiz: {
      title: '7th Chord Mastery Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'What interval makes the dominant 7th chord so tense?',
          options: [
            'The perfect 5th',
            'The tritone between the 3rd and 7th',
            'The major 3rd',
            'The root note'
          ],
          correctIndex: 1,
          explanation: 'The dominant 7th contains a tritone (6 half steps) between the 3rd and 7th. In G7, that\'s B to F. This is the most dissonant interval and creates the urgent need to resolve.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'What\'s the difference between Cmaj7 and C7?',
          options: [
            'Cmaj7 has a B natural, C7 has a B♭',
            'They are the same chord',
            'C7 has more notes than Cmaj7',
            'Cmaj7 is minor, C7 is major'
          ],
          correctIndex: 0,
          explanation: 'Cmaj7 = C-E-G-B (major 7th = B natural). C7 = C-E-G-B♭ (minor 7th = B flat). That one half-step difference completely changes the chord\'s function!'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'In a ii-V-I progression in C major, what are the chords?',
          options: [
            'Cm7 - F7 - Bbmaj7',
            'Dm7 - G7 - Cmaj7',
            'Em7 - A7 - Dmaj7',
            'Am7 - D7 - Gmaj7'
          ],
          correctIndex: 1,
          explanation: 'In C major: ii = Dm7 (D is the 2nd note), V = G7 (G is the 5th note), I = Cmaj7 (C is the 1st note). This is the most important jazz progression!'
        },
        {
          id: 'q4',
          type: 'audio_identify',
          question: 'Listen to this chord. What type of 7th chord is it?',
          playAction: { type: 'chord', root: 'D', chordType: 'dominant7' },
          options: ['Major 7th', 'Dominant 7th', 'Minor 7th', 'Half-diminished'],
          correctIndex: 1,
          explanation: 'This is D7 (D dominant 7th). You can hear the tension from the tritone between F# and C. It wants to resolve to G!'
        }
      ],
      passingScore: 3
    }
  },

  // =====================================================
  // Secondary Dominants
  // =====================================================
  {
    id: 'lesson-secondary-dominants',
    path: 'intermediate',
    title: 'Secondary Dominants',
    subtitle: 'Creating tension that resolves to ANY chord',
    estimatedTime: '14 min',
    icon: '🎯',

    learn: {
      introduction: `You've learned that the V chord (dominant) creates tension that resolves to the I chord. But what if you could create that same powerful tension before ANY chord in the key? That's exactly what secondary dominants do!

**What is a Secondary Dominant?**
A secondary dominant is a dominant 7th chord that resolves to a chord OTHER than the tonic (I). It's "borrowed" from another key to create extra tension and color.

**The Notation: V/x ("Five of x")**
We write secondary dominants as V/x, meaning "the V chord OF x." For example:
- **V/V** = "Five of Five" = The dominant that resolves to the V chord
- **V/ii** = "Five of Two" = The dominant that resolves to the ii chord
- **V/vi** = "Five of Six" = The dominant that resolves to the vi chord

**How to Find Any Secondary Dominant:**
To find the secondary dominant of any chord, simply go up a perfect 5th (or down a perfect 4th) from that chord's root, then make it a dominant 7th.

In the key of C:
- V/V (resolves to G) → D7 (D is a 5th above G)
- V/ii (resolves to Dm) → A7 (A is a 5th above D)
- V/iii (resolves to Em) → B7 (B is a 5th above E)
- V/IV (resolves to F) → C7 (C is a 5th above F)
- V/vi (resolves to Am) → E7 (E is a 5th above A)

**Why Do Secondary Dominants Work?**
Each secondary dominant contains a tritone that resolves to the target chord, just like V7 resolves to I. The ear is "tricked" into hearing a momentary key change, which creates interest and forward motion.

**The Most Common Secondary Dominants:**

1. **V/V (D7 in C major)** - The most common! Used in countless songs to approach the V chord with extra emphasis. The progression C - D7 - G - C adds drama to the approach to G.

2. **V/ii (A7 in C major)** - Creates a strong pull to the ii chord. C - A7 - Dm - G - C gives the ii chord more importance.

3. **V/vi (E7 in C major)** - Adds intensity before the emotional vi chord. C - E7 - Am - F is more dramatic than C - Em - Am - F.

4. **V/IV (C7 in C major)** - The tonic becomes a dominant! C7 - F creates a bluesy, forward-pushing sound.

**Important: Applied Chords Don't Change the Key**
When you use D7 in C major, you haven't modulated to G major. You've just "applied" G major's dominant for a moment. The music returns to C major immediately after.`,

      keyPoints: [
        {
          title: 'Every Chord Can Have Its Own Dominant',
          explanation: 'Any major or minor chord in the key can be preceded by its own V7 chord. This temporarily creates the tension-resolution relationship that exists between V and I, but for any chord. It\'s like giving every chord in your progression a "red carpet introduction."',
          analogy: 'If V7-I is like a trumpeted announcement of the king, secondary dominants let you give that royal treatment to any member of the court.'
        },
        {
          title: 'The Tritone Still Does the Work',
          explanation: 'Secondary dominants work because they each contain a tritone that resolves to the target chord. In D7 (resolving to G), the tritone is F#-C, which resolves to G-B. In A7 (resolving to Dm), the tritone is G#-C#... wait, but we\'re in C major! This "foreign" note (G#) is what makes it colorful.',
          analogy: 'Like adding a pinch of exotic spice to a familiar dish - it\'s unexpected but delicious.'
        },
        {
          title: 'V/V is Everywhere',
          explanation: 'The secondary dominant of V (D7 in C major) is so common it\'s almost expected. Songs like "Sweet Home Alabama" (D-C-G), "Twist and Shout" (D-G-A in the key of A), and countless blues tunes use it. When you hear a major chord a whole step below the V, it\'s almost always V/V.',
          analogy: 'V/V is like the "special guest star" introduction before the main character (V) enters.'
        },
        {
          title: 'Secondary Dominants Add Forward Motion',
          explanation: 'Music can feel static when chords just exist in the key. Secondary dominants add motion because each one DEMANDS resolution. A progression like C - Am - Dm - G can become C - A7 - Dm - G, and suddenly there\'s more energy and direction.',
          analogy: 'Regular diatonic chords are like walking. Secondary dominants are like getting a push from behind - you\'re propelled forward!'
        }
      ],

      summary: 'Secondary dominants are dominant 7th chords that create tension resolving to chords other than the tonic. Written as V/x (like V/V, V/ii, V/vi), they\'re found by going a 5th above the target chord and making it dominant 7th. Each contains a tritone that resolves to the target, creating momentary "tonicization" without changing the key. V/V is the most common, but any major or minor chord can be preceded by its secondary dominant for added color and forward motion.'
    },

    hearIt: {
      title: 'Hear secondary dominants in action',
      examples: [
        {
          label: 'V/V: C - D7 - G - C',
          description: 'D7 is the V of G. Hear how it creates extra tension before arriving at G.',
          playAction: { type: 'progression', chords: ['C', 'D7', 'G', 'C'] }
        },
        {
          label: 'Without vs With: C - G vs C - D7 - G',
          description: 'Compare the plain version to the one with V/V. The secondary dominant adds drama!',
          playAction: { type: 'progression', chords: ['C', 'G', 'C', 'D7', 'G'] }
        },
        {
          label: 'V/vi: C - E7 - Am - G',
          description: 'E7 is the V of Am. It intensifies the emotional move to the vi chord.',
          playAction: { type: 'progression', chords: ['C', 'E7', 'Am', 'G'] }
        },
        {
          label: 'V/ii: C - A7 - Dm - G - C',
          description: 'A7 leads powerfully to Dm. Great for emphasizing the ii chord.',
          playAction: { type: 'progression', chords: ['C', 'A7', 'Dm', 'G', 'C'] }
        },
        {
          label: 'V/IV: C - C7 - F - G - C',
          description: 'C becomes C7 and pushes to F. Bluesy and forward-moving!',
          playAction: { type: 'progression', chords: ['C', 'C7', 'F', 'G', 'C'] }
        },
        {
          label: 'Chain of Dominants: A7 - D7 - G7 - C',
          description: 'Each dominant resolves to the next! This is a common jazz technique.',
          playAction: { type: 'progression', chords: ['A7', 'D7', 'G7', 'C'] }
        }
      ],
      famousSongs: [
        '"Sweet Home Alabama" (Lynyrd Skynyrd) - D-C-G uses V/V in G major',
        '"Twist and Shout" (Beatles) - Uses V/V extensively',
        '"Hey Jude" (Beatles) - E7 before the vi chord (V/vi)',
        '"Georgia On My Mind" (Ray Charles) - Multiple secondary dominants throughout',
        '"I Got Rhythm" (Gershwin) - Classic use of V/vi (E7 to Am)',
        '"All of Me" (jazz standard) - Secondary dominants create the harmonic motion'
      ]
    },

    // Try It is a guided exercise
    tryIt: null,

    experiment: {
      title: 'Add secondary dominants to your progressions',
      prompt: 'Take familiar progressions and insert secondary dominants before key chords:',
      challenges: [
        {
          label: 'Upgrade I-V-vi-IV: C - D7 - G - E7 - Am - F',
          hint: 'Add V/V before G and V/vi before Am',
          solution: { progression: ['C', 'D7', 'G', 'E7', 'Am', 'F'] }
        },
        {
          label: 'Circle of dominants: E7 - A7 - D7 - G7 - Cmaj7',
          hint: 'Each dominant resolves down a 5th to the next',
          solution: { progression: ['E7', 'A7', 'D7', 'G7', 'Cmaj7'] }
        },
        {
          label: 'Bluesy I-IV: C7 - F - C - G7 - C',
          hint: 'C7 acts as V/IV, pushing strongly to F',
          solution: { progression: ['C7', 'F', 'C', 'G7', 'C'] }
        }
      ],
      freePlay: {
        prompt: 'Take any progression you\'ve built and try adding secondary dominants before different chords. Which ones sound best? V/V and V/vi are great starting points!',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Secondary Dominants Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'In the key of C major, what chord is V/V?',
          options: ['G7', 'D7', 'A7', 'E7'],
          correctIndex: 1,
          explanation: 'V/V means "the V of V." V in C major is G. The V of G is D7 (D is a 5th above G). So V/V = D7.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'What chord would you use to create tension before Am in C major?',
          options: ['D7 (V/V)', 'A7 (V/ii)', 'E7 (V/vi)', 'B7 (V/iii)'],
          correctIndex: 2,
          explanation: 'To create tension before Am, use its V chord: E7. E is a 5th above A, and making it dominant 7th gives us E7 (V/vi).'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'Why do secondary dominants create tension?',
          options: [
            'They are louder than regular chords',
            'They contain a tritone that resolves to the target chord',
            'They use notes from a different key',
            'They have more notes than triads'
          ],
          correctIndex: 1,
          explanation: 'Like all dominant 7th chords, secondary dominants contain a tritone that creates tension and resolves to the target chord. This is the same mechanism that makes V7-I so powerful.'
        },
        {
          id: 'q4',
          type: 'audio_identify',
          question: 'Listen to this progression. Does it use a secondary dominant?',
          playAction: { type: 'progression', chords: ['C', 'D7', 'G', 'C'] },
          options: ['Yes - D7 is V/V', 'No - all chords are diatonic', 'Yes - G is V/IV', 'No - there\'s no dominant chord'],
          correctIndex: 0,
          explanation: 'D7 is not diatonic to C major (it has F#). It\'s the V of G, making it a secondary dominant (V/V).'
        }
      ],
      passingScore: 3
    }
  },

  // =====================================================
  // Borrowed Chords (Modal Interchange)
  // =====================================================
  {
    id: 'lesson-borrowed-chords',
    path: 'intermediate',
    title: 'Borrowed Chords',
    subtitle: 'Stealing color from parallel keys',
    estimatedTime: '12 min',
    icon: '🎨',

    learn: {
      introduction: `You're writing in C major, and everything sounds... fine. But what if you could reach into C MINOR and grab a chord for a moment? That's borrowed chords (also called modal interchange) - one of the most powerful tools for adding emotional color to your music.

**What Are Borrowed Chords?**
Borrowed chords are chords taken from the parallel mode/key. If you're in C major, you can "borrow" chords from C minor. These chords use notes that aren't in your current key, creating unexpected color and emotion.

**Parallel vs Relative Keys:**
- **Parallel keys** share the same root: C major and C minor
- **Relative keys** share the same notes: C major and A minor
- Borrowed chords come from PARALLEL keys (same root, different mode)

**The Most Common Borrowed Chords (in a Major Key):**

From the parallel minor, you can borrow:

1. **♭VII (B♭ in C major)** - The most popular borrowed chord!
   - Adds a rock/epic quality
   - Used in: "Hey Jude," "Let It Be," countless rock songs
   - Creates motion without the strong pull of V

2. **iv (Fm in C major)** - Minor four instead of major four
   - Incredibly emotional and dramatic
   - Used in: "Creep" (Radiohead), "Space Oddity" (Bowie)
   - The ♭6 (A♭) adds a dark twist

3. **♭VI (A♭ in C major)** - Major chord on the flattened 6th
   - Surprising and beautiful
   - Used in: "No Woman No Cry," many film scores
   - Creates a sense of wonder or bittersweetness

4. **♭III (E♭ in C major)** - Major chord on the flattened 3rd
   - Bright but unexpected
   - Creates a "lifted" feeling
   - Common in Radiohead, Coldplay

5. **i (Cm instead of C)** - Minor tonic!
   - Turning major to minor for a dark turn
   - "Picardy third" in reverse

**Why Borrowed Chords Work:**
Your ear is used to hearing major key sounds. When a borrowed chord appears, it introduces "blue notes" (♭3, ♭6, ♭7) that create instant emotion without changing the key. It's like a cloud passing over the sun - brief darkness that makes the return to major even brighter.

**The Power of ♭VII:**
The ♭VII chord deserves special attention because it's everywhere:
- In C major, ♭VII = B♭ major (B♭ - D - F)
- It contains ♭7 (B♭) from the parallel minor
- It creates motion to the tonic without dominant function
- Rock, pop, and film music use it constantly
- C - B♭ - F - C is a classic rock progression`,

      keyPoints: [
        {
          title: 'Borrowed Chords Add "Blue Notes"',
          explanation: 'The notes that make minor keys sound sad (♭3, ♭6, ♭7) can be borrowed into major keys for emotional effect. When you play Fm in C major, you\'re introducing A♭ (the ♭6), which creates instant drama without changing keys.',
          analogy: 'Like adding a drop of ink to water - a small amount of minor color spreads through the major key.'
        },
        {
          title: 'The iv Chord is Devastatingly Emotional',
          explanation: 'The minor iv (Fm in C) is one of the most emotional sounds in music. It\'s used in "Creep" (G-B-C-Cm shows iv), "My Heart Will Go On," and countless ballads. The ♭6 (A♭) is what makes it so poignant.',
          analogy: 'The iv chord is like a single tear - subtle but deeply moving.'
        },
        {
          title: '♭VII Creates "Epic" Rock Sound',
          explanation: 'The ♭VII chord (B♭ in C) is the signature sound of rock and epic film music. Unlike V, it doesn\'t demand resolution - it just adds weight and drama. C - B♭ - C sounds triumphant; C - G - C sounds traditional.',
          analogy: '♭VII is like a power chord for your progression - it adds muscle without being pushy.'
        },
        {
          title: 'You Can Chain Borrowed Chords',
          explanation: 'Multiple borrowed chords can work together: C - A♭ - B♭ - C uses both ♭VI and ♭VII from the parallel minor. This creates a sweeping, cinematic sound that\'s very different from diatonic progressions.',
          analogy: 'Like a painter mixing colors from a different palette - unexpected but harmonious.'
        }
      ],

      summary: 'Borrowed chords come from the parallel key (C minor for C major) and add emotional color through "blue notes" (♭3, ♭6, ♭7). The most useful are: ♭VII (epic/rock), iv (devastatingly emotional), ♭VI (wondrous), and ♭III (bright surprise). These chords don\'t change the key - they just add temporary darkness or color that makes the return to major more satisfying.'
    },

    hearIt: {
      title: 'Hear borrowed chords in action',
      examples: [
        {
          label: '♭VII: C - B♭ - F - C',
          description: 'The B♭ is borrowed from C minor. Classic rock sound!',
          playAction: { type: 'progression', chords: ['C', 'Bb', 'F', 'C'] }
        },
        {
          label: 'iv: C - F - Fm - C',
          description: 'F becomes Fm (borrowed iv). Heart-wrenching emotion!',
          playAction: { type: 'progression', chords: ['C', 'F', 'Fm', 'C'] }
        },
        {
          label: '♭VI: C - Am - Ab - G',
          description: 'A♭ is the ♭VI, borrowed from C minor. Unexpected beauty.',
          playAction: { type: 'progression', chords: ['C', 'Am', 'Ab', 'G'] }
        },
        {
          label: 'Epic combo: C - Ab - Bb - C',
          description: 'Both ♭VI and ♭VII borrowed. Cinematic and powerful!',
          playAction: { type: 'progression', chords: ['C', 'Ab', 'Bb', 'C'] }
        },
        {
          label: 'Radiohead-style: C - Eb - F - G',
          description: '♭III (E♭) adds that distinctive alt-rock color.',
          playAction: { type: 'progression', chords: ['C', 'Eb', 'F', 'G'] }
        },
        {
          label: 'Comparing IV vs iv: C - F - G vs C - Fm - G',
          description: 'Hear how iv (Fm) is more emotional than IV (F).',
          playAction: { type: 'progression', chords: ['C', 'F', 'G', 'C', 'Fm', 'G'] }
        }
      ],
      famousSongs: [
        '"Creep" (Radiohead) - Uses ♭III and iv for maximum angst',
        '"Hey Jude" (Beatles) - ♭VII (F in G major) in the outro',
        '"Let It Be" (Beatles) - ♭VII appears throughout',
        '"Space Oddity" (David Bowie) - Beautiful use of iv',
        '"Mad World" (Tears for Fears/Gary Jules) - Borrowed chords create the dark mood',
        '"All Along the Watchtower" (Dylan/Hendrix) - ♭VII and ♭VI throughout'
      ]
    },

    // Try It is a guided exercise
    tryIt: null,

    experiment: {
      title: 'Add borrowed colors to your progressions',
      prompt: 'Start with familiar progressions and substitute borrowed chords:',
      challenges: [
        {
          label: 'Rock anthem: C - G - B♭ - F',
          hint: '♭VII (B♭) adds that powerful rock sound',
          solution: { progression: ['C', 'G', 'Bb', 'F'] }
        },
        {
          label: 'Emotional ballad: C - Am - Fm - G',
          hint: 'iv (Fm) replaces IV for deep emotion',
          solution: { progression: ['C', 'Am', 'Fm', 'G'] }
        },
        {
          label: 'Cinematic sweep: C - A♭ - B♭ - C',
          hint: 'Chain ♭VI and ♭VII for film score vibes',
          solution: { progression: ['C', 'Ab', 'Bb', 'C'] }
        },
        {
          label: 'Alt-rock color: C - E♭ - B♭ - F',
          hint: '♭III (E♭) and ♭VII (B♭) together',
          solution: { progression: ['C', 'Eb', 'Bb', 'F'] }
        }
      ],
      freePlay: {
        prompt: 'Take I-V-vi-IV and try replacing each chord with its borrowed equivalent. Which substitutions work best? Try iv for IV, ♭VII for V, and ♭VI for vi.',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Borrowed Chords Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'Where do borrowed chords come from?',
          options: [
            'The relative minor key',
            'The parallel minor/major key',
            'A random key',
            'The dominant key'
          ],
          correctIndex: 1,
          explanation: 'Borrowed chords come from the parallel key - the key with the same root but different mode. C major borrows from C minor.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'In C major, what is the ♭VII chord?',
          options: ['Bm', 'B', 'B♭m', 'B♭'],
          correctIndex: 3,
          explanation: '♭VII means a major chord on the flattened 7th degree. In C major, that\'s B♭ major (borrowed from C minor where B♭ is natural).'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'Why is the iv chord (like Fm in C major) so emotional?',
          options: [
            'It has more notes than IV',
            'It contains the ♭6 (A♭), a very expressive chromatic note',
            'It\'s louder than IV',
            'It uses sharps instead of flats'
          ],
          correctIndex: 1,
          explanation: 'The iv chord contains ♭6 (A♭ in C major), which is one of the most emotionally powerful "blue notes." This is why iv is used in so many emotional songs.'
        },
        {
          id: 'q4',
          type: 'audio_identify',
          question: 'Listen to this progression. Does it contain a borrowed chord?',
          playAction: { type: 'progression', chords: ['C', 'Bb', 'F', 'C'] },
          options: ['Yes - B♭ is borrowed (♭VII)', 'No - all chords are diatonic to C major', 'Yes - F is borrowed', 'No - this is in B♭ major'],
          correctIndex: 0,
          explanation: 'B♭ major is not diatonic to C major (C major has B natural, not B♭). B♭ is the ♭VII chord, borrowed from C minor.'
        }
      ],
      passingScore: 3
    }
  },

  // =====================================================
  // Creating Tension and Release
  // =====================================================
  {
    id: 'lesson-tension-release',
    path: 'intermediate',
    title: 'Creating Tension and Release',
    subtitle: 'The push and pull that makes music move',
    estimatedTime: '11 min',
    icon: '🎢',

    learn: {
      introduction: `All great music has one thing in common: the skillful manipulation of tension and release. It's what makes you lean forward during a verse and feel satisfied at a chorus. Let's master this essential skill!

**What is Musical Tension?**
Tension is the feeling that something is unresolved - that the music "wants" to go somewhere. Release (or resolution) is the satisfying arrival at a stable point. Together, they create the emotional journey of music.

**Sources of Harmonic Tension:**

1. **Dominant Function (V and V7)**
   - The strongest tension in tonal music
   - The tritone in V7 desperately wants to resolve
   - V → I is the ultimate release

2. **Suspended Chords (sus4, sus2)**
   - The 3rd is replaced with 4th or 2nd
   - Creates expectation for the 3rd to return
   - Csus4 → C is a satisfying micro-resolution

3. **Added Dissonance (add9, 7ths)**
   - Extra notes create mild tension
   - 7th chords are more "active" than triads
   - Can be used to color stable chords

4. **Non-Diatonic Chords**
   - Secondary dominants, borrowed chords
   - "Foreign" notes demand resolution
   - Chromatic movement creates urgency

5. **Pedal Points**
   - Holding one note while chords change above
   - Creates tension against moving harmony
   - Very effective for building intensity

**Tension and Release in Progressions:**

The classic tension/release structure:
- **Low tension:** I, IV, vi (stable, "home" chords)
- **Medium tension:** ii, iii, ♭VII (movement, transition)
- **High tension:** V, V7, secondary dominants (demand resolution)
- **Maximum tension:** Augmented, diminished, altered dominants

**The Art of Delayed Resolution:**
Great songwriters don't always resolve immediately. They extend tension by:
- Inserting chords between V and I
- Using deceptive cadences (V → vi instead of V → I)
- Repeating the tension chord
- Adding secondary dominants before V

**Building Tension Over Time:**
Entire song sections can build tension:
- Verse: Lower tension, sets up the story
- Pre-chorus: Building tension, anticipation
- Chorus: Can be release OR maximum tension (depends on the song)
- Bridge: Often highest tension before final release`,

      keyPoints: [
        {
          title: 'Tension is Relative',
          explanation: 'What feels tense depends on context. After several minor chords, a major chord feels like release. After V7, anything other than I feels like delayed resolution. You train your listener\'s expectations and then either fulfill or subvert them.',
          analogy: 'Like a joke\'s setup and punchline - the longer the setup, the bigger the payoff (or the funnier the subversion).'
        },
        {
          title: 'Suspended Chords Create Micro-Tension',
          explanation: 'A sus4 chord (C-F-G instead of C-E-G) suspends the 3rd, creating anticipation for its return. The resolution (Csus4 → C) is small but satisfying. This is a great way to add movement without changing chords.',
          analogy: 'Like holding your breath for a moment - small tension, small but real relief.'
        },
        {
          title: 'The Deceptive Cadence (V → vi)',
          explanation: 'Instead of resolving V to I, try V to vi. The ear expects I but gets vi - it\'s a "plot twist" in music. This extends the song and adds emotional depth. Very common in ballads and emotional songs.',
          analogy: 'Like reaching for a door handle and finding it locked - surprising, but it keeps the story going.'
        },
        {
          title: 'Stack Tension for Maximum Impact',
          explanation: 'You can layer tension sources: use a secondary dominant, make it a 7th chord, add a suspension, and put it over a pedal tone. The more tension you stack, the more powerful the release. But don\'t overdo it - too much tension becomes noise.',
          analogy: 'Like pulling back a slingshot - the further you pull, the more powerful the launch, but pull too far and it breaks.'
        }
      ],

      summary: 'Tension and release is the engine of music. Tension comes from dominant function (V7), suspensions, dissonance, and chromatic notes. Release comes from resolution to stable chords (especially I). Great music delays and manipulates resolution through deceptive cadences, secondary dominants, and careful pacing. The contrast between tension and release creates emotional impact.'
    },

    hearIt: {
      title: 'Experience tension and release',
      examples: [
        {
          label: 'Basic V-I Resolution',
          description: 'G7 → C. The tritone (B-F) resolves. Maximum satisfaction!',
          playAction: { type: 'progression', chords: ['G7', 'C'] }
        },
        {
          label: 'Delayed Resolution: V - IV - I',
          description: 'G7 → F → C. The IV chord delays the release, adding anticipation.',
          playAction: { type: 'progression', chords: ['G7', 'F', 'C'] }
        },
        {
          label: 'Deceptive Cadence: V - vi',
          description: 'G7 → Am. You expected C but got Am. Emotional plot twist!',
          playAction: { type: 'progression', chords: ['G7', 'Am'] }
        },
        {
          label: 'Suspension Resolution: Csus4 - C',
          description: 'The suspended 4th (F) resolves to the 3rd (E). Micro-tension!',
          playAction: { type: 'progression', chords: ['Csus4', 'C'] }
        },
        {
          label: 'Building Tension: Am - Dm - E7 - Am',
          description: 'Each chord builds more tension until E7 releases to Am.',
          playAction: { type: 'progression', chords: ['Am', 'Dm', 'E7', 'Am'] }
        },
        {
          label: 'Stacked Tension: Dm7 - G7sus4 - G7 - C',
          description: 'Tension layers: sus4 → 7th → resolution. Maximum buildup!',
          playAction: { type: 'progression', chords: ['Dm7', 'G7sus4', 'G7', 'C'] }
        }
      ],
      famousSongs: [
        '"Hallelujah" (Leonard Cohen) - Masterful tension/release throughout',
        '"Someone Like You" (Adele) - Deceptive cadences create the emotional punch',
        '"Let It Be" - Suspended chords resolve beautifully',
        '"Bohemian Rhapsody" - Operatic tension building',
        '"Stairway to Heaven" - Gradual tension build across the entire song',
        '"Fix You" (Coldplay) - Verse builds tension, chorus releases'
      ]
    },

    // Try It is a guided exercise
    tryIt: null,

    experiment: {
      title: 'Craft your own tension narratives',
      prompt: 'Build progressions that deliberately manipulate tension:',
      challenges: [
        {
          label: 'Delayed resolution: C - Am - G7 - F - C',
          hint: 'G7 wants C but gets F first - delayed gratification',
          solution: { progression: ['C', 'Am', 'G7', 'F', 'C'] }
        },
        {
          label: 'Deceptive + resolve: C - F - G7 - Am - G7 - C',
          hint: 'First G7 goes to Am (deceptive), second G7 resolves properly',
          solution: { progression: ['C', 'F', 'G7', 'Am', 'G7', 'C'] }
        },
        {
          label: 'Maximum tension: Am - Dm - E7sus4 - E7 - Am',
          hint: 'Stack a suspension before the dominant for extra tension',
          solution: { progression: ['Am', 'Dm', 'E7sus4', 'E7', 'Am'] }
        }
      ],
      freePlay: {
        prompt: 'Try building a progression where you delay resolution as long as possible. How many chords can you insert between V7 and I while still maintaining the tension?',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Tension and Release Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'What creates the strongest harmonic tension in tonal music?',
          options: [
            'The IV chord',
            'The ii chord',
            'The V7 chord (dominant 7th)',
            'The vi chord'
          ],
          correctIndex: 2,
          explanation: 'The V7 chord creates the strongest tension because it contains a tritone that desperately wants to resolve to the tonic (I).'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'What is a "deceptive cadence"?',
          options: [
            'V resolving to I',
            'V resolving to vi instead of I',
            'Any chord resolving to IV',
            'A cadence with no resolution'
          ],
          correctIndex: 1,
          explanation: 'A deceptive cadence is when V resolves to vi instead of the expected I. It "deceives" the listener\'s expectations and extends the phrase.'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'What does a sus4 chord suspend?',
          options: [
            'The root',
            'The 5th',
            'The 3rd (replaced by the 4th)',
            'The 7th'
          ],
          correctIndex: 2,
          explanation: 'A sus4 chord replaces the 3rd with the 4th. Csus4 is C-F-G instead of C-E-G. The 4th wants to resolve back down to the 3rd.'
        },
        {
          id: 'q4',
          type: 'audio_identify',
          question: 'Does this cadence resolve as expected?',
          playAction: { type: 'progression', chords: ['C', 'F', 'G7', 'Am'] },
          options: ['Yes - G7 resolved to C', 'No - G7 resolved to Am (deceptive)', 'Yes - it ended on the tonic', 'No - there was no cadence'],
          correctIndex: 1,
          explanation: 'G7 resolved to Am instead of the expected C. This is a deceptive cadence - the V7 goes to vi instead of I.'
        }
      ],
      passingScore: 3
    }
  },

  // =====================================================
  // The Melody-Chord Relationship
  // =====================================================
  {
    id: 'lesson-melody-chord',
    path: 'intermediate',
    title: 'The Melody-Chord Relationship',
    subtitle: 'How melodies and harmonies work together',
    estimatedTime: '13 min',
    icon: '🎶',

    learn: {
      introduction: `A great melody over wrong chords sounds bad. Great chords under a weak melody sound empty. Understanding how melody and harmony interact is essential for writing complete music.

**Chord Tones vs Non-Chord Tones:**

Every note in a melody has a relationship to the chord playing underneath:

**Chord Tones** (stable, consonant):
- Root (1) - Maximum stability
- Third (3) - Defines major/minor character
- Fifth (5) - Strong, supports the root
- Seventh (7) - Adds color while staying in the chord

**Non-Chord Tones** (tension, movement):
- Passing Tones - Connect chord tones stepwise
- Neighbor Tones - Step away and back to a chord tone
- Suspensions - Held from previous chord, resolve down
- Anticipations - Arrive at the next chord tone early
- Appoggiaturas - Leap to a dissonance, resolve by step

**Strong Beats vs Weak Beats:**

Where notes land matters:
- **Strong beats (1 and 3):** Chord tones sound stable, non-chord tones create emphasis
- **Weak beats (2 and 4):** Non-chord tones pass by without much notice
- Great melodies often have chord tones on strong beats and use non-chord tones for movement

**The "Chord Tone Melody" Technique:**

The simplest way to write a melody over chords:
1. Identify the chord tones for each chord
2. Choose one chord tone per chord as your main note
3. Connect them with passing tones and neighbor tones
4. Result: A melody that perfectly fits the harmony

**Extensions and Tensions in Melody:**

Notes beyond the triad add color:
- 9th (2nd) - Sweet, open
- 11th (4th) - Suspended feeling (avoid over major chords)
- 13th (6th) - Warm, soulful
- ♭9, #9, ♭13 - Jazz tensions, advanced color

**Voice Leading in Melody:**
The same principles that make chord progressions smooth apply to melody:
- Move by step when possible
- Avoid large leaps (or follow leaps with steps)
- Resolve tendency tones (7 up to 1, 4 down to 3)`,

      keyPoints: [
        {
          title: 'Chord Tones Create Stability',
          explanation: 'When a melody note is part of the current chord, it sounds stable and "right." The root is most stable, followed by the 5th, then the 3rd. Using chord tones on strong beats creates a melody that feels grounded in the harmony.',
          analogy: 'Chord tones are like standing on solid ground. Non-chord tones are like stepping on stones in a stream - brief, purposeful movement.'
        },
        {
          title: 'Non-Chord Tones Create Movement',
          explanation: 'Passing tones, neighbor tones, and suspensions are what make melodies interesting. They create small tensions that resolve, giving the melody direction and momentum. A melody of only chord tones would be static.',
          analogy: 'Non-chord tones are like spices in cooking - you don\'t make a meal of them, but they make everything more interesting.'
        },
        {
          title: 'Where Notes Land Matters',
          explanation: 'A dissonant note on a strong beat (1 or 3) creates emphasis and expression. The same note on a weak beat just passes by. Great melodies use this strategically - placing important chord tones on strong beats and using weak beats for movement.',
          analogy: 'Strong beats are like spotlights - whatever\'s there gets noticed. Weak beats are hallways between rooms.'
        },
        {
          title: 'Tension Notes Resolve',
          explanation: 'Non-chord tones have expected resolutions: the 4th resolves down to 3rd, the 7th resolves up to the root, the 6th can go either way. When your melody follows these tendencies, it sounds "correct." Subverting them creates surprise.',
          analogy: 'Like gravity - notes have weight and want to fall to resolution. You can fight gravity, but it takes energy.'
        }
      ],

      summary: 'Melodies interact with chords through chord tones (stable) and non-chord tones (tension/movement). Chord tones on strong beats create stability; non-chord tones on weak beats create flow. Great melodies balance both, using passing tones, neighbor tones, and suspensions to create movement while landing on chord tones at important moments. Understanding this relationship lets you write melodies that perfectly complement your progressions.'
    },

    hearIt: {
      title: 'Hear melody and chord interaction',
      examples: [
        {
          label: 'Chord tone melody: C-E-G over C major',
          description: 'Pure chord tones. Stable and consonant, but not very interesting.',
          playAction: { type: 'chord', root: 'C', chordType: 'major' }
        },
        {
          label: 'Passing tone: C-D-E over C major',
          description: 'The D connects C to E. It\'s not in the chord but sounds natural.',
          playAction: { type: 'chord', root: 'C', chordType: 'major' }
        },
        {
          label: 'Suspension: G-F-E over C major (4-3 suspension)',
          description: 'F is suspended from the previous chord, resolves down to E.',
          playAction: { type: 'chord', root: 'C', chordType: 'major' }
        },
        {
          label: '9th over major: D over Cmaj7',
          description: 'The 9th adds sweetness without clashing. Common in jazz and R&B.',
          playAction: { type: 'chord', root: 'C', chordType: 'major7' }
        },
        {
          label: 'Progression with melody focus',
          description: 'C - Am - F - G with chord tones as melody anchors.',
          playAction: { type: 'progression', chords: ['C', 'Am', 'F', 'G'] }
        }
      ],
      famousSongs: [
        '"Yesterday" (Beatles) - Paul\'s melody perfectly follows chord tones',
        '"Summertime" (Gershwin) - Jazz standard with beautiful chord-tone melodies',
        '"Hallelujah" (Leonard Cohen) - Suspensions and passing tones throughout',
        '"Over the Rainbow" - Wide leaps followed by stepwise motion',
        '"Autumn Leaves" - The melody outlines the 7th chords underneath',
        '"My Funny Valentine" - Chromatic passing tones add sophistication'
      ]
    },

    // Try It is a guided exercise
    tryIt: null,

    experiment: {
      title: 'Explore melody-chord relationships',
      prompt: 'Build progressions and think about what melody notes would work:',
      challenges: [
        {
          label: 'Chord-tone progression: Cmaj7 - Am7 - Dm7 - G7',
          hint: 'For each chord, the 1-3-5-7 are your safe melody notes',
          solution: { progression: ['Cmaj7', 'Am7', 'Dm7', 'G7'] }
        },
        {
          label: 'Pedal tone test: C - Am - F - G with C in melody',
          hint: 'C is a chord tone for C and Am, tension for F, tension for G',
          solution: { progression: ['C', 'Am', 'F', 'G'] }
        },
        {
          label: 'Guide tones: Dm7 - G7 - Cmaj7 (follow F-F-E in melody)',
          hint: 'The 7th of Dm7 (C) and 3rd of G7 (B) guide to Cmaj7',
          solution: { progression: ['Dm7', 'G7', 'Cmaj7'] }
        }
      ],
      freePlay: {
        prompt: 'Build a 4-chord progression and try to hear a melody over it. Which notes feel stable on each chord? Those are the chord tones!',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Melody-Chord Relationship Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'If a C major chord is playing, which note is a chord tone?',
          options: ['D', 'F', 'G', 'A'],
          correctIndex: 2,
          explanation: 'C major is C-E-G. G is the 5th of the chord - a chord tone. D, F, and A are non-chord tones.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'What is a passing tone?',
          options: [
            'A chord tone on a strong beat',
            'A non-chord tone that connects two chord tones by step',
            'The root of the chord',
            'A note held from the previous chord'
          ],
          correctIndex: 1,
          explanation: 'A passing tone is a non-chord tone that moves stepwise between two chord tones. It creates melodic connection and movement.'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'Where do chord tones typically sound most stable in a melody?',
          options: [
            'On weak beats (2 and 4)',
            'On strong beats (1 and 3)',
            'Between beats (offbeats)',
            'Only at the end of phrases'
          ],
          correctIndex: 1,
          explanation: 'Chord tones on strong beats (1 and 3) create stability and grounding. This is a fundamental principle of melody writing.'
        },
        {
          id: 'q4',
          type: 'multiple_choice',
          question: 'What is a suspension?',
          options: [
            'A note from the next chord played early',
            'A note held from the previous chord that resolves down',
            'The 5th of any chord',
            'Two chord tones played together'
          ],
          correctIndex: 1,
          explanation: 'A suspension is a note held over from the previous chord that creates tension and typically resolves down by step (like 4-3 or 9-8).'
        }
      ],
      passingScore: 3
    }
  }
];

export default intermediateLessons;
