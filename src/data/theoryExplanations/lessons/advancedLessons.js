/**
 * Advanced Learning Path
 *
 * These lessons cover sophisticated theory concepts
 * for users who want to master music theory.
 * Content is detailed and comprehensive - these aren't beginner concepts!
 *
 * LESSON ORDERING:
 * - Lessons are numbered automatically based on array position (see index.js)
 * - To reorder lessons, simply move them in this array
 * - IDs are semantic (no numbers) for stability when reordering
 */

export const advancedLessons = [
  // =====================================================
  // Introduction to Modes
  // =====================================================
  {
    id: 'lesson-modes-intro',
    path: 'advanced',
    title: 'Introduction to Modes',
    subtitle: 'Beyond major and minor - the seven church modes',
    estimatedTime: '15 min',
    icon: '🏛️',

    learn: {
      introduction: `You've been playing in major and minor keys. But what if I told you there are five MORE scales hiding inside every major scale? Welcome to the world of modes - one of the most powerful tools for creating distinct musical colors.

**What Are Modes?**
Modes are scales that use the same notes as a major scale but start on a different note. Each mode has its own unique character and emotional quality.

Think of it this way: The C major scale is C-D-E-F-G-A-B. What happens if you play those same notes but start and end on D instead? You get D Dorian - a mode with a completely different sound!

**The Seven Modes (using C major's notes):**

1. **Ionian (starts on 1st degree)** - C-D-E-F-G-A-B-C
   - This IS the major scale
   - Bright, happy, resolved
   - Formula: 1 2 3 4 5 6 7

2. **Dorian (starts on 2nd degree)** - D-E-F-G-A-B-C-D
   - Minor scale with a raised 6th
   - Jazzy, sophisticated, slightly sad but hopeful
   - Formula: 1 2 ♭3 4 5 6 ♭7
   - Used in: "So What" (Miles Davis), "Scarborough Fair"

3. **Phrygian (starts on 3rd degree)** - E-F-G-A-B-C-D-E
   - Minor scale with a lowered 2nd
   - Dark, Spanish/Flamenco, mysterious
   - Formula: 1 ♭2 ♭3 4 5 ♭6 ♭7
   - Used in: Flamenco music, metal, "White Rabbit" (Jefferson Airplane)

4. **Lydian (starts on 4th degree)** - F-G-A-B-C-D-E-F
   - Major scale with a raised 4th
   - Dreamy, floating, otherworldly, magical
   - Formula: 1 2 3 #4 5 6 7
   - Used in: "Flying in a Blue Dream" (Joe Satriani), The Simpsons theme

5. **Mixolydian (starts on 5th degree)** - G-A-B-C-D-E-F-G
   - Major scale with a lowered 7th
   - Bluesy, rock, dominant sound
   - Formula: 1 2 3 4 5 6 ♭7
   - Used in: "Sweet Home Alabama," "Norwegian Wood," most rock guitar solos

6. **Aeolian (starts on 6th degree)** - A-B-C-D-E-F-G-A
   - This IS natural minor
   - Sad, serious, dramatic
   - Formula: 1 2 ♭3 4 5 ♭6 ♭7

7. **Locrian (starts on 7th degree)** - B-C-D-E-F-G-A-B
   - Diminished sound, highly unstable
   - Dark, unsettled, rarely used as a key center
   - Formula: 1 ♭2 ♭3 4 ♭5 ♭6 ♭7
   - The diminished 5th makes it very unstable

**The Key to Understanding Modes: Characteristic Notes**

Each mode has one or two notes that define its character compared to major or minor:
- **Dorian:** The natural 6 (compared to minor's ♭6)
- **Phrygian:** The ♭2 (the "Spanish" interval)
- **Lydian:** The #4 (the "dreamy" note)
- **Mixolydian:** The ♭7 (the "bluesy" note)
- **Locrian:** The ♭5 (the "unstable" note)

**Parallel vs Derivative Approach:**

Two ways to think about modes:
1. **Derivative:** D Dorian uses C major's notes starting on D
2. **Parallel:** D Dorian is like D minor but with a raised 6th (B natural instead of B♭)

The parallel approach is more practical for actually using modes in music!`,

      keyPoints: [
        {
          title: 'Modes Are Rotations of the Major Scale',
          explanation: 'Each mode uses the same seven notes as its parent major scale, just starting on a different degree. C major contains all seven modes: C Ionian, D Dorian, E Phrygian, F Lydian, G Mixolydian, A Aeolian, B Locrian. They share notes but have completely different characters.',
          analogy: 'Like looking at the same room from different angles - same furniture, completely different perspective.'
        },
        {
          title: 'Characteristic Notes Define the Sound',
          explanation: 'Each mode has one or two notes that make it unique. Lydian\'s #4 creates its dreamy quality. Phrygian\'s ♭2 creates its Spanish darkness. When you emphasize these characteristic notes, the mode\'s personality comes through.',
          analogy: 'Like a person\'s most distinctive feature - it\'s what you notice and remember.'
        },
        {
          title: 'Major Modes vs Minor Modes',
          explanation: 'Modes with a major 3rd (Ionian, Lydian, Mixolydian) have a major quality. Modes with a minor 3rd (Dorian, Phrygian, Aeolian, Locrian) have a minor quality. Within each category, the other notes create different flavors.',
          analogy: 'Major vs minor is the main course. The other notes are the seasoning that makes each dish unique.'
        },
        {
          title: 'Dorian and Mixolydian Are the Most Useful',
          explanation: 'Dorian (minor with natural 6) is everywhere in jazz, funk, and rock. Mixolydian (major with ♭7) is the sound of blues and rock. These two modes are workhorses - learn them first and you\'ll use them constantly.',
          analogy: 'If modes were tools, Dorian and Mixolydian would be the hammer and screwdriver - you\'ll reach for them all the time.'
        }
      ],

      summary: 'Modes are seven scales derived from the major scale, each starting on a different degree. The most useful are: Dorian (minor with raised 6th - jazzy), Phrygian (minor with ♭2 - Spanish/dark), Lydian (major with #4 - dreamy), and Mixolydian (major with ♭7 - bluesy rock). Each mode has characteristic notes that define its sound. Understanding modes gives you seven distinct colors to paint with instead of just major and minor.'
    },

    hearIt: {
      title: 'Hear the character of each mode',
      examples: [
        {
          label: 'Ionian (Major) - Bright and happy',
          description: 'C-D-E-F-G-A-B-C. The standard major scale - resolved and complete.',
          playAction: { type: 'scale', root: 'C', scaleType: 'major' }
        },
        {
          label: 'Dorian - Jazzy minor',
          description: 'D-E-F-G-A-B-C-D. Minor but with a brighter 6th. The jazz minor sound.',
          playAction: { type: 'scale', root: 'D', scaleType: 'dorian' }
        },
        {
          label: 'Phrygian - Spanish darkness',
          description: 'E-F-G-A-B-C-D-E. That ♭2 (F) creates instant flamenco drama.',
          playAction: { type: 'scale', root: 'E', scaleType: 'phrygian' }
        },
        {
          label: 'Lydian - Dreamy floating',
          description: 'F-G-A-B-C-D-E-F. The #4 (B) lifts you off the ground.',
          playAction: { type: 'scale', root: 'F', scaleType: 'lydian' }
        },
        {
          label: 'Mixolydian - Rock/blues major',
          description: 'G-A-B-C-D-E-F-G. Major with ♭7 - the sound of rock guitar.',
          playAction: { type: 'scale', root: 'G', scaleType: 'mixolydian' }
        },
        {
          label: 'Aeolian (Natural Minor) - Serious and sad',
          description: 'A-B-C-D-E-F-G-A. The natural minor scale - dramatic and somber.',
          playAction: { type: 'scale', root: 'A', scaleType: 'minor' }
        },
        {
          label: 'Locrian - Unstable and dark',
          description: 'B-C-D-E-F-G-A-B. The ♭5 makes it almost unusable as a key center.',
          playAction: { type: 'scale', root: 'B', scaleType: 'locrian' }
        }
      ],
      famousSongs: [
        '"So What" (Miles Davis) - D Dorian throughout, defining modal jazz',
        '"Scarborough Fair" - Dorian mode gives it that ancient, folk quality',
        '"White Rabbit" (Jefferson Airplane) - Phrygian creates the psychedelic darkness',
        '"The Simpsons Theme" (Danny Elfman) - Lydian creates the quirky, floating feel',
        '"Sweet Home Alabama" (Lynyrd Skynyrd) - D Mixolydian gives it that southern rock sound',
        '"Norwegian Wood" (Beatles) - Mixolydian mode with folk influence',
        '"Cliffs of Dover" (Eric Johnson) - Masterful use of Lydian mode'
      ]
    },

    // Try It is a guided exercise
    tryIt: null,

    experiment: {
      title: 'Explore modal colors',
      prompt: 'Build progressions that stay in one mode to hear its character:',
      challenges: [
        {
          label: 'Dorian vamp: Dm7 - G7 (stay on Dm)',
          hint: 'Don\'t resolve to C! The Dm is your home. This is "So What" territory.',
          solution: { progression: ['Dm7', 'G7', 'Dm7', 'G7'] }
        },
        {
          label: 'Lydian shimmer: Fmaj7 - G - Fmaj7',
          hint: 'The G chord contains B (the #4 of F). Pure Lydian magic.',
          solution: { progression: ['Fmaj7', 'G', 'Fmaj7', 'G'] }
        },
        {
          label: 'Mixolydian rock: G - F - C - G',
          hint: 'G is home, F is the ♭VII. Classic rock mode.',
          solution: { progression: ['G', 'F', 'C', 'G'] }
        },
        {
          label: 'Phrygian drama: Em - F - Em',
          hint: 'The F chord (♭II) defines the Phrygian sound.',
          solution: { progression: ['Em', 'F', 'Em', 'F'] }
        }
      ],
      freePlay: {
        prompt: 'Pick a mode and try to write a 4-chord progression that stays in that mode. Hint: Avoid chords that would make it sound like regular major or minor!',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Modes Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'What makes Dorian different from natural minor?',
          options: [
            'A raised 7th',
            'A raised 6th',
            'A lowered 2nd',
            'A raised 4th'
          ],
          correctIndex: 1,
          explanation: 'Dorian has a natural 6th (raised compared to natural minor\'s ♭6). This gives it a brighter, jazzier quality while still being minor.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'Which mode is often used in flamenco and Spanish music?',
          options: ['Lydian', 'Mixolydian', 'Phrygian', 'Dorian'],
          correctIndex: 2,
          explanation: 'Phrygian mode, with its ♭2, creates the distinctive Spanish/flamenco sound. The half-step between 1 and ♭2 is very dramatic.'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'What\'s the characteristic note of Lydian mode?',
          options: ['♭7', '♭2', '#4', '♭6'],
          correctIndex: 2,
          explanation: 'Lydian has a raised 4th (#4), which creates its dreamy, floating quality. It\'s the "brightest" of all the modes.'
        },
        {
          id: 'q4',
          type: 'multiple_choice',
          question: 'If you play C major scale notes but start and end on G, what mode is it?',
          options: ['G Ionian', 'G Dorian', 'G Mixolydian', 'G Lydian'],
          correctIndex: 2,
          explanation: 'Starting on the 5th degree of the major scale gives you Mixolydian. G Mixolydian uses C major\'s notes but treats G as home.'
        }
      ],
      passingScore: 3
    }
  },

  // =====================================================
  // Modal Harmony
  // =====================================================
  {
    id: 'lesson-modal-harmony',
    path: 'advanced',
    title: 'Modal Harmony',
    subtitle: 'Building progressions that stay in mode',
    estimatedTime: '14 min',
    icon: '🌈',

    learn: {
      introduction: `Knowing the modes is one thing. Writing progressions that actually STAY in a mode is another challenge entirely. Let's learn the art of modal harmony - creating progressions that maintain modal color without slipping back into regular major/minor tonality.

**The Challenge of Modal Harmony:**

Your ears are trained to hear major and minor. The moment you play certain chord progressions (like V-I), your brain says "we're in a key!" and the modal color disappears. Modal harmony requires avoiding these tonal "gravity wells."

**The Three Rules of Modal Harmony:**

**Rule 1: Avoid the Tritone Resolution**
The V-I (or V7-I) cadence is so strong it destroys modal feeling. In modal harmony:
- Avoid dominant 7th chords resolving to the tonic
- Use other chords to create movement instead
- The ♭VII chord is your best friend (it moves to I without dominant function)

**Rule 2: Emphasize the Characteristic Chord**
Each mode has a chord built on its characteristic note that defines its sound:
- **Dorian:** IV major (has the natural 6th)
- **Phrygian:** ♭II major (has the ♭2)
- **Lydian:** II major (has the #4)
- **Mixolydian:** ♭VII major (has the ♭7)

Using these chords reinforces the modal color.

**Rule 3: Use Pedal Points and Drones**
Holding the root note while other chords move above it keeps the mode anchored:
- A bass pedal on the tonic reinforces "home"
- Chords move over the pedal without creating strong resolutions
- Very effective for Dorian and Mixolydian vamps

**Modal Chord Qualities:**

Each mode produces different chord types when you harmonize it:

**Dorian (minor tonic):**
- i - ii - ♭III - IV - v - vi° - ♭VII
- Key chords: i (minor), IV (major!), ♭VII (major)
- The major IV is Dorian's signature - it has the natural 6th

**Phrygian (minor tonic):**
- i - ♭II - ♭III - iv - v° - ♭VI - ♭VII
- Key chord: ♭II (major) - the Phrygian chord!
- Very dark, with that half-step from ♭II to i

**Lydian (major tonic):**
- I - II - iii - #iv° - V - vi - vii
- Key chord: II (major) - contains the #4
- Very bright and floating

**Mixolydian (major tonic):**
- I - ii - iii° - IV - v - vi - ♭VII
- Key chord: ♭VII (major) - the blues/rock sound
- Also v is minor (not major like in major key)

**Common Modal Progressions:**

- **Dorian:** i - IV - i - IV, i - ♭VII - IV - i
- **Phrygian:** i - ♭II - i, i - ♭VII - ♭VI - ♭VII - i
- **Lydian:** I - II - I, I - II - vii - I
- **Mixolydian:** I - ♭VII - IV - I, I - IV - ♭VII - IV - I`,

      keyPoints: [
        {
          title: 'Avoid V-I Cadences',
          explanation: 'The V-I cadence is the strongest sound in tonal music. It immediately makes your ear hear "major key" or "minor key." In modal harmony, use ♭VII-I, IV-I, or ♭II-i instead. These move to the tonic without destroying the modal color.',
          analogy: 'V-I is like a neon sign saying "HOME!" Modal cadences are more like a gentle "you\'re here" without the announcement.'
        },
        {
          title: 'The Characteristic Chord is Your Secret Weapon',
          explanation: 'Each mode has one chord that contains its defining note. Dorian\'s major IV chord contains the natural 6th. Lydian\'s II major contains the #4. When you play this chord, the mode becomes unmistakable. Use it often!',
          analogy: 'It\'s like wearing a team jersey - one look and everyone knows which side you\'re on.'
        },
        {
          title: 'Vamps Work Better Than Progressions',
          explanation: 'Modal music often works best with short, repeating patterns (vamps) rather than long, developing progressions. i-IV in Dorian, I-♭VII in Mixolydian - these two-chord vamps can sustain entire songs while clearly establishing the mode.',
          analogy: 'Like a mantra or meditation - repetition creates the space for the mode to be felt deeply.'
        },
        {
          title: 'Pedal Tones Anchor the Mode',
          explanation: 'A sustained bass note (pedal point) keeps the tonic grounded while chords move above. This prevents your ear from reinterpreting the harmony as a different key. Many modal jazz tunes use bass pedals extensively.',
          analogy: 'The pedal tone is like an anchor - the boat can move around, but it stays in one spot.'
        }
      ],

      summary: 'Modal harmony requires avoiding tonal cadences (especially V-I) that would destroy the modal color. Use the characteristic chord of each mode (Dorian\'s IV, Lydian\'s II, Mixolydian\'s ♭VII, Phrygian\'s ♭II) to reinforce the modal sound. Short vamps and pedal tones work better than complex progressions. The goal is to make the tonic feel like home without using traditional key-based resolution.'
    },

    hearIt: {
      title: 'Hear modal progressions',
      examples: [
        {
          label: 'Dorian vamp: Dm7 - G7',
          description: 'The classic jazz Dorian vamp. G7 is the IV7 of D Dorian (not the V7!).',
          playAction: { type: 'progression', chords: ['Dm7', 'G7', 'Dm7', 'G7'] }
        },
        {
          label: 'Dorian i-IV-VII: Dm - G - C - Dm',
          description: 'All three chords reinforce D Dorian. The G is major (has B natural - the raised 6th).',
          playAction: { type: 'progression', chords: ['Dm', 'G', 'C', 'Dm'] }
        },
        {
          label: 'Phrygian: Em - F - Em',
          description: 'The ♭II (F) creates that dark, Spanish sound. Instant flamenco!',
          playAction: { type: 'progression', chords: ['Em', 'F', 'Em', 'F'] }
        },
        {
          label: 'Lydian: Fmaj7 - G - Am - G',
          description: 'The G chord contains B (F\'s #4). Dreamy and floating.',
          playAction: { type: 'progression', chords: ['Fmaj7', 'G', 'Am', 'G'] }
        },
        {
          label: 'Mixolydian: G - F - C - G',
          description: 'G with ♭VII (F). This is the sound of 70s rock!',
          playAction: { type: 'progression', chords: ['G', 'F', 'C', 'G'] }
        },
        {
          label: 'Mixolydian rock: D - C - G - D',
          description: 'D Mixolydian - the ♭VII (C) keeps it from feeling like D major.',
          playAction: { type: 'progression', chords: ['D', 'C', 'G', 'D'] }
        }
      ],
      famousSongs: [
        '"So What" (Miles Davis) - Pure Dorian, just two chords for 8 minutes',
        '"Oye Como Va" (Santana) - A Dorian vamp with Latin rhythm',
        '"Impressions" (John Coltrane) - Another Dorian masterpiece',
        '"Sweet Home Alabama" (Lynyrd Skynyrd) - D Mixolydian with that ♭VII',
        '"Ramblin\' Man" (Allman Brothers) - Mixolydian country rock',
        '"Get Lucky" (Daft Punk) - B Dorian disco groove'
      ]
    },

    // Try It is a guided exercise
    tryIt: null,

    experiment: {
      title: 'Create modal progressions',
      prompt: 'Build progressions that clearly establish a mode:',
      challenges: [
        {
          label: 'Dorian groove: Am - D - Am - D',
          hint: 'A Dorian - D major contains F# (the natural 6th). Vamp on it!',
          solution: { progression: ['Am', 'D', 'Am', 'D'] }
        },
        {
          label: 'Lydian dream: Cmaj7 - D - Em - D',
          hint: 'C Lydian - D major has the F# (#4 of C). Float away!',
          solution: { progression: ['Cmaj7', 'D', 'Em', 'D'] }
        },
        {
          label: 'Mixolydian blues: A - G - D - A',
          hint: 'A Mixolydian - G is the ♭VII. Southern rock sound!',
          solution: { progression: ['A', 'G', 'D', 'A'] }
        },
        {
          label: 'Phrygian darkness: Bm - C - Bm - C',
          hint: 'B Phrygian - C major is the ♭II. Mysterious and dark.',
          solution: { progression: ['Bm', 'C', 'Bm', 'C'] }
        }
      ],
      freePlay: {
        prompt: 'Try building a 4-chord modal progression that avoids V-I. Use the characteristic chord to reinforce your chosen mode!',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Modal Harmony Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'Why should you avoid V-I cadences in modal harmony?',
          options: [
            'They sound bad',
            'They\'re too quiet',
            'They destroy the modal color by implying a major/minor key',
            'They\'re too difficult to play'
          ],
          correctIndex: 2,
          explanation: 'The V-I cadence is so strongly associated with major/minor keys that it overrides the modal sound. Modal harmony uses other cadences (like ♭VII-I) instead.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'What is the characteristic chord of Dorian mode?',
          options: [
            'Minor i chord',
            'Major IV chord',
            '♭II major chord',
            'Diminished vii chord'
          ],
          correctIndex: 1,
          explanation: 'Dorian\'s characteristic chord is the major IV. Unlike natural minor, Dorian has a natural 6th, which makes the IV chord major instead of minor.'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'What chord defines Mixolydian mode?',
          options: ['V7', '♭VII', 'ii', 'IV'],
          correctIndex: 1,
          explanation: 'The ♭VII chord is Mixolydian\'s signature. It contains the ♭7 that makes Mixolydian different from major. It\'s the "rock" chord.'
        },
        {
          id: 'q4',
          type: 'audio_identify',
          question: 'What mode is this progression in?',
          playAction: { type: 'progression', chords: ['Am', 'D', 'Am', 'D'] },
          options: ['A Aeolian (natural minor)', 'A Dorian', 'A Phrygian', 'A major'],
          correctIndex: 1,
          explanation: 'The D major chord contains F# - the natural 6th of A. In A natural minor, this chord would be D minor. The major IV means this is A Dorian!'
        }
      ],
      passingScore: 3
    }
  },

  // =====================================================
  // Advanced Voice Leading
  // =====================================================
  {
    id: 'lesson-advanced-voice-leading',
    path: 'advanced',
    title: 'Advanced Voice Leading',
    subtitle: 'Counterpoint, guide tones, and independent voices',
    estimatedTime: '16 min',
    icon: '🎻',

    learn: {
      introduction: `You've learned basic voice leading - keeping common tones and moving smoothly. Now let's go deeper into the art that Bach spent his life perfecting: making each voice in your chords sing its own melody while working together in harmony.

**From Chords to Voices:**

Stop thinking of chords as blocks of sound. Each note in a chord is a "voice" that can move independently:
- Soprano (top voice) - Usually carries the melody
- Alto (second from top) - Inner voice, supports soprano
- Tenor (second from bottom) - Inner voice, supports bass
- Bass (bottom voice) - Foundation, often root movement

**The Four Types of Voice Motion:**

When two voices move, they relate in one of four ways:

1. **Parallel Motion** - Both voices move in the same direction by the same interval
   - Example: C→D and E→F (both up by step)
   - Sounds unified but can be weak if overused
   - Avoid parallel 5ths and octaves in classical style

2. **Similar Motion** - Both voices move in the same direction by different intervals
   - Example: C→E and G→B (both up, but different intervals)
   - Smooth and natural

3. **Contrary Motion** - Voices move in opposite directions
   - Example: C→E and G→F (one up, one down)
   - Creates independence and strength - the gold standard!

4. **Oblique Motion** - One voice stays, the other moves
   - Example: C→C and E→F (one static, one moving)
   - Great for pedal tones and suspensions

**Guide Tones: The Soul of Voice Leading**

Guide tones are the 3rd and 7th of each chord - the notes that define the chord's character. Great voice leading connects guide tones smoothly:

In Dm7 - G7 - Cmaj7:
- Dm7: 3rd=F, 7th=C
- G7: 3rd=B, 7th=F (C moves to B, F stays!)
- Cmaj7: 3rd=E, 7th=B (B stays, F moves to E!)

The guide tones move by step or stay the same. This is why ii-V-I sounds so smooth!

**Voice Leading Rules (and When to Break Them):**

Classical rules exist for good reasons:
- **Avoid parallel 5ths and octaves** - They sound hollow and destroy independence
- **Resolve tendency tones** - 7ths resolve down, leading tones resolve up
- **Avoid voice crossing** - Keep soprano above alto above tenor above bass
- **Avoid large leaps** - Move by step when possible, or balance leaps with steps

But modern music breaks these rules creatively:
- Parallel 5ths can sound powerful (rock power chords!)
- Unresolved 7ths create tension
- Voice crossing creates interesting textures

**Counterpoint: Voices as Melodies**

True counterpoint means each voice is a melody that could stand alone:
- Bass isn't just roots - it's a bass LINE
- Inner voices aren't just filler - they have shape
- When all voices are interesting, the whole is magical

Bach's chorales are the ultimate study - four voices, each singable, combining perfectly.`,

      keyPoints: [
        {
          title: 'Contrary Motion Creates Independence',
          explanation: 'When voices move in opposite directions, each maintains its own identity. This is why the strongest voice leading features contrary motion between bass and soprano. It creates the sense of multiple melodies working together.',
          analogy: 'Like two dancers moving past each other - each has their own path, but they\'re clearly partnered.'
        },
        {
          title: 'Guide Tones Are Your Map',
          explanation: 'The 3rd and 7th of each chord are the guide tones - they define whether a chord is major/minor and add tension (7ths). Following guide tone movement gives you a roadmap for smooth voice leading. When guide tones move by step or stay the same, everything sounds connected.',
          analogy: 'Guide tones are like the plot points of a story - connect them smoothly and the narrative flows.'
        },
        {
          title: 'Parallel 5ths and Octaves Sound Hollow',
          explanation: 'In classical voice leading, consecutive 5ths (C-G to D-A) and octaves (C-C to D-D) are avoided because they make voices lose independence - they merge into one. Rock music embraces this (power chords are parallel 5ths!), but in complex harmony, it\'s usually avoided.',
          analogy: 'Parallel motion is like two people saying the exact same thing - you only hear one opinion.'
        },
        {
          title: 'The Bass Line is a Melody Too',
          explanation: 'Great bass lines don\'t just play roots. They move stepwise, use passing tones, and have contour. A walking bass line in jazz or a Bach bass part is as melodic as the soprano. When your bass sings, your whole progression comes alive.',
          analogy: 'The bass is like the foundation of a building - it should be solid AND beautiful.'
        }
      ],

      summary: 'Advanced voice leading treats each chord tone as an independent voice that moves melodically. The four types of motion (parallel, similar, contrary, oblique) create different effects - contrary motion is strongest. Guide tones (3rds and 7ths) moving by step create smooth progressions. Classical rules (avoid parallel 5ths, resolve tendencies) serve independence; modern music breaks them intentionally. The goal is for every voice to be singable while the whole sounds unified.'
    },

    hearIt: {
      title: 'Hear voice leading principles',
      examples: [
        {
          label: 'Guide tone connection: Dm7 - G7 - Cmaj7',
          description: 'Listen for the smooth guide tone movement: F→F→E and C→B→B.',
          playAction: { type: 'progression', chords: ['Dm7', 'G7', 'Cmaj7'] }
        },
        {
          label: 'Bad voice leading: C - G - Am - F (all root position)',
          description: 'Voices jump around a lot. Compare to the voice-led version.',
          playAction: { type: 'progression', chords: ['C', 'G', 'Am', 'F'] }
        },
        {
          label: 'Good voice leading: C - G/B - Am - F',
          description: 'The bass walks: C - B - A - F. Much smoother!',
          playAction: { type: 'progression', chords: ['C', 'G/B', 'Am', 'F'] }
        },
        {
          label: 'Contrary motion: Bass down, soprano up',
          description: 'C - F/A - G/B - C with bass moving C-A-B-C while melody moves G-A-B-C.',
          playAction: { type: 'progression', chords: ['C', 'F', 'G', 'C'] }
        },
        {
          label: 'Suspension resolution: Gsus4 - G',
          description: 'The 4th (C) resolves to 3rd (B). Classic voice leading ornament.',
          playAction: { type: 'progression', chords: ['Gsus4', 'G'] }
        },
        {
          label: 'Walking bass: Cmaj7 - Dm7/C - Em7/B - Am7',
          description: 'Bass line walks: C - C - B - A. Each note connects smoothly.',
          playAction: { type: 'progression', chords: ['Cmaj7', 'Dm7', 'Em7', 'Am7'] }
        }
      ],
      famousSongs: [
        '"Whiter Shade of Pale" (Procol Harum) - Bach-inspired descending bass with voice leading',
        '"A Day in the Life" (Beatles) - Complex voice leading in the orchestral sections',
        '"Stairway to Heaven" (Led Zeppelin) - The intro has beautiful chromatic voice leading',
        'Any Bach Chorale - The gold standard of four-voice voice leading',
        '"Giant Steps" (John Coltrane) - Complex guide tone movement at high speed',
        '"Autumn Leaves" - Standard tune used to teach guide tone voice leading'
      ]
    },

    // Try It is a guided exercise
    tryIt: null,

    experiment: {
      title: 'Practice voice leading techniques',
      prompt: 'Build progressions focusing on smooth voice connections:',
      challenges: [
        {
          label: 'Walking bass: C - Am - Dm - G with bass line C-C-D-D',
          hint: 'Use inversions to create stepwise bass movement',
          solution: { progression: ['C', 'Am', 'Dm', 'G'] }
        },
        {
          label: 'Guide tones: Am7 - D7 - Gmaj7',
          hint: 'Track the 3rds and 7ths - they should move smoothly!',
          solution: { progression: ['Am7', 'D7', 'Gmaj7'] }
        },
        {
          label: 'Contrary motion: F - G/B - C',
          hint: 'Bass moves F - B - C (up), try melody moving down',
          solution: { progression: ['F', 'G', 'C'] }
        }
      ],
      freePlay: {
        prompt: 'Take a progression you know and reharmonize it with inversions to create smooth voice leading. Focus on making the bass line singable!',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Advanced Voice Leading Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'What are "guide tones"?',
          options: [
            'The root and 5th of each chord',
            'The 3rd and 7th of each chord',
            'The melody notes',
            'The bass notes'
          ],
          correctIndex: 1,
          explanation: 'Guide tones are the 3rd and 7th of each chord - the notes that define the chord\'s quality and tension. Smooth guide tone movement creates smooth progressions.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'Which type of voice motion creates the strongest sense of independence?',
          options: [
            'Parallel motion',
            'Similar motion',
            'Contrary motion',
            'No motion'
          ],
          correctIndex: 2,
          explanation: 'Contrary motion (voices moving in opposite directions) creates the strongest independence. Each voice maintains its own identity.'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'Why are parallel 5ths traditionally avoided?',
          options: [
            'They\'re too loud',
            'They make voices lose independence and sound hollow',
            'They\'re too difficult to play',
            'They create dissonance'
          ],
          correctIndex: 1,
          explanation: 'Parallel 5ths make voices merge into one sound, destroying the sense of independent melodic lines. In classical voice leading, each voice should maintain its identity.'
        },
        {
          id: 'q4',
          type: 'multiple_choice',
          question: 'In Dm7 - G7 - Cmaj7, what happens to the guide tones?',
          options: [
            'They all stay the same',
            'They all jump by large intervals',
            'The 7ths move by half-step while 3rds move by step',
            'They move randomly'
          ],
          correctIndex: 2,
          explanation: 'In ii-V-I: the 7th of Dm7 (C) moves to 3rd of G7 (B), then stays as 7th of Cmaj7. The 3rd of Dm7 (F) stays as 7th of G7, then moves to 3rd of Cmaj7 (E). Very smooth!'
        }
      ],
      passingScore: 3
    }
  },

  // =====================================================
  // Extended Chords
  // =====================================================
  {
    id: 'lesson-extended-chords',
    path: 'advanced',
    title: 'Extended Chords',
    subtitle: '9ths, 11ths, and 13ths - the colors of jazz',
    estimatedTime: '15 min',
    icon: '🎷',

    learn: {
      introduction: `You've mastered triads (3 notes) and 7th chords (4 notes). Now let's stack even more thirds to create the rich, complex harmonies of jazz: 9th, 11th, and 13th chords.

**How Extended Chords Are Built:**

Chords are built by stacking thirds. Keep stacking:
- Triad: 1 - 3 - 5 (3 notes)
- 7th: 1 - 3 - 5 - 7 (4 notes)
- 9th: 1 - 3 - 5 - 7 - 9 (5 notes)
- 11th: 1 - 3 - 5 - 7 - 9 - 11 (6 notes)
- 13th: 1 - 3 - 5 - 7 - 9 - 11 - 13 (7 notes - every note of the scale!)

**The 9th Chord (1-3-5-7-9):**

The 9th adds sweetness and sophistication to 7th chords:

- **Dominant 9 (C9):** C-E-G-B♭-D
  - Bluesy, soulful, rich
  - The D adds warmth without changing the dominant function
  - Used everywhere in jazz, R&B, funk

- **Major 9 (Cmaj9):** C-E-G-B-D
  - Dreamy, lush, sophisticated
  - The 9th floats beautifully over the major 7th
  - Perfect for endings and peaceful moments

- **Minor 9 (Cm9):** C-E♭-G-B♭-D
  - Smooth, modern, emotional
  - The 9th softens the minor quality
  - Very common in R&B and neo-soul

**Altered 9ths:**
- ♭9: Dark, tense (C7♭9 = C-E-G-B♭-D♭)
- #9: The "Hendrix chord" - gritty, bluesy (C7#9 = C-E-G-B♭-D#)

**The 11th Chord (1-3-5-7-9-11):**

The 11th is tricky - it clashes with the 3rd on major and dominant chords:

- **Minor 11 (Cm11):** C-E♭-G-B♭-D-F
  - Works beautifully - the 11th (F) fits perfectly
  - Very common in jazz and fusion

- **Dominant 11 (C11):** Usually omits the 3rd!
  - The F clashes with E, so most "11" chords become "sus4"
  - C11 often played as C-G-B♭-D-F (no E)

- **Sharp 11 (#11):** The Lydian sound
  - Cmaj7#11 = C-E-G-B-F#
  - The F# (enharmonic #11) creates beautiful Lydian color
  - Very sophisticated, used in modern jazz

**The 13th Chord (1-3-5-7-9-11-13):**

The ultimate extended chord - contains all seven notes of the scale:

- **Dominant 13 (C13):** C-E-G-B♭-D-F-A
  - Often simplified to C-E-B♭-D-A (omitting 5th and 11th)
  - Rich, full, jazzy
  - The 13th (A) adds warmth to the dominant

- **Minor 13 (Cm13):** Rare, but beautiful
  - Very dense and modern sounding

**Practical Voicings:**

You can't play all 7 notes! Typical voicings omit:
- The root (bass player has it)
- The 5th (least important)
- The 11th on dominant chords (clashes with 3rd)

Common jazz voicings:
- 9th chords: 1-3-7-9 or 1-7-9-3
- 13th chords: 1-3-7-9-13 or 3-7-9-13

**The Rule of Upper Structures:**
Extensions become more colorful as you go higher:
- 9th adds warmth
- 11th adds suspension/tension
- 13th adds soulfulness

The higher you stack, the more "jazz" you get!`,

      keyPoints: [
        {
          title: '9ths Are the Gateway to Jazz',
          explanation: 'The 9th chord is where jazz begins. Adding the 9th (2nd) to a 7th chord creates immediate sophistication without complexity. Cmaj9, C9, and Cm9 are essential vocabulary for any jazz or R&B player.',
          analogy: 'If 7th chords are coffee, 9th chords are a latte - same base, but richer and smoother.'
        },
        {
          title: 'The 11th Problem',
          explanation: 'On major and dominant chords, the 11th (4th) clashes terribly with the 3rd - they\'re only a half-step apart. Solutions: omit the 3rd (creating a "sus" sound), or raise the 11th to #11 (creating Lydian color). Minor 11ths work perfectly because the ♭3 is far enough from the 11th.',
          analogy: 'The 11th and 3rd are like two people trying to sit in the same chair - one has to move.'
        },
        {
          title: 'The #11 is Lydian Magic',
          explanation: 'Raising the 11th to #11 eliminates the clash and creates beautiful Lydian color. Cmaj7#11 is a favorite modern jazz sound - dreamy, floating, and sophisticated. It\'s like adding Lydian mode to your chord.',
          analogy: 'The #11 is like opening a window in a closed room - suddenly there\'s light and air.'
        },
        {
          title: 'You Don\'t Play Every Note',
          explanation: 'Extended chords contain 5, 6, or 7 notes, but you rarely play them all. Common omissions: the root (bass covers it), the 5th (it doesn\'t define the chord), and the 11th on dominant chords (clash). What\'s left is a compact voicing that implies the full chord.',
          analogy: 'Like a sketch vs a painting - a few well-chosen lines suggest the whole picture.'
        }
      ],

      summary: 'Extended chords stack more thirds on top of 7th chords: 9ths add warmth, 11ths add suspension (but clash on major chords - use #11 instead), and 13ths add soulfulness. Dominant 9 and 13 chords are jazz essentials; minor 9 and 11 work beautifully; major 9 and maj7#11 are sophisticated colors. In practice, omit the root and 5th to create playable voicings. Extended chords are the harmonic vocabulary of jazz, R&B, and modern pop.'
    },

    hearIt: {
      title: 'Hear extended chord colors',
      examples: [
        {
          label: 'Cmaj9 - Dreamy major',
          description: 'The 9th (D) floats over the major 7th. Lush and sophisticated.',
          playAction: { type: 'chord', root: 'C', chordType: 'major9' }
        },
        {
          label: 'C9 - Soulful dominant',
          description: 'Dominant 7th plus 9th. The sound of R&B and blues.',
          playAction: { type: 'chord', root: 'C', chordType: 'dominant9' }
        },
        {
          label: 'Cm9 - Smooth minor',
          description: 'Minor 7th plus 9th. Modern, cool, emotional.',
          playAction: { type: 'chord', root: 'C', chordType: 'minor9' }
        },
        {
          label: 'C7#9 - The Hendrix chord',
          description: 'That gritty, bluesy sound. E7#9 is "Purple Haze."',
          playAction: { type: 'chord', root: 'C', chordType: 'dominant7sharp9' }
        },
        {
          label: 'Cm11 - Jazz minor',
          description: 'The 11th adds suspension to the minor sound. Very modern.',
          playAction: { type: 'chord', root: 'C', chordType: 'minor11' }
        },
        {
          label: 'Cmaj7#11 - Lydian color',
          description: 'The #11 creates that floating, dreamy Lydian quality.',
          playAction: { type: 'chord', root: 'C', chordType: 'major7sharp11' }
        },
        {
          label: 'C13 - Full jazz dominant',
          description: 'Rich and warm. The 13th adds soul to the dominant.',
          playAction: { type: 'chord', root: 'C', chordType: 'dominant13' }
        },
        {
          label: 'Extended ii-V-I: Dm9 - G13 - Cmaj9',
          description: 'The classic jazz progression with extended colors.',
          playAction: { type: 'progression', chords: ['Dm9', 'G13', 'Cmaj9'] }
        }
      ],
      famousSongs: [
        '"Purple Haze" (Jimi Hendrix) - The E7#9 "Hendrix chord" is iconic',
        '"Black Cow" (Steely Dan) - Rich extended harmonies throughout',
        '"Sir Duke" (Stevie Wonder) - 9th chords create the warm soul sound',
        '"Just the Two of Us" (Bill Withers/Grover Washington) - Cmaj9 in the intro',
        '"Dolphin Dance" (Herbie Hancock) - Extended chords everywhere',
        '"Stella by Starlight" (jazz standard) - Classic use of extensions'
      ]
    },

    // Try It is a guided exercise
    tryIt: null,

    experiment: {
      title: 'Explore extended chord colors',
      prompt: 'Upgrade your progressions with extended harmonies:',
      challenges: [
        {
          label: 'Soul ii-V-I: Dm9 - G13 - Cmaj9',
          hint: 'Add 9ths and 13ths to the classic progression',
          solution: { progression: ['Dm9', 'G13', 'Cmaj9'] }
        },
        {
          label: 'Neo-soul: Fm9 - Bb13 - Ebmaj9 - Abmaj9',
          hint: 'Minor 9 to dominant 13 to major 9 - smooth!',
          solution: { progression: ['Fm9', 'Bb13', 'Ebmaj9', 'Abmaj9'] }
        },
        {
          label: 'Lydian colors: Cmaj7#11 - Dm9 - Em7 - Fmaj7#11',
          hint: 'Use #11 for Lydian flavor on the major chords',
          solution: { progression: ['Cmaj7#11', 'Dm9', 'Em7', 'Fmaj7#11'] }
        },
        {
          label: 'Hendrix style: E7#9 - A9 - E7#9 - B9',
          hint: 'The #9 creates that gritty rock-blues sound',
          solution: { progression: ['E7#9', 'A9', 'E7#9', 'B9'] }
        }
      ],
      freePlay: {
        prompt: 'Take a simple I-vi-ii-V progression and add extensions to every chord. Try different combinations of 9ths, 11ths, and 13ths to find your favorite sounds!',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Extended Chords Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'What notes are in a Cmaj9 chord?',
          options: [
            'C - E - G - B♭ - D',
            'C - E - G - B - D',
            'C - E♭ - G - B♭ - D',
            'C - E - G - D'
          ],
          correctIndex: 1,
          explanation: 'Cmaj9 = C (root) - E (3rd) - G (5th) - B (major 7th) - D (9th). The major 7th is B natural, not B♭.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'Why does the 11th clash with the 3rd on dominant chords?',
          options: [
            'They\'re the same note',
            'They\'re only a half-step apart',
            'They\'re an octave apart',
            'They\'re both sharps'
          ],
          correctIndex: 1,
          explanation: 'On C7, the 3rd is E and the 11th is F - only a half-step apart. This minor 2nd creates a harsh clash. Use #11 (F#) instead!'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'What is the "Hendrix chord"?',
          options: [
            'Major 7th',
            'Dominant 7#9',
            'Minor 9th',
            'Diminished 7th'
          ],
          correctIndex: 1,
          explanation: 'The 7#9 chord (like E7#9 in "Purple Haze") is called the Hendrix chord. The #9 (G in E7#9) creates that gritty, bluesy sound.'
        },
        {
          id: 'q4',
          type: 'multiple_choice',
          question: 'What note is often omitted in extended chord voicings?',
          options: [
            'The root',
            'The 3rd',
            'The 5th',
            'Both root and 5th'
          ],
          correctIndex: 3,
          explanation: 'Both the root (covered by the bass) and the 5th (least important for chord quality) are commonly omitted to create more compact, playable voicings.'
        }
      ],
      passingScore: 3
    }
  },

  // =====================================================
  // Counterpoint Fundamentals
  // =====================================================
  {
    id: 'lesson-counterpoint',
    path: 'advanced',
    title: 'Counterpoint Fundamentals',
    subtitle: 'The art of combining independent melodic lines',
    estimatedTime: '18 min',
    icon: '🎼',

    learn: {
      introduction: `Counterpoint is one of the oldest and most sophisticated techniques in music - the art of combining multiple independent melodies that work together harmonically. Bach was the master, but these principles appear everywhere from fugues to rock guitar harmonies.

**What is Counterpoint?**

Counterpoint (from Latin "punctus contra punctum" - point against point, or note against note) is the technique of combining two or more independent melodic lines. Unlike homophonic music (melody + accompaniment), in counterpoint, EVERY voice is a melody.

**Why Study Counterpoint?**

Even if you never write a fugue, counterpoint skills will:
- Make your bass lines more interesting (they become melodies!)
- Create better inner voice movement in your arrangements
- Help you understand why certain progressions sound "good" or "wrong"
- Improve your ear for voice independence

**The Species of Counterpoint:**

Historically, counterpoint was taught in five "species" of increasing complexity:

**First Species (1:1)** - Note against note
- One note in the counterpoint for each note in the cantus firmus (fixed melody)
- Only consonances on strong beats
- No parallel 5ths or octaves
- Movement should be mostly stepwise with occasional leaps

**Second Species (2:1)** - Two notes against one
- Two notes in counterpoint for each note in cantus firmus
- Allows passing dissonances on weak beats
- Dissonances must resolve by step

**Third Species (4:1)** - Four notes against one
- More freedom for passing tones and neighbor tones
- Creates flowing, decorative lines

**Fourth Species** - Suspensions
- The counterpoint is offset, creating suspensions
- Dissonance on strong beat resolves to consonance
- The "sigh" of 4-3 and 7-6 suspensions

**Fifth Species (Florid)** - Free counterpoint
- Combines all previous species
- Maximum melodic freedom

**The Fundamental Rules:**

1. **Avoid Parallel 5ths and Octaves**
   - Two voices moving to a 5th from a 5th (G-D to A-E)
   - Two voices moving to an octave from an octave
   - These intervals are so pure they destroy independence

2. **Use Contrary Motion**
   - When one voice goes up, the other goes down
   - Creates the strongest independence

3. **Balance Steps and Leaps**
   - Melodic lines should be mostly stepwise
   - If you leap, follow with a step in the opposite direction
   - Avoid consecutive leaps in the same direction

4. **Resolve Dissonances**
   - Dissonances (2nds, 7ths, tritone) must resolve by step
   - Usually resolve down to a consonance

5. **Avoid Voice Crossing**
   - Keep soprano above alto, alto above tenor, etc.
   - Crossing destroys the sense of independent lines

**Consonant vs Dissonant Intervals:**

**Perfect Consonances** (strong, stable):
- Unison, Perfect 5th, Octave
- Use on strong beats

**Imperfect Consonances** (warm, preferred):
- Major/Minor 3rds, Major/Minor 6ths
- The workhorses of counterpoint

**Dissonances** (tension, need resolution):
- 2nds, 7ths, Tritone
- Only on weak beats (in early species)
- Must resolve by step`,

      keyPoints: [
        {
          title: 'Each Voice Must Be a Melody',
          explanation: 'In true counterpoint, if you isolated any single voice, it would make sense as a melody on its own. The bass isn\'t just roots, the tenor isn\'t just filler - each line has direction, shape, and musical meaning. This is what makes Bach\'s music so rich.',
          analogy: 'Like a conversation where everyone has something interesting to say, not just one person talking while others nod.'
        },
        {
          title: 'Parallel 5ths and Octaves Destroy Independence',
          explanation: 'These "perfect" intervals are so acoustically pure that when two voices move in parallel 5ths or octaves, they merge into one sound. The voices lose their independence. This is why the rule exists - not arbitrarily, but to preserve the texture.',
          analogy: 'Like two people saying the exact same thing at the same time - you only hear one voice, not two independent thoughts.'
        },
        {
          title: 'Contrary Motion is King',
          explanation: 'When one voice moves up while another moves down, they maintain maximum independence. Good counterpoint features more contrary motion than parallel or similar motion. It\'s the most effective way to keep voices distinct.',
          analogy: 'Like two dancers moving past each other in opposite directions - you clearly see two separate paths.'
        },
        {
          title: 'Dissonance Creates and Releases Tension',
          explanation: 'Dissonances (2nds, 7ths, tritones) are essential for creating interest, but they must be handled carefully. In strict counterpoint, they appear on weak beats and resolve by step to consonances. Suspensions delay the expected consonance, creating delicious tension.',
          analogy: 'Dissonance is like salt in cooking - essential for flavor, but too much ruins the dish. And it must be balanced with resolution.'
        }
      ],

      summary: 'Counterpoint is the art of combining independent melodic lines. The fundamental rules - avoid parallel 5ths/octaves, use contrary motion, balance steps and leaps, resolve dissonances - serve to maintain voice independence. Even if you never write a fugue, counterpoint skills improve bass lines, arrangements, and harmonic understanding. Bach\'s works are the gold standard, but these principles appear throughout music history.'
    },

    hearIt: {
      title: 'Hear counterpoint principles',
      examples: [
        {
          label: 'Contrary motion with inversions',
          description: 'Bass descends C-B-A (LH in blue) while upper voices stay stable (RH in orange). Inversions create independent voice movement.',
          playAction: {
            type: 'two_hand_progression',
            chords: [
              { name: 'C', lh: ['C3'], rh: ['E4', 'G4'] },
              { name: 'G/B', lh: ['B2'], rh: ['D4', 'G4'] },
              { name: 'Am', lh: ['A2'], rh: ['C4', 'E4'] }
            ]
          }
        },
        {
          label: 'Ascending bass line',
          description: 'Bass ascends stepwise: F-G-A-B-C (LH). The inversions create a smooth melodic bass.',
          playAction: {
            type: 'two_hand_progression',
            chords: [
              { name: 'F', lh: ['F2'], rh: ['A4', 'C5'] },
              { name: 'G', lh: ['G2'], rh: ['B4', 'D5'] },
              { name: 'Am', lh: ['A2'], rh: ['C4', 'E4'] },
              { name: 'G/B', lh: ['B2'], rh: ['D4', 'G4'] },
              { name: 'C', lh: ['C3'], rh: ['E4', 'G4'] }
            ]
          }
        },
        {
          label: 'Parallel 3rds (good)',
          description: 'All voices move together in 3rds - C-E to D-F to E-G. Parallel but maintains independence.',
          playAction: {
            type: 'two_hand_progression',
            chords: [
              { name: 'C', lh: ['C3'], rh: ['E4', 'G4'] },
              { name: 'Dm', lh: ['D3'], rh: ['F4', 'A4'] },
              { name: 'Em', lh: ['E3'], rh: ['G4', 'B4'] }
            ]
          }
        },
        {
          label: '4-3 Suspension',
          description: 'The 4th (F over C) holds over, then resolves to the 3rd (E). Classic counterpoint.',
          playAction: {
            type: 'two_hand_progression',
            chords: [
              { name: 'Csus4', lh: ['C3'], rh: ['F4', 'G4'] },
              { name: 'C', lh: ['C3'], rh: ['E4', 'G4'] }
            ]
          }
        },
        {
          label: '7-6 Suspension',
          description: 'The 7th (B) holds and resolves down to 6th (A). Expressive and beautiful.',
          playAction: {
            type: 'two_hand_progression',
            chords: [
              { name: 'Cmaj7', lh: ['C3'], rh: ['E4', 'G4', 'B4'] },
              { name: 'C6', lh: ['C3'], rh: ['E4', 'G4', 'A4'] }
            ]
          }
        },
        {
          label: 'Bach-style walking bass',
          description: 'Bass walks stepwise: C-B-A-G#-A (LH). Contrary to upper voices (RH) - a melody in its own right!',
          playAction: {
            type: 'two_hand_progression',
            chords: [
              { name: 'C', lh: ['C3'], rh: ['E4', 'G4'] },
              { name: 'G/B', lh: ['B2'], rh: ['D4', 'G4'] },
              { name: 'Am', lh: ['A2'], rh: ['C4', 'E4'] },
              { name: 'E/G#', lh: ['G#2'], rh: ['B4', 'E4'] },
              { name: 'Am', lh: ['A2'], rh: ['C4', 'E4'] }
            ]
          }
        }
      ],
      famousSongs: [
        'Bach\'s Two-Part Inventions - The best introduction to counterpoint',
        'Bach\'s Cello Suites - Solo counterpoint implying multiple voices',
        'Handel\'s "Hallelujah Chorus" - Choral counterpoint at its finest',
        'Pachelbel\'s Canon - Strict canon (round) over a ground bass',
        '"Eleanor Rigby" (Beatles) - String counterpoint in pop music',
        'Iron Maiden guitar harmonies - Rock counterpoint in parallel 3rds'
      ]
    },

    tryIt: null,

    experiment: {
      title: 'Practice counterpoint thinking',
      prompt: 'Use the Progression Workshop to create bass lines that work contrapuntally with melodies:',
      challenges: [
        {
          label: 'Walking bass: C - Am - Dm - G with C-B-A-G bass',
          hint: 'Use inversions to create a descending bass line against static melody',
          solution: { progression: ['C', 'Am/C', 'Dm/A', 'G'] }
        },
        {
          label: 'Contrary motion: C - F/A - G/B - C',
          hint: 'Bass moves up (C-A-B-C) while you imagine melody moving down',
          solution: { progression: ['C', 'F/A', 'G/B', 'C'] }
        },
        {
          label: 'Suspension chain: Gsus4 - G - Csus4 - C',
          hint: 'Each suspension resolves before the next one begins',
          solution: { progression: ['Gsus4', 'G', 'Csus4', 'C'] }
        }
      ],
      freePlay: {
        prompt: 'Build a 4-chord progression where the bass line is interesting enough to hum on its own. Use inversions to create stepwise motion!',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Counterpoint Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'Why are parallel 5ths and octaves avoided in counterpoint?',
          options: [
            'They sound bad',
            'They are too loud',
            'They make voices lose independence by merging them acoustically',
            'They are too difficult to play'
          ],
          correctIndex: 2,
          explanation: 'Perfect intervals (5ths, octaves) are so acoustically pure that parallel motion in these intervals causes voices to fuse together, destroying the sense of independent melodic lines.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'What type of voice motion creates the strongest independence?',
          options: [
            'Parallel motion',
            'Similar motion',
            'Contrary motion',
            'Oblique motion'
          ],
          correctIndex: 2,
          explanation: 'Contrary motion (one voice up, the other down) creates the strongest sense of independence. It\'s the hallmark of good counterpoint.'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'What is a 4-3 suspension?',
          options: [
            'A chord with the 4th raised to 5th',
            'A dissonant 4th held over and resolving down to the 3rd',
            'Playing 4 notes then 3 notes',
            'A time signature change'
          ],
          correctIndex: 1,
          explanation: 'A 4-3 suspension holds the 4th (from the previous chord) over a new bass note, creating a dissonance that resolves down by step to the 3rd. It\'s one of the most expressive counterpoint devices.'
        },
        {
          id: 'q4',
          type: 'multiple_choice',
          question: 'In strict counterpoint, when can dissonances occur?',
          options: [
            'Only on strong beats',
            'Only on weak beats, and must resolve by step',
            'Anywhere, without restriction',
            'Never - only consonances allowed'
          ],
          correctIndex: 1,
          explanation: 'In early species counterpoint, dissonances are allowed only on weak beats and must resolve by step to a consonance. Later species introduce suspensions, where dissonances on strong beats resolve down by step.'
        }
      ],
      passingScore: 3
    }
  },

  // =====================================================
  // Modulation Techniques
  // =====================================================
  {
    id: 'lesson-modulation',
    path: 'advanced',
    title: 'Modulation Techniques',
    subtitle: 'How to change keys smoothly (or dramatically)',
    estimatedTime: '16 min',
    icon: '🔄',

    learn: {
      introduction: `Modulation - changing from one key to another - is one of the most powerful tools in a composer's arsenal. It can refresh a song, add drama, create surprise, or lift the energy. Let's explore the different ways to move between keys.

**What is Modulation?**

Modulation is a deliberate change of tonal center - moving from one key to another within a piece of music. Unlike just playing a chromatic chord (which is borrowed or secondary), modulation establishes a NEW home key.

**Types of Modulation:**

**1. Pivot Chord Modulation (Common Chord)**
The smoothest type. A chord that exists in BOTH keys acts as a "pivot" - you hear it in the old key, but it leads to the new key.

Example: C major to G major
- Am is vi in C major AND ii in G major
- Progression: C - F - Am - D7 - G
- Am is the pivot (vi in C becomes ii in G)
- The D7 (V7/G) confirms the new key

**2. Common Tone Modulation**
A single note is held while the harmony changes to a new key. The held note provides continuity.

Example: C major to Ab major
- Hold the note C (or G, which is in both C and Ab chords)
- C chord (C-E-G) → Ab chord (Ab-C-Eb)
- The common tone C bridges the distant keys

**3. Direct Modulation (Phrase Modulation)**
The most abrupt - simply start the new key without preparation. Often used at the start of a new section.

Example: End a verse in C, start the chorus in Eb
- No pivot, no preparation
- Works because the phrase boundary creates a "reset"
- Very common in pop music (the "truck driver's modulation" up a half-step)

**4. Sequential Modulation**
A melodic or harmonic pattern repeats at a new pitch level, carrying you to a new key.

Example: ii-V-I in C, then ii-V-I in Db
- Dm7 - G7 - Cmaj7 | Ebm7 - Ab7 - Dbmaj7
- The pattern itself creates the logic for the key change

**5. Chromatic Modulation**
Uses chromatic voice leading (half-step movement) to slip into the new key.

Example: C to E major
- C - C+ (C-E-G#) - E
- The G# (a chromatic alteration) becomes the 3rd of E major

**Closely Related vs Distant Keys:**

**Closely related keys** (easy to modulate):
- Share many common chords
- Differ by one sharp or flat
- From C: G, F, Am, Dm, Em

**Distant keys** (need more setup):
- Few common chords
- Differ by many sharps/flats
- From C: Db, Ab, E, B

**The "Truck Driver's Modulation":**
A famous (infamous?) technique in pop music: modulate up a half-step for the final chorus. Direct, unsubtle, but incredibly effective for adding energy. Think "My Heart Will Go On" or "Livin' on a Prayer."

**Establishing the New Key:**

A modulation isn't complete until the new key is confirmed. Typically:
- Play the V7 of the new key (creates expectation)
- Resolve to the new I chord
- Cadence (V7-I or ii-V-I) solidifies it`,

      keyPoints: [
        {
          title: 'Pivot Chords Are Your Smoothest Tool',
          explanation: 'A pivot chord belongs to both keys - your ear hears it in the context of the old key, then it\'s reinterpreted in the new key. The smoother the reinterpretation (like vi becoming ii), the more seamless the modulation. Find chords that overlap between your two keys.',
          analogy: 'Like a word with two meanings - the same sound carries you from one context to another.'
        },
        {
          title: 'Direct Modulation Works at Phrase Boundaries',
          explanation: 'At the start of a new section (verse to chorus, for example), you can simply start in a new key without preparation. The phrase boundary creates a natural "reset" that allows the ear to accept the new key. This is why pop songs can modulate without theory - the form does the work.',
          analogy: 'Like starting a new chapter in a book - you accept a change of scene because you know you\'re starting fresh.'
        },
        {
          title: 'The V7 Confirms the New Key',
          explanation: 'A modulation isn\'t "done" until you establish the new key. The most powerful confirmation is playing the V7 of the new key resolving to I. This dominant-tonic motion tells the ear definitively: "This is home now."',
          analogy: 'V7-I is like signing a contract - it makes the new key official.'
        },
        {
          title: 'Distant Keys Need More Steps',
          explanation: 'Modulating from C to Db (distant keys with no common chords) requires more effort than C to G (closely related). You might chain through intermediate keys (C→Am→F→Db) or use chromatic common tones. The further you travel, the more bridges you need.',
          analogy: 'Distant keys are like distant cities - you might need connecting flights instead of a direct route.'
        }
      ],

      summary: 'Modulation is changing from one key to another. The main techniques are: pivot chord (a chord common to both keys), common tone (one note bridges the keys), direct modulation (simply start the new key at a phrase boundary), sequential (pattern repeats at new pitch level), and chromatic (half-step voice leading). Closely related keys are easier to modulate between. The V7-I cadence in the new key confirms the modulation.'
    },

    hearIt: {
      title: 'Hear different modulation techniques',
      examples: [
        {
          label: 'Pivot chord: C major to G major',
          description: 'C - Am - D7 - G. Am is vi in C, reinterpreted as ii in G.',
          playAction: { type: 'progression', chords: ['C', 'Am', 'D7', 'G'] }
        },
        {
          label: 'Pivot chord: C major to A minor (relative minor)',
          description: 'C - G - Am - E7 - Am. G is V in C, becomes VII in Am. E7 confirms Am.',
          playAction: { type: 'progression', chords: ['C', 'G', 'Am', 'E7', 'Am'] }
        },
        {
          label: 'Direct modulation up a half-step',
          description: 'G - D - G, then Ab - Eb - Ab. The classic "truck driver\'s modulation."',
          playAction: { type: 'progression', chords: ['G', 'D', 'G', 'Ab', 'Eb', 'Ab'] }
        },
        {
          label: 'Sequential modulation: ii-V-I moving up',
          description: 'Dm7 - G7 - Cmaj7, then Ebm7 - Ab7 - Dbmaj7. Same pattern, new key.',
          playAction: { type: 'progression', chords: ['Dm7', 'G7', 'Cmaj7', 'Ebm7', 'Ab7', 'Dbmaj7'] }
        },
        {
          label: 'Chromatic modulation: C to E',
          description: 'C - C+ - E. The augmented chord (C-E-G#) provides the chromatic link.',
          playAction: { type: 'progression', chords: ['C', 'Caug', 'E'] }
        },
        {
          label: 'Common tone modulation: C to Ab',
          description: 'C - Ab. The note C is in both chords, bridging very distant keys.',
          playAction: { type: 'progression', chords: ['C', 'Ab', 'Bb', 'Ab'] }
        }
      ],
      famousSongs: [
        '"My Heart Will Go On" (Celine Dion) - Famous direct modulation up a half-step',
        '"Livin\' on a Prayer" (Bon Jovi) - Another "truck driver" half-step modulation',
        '"Penny Lane" (Beatles) - Multiple key changes using pivot chords',
        '"I Will Always Love You" (Whitney Houston) - Dramatic key lift',
        '"Bohemian Rhapsody" (Queen) - Multiple modulations throughout',
        'Classical sonatas - Typically modulate to V (or relative major) in exposition'
      ]
    },

    tryIt: null,

    experiment: {
      title: 'Practice modulation techniques',
      prompt: 'Build progressions that change keys:',
      challenges: [
        {
          label: 'Pivot from C to G: C - F - Am - D7 - G',
          hint: 'Am is vi in C and ii in G - the perfect pivot',
          solution: { progression: ['C', 'F', 'Am', 'D7', 'G'] }
        },
        {
          label: 'Direct up a half-step: C - G - C, Db - Ab - Db',
          hint: 'Just start the new key! The pause between makes it work.',
          solution: { progression: ['C', 'G', 'C', 'Db', 'Ab', 'Db'] }
        },
        {
          label: 'To relative minor: C - Em - Am - E7 - Am',
          hint: 'E7 (V7 of Am) confirms the modulation to A minor',
          solution: { progression: ['C', 'Em', 'Am', 'E7', 'Am'] }
        },
        {
          label: 'Circle of fifths chain: C - G - D - A',
          hint: 'Each chord is V of the next - modulatory but smooth',
          solution: { progression: ['C', 'G7', 'G', 'D7', 'D', 'A7', 'A'] }
        }
      ],
      freePlay: {
        prompt: 'Try modulating from C major to a distant key like Ab or E. What pivot chords can you find? What chromatic alterations help bridge the gap?',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Modulation Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'What is a pivot chord modulation?',
          options: [
            'Playing two chords at once',
            'Using a chord that exists in both the old and new keys',
            'Always using the V chord',
            'Modulating only to relative minor'
          ],
          correctIndex: 1,
          explanation: 'A pivot chord belongs to both keys. It\'s heard in the context of the old key, then reinterpreted as part of the new key, creating a smooth bridge between them.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'What is the "truck driver\'s modulation"?',
          options: [
            'Modulating to the relative minor',
            'Using a pivot chord to modulate down',
            'A direct modulation up a half-step, often for a final chorus',
            'Modulating around the circle of fifths'
          ],
          correctIndex: 2,
          explanation: 'The "truck driver\'s modulation" is a direct key change up a half-step, typically for the last chorus. It\'s called that because it\'s straightforward and unsophisticated, but it adds undeniable energy.'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'How do you confirm a modulation to a new key?',
          options: [
            'Play the new key\'s I chord once',
            'Play the new key\'s V7 resolving to I (cadence)',
            'Just announce the new key verbally',
            'There\'s no way to confirm it'
          ],
          correctIndex: 1,
          explanation: 'A modulation is confirmed by cadencing in the new key - typically V7 to I. This dominant-tonic motion tells the ear definitively that a new tonal center has been established.'
        },
        {
          id: 'q4',
          type: 'multiple_choice',
          question: 'Which keys are closely related to C major?',
          options: [
            'Db, Eb, Ab',
            'G, F, Am, Dm, Em',
            'B, F#, C#',
            'Only A minor'
          ],
          correctIndex: 1,
          explanation: 'Closely related keys share most of their chords. From C major: G and F (differ by one sharp/flat) and their relative minors (Em, Dm, Am) are closely related.'
        }
      ],
      passingScore: 3
    }
  },

  // =====================================================
  // Exotic & Specialized Scales
  // =====================================================
  {
    id: 'lesson-exotic-scales',
    path: 'advanced',
    title: 'Exotic & Specialized Scales',
    subtitle: 'Bebop, Phrygian Dominant, Hungarian Minor, and more',
    estimatedTime: '17 min',
    icon: '🌍',

    learn: {
      introduction: `Beyond major, minor, and the seven modes, there's a world of exotic scales that give music unique colors. These scales are essential for specific genres and can add incredible flavor to your playing.

**Bebop Scales:**

Jazz musicians in the 1940s discovered a brilliant trick: add one chromatic passing tone to make a 7-note scale into an 8-note scale. Why? Because 8 notes fit evenly into a 4-beat measure, keeping chord tones on strong beats!

**Bebop Dominant Scale:**
Major scale with a passing tone between b7 and root
- Formula: 1 - 2 - 3 - 4 - 5 - 6 - b7 - 7 - 1
- C Bebop Dominant: C-D-E-F-G-A-Bb-B-C
- Use over: Dominant 7th chords (G7, C7)
- The added major 7th (B) lets you run up and down and always land chord tones on downbeats

**Bebop Major Scale:**
Major scale with a passing tone between 5 and 6
- Formula: 1 - 2 - 3 - 4 - 5 - #5 - 6 - 7
- C Bebop Major: C-D-E-F-G-G#-A-B-C
- Use over: Major 7th chords

**Bebop Dorian (Minor) Scale:**
Dorian with a passing tone between 3 and 4
- Formula: 1 - 2 - b3 - 3 - 4 - 5 - 6 - b7
- C Bebop Minor: C-D-Eb-E-F-G-A-Bb-C
- Use over: Minor 7th chords
- The major 3rd (E) passing tone adds chromaticism

**Phrygian Dominant Scale (Spanish Gypsy):**

This is the 5th mode of harmonic minor - one of the most dramatic scales in music!

- Formula: 1 - b2 - 3 - 4 - 5 - b6 - b7
- E Phrygian Dominant: E-F-G#-A-B-C-D-E
- Derived from: A harmonic minor starting on E

**Why it's special:**
- Has both b2 (dark, Phrygian) AND major 3rd (bright)
- Creates instant flamenco/Spanish/Middle Eastern sound
- The interval between b2 and 3 (augmented 2nd) is exotic and dramatic
- Use over: Dominant 7th chords, especially in minor key contexts

**Where you hear it:**
- Flamenco guitar
- Metal (Yngwie Malmsteen, Marty Friedman)
- Middle Eastern music
- Film scores (any "desert" or "exotic" scene)

**Hungarian Minor Scale:**

A dramatic scale with TWO augmented 2nds - creating an almost "gypsy" or "Eastern European" flavor.

- Formula: 1 - 2 - b3 - #4 - 5 - b6 - 7
- C Hungarian Minor: C-D-Eb-F#-G-Ab-B-C
- Also called: Double Harmonic Minor, Gypsy Minor

**Why it's special:**
- The #4 combined with b3 and b6 creates incredible tension
- Two augmented 2nd intervals (b3 to #4, b6 to 7)
- Very "exotic" and dramatic
- Common in Hungarian and Eastern European folk music

**Lydian Dominant Scale:**

The 4th mode of melodic minor - essential for jazz!

- Formula: 1 - 2 - 3 - #4 - 5 - 6 - b7
- C Lydian Dominant: C-D-E-F#-G-A-Bb-C
- Combines: Lydian's #4 with Mixolydian's b7

**Why it's special:**
- Use over: Dominant 7th chords (especially #11 chords)
- Creates sophisticated, "floating" dominant sound
- The #4 eliminates the typical dominant "darkness"
- Think: Joe Henderson, Wayne Shorter, modern jazz

**Whole Tone Scale:**

Only 6 notes, all whole steps apart - completely symmetrical!

- Formula: 1 - 2 - 3 - #4 - #5 - b7
- C Whole Tone: C-D-E-F#-G#-A#-C
- Only TWO whole tone scales exist (C and Db patterns)

**Why it's special:**
- No leading tone, no dominant function - pure ambiguity
- "Dreamy," "floating," "otherworldly" quality
- Use over: Augmented chords, dominant 7#5
- Think: Debussy, dream sequences in film

**Diminished Scales:**

Also called "Octatonic" - 8 notes alternating between whole and half steps.

**Half-Whole Diminished:**
- Formula: H-W-H-W-H-W-H-W (starting with half step)
- C Half-Whole Dim: C-Db-Eb-E-F#-G-A-Bb-C
- Use over: Diminished 7th chords, dominant 7b9 chords

**Whole-Half Diminished:**
- Formula: W-H-W-H-W-H-W-H (starting with whole step)
- C Whole-Half Dim: C-D-Eb-F-Gb-Ab-A-B-C
- Use over: Dominant 7th chords (when you want tension)

**Why they're special:**
- Only THREE diminished scales exist (C, Db, D patterns repeat)
- Highly symmetrical - transpose by minor 3rd and you get the same notes
- Creates tension and chromaticism
- Essential for jazz improvisers`,

      keyPoints: [
        {
          title: 'Bebop Scales Keep Chord Tones on Strong Beats',
          explanation: 'By adding one chromatic passing tone, bebop scales have 8 notes - fitting perfectly into 4 beats. When you run up or down the scale starting on a chord tone, you always land on chord tones on beats 1, 2, 3, and 4. This is the secret to bebop\'s swinging, coherent sound.',
          analogy: 'Like adding an extra step to a staircase so you always land on the right foot.'
        },
        {
          title: 'Phrygian Dominant is the "Spanish" Sound',
          explanation: 'The combination of b2 (dark Phrygian flavor) and major 3rd (bright resolution) creates instant drama. The augmented 2nd between b2 and 3 (E-F-G# in E Phrygian Dominant) is the interval that defines flamenco and Middle Eastern music.',
          analogy: 'It\'s like seeing a sunset and sunrise at the same time - dark and bright in one scale.'
        },
        {
          title: 'Lydian Dominant is Jazz\'s Secret Weapon',
          explanation: 'Combining the dreamy #4 of Lydian with the bluesy b7 of dominant creates a sophisticated, "outside" sound. Jazz players use it over dominant 7th chords when they want to sound modern and sophisticated without going fully "outside."',
          analogy: 'It\'s like wearing sneakers with a suit - unexpected combination that works perfectly.'
        },
        {
          title: 'Symmetrical Scales Have Limited Transpositions',
          explanation: 'The whole tone scale only has 2 versions; the diminished scales only have 3. Because they\'re built on repeating patterns, transposing them eventually gets you back to the same notes. This makes them easier to learn but also gives them a distinctive, "rootless" quality.',
          analogy: 'Like a hall of mirrors - wherever you start, you see the same pattern.'
        }
      ],

      summary: 'Exotic scales add distinctive colors beyond standard modes. Bebop scales add a chromatic passing tone to keep chord tones on strong beats. Phrygian Dominant (5th mode of harmonic minor) creates instant Spanish/Middle Eastern drama. Lydian Dominant (4th mode of melodic minor) gives sophisticated jazz tension. Hungarian Minor has two augmented 2nds for gypsy flavor. Whole tone and diminished scales are symmetrical with limited transpositions. Each scale has specific uses and characteristic sounds.'
    },

    hearIt: {
      title: 'Hear exotic scale colors',
      examples: [
        {
          label: 'Phrygian Dominant - Spanish drama',
          description: 'E-F-G#-A-B-C-D-E. That augmented 2nd (F to G#) is instant flamenco.',
          playAction: { type: 'scale', root: 'E', scaleType: 'phrygian dominant' }
        },
        {
          label: 'Lydian Dominant - Jazz sophistication',
          description: 'C-D-E-F#-G-A-Bb-C. The #4 and b7 together: dreamy yet bluesy.',
          playAction: { type: 'scale', root: 'C', scaleType: 'lydian dominant' }
        },
        {
          label: 'Hungarian Minor - Gypsy fire',
          description: 'C-D-Eb-F#-G-Ab-B-C. Two augmented 2nds create dramatic tension.',
          playAction: { type: 'scale', root: 'C', scaleType: 'hungarian minor' }
        },
        {
          label: 'Whole Tone - Dreamlike ambiguity',
          description: 'C-D-E-F#-G#-A#-C. No half steps, pure floating quality.',
          playAction: { type: 'scale', root: 'C', scaleType: 'whole tone' }
        },
        {
          label: 'Diminished (Half-Whole) - Tense chromaticism',
          description: 'C-Db-Eb-E-F#-G-A-Bb-C. Alternating half and whole steps.',
          playAction: { type: 'scale', root: 'C', scaleType: 'diminished' }
        },
        {
          label: 'Bebop Dominant - Swing lines',
          description: 'C-D-E-F-G-A-Bb-B-C. The added B keeps chord tones on downbeats.',
          playAction: { type: 'scale', root: 'C', scaleType: 'bebop dominant' }
        },
        {
          label: 'Harmonic Minor - Dark and classical',
          description: 'A-B-C-D-E-F-G#-A. The raised 7th creates that "dramatic" sound.',
          playAction: { type: 'scale', root: 'A', scaleType: 'harmonic minor' }
        },
        {
          label: 'Melodic Minor - Jazzy minor',
          description: 'A-B-C-D-E-F#-G#-A (ascending). Minor 3rd with major 6th and 7th.',
          playAction: { type: 'scale', root: 'A', scaleType: 'melodic minor' }
        }
      ],
      famousSongs: [
        '"Misirlou" (Dick Dale) - Phrygian Dominant throughout',
        '"Black Star" (Yngwie Malmsteen) - Harmonic minor and Phrygian Dominant',
        '"Take the A Train" - Lydian Dominant over the opening chord',
        '"Clair de Lune" (Debussy) - Whole tone scale passages',
        '"Giant Steps" (Coltrane) - Uses symmetric scales',
        '"Spain" (Chick Corea) - Phrygian Dominant in the intro',
        '"Dark Eyes" - Traditional song using Hungarian Minor',
        '"Confirmation" (Charlie Parker) - Bebop scales throughout'
      ]
    },

    tryIt: null,

    experiment: {
      title: 'Explore exotic scale colors',
      prompt: 'Use the Scale Explorer to hear these distinctive sounds:',
      challenges: [
        {
          label: 'Flamenco: E Phrygian Dominant over E7',
          hint: 'Select E as root, Phrygian Dominant as scale type',
          solution: { progression: ['E7', 'F', 'E7', 'F'] }
        },
        {
          label: 'Jazz: C Lydian Dominant over C7#11',
          hint: 'The #4 (F#) defines the Lydian sound',
          solution: { progression: ['C7', 'F', 'C7'] }
        },
        {
          label: 'Dreamy: Whole tone over Caug',
          hint: 'No leading tone - the scale just floats',
          solution: { progression: ['Caug', 'Eaug', 'Caug'] }
        },
        {
          label: 'Dark drama: A Harmonic Minor',
          hint: 'That G# to A gives classical minor its character',
          solution: { progression: ['Am', 'E7', 'Am'] }
        }
      ],
      freePlay: {
        prompt: 'Go to the Scale Explorer and compare Harmonic Minor, Melodic Minor, and Phrygian Dominant starting on the same root. Notice how the augmented 2nd appears in different places and changes the character!',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Exotic Scales Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'Why do bebop scales have 8 notes instead of 7?',
          options: [
            'To make them harder to play',
            'So chord tones land on strong beats when played as eighth notes',
            'Because jazz musicians prefer even numbers',
            'To add more dissonance'
          ],
          correctIndex: 1,
          explanation: 'Bebop scales add a chromatic passing tone so that 8 notes fit evenly into a 4-beat measure. This ensures chord tones (1, 3, 5, 7) land on strong beats when you run up or down the scale.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'What makes Phrygian Dominant sound "Spanish"?',
          options: [
            'It has a major 7th',
            'It has a flat 2nd and major 3rd, creating an augmented 2nd',
            'It\'s played on Spanish guitars only',
            'It uses only white keys'
          ],
          correctIndex: 1,
          explanation: 'Phrygian Dominant has a b2 (dark) and major 3rd (bright) - the interval between them (augmented 2nd) is the "Spanish" or "Middle Eastern" sound. It\'s like E-F-G# in E Phrygian Dominant.'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'How many whole tone scales exist?',
          options: ['1', '2', '6', '12'],
          correctIndex: 1,
          explanation: 'Only 2 whole tone scales exist because the scale is completely symmetrical. C whole tone uses C-D-E-F#-G#-A#. Db whole tone uses Db-Eb-F-G-A-B. Any other starting note just gives you one of these two.'
        },
        {
          id: 'q4',
          type: 'multiple_choice',
          question: 'What is Lydian Dominant a mode of?',
          options: [
            'Major scale',
            'Harmonic minor',
            'Melodic minor',
            'Whole tone scale'
          ],
          correctIndex: 2,
          explanation: 'Lydian Dominant is the 4th mode of melodic minor. If you play G melodic minor starting on C, you get C Lydian Dominant (C-D-E-F#-G-A-Bb). It combines Lydian\'s #4 with the dominant\'s b7.'
        }
      ],
      passingScore: 3
    }
  }
];

export default advancedLessons;
