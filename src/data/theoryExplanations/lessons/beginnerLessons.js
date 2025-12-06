/**
 * Beginner Learning Path
 *
 * These lessons build on the foundational lessons and teach
 * chord construction, chord qualities, and progressions.
 * Each lesson utilizes our interactive building blocks to teach concepts
 * through doing, not just reading.
 *
 * LESSON ORDERING:
 * - Lessons are numbered automatically based on array position (see index.js)
 * - To reorder lessons, simply move them in this array
 * - IDs are semantic (no numbers) for stability when reordering
 * - Tutorials are mapped by ID in lessonViewer.js (to avoid circular imports)
 */

export const beginnerLessons = [
  // =====================================================
  // What is a Chord?
  // =====================================================
  {
    id: 'lesson-what-is-chord',
    path: 'beginner',
    title: 'What is a Chord?',
    subtitle: 'Understanding the building blocks of music',
    estimatedTime: '5 min',
    icon: '🎵',

    // LEARN Section
    learn: {
      introduction: `When you play a single note on piano, it sounds simple and alone.
But when you play multiple notes together, something magical happens - they blend into something bigger than the sum of their parts.

**A chord is simply multiple notes played at the same time.**

Think of it like colors. One color is nice, but when you combine colors, you can create art.
One note is a sound, but multiple notes together create emotion.`,

      keyPoints: [
        {
          title: 'Most chords have 3 notes',
          explanation: 'The most common chords are called "triads" (tri = three). They stack three notes on top of each other.',
          analogy: 'Like a three-layer sandwich - each layer adds something to the whole.'
        },
        {
          title: 'Chords can sound happy or sad',
          explanation: 'The specific notes you choose determine the mood. Some combinations sound bright and happy, others sound dark and emotional.',
          analogy: 'Like choosing warm vs cool colors in a painting.'
        },
        {
          title: 'Chords are named after their bottom note',
          explanation: 'A C chord starts with C. A G chord starts with G. The bottom note is called the "root".',
          analogy: 'Like how a tree is named after its type, not its leaves - the root defines it.'
        }
      ],

      summary: 'A chord is multiple notes played together. Most chords have 3 notes (called triads). The bottom note names the chord.'
    },

    // HEAR IT Section
    hearIt: {
      title: 'Listen to these examples',
      examples: [
        {
          label: 'A single note (C)',
          description: 'Just one sound - simple and thin',
          playAction: { type: 'single_note', note: 'C4' }
        },
        {
          label: 'A C major chord (C, E, G)',
          description: 'Three notes together - full and complete!',
          playAction: { type: 'chord', root: 'C', chordType: 'major' }
        },
        {
          label: 'A C minor chord (C, Eb, G)',
          description: 'Same root, different mood - hear the difference?',
          playAction: { type: 'chord', root: 'C', chordType: 'minor' }
        }
      ],
    },

    // TRY IT Section (Interactive exercises using our building blocks)
    // Note: The main guided exercise is in interactiveTutorial.js (whatIsAChordTutorial)
    // These are additional practice exercises shown after completing the guided tour
    tryIt: {
      title: 'Build your first chord',
      instructions: 'Start with the Guided Exercise above to learn the basics, then try these additional practice challenges:',
      exercises: [],
      successMessage: 'You built your first chords! You can hear the difference between major (happy) and minor (sad).'
    },

    // EXPERIMENT Section
    // After completing the guided exercise, users can practice more in Chord Lab
    experiment: {
      title: 'Free exploration',
      prompt: 'After completing the guided exercise, try building more chords in the Chord Lab (use the tab at the top of the page):',
      challenges: [
        {
          label: 'Build a G major chord',
          hint: 'Change the root to G, keep the type as Major',
          solution: { root: 'G', type: 'major' }
        },
        {
          label: 'Build an A minor chord',
          hint: 'Root = A, Type = Minor',
          solution: { root: 'A', type: 'minor' }
        },
        {
          label: 'Build an F major chord',
          hint: 'Root = F, Type = Major',
          solution: { root: 'F', type: 'major' }
        }
      ],
      freePlay: {
        prompt: 'Try any root note with Major and Minor. Notice how every major chord sounds "happy" and every minor chord sounds "sad", regardless of the root note!'
      }
    },

    // QUIZ Section
    quiz: {
      title: 'Check your understanding',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'How many notes do most basic chords have?',
          options: ['2 notes', '3 notes', '5 notes', '7 notes'],
          correctIndex: 1,
          explanation: 'Most basic chords (triads) have 3 notes stacked on top of each other.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'What is the "root" of a chord?',
          options: [
            'The highest note',
            'The middle note',
            'The bottom note that names the chord',
            'Any note in the chord'
          ],
          correctIndex: 2,
          explanation: 'The root is the bottom note that gives the chord its name. A C chord has C as its root.'
        },
        {
          id: 'q3',
          type: 'audio_identify',
          question: 'Listen to this chord. Is it major or minor?',
          playAction: { type: 'chord', root: 'D', chordType: 'minor' },
          options: ['Major (happy)', 'Minor (sad)'],
          correctIndex: 1,
          explanation: 'This D minor chord has that characteristic "sad" sound of minor chords.'
        }
      ],
      passingScore: 2 // Must get at least 2 out of 3
    }
  },

  // =====================================================
  // Major vs Minor - Scales and Triads
  // =====================================================
  {
    id: 'lesson-major-vs-minor',
    path: 'beginner',
    title: 'Major vs Minor',
    subtitle: 'Understanding major and minor scales and triads',
    estimatedTime: '8 min',
    icon: '😊😢',

    learn: {
      introduction: `In Lesson 4, you learned about the **major scale** - that familiar "Do Re Mi" pattern. But there's another important scale: the **minor scale**.

**The Minor Scale**

Just like the major scale has a specific pattern of whole and half steps, so does the minor scale - but it's different:

- **Major scale:** W-W-H-W-W-W-H (bright, happy sound)
- **Natural Minor scale:** W-H-W-W-H-W-W (darker, sadder sound)

In C Major: C - D - E - F - G - A - B - C
In C Minor: C - D - **Eb** - F - G - **Ab** - **Bb** - C

Notice the key difference? The **3rd note** (and 6th and 7th) are lowered by a half step in the minor scale. This is what creates that "sad" sound.

**Major and Minor Triads**

When we build a basic 3-note chord (a **triad**) using notes from these scales:

- **C Major Triad** = C - E - G (using the 1st, 3rd, and 5th notes of C major scale)
- **C Minor Triad** = C - **Eb** - G (using the 1st, 3rd, and 5th notes of C minor scale)

The only difference is that **one note** - E vs Eb. That's a half step, but it completely changes the emotional character!`,

      keyPoints: [
        {
          title: 'Major and minor are scale types first',
          explanation: 'Before we have major and minor chords, we have major and minor scales. The scale determines which notes are available for building chords.',
          analogy: 'The scale is like a paint palette - major and minor give you different colors to work with.'
        },
        {
          title: 'Triads are built from scale degrees 1, 3, and 5',
          explanation: 'A triad uses the 1st, 3rd, and 5th notes of a scale. In a major scale, the 3rd is higher (E in C). In a minor scale, the 3rd is lower (Eb in C minor).',
          analogy: 'It\'s like the difference between a smile (major 3rd - E) and a slight frown (minor 3rd - Eb).'
        },
        {
          title: 'The "third" determines major vs minor quality',
          explanation: 'A major third interval (4 half-steps, like C to E) creates a major triad. A minor third interval (3 half-steps, like C to Eb) creates a minor triad.',
          analogy: 'That half-step difference is small on the keyboard but huge to your ears!'
        },
        {
          title: 'Every major key has a "relative minor"',
          explanation: 'C major and A minor share the same notes (all white keys). They\'re called "relative" keys - same notes, different home base.',
          analogy: 'Like two stories told from different perspectives - same characters, different mood.'
        }
      ],

      summary: 'Major and minor scales have different patterns - the minor scale lowers the 3rd (and 6th and 7th) notes. Major triads use 1-3-5 from a major scale (C-E-G), while minor triads use 1-3-5 from a minor scale (C-Eb-G). That one lowered note creates the emotional difference.'
    },

    hearIt: {
      title: 'Hear the scales and triads',
      examples: [
        {
          label: 'C Major Scale',
          description: 'The bright, happy "Do Re Mi" - notice the E (major 3rd)',
          playAction: { type: 'scale', root: 'C', scaleType: 'major' }
        },
        {
          label: 'C Minor Scale',
          description: 'Darker and more emotional - notice the Eb (minor 3rd)',
          playAction: { type: 'scale', root: 'C', scaleType: 'minor' }
        },
        {
          label: 'C Major Triad (C - E - G)',
          description: 'Built from the C major scale. Bright and happy.',
          playAction: { type: 'chord', root: 'C', chordType: 'major' }
        },
        {
          label: 'C Minor Triad (C - Eb - G)',
          description: 'Built from the C minor scale. Dark and emotional.',
          playAction: { type: 'chord', root: 'C', chordType: 'minor' }
        },
        {
          label: 'Just the third changing (E to Eb)',
          description: 'Hear ONLY the note that changes between major and minor!',
          playAction: { type: 'comparison', notes: ['E4', 'Eb4'] }
        }
      ],
      famousSongs: [
        '"Happy" (Pharrell) - Uses mostly major triads',
        '"Mad World" (Gary Jules) - Built on minor triads',
        '"Someone Like You" (Adele) - Mixes major and minor for emotional depth'
      ]
    },

    // TRY IT Section (Interactive exercises using our building blocks)
    // Note: The main guided exercise is in interactiveTutorial.js (majorVsMinorTutorial)
    // These are additional practice exercises shown after completing the guided tour
    tryIt: {
      title: 'Feel the difference yourself',
      instructions: 'Start with the Guided Exercise above to experience the major/minor difference, then try these additional practice challenges:',
      exercises: [],
      successMessage: 'You experienced the power of the third! That one half-step changes everything between happy and sad.'
    },

    experiment: {
      title: 'Explore major and minor pairs',
      prompt: 'Try these pairs to reinforce the feeling:',
      challenges: [
        {
          label: 'E Major Triad → E Minor Triad',
          hint: 'E Major = E-G#-B, E Minor = E-G-B (G# drops to G)',
          solution: { pairs: [{ root: 'E', types: ['major', 'minor'] }] }
        },
        {
          label: 'G Major Triad → G Minor Triad',
          hint: 'G Major = G-B-D, G Minor = G-Bb-D (B drops to Bb)',
          solution: { pairs: [{ root: 'G', types: ['major', 'minor'] }] }
        },
        {
          label: 'A Major Triad → A Minor Triad',
          hint: 'A Minor uses all white keys (A-C-E). A Major raises the C to C#.',
          solution: { pairs: [{ root: 'A', types: ['major', 'minor'] }] }
        }
      ],
      freePlay: {
        prompt: 'Try building both the major and minor SCALES on the same root (use Scale Explorer), then the triads. Notice how the 3rd note of the scale becomes the 3rd of the triad!',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Major vs Minor Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'What is the main difference between a major triad and a minor triad?',
          options: [
            'Major triads have more notes',
            'The third is lowered by a half-step in minor triads',
            'Minor triads are played quieter',
            'Major triads use sharps, minor triads use flats'
          ],
          correctIndex: 1,
          explanation: 'Minor triads have a lowered 3rd (minor 3rd = 3 half-steps) compared to major triads (major 3rd = 4 half-steps). C Major = C-E-G, C Minor = C-Eb-G.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'What notes make up a C Minor triad?',
          options: [
            'C - E - G',
            'C - Eb - G',
            'C - E - Gb',
            'C - D - G'
          ],
          correctIndex: 1,
          explanation: 'C Minor triad = C - Eb - G. The Eb is the minor 3rd (from the C minor scale), while C Major uses E (the major 3rd).'
        },
        {
          id: 'q3',
          type: 'audio_identify',
          question: 'Listen carefully. Is this a major or minor triad?',
          playAction: { type: 'chord', root: 'E', chordType: 'minor' },
          options: ['Major triad (bright)', 'Minor triad (dark)'],
          correctIndex: 1,
          explanation: 'This E minor triad (E-G-B) has the characteristic darker, more emotional quality of minor triads.'
        }
      ],
      passingScore: 2
    }
  },

  // =====================================================
  // Chord Inversions
  // =====================================================
  {
    id: 'lesson-inversions',
    path: 'beginner',
    title: 'Chord Inversions',
    subtitle: 'Rearranging notes for smoother sounds',
    estimatedTime: '7 min',
    icon: '🔄',

    learn: {
      introduction: `You know that a C Major triad has three notes: C - E - G. But does the C always have to be on the bottom?

**No! You can rearrange the notes.**

When you move notes to different octaves while keeping the same three pitches, you create an **inversion**. The chord is still C Major, but it sounds and feels slightly different.

**The Three Positions of a Triad:**

- **Root Position:** Root on bottom → C - E - G (C is the bass note)
- **First Inversion:** Third on bottom → E - G - C (E is the bass note)
- **Second Inversion:** Fifth on bottom → G - C - E (G is the bass note)

All three are C Major - same notes, just rearranged! But each has a different character:
- Root position sounds **stable and grounded**
- First inversion sounds **lighter and flowing**
- Second inversion sounds **suspended and wanting to resolve**`,

      keyPoints: [
        {
          title: 'Same notes, different bass note',
          explanation: 'An inversion changes which note is on the bottom (the bass). The bass note strongly affects how the chord feels, even though the harmony is the same.',
          analogy: 'Like looking at a sculpture from different angles - same object, different perspectives.'
        },
        {
          title: 'Inversions make progressions smoother',
          explanation: 'Instead of jumping around the keyboard, inversions let you keep your hand in one area. The bass line moves by smaller steps, creating a more connected sound.',
          analogy: 'Like walking instead of hopping - smoother, more graceful movement.'
        },
        {
          title: 'First inversion is great for passing chords',
          explanation: 'When you want a chord to feel like it\'s "passing through" rather than landing heavily, first inversion is perfect.',
          analogy: 'Like stepping lightly vs stomping - both get you there, but with different energy.'
        },
        {
          title: 'Second inversion creates tension',
          explanation: 'Second inversion (fifth in bass) often sounds unstable and wants to resolve. It\'s commonly used right before a final chord.',
          analogy: 'Like leaning forward before taking a step - there\'s built-in momentum.'
        }
      ],

      summary: 'Inversions rearrange a chord\'s notes so different notes are in the bass. Root position (root in bass) is stable, first inversion (third in bass) is light, second inversion (fifth in bass) creates tension. Same chord, different characters!'
    },

    hearIt: {
      title: 'Hear how inversions change the feel',
      examples: [
        {
          label: 'C Major - Root Position (C - E - G)',
          description: 'Solid and grounded. The C in the bass gives it stability.',
          playAction: { type: 'chord', root: 'C', chordType: 'major', inversion: 0 }
        },
        {
          label: 'C Major - First Inversion (E - G - C)',
          description: 'Lighter and more flowing. Great for moving between chords.',
          playAction: { type: 'chord', root: 'C', chordType: 'major', inversion: 1 }
        },
        {
          label: 'C Major - Second Inversion (G - C - E)',
          description: 'Suspended feeling. Often wants to resolve to another chord.',
          playAction: { type: 'chord', root: 'C', chordType: 'major', inversion: 2 }
        },
        {
          label: 'Smooth progression using inversions',
          description: 'C (root) → F (2nd inv) → G (root) → C. Notice how the bass moves smoothly!',
          playAction: { type: 'progression', chords: ['C', 'F/C', 'G', 'C'] }
        }
      ],
      famousSongs: [
        '"Let It Be" (Beatles) - Uses inversions for smooth bass movement',
        '"Hallelujah" (Leonard Cohen) - Famous descending bass using inversions',
        'Classical music - Inversions everywhere for voice leading!'
      ]
    },

    // TRY IT Section (Interactive exercises using our building blocks)
    // Note: The main guided exercise is in interactiveTutorial.js (chordInversionsTutorial)
    // These are additional practice exercises shown after completing the guided tour
    tryIt: {
      title: 'Explore inversions in the Chord Lab',
      instructions: 'Start with the Guided Exercise above to discover how inversions change chord character, then try additional practice challenges:',
      exercises: [],
      successMessage: 'You\'ve discovered inversions! The same chord can have three different characters depending on which note is in the bass.'
    },

    experiment: {
      title: 'Use inversions for smooth voice leading',
      prompt: 'Inversions really shine when creating smooth chord progressions:',
      challenges: [
        {
          label: 'Play C-F-G-C all in root position',
          hint: 'Notice how the bass jumps around quite a bit',
          solution: { progression: ['C', 'F', 'G', 'C'] }
        },
        {
          label: 'Now try C-F/C-G-C (F in 2nd inversion)',
          hint: 'Keep C in the bass for the F chord - much smoother!',
          solution: { progression: ['C', 'F/C', 'G', 'C'] }
        },
        {
          label: 'Try Am-G/B-C (G in 1st inversion)',
          hint: 'The bass walks up: A → B → C. Beautiful!',
          solution: { progression: ['Am', 'G/B', 'C'] }
        }
      ],
      freePlay: {
        prompt: 'Take any progression you know and experiment with using inversions. Try to create a bass line that moves by steps instead of jumps. This is called "voice leading" and it\'s a key skill for arrangers and pianists!',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Inversions Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'In a first inversion triad, which note is in the bass?',
          options: [
            'The root',
            'The third',
            'The fifth',
            'Any note'
          ],
          correctIndex: 1,
          explanation: 'First inversion puts the third in the bass. For C Major first inversion: E - G - C (E is the third and is now on bottom).'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'Why do musicians use inversions?',
          options: [
            'To play different chords',
            'To make the chord louder',
            'To create smoother bass movement between chords',
            'To change from major to minor'
          ],
          correctIndex: 2,
          explanation: 'Inversions allow the bass to move by smaller intervals (steps instead of jumps), creating smoother, more connected progressions.'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'Which inversion tends to sound the most "unstable" or wanting to resolve?',
          options: [
            'Root position',
            'First inversion',
            'Second inversion',
            'They all sound the same'
          ],
          correctIndex: 2,
          explanation: 'Second inversion (fifth in bass) creates the most tension and often feels like it needs to resolve. It\'s commonly used before final cadences.'
        }
      ],
      passingScore: 2
    }
  },

  // =====================================================
  // Your First Progression (I-IV-V-I)
  // =====================================================
  {
    id: 'lesson-first-progression',
    path: 'beginner',
    title: 'Your First Progression',
    subtitle: 'The I-IV-V-I that\'s in thousands of songs',
    estimatedTime: '8 min',
    icon: '🎼',

    learn: {
      introduction: `Now that you know how to build chords, let's put them in **order** to make music!

A **chord progression** is a series of chords played one after another.

The most important progression in all of Western music is: **I - IV - V - I**

Those Roman numerals mean:
- **I** = The "home" chord (1st note of the key)
- **IV** = The "traveling" chord (4th note of the key)
- **V** = The "tension" chord (5th note of the key)
- **I** = Back "home"

In the key of C, this becomes: **C - F - G - C**

This progression is used in thousands of songs because it tells a complete musical story: Home → Journey → Tension → Home again.`,

      keyPoints: [
        {
          title: 'Roman numerals = chord positions',
          explanation: 'Musicians use Roman numerals (I, II, III...) to show which chord in a key. I is always the "home" chord.',
          analogy: 'Like numbering houses on a street - I is your home, and other numbers are neighbors.'
        },
        {
          title: 'This progression tells a story',
          explanation: 'I (home) → IV (we\'re going somewhere) → V (tension, want to return) → I (ahh, we\'re home!)',
          analogy: 'Like leaving home for an adventure, getting lost, then finding your way back. Satisfying!'
        },
        {
          title: 'It works in ANY key',
          explanation: 'In C: C-F-G-C. In G: G-C-D-G. In D: D-G-A-D. Same pattern, different starting points.',
          analogy: 'Like a recipe that works with any flavor - the proportions stay the same.'
        }
      ],

      summary: 'I-IV-V-I is the foundation of Western music. In the key of C, that\'s C-F-G-C. It creates a satisfying journey from home, to traveling, to tension, back to home.'
    },

    hearIt: {
      title: 'Hear the journey',
      examples: [
        {
          label: 'The full progression: C - F - G - C',
          description: 'Listen to the complete story. Notice how it feels "finished" at the end.',
          playAction: { type: 'progression', chords: ['C', 'F', 'G', 'C'] }
        },
        {
          label: 'Stop before the end: C - F - G',
          description: 'This feels incomplete! The G is "asking a question" that needs an answer.',
          playAction: { type: 'progression', chords: ['C', 'F', 'G'] }
        },
        {
          label: 'Just I and V: C - G - C',
          description: 'Even simpler - straight from home to tension to home.',
          playAction: { type: 'progression', chords: ['C', 'G', 'C'] }
        }
      ],
      famousSongs: [
        '"Twist and Shout" (Beatles) - Classic I-IV-V',
        '"La Bamba" (Ritchie Valens) - I-IV-V throughout',
        '"Wild Thing" (The Troggs) - I-IV-V rock anthem',
        '"Louie Louie" (The Kingsmen) - The ultimate I-IV-V song'
      ]
    },

    tryIt: {
      title: 'Build your first progression',
      instructions: 'Use the Progression Workshop to create I-IV-V-I in the key of C.',
      // Exercises moved to Guided Exercise (firstProgressionTutorial in interactiveTutorial.js)
      exercises: [],
      successMessage: 'Congratulations! You just built the most important progression in music history. This same pattern is in thousands of hit songs!'
    },

    experiment: {
      title: 'Try it in different keys',
      prompt: 'The beauty of I-IV-V-I is it works everywhere:',
      challenges: [
        {
          label: 'Build I-IV-V-I in G major',
          hint: 'G (I) - C (IV) - D (V) - G (I)',
          solution: { key: 'G', progression: ['G', 'C', 'D', 'G'] }
        },
        {
          label: 'Build I-IV-V-I in D major',
          hint: 'D (I) - G (IV) - A (V) - D (I)',
          solution: { key: 'D', progression: ['D', 'G', 'A', 'D'] }
        },
        {
          label: 'Try stopping on V',
          hint: 'Build C-F-G and notice how it feels unfinished',
          solution: { key: 'C', progression: ['C', 'F', 'G'] }
        }
      ],
      freePlay: {
        prompt: 'Experiment with the order! What happens if you play I-V-IV-I? Or I-IV-IV-V? Which orders sound "right" and which sound "wrong"?',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Progression Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'In the key of C, what chord is the "IV" (four)?',
          options: ['D major', 'E major', 'F major', 'G major'],
          correctIndex: 2,
          explanation: 'Counting from C: C(I) - D(II) - E(III) - F(IV). So F is the IV chord in C major.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'Which chord in I-IV-V-I creates the most "tension" that wants to resolve?',
          options: ['I (the home chord)', 'IV (the traveling chord)', 'V (the tension chord)'],
          correctIndex: 2,
          explanation: 'The V chord creates tension that naturally wants to resolve back to I. It\'s like a question that needs an answer.'
        },
        {
          id: 'q3',
          type: 'progression_build',
          question: 'Build the I-IV-V-I progression in the key of G',
          expectedProgression: ['G', 'C', 'D', 'G'],
          explanation: 'In G major: G(I) - C(IV) - D(V) - G(I). Same pattern, starting from G!'
        }
      ],
      passingScore: 2
    }
  },

  // =====================================================
  // Why Some Chords "Want" to Move
  // =====================================================
  {
    id: 'lesson-why-chords-move',
    path: 'beginner',
    title: 'Why Chords "Want" to Move',
    subtitle: 'Understanding tension and resolution',
    estimatedTime: '7 min',
    icon: '➡️',
    // No tutorial for this lesson yet

    learn: {
      introduction: `You've felt it - some chords feel "finished" and some feel like they need to go somewhere. But why?

**It comes down to tension and resolution.**

Some chord combinations have notes that are very close together, almost touching. These notes create tension - your ear wants them to move!

The most powerful example: **The V chord wants to go to I**

When you play G before C, two things happen:
1. The note B (in the G chord) is just one step below C - it wants to go UP
2. The note F (if it's G7) is just one step above E - it wants to go DOWN

These notes are like rubber bands being stretched. When they finally move to C and E, the tension releases. **That's resolution.**`,

      keyPoints: [
        {
          title: 'Tension is NOT bad',
          explanation: 'Without tension, music would be boring! Tension creates interest, drama, and the satisfaction of resolution.',
          analogy: 'Like in a story - the conflict makes the happy ending meaningful.'
        },
        {
          title: 'Half-step movement is magnetic',
          explanation: 'Notes that are just one half-step apart feel pulled toward each other, like magnets.',
          analogy: 'Like when you\'re one step from the finish line - you HAVE to complete it!'
        },
        {
          title: 'The "leading tone" leads home',
          explanation: 'The 7th note of any scale (B in C major) is called the "leading tone" because it leads so strongly to the home note.',
          analogy: 'It\'s like an arrow pointing home - once you hear it, you expect to arrive.'
        }
      ],

      summary: 'Chords move because certain notes create tension that wants to resolve. The V chord is the king of tension because it contains notes just a half-step away from the home chord.'
    },

    hearIt: {
      title: 'Feel the pull',
      examples: [
        {
          label: 'G7 → C (Strong resolution)',
          description: 'This is the most satisfying resolution in music. The tension in G7 MELTS into C.',
          playAction: { type: 'progression', chords: ['G7', 'C'] }
        },
        {
          label: 'Just the G7 (unresolved)',
          description: 'Feel how uncomfortable this is? It\'s screaming for a C chord!',
          playAction: { type: 'chord', root: 'G', chordType: 'dominant7' }
        },
        {
          label: 'C → G → ? (your brain expects C)',
          description: 'After G, your brain automatically expects C. It\'s almost involuntary!',
          playAction: { type: 'progression', chords: ['C', 'G'] }
        },
        {
          label: 'The "wrong" resolution: G → Am',
          description: 'This is called a "deceptive cadence" - it surprises your ear!',
          playAction: { type: 'progression', chords: ['G', 'Am'] }
        }
      ],
      famousSongs: [
        'End of "Happy Birthday" - V-I resolution',
        '"Amen" in hymns - IV-I resolution (different but also satisfying)',
        'Any classical piece ending - Almost always V-I'
      ]
    },

    tryIt: {
      title: 'Create and release tension',
      instructions: 'Experience how tension builds and releases.',
      exercises: [
        {
          step: 1,
          instruction: 'Build a G7 chord in the Chord Builder (G dominant 7)',
          hint: 'Root: G, Type: Dominant 7',
          validation: { type: 'chord_matches', root: 'G', chordType: 'dominant7' }
        },
        {
          step: 2,
          instruction: 'Play the G7 and sit with the tension',
          hint: 'Notice how your ear is waiting for something...',
          validation: { type: 'chord_played' }
        },
        {
          step: 3,
          instruction: 'Now quickly change to C major and play',
          hint: 'Ahh... the resolution! Doesn\'t that feel good?',
          validation: { type: 'chord_matches', root: 'C', chordType: 'major' }
        },
        {
          step: 4,
          instruction: 'Build a progression: C - Am - G7 - C',
          hint: 'Switch to Progression tab and build this sequence',
          validation: { type: 'progression_matches', chords: ['C', 'Am', 'G7', 'C'] }
        },
        {
          step: 5,
          instruction: 'Play the progression and notice where the tension peaks',
          hint: 'The G7 is the most tense moment - then it releases to C',
          validation: { type: 'progression_played' }
        }
      ],
      successMessage: 'You now understand the fundamental force that drives all Western music - the push and pull of tension and resolution!'
    },

    experiment: {
      title: 'Play with resolution',
      prompt: 'Explore different ways to create and resolve tension:',
      challenges: [
        {
          label: 'Try G7 → Am instead of G7 → C',
          hint: 'This is called a "deceptive cadence" - surprising but beautiful',
          solution: { progression: ['G7', 'Am'] }
        },
        {
          label: 'Build maximum tension: C - F - G7 - ?',
          hint: 'After G7, try going to C, Am, or even F. Which feels most resolved?',
          solution: { progression: ['C', 'F', 'G7'] }
        },
        {
          label: 'The "Amen" resolution: F → C',
          hint: 'This IV-I resolution is softer than V-I. Common in church music.',
          solution: { progression: ['F', 'C'] }
        }
      ],
      freePlay: {
        prompt: 'Create a progression that builds tension slowly, then releases it. Hint: Adding more chords before the V makes the eventual resolution even more satisfying!',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Tension and Resolution Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'Why does the G chord want to move to C?',
          options: [
            'Because G is louder than C',
            'Because notes in G are close to notes in C and want to resolve',
            'Because G and C are the same chord',
            'It doesn\'t - this is random'
          ],
          correctIndex: 1,
          explanation: 'The notes in G (especially B) are just a half-step away from notes in C. This closeness creates tension that wants to resolve.'
        },
        {
          id: 'q2',
          type: 'audio_identify',
          question: 'Listen. Does this resolution feel "complete" or "surprising"?',
          playAction: { type: 'progression', chords: ['G7', 'Am'] },
          options: ['Complete (expected)', 'Surprising (unexpected)'],
          correctIndex: 1,
          explanation: 'This is a "deceptive cadence" - we expect G7 to go to C, so Am is a surprise!'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'What is the "leading tone"?',
          options: [
            'The first note of a scale',
            'The loudest note in a chord',
            'The 7th note of a scale that leads to the home note',
            'Any note that moves'
          ],
          correctIndex: 2,
          explanation: 'The leading tone (7th scale degree, like B in C major) is called that because it "leads" so strongly back to the home note.'
        }
      ],
      passingScore: 2
    }
  },

  // =====================================================
  // Voice Leading: Smooth Chord Movement
  // =====================================================
  {
    id: 'lesson-voice-leading',
    path: 'beginner',
    title: 'Voice Leading: Smooth Chord Movement',
    subtitle: 'Making your progressions flow like a conversation',
    estimatedTime: '10 min',
    icon: '🎯',

    learn: {
      introduction: `You've learned to build progressions with I-IV-V-I and add emotion with minor chords. But have you noticed that sometimes chord changes sound jarring, while other times they flow smoothly?

**The secret is voice leading.**

Voice leading is the art of moving smoothly between chords by minimizing how far each individual note has to travel.

Think of it like this: imagine each note in a chord is a singer. When you change chords, each singer needs to move to their new note. Good voice leading means each singer takes the smallest possible step.

**The golden rule: Keep common tones, move others by step (1-2 semitones).**

For example, when moving from C (C-E-G) to Am (A-C-E):
- E stays in place (common tone!)
- C stays in place (common tone!)
- Only G moves to A (just one whole step)

That's beautiful voice leading - two notes don't move at all!`,

      keyPoints: [
        {
          title: 'Common tones are your friends',
          explanation: 'When two chords share notes, keep them in the same voice (same position). The fewer notes that move, the smoother the change.',
          analogy: 'Like a relay race - you want smooth handoffs, not everyone scrambling at once.'
        },
        {
          title: 'Small steps beat big leaps',
          explanation: 'When a note must move, prefer half-steps (1 semitone) or whole steps (2 semitones). Big jumps sound choppy.',
          analogy: 'Walking smoothly vs. jumping around - which looks more graceful?'
        },
        {
          title: 'Inversions enable smooth motion',
          explanation: 'This is why we learned inversions! Using the right inversion puts notes where they need to be for smooth voice leading.',
          analogy: 'Inversions are like rearranging people in a photo - same group, better arrangement.'
        },
        {
          title: 'Voice leading creates musical "gravity"',
          explanation: 'Good voice leading creates a sense of inevitability - each chord flows naturally to the next, like water finding its path.',
          analogy: 'A well-told story where each scene leads naturally to the next.'
        }
      ],

      summary: 'Voice leading is moving smoothly between chords by keeping common tones and moving other notes by the smallest possible distance. Using inversions strategically enables this smooth motion.'
    },

    hearIt: {
      title: 'Hear smooth voice leading in action',
      examples: [
        {
          label: 'C to Am: Two common tones!',
          description: 'C (C4-E4-G4) → Am 1st inv (C4-E4-A4). Listen: C and E stay at the SAME pitch! Only G moves up to A. That\'s beautiful voice leading.',
          playAction: {
            type: 'voiced_progression',
            voicings: [
              ['C4', 'E4', 'G4'],   // C major
              ['C4', 'E4', 'A4']    // Am 1st inversion - C and E stay!
            ]
          }
        },
        {
          label: 'C to F: Smooth stepwise motion',
          description: 'C (C4-E4-G4) → F 2nd inv (C4-F4-A4). The C stays put at C4, while E steps up to F and G steps up to A. All small movements!',
          playAction: {
            type: 'voiced_progression',
            voicings: [
              ['C4', 'E4', 'G4'],   // C major
              ['C4', 'F4', 'A4']    // F 2nd inversion - C stays, others step up
            ]
          }
        },
        {
          label: 'C-Am-F-G with voice leading',
          description: 'C root → Am 1st inv → F 2nd inv → G 1st inv. Watch the common tones: C,E stay for Am; C,A stay for F; then B in bass sets up the return home!',
          playAction: {
            type: 'voiced_progression',
            voicings: [
              ['C4', 'E4', 'G4'],   // C major root
              ['C4', 'E4', 'A4'],   // Am 1st inv - C,E stay
              ['C4', 'F4', 'A4'],   // F 2nd inv - C,A stay
              ['B3', 'D4', 'G4']    // G 1st inv - smooth bass B→C coming
            ]
          }
        },
        {
          label: 'C-D-E: Parallel motion (choppy)',
          description: 'ALL notes move up by the same amount. No common tones, no smooth connections. Compare this to the examples above!',
          playAction: {
            type: 'voiced_progression',
            voicings: [
              ['C4', 'E4', 'G4'],    // C major
              ['D4', 'F#4', 'A4'],   // D major - everything jumped
              ['E4', 'G#4', 'B4']    // E major - everything jumped again
            ]
          }
        }
      ],
      famousSongs: [
        'Bach chorales - The gold standard of voice leading',
        '"Yesterday" (Beatles) - Beautiful chromatic voice leading in the verse',
        'Most classical piano pieces - Voice leading is fundamental',
        'Jazz ballads - Use sophisticated voice leading constantly'
      ],
      note: 'In the Guided Exercise, you\'ll learn to create these smooth voicings yourself using inversions and octave shifts in the Progression Workshop!'
    },

    tryIt: {
      title: 'Build a smooth-flowing progression',
      instructions: 'Learn to apply voice leading principles in the Progression Workshop. We\'ll build a progression step by step, choosing inversions that create smooth voice leading.',
      exercises: [],
      successMessage: 'You\'ve learned the fundamentals of voice leading! Your progressions will now flow more naturally.'
    },

    experiment: {
      title: 'Practice voice leading',
      prompt: 'Explore how different inversions create different voice leading:',
      challenges: [
        {
          label: 'Build C-Am-F-G with smooth bass',
          hint: 'Try: C root, Am root, F/C (2nd inv), G/B (1st inv). Listen to the bass line!',
          solution: { progression: ['C', 'Am', 'F/C', 'G/B'] }
        },
        {
          label: 'Find the common tones between C and Em',
          hint: 'C = C-E-G, Em = E-G-B. Which notes appear in both?',
          solution: { note: 'E and G are common tones' }
        },
        {
          label: 'Create a descending bass line: C → B → A → G',
          hint: 'Use: C root, G/B, Am, G. The bass walks down smoothly!',
          solution: { progression: ['C', 'G/B', 'Am', 'G'] }
        }
      ],
      freePlay: {
        prompt: 'Try building any I-IV-V-I progression, then experiment with inversions until you find the smoothest sounding version. Notice how the recommended inversion feature often suggests voice-leading-friendly choices!',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Voice Leading Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'What is the main goal of voice leading?',
          options: [
            'Make chords louder',
            'Use only root position chords',
            'Minimize note movement between chords for smooth transitions',
            'Always move all notes in the same direction'
          ],
          correctIndex: 2,
          explanation: 'Voice leading is about creating smooth transitions by minimizing how far each note has to move between chords.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'What is a "common tone" in voice leading?',
          options: [
            'The loudest note in a chord',
            'A note that appears in both chords, so it doesn\'t need to move',
            'The root note of a chord',
            'A note that moves by a large interval'
          ],
          correctIndex: 1,
          explanation: 'Common tones are notes shared between two chords. Keeping them stationary creates the smoothest voice leading.'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'How do inversions help with voice leading?',
          options: [
            'They make chords louder',
            'They always sound better than root position',
            'They allow you to position notes for smoother movement',
            'They change the chord quality'
          ],
          correctIndex: 2,
          explanation: 'Inversions rearrange the notes of a chord, letting you place notes where they need to be for minimal movement to the next chord.'
        }
      ],
      passingScore: 2
    }
  },

  // =====================================================
  // The Most Popular Progression
  // =====================================================
  {
    id: 'lesson-popular-progression',
    path: 'beginner',
    title: 'The Most Popular Progression',
    subtitle: 'I-V-vi-IV: The four chords that dominate pop music',
    estimatedTime: '8 min',
    icon: '⭐',

    learn: {
      introduction: `There's a chord progression so popular that it's in literally hundreds of hit songs. It's been used in every decade since the 1950s.

**The "Axis" Progression: I - V - vi - IV**

In the key of C: **C - G - Am - F**

Why is it so popular?
- It has everything: happiness (C, G, F), emotion (Am), movement, and satisfaction
- It can loop forever without getting boring
- It works with almost any melody
- It creates that "anthemic" feeling that makes people sing along

Once you learn this progression, you'll hear it EVERYWHERE.`,

      keyPoints: [
        {
          title: 'The lowercase "vi" means minor',
          explanation: 'Roman numerals: UPPERCASE = major, lowercase = minor. So "vi" is the 6th chord, and it\'s minor.',
          analogy: 'Like capitalization in writing - big letters for major, small letters for minor.'
        },
        {
          title: 'The Am (vi) adds emotion',
          explanation: 'Three major chords would be too happy. The Am adds vulnerability and makes the progression deeper.',
          analogy: 'Like adding a touch of sadness to a happy story - it makes the joy more meaningful.'
        },
        {
          title: 'It rotates beautifully',
          explanation: 'You can start on ANY chord: vi-IV-I-V (sensitive), IV-I-V-vi (anthem), etc. Same chords, different feeling.',
          analogy: 'Like a diamond - same gem, but different facets catch the light differently.'
        }
      ],

      summary: 'I-V-vi-IV (C-G-Am-F) is the most used progression in pop music. It combines the stability of major chords with the emotion of one minor chord (the vi). It\'s versatile and can start from any chord.'
    },

    hearIt: {
      title: 'The progression that\'s everywhere',
      examples: [
        {
          label: 'I - V - vi - IV (C - G - Am - F)',
          description: 'The classic version. Starting strong, adding emotion, resolving warmly.',
          playAction: { type: 'progression', chords: ['C', 'G', 'Am', 'F'] }
        },
        {
          label: 'vi - IV - I - V (Am - F - C - G)',
          description: 'The "sensitive" rotation. Starting on minor creates immediate emotion.',
          playAction: { type: 'progression', chords: ['Am', 'F', 'C', 'G'] }
        },
        {
          label: 'IV - I - V - vi (F - C - G - Am)',
          description: 'The "anthem" rotation. Building to the emotional moment.',
          playAction: { type: 'progression', chords: ['F', 'C', 'G', 'Am'] }
        }
      ],
      famousSongs: [
        '"Let It Be" (Beatles) - I-V-vi-IV',
        '"With or Without You" (U2) - I-V-vi-IV',
        '"No Woman No Cry" (Bob Marley) - I-V-vi-IV',
        '"Someone Like You" (Adele) - starts vi-IV-I-V',
        '"Africa" (Toto) - vi-IV-I-V',
        '"Demons" (Imagine Dragons) - I-V-vi-IV',
        '"Despacito" - uses this progression'
      ]
    },

    // TRY IT Section - Guided Exercise defined in interactiveTutorial.js
    tryIt: {
      title: 'Build the hit progression with voice leading',
      instructions: 'First build C-G-Am-F in root position to hear the basic progression. Then apply voice leading techniques to make it flow smoothly!',
      exercises: [],
      successMessage: 'You just built the same progression used in billions of dollars worth of hit songs - with professional voice leading!'
    },

    experiment: {
      title: 'Try the rotations',
      prompt: 'Same four chords, different starting points - completely different feelings:',
      challenges: [
        {
          label: 'The "Sensitive" start: Am - F - C - G',
          hint: 'Start on the minor chord for immediate emotion',
          solution: { progression: ['Am', 'F', 'C', 'G'] }
        },
        {
          label: 'The "Anthem" start: F - C - G - Am',
          hint: 'Building toward the emotional Am at the end',
          solution: { progression: ['F', 'C', 'G', 'Am'] }
        },
        {
          label: 'Try adding 7ths: Cmaj7 - G - Am7 - Fmaj7',
          hint: 'Adding 7ths makes it more sophisticated/jazzy',
          solution: { progression: ['Cmaj7', 'G', 'Am7', 'Fmaj7'] }
        }
      ],
      freePlay: {
        prompt: 'Put on any pop song from the radio. There\'s about a 40% chance it uses this progression! Try to identify it by ear.',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Pop Progression Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'In I-V-vi-IV, why is "vi" written in lowercase?',
          options: [
            'It\'s a typo',
            'It\'s less important',
            'It\'s a minor chord',
            'It\'s played quieter'
          ],
          correctIndex: 2,
          explanation: 'Lowercase Roman numerals indicate minor chords. So "vi" is the 6th chord and it\'s minor (Am in the key of C).'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'What makes this progression so versatile?',
          options: [
            'It only works in one key',
            'You can start on any of the 4 chords for different feelings',
            'It has only major chords',
            'It\'s very difficult to play'
          ],
          correctIndex: 1,
          explanation: 'You can rotate the starting point: I-V-vi-IV (standard), vi-IV-I-V (sensitive), IV-I-V-vi (anthem). Same chords, different moods!'
        },
        {
          id: 'q3',
          type: 'progression_build',
          question: 'Build the "sensitive" rotation starting on vi in the key of C',
          expectedProgression: ['Am', 'F', 'C', 'G'],
          explanation: 'Starting on Am creates immediate emotion, making it popular for ballads and emotional songs.'
        }
      ],
      passingScore: 2
    }
  },

  // =====================================================
  // Adding Emotion with Minor Chords
  // =====================================================
  {
    id: 'lesson-adding-emotion',
    path: 'beginner',
    title: 'Adding Emotion with Minor Chords',
    subtitle: 'Using minor chords to deepen your progressions',
    estimatedTime: '7 min',
    icon: '💫',
    // No tutorial for this lesson yet

    learn: {
      introduction: `You know major vs minor. You know the popular progressions. Now let's learn to **intentionally craft emotion** using minor chords.

In any major key, three chords are naturally minor:
- **ii** (2) - D minor in C
- **iii** (3) - E minor in C
- **vi** (6) - A minor in C

Each one has a different emotional flavor:
- **ii (Dm)** - Thoughtful, preparing for something
- **iii (Em)** - Mysterious, ambiguous
- **vi (Am)** - Sad, emotional, vulnerable

By choosing which minor chords to use (and where), you control the emotional journey of your song.`,

      keyPoints: [
        {
          title: 'The ii chord is a "pre-tension" chord',
          explanation: 'ii (Dm) naturally leads to V (G). The progression ii-V-I is jazz\'s most important pattern!',
          analogy: 'Like taking a deep breath before the big moment.'
        },
        {
          title: 'The iii chord is the chameleon',
          explanation: 'Em can feel like a dark C or a bright Am. It\'s ambiguous and creates mystery.',
          analogy: 'Like twilight - neither fully day nor night.'
        },
        {
          title: 'The vi chord is pure emotion',
          explanation: 'Am in C major carries the most emotional weight. It\'s the "relative minor" of C.',
          analogy: 'Like the vulnerable moment in a happy story - it makes everything more real.'
        }
      ],

      summary: 'Every major key has three naturally minor chords (ii, iii, vi). Each adds different emotion: ii is preparatory, iii is mysterious, vi is emotional. Choosing which to use shapes your song\'s feeling.'
    },

    hearIt: {
      title: 'Feel each minor chord\'s character',
      examples: [
        {
          label: 'C - Dm - G - C (using ii)',
          description: 'The Dm creates a thoughtful pause before G\'s tension. Very smooth.',
          playAction: { type: 'progression', chords: ['C', 'Dm', 'G', 'C'] }
        },
        {
          label: 'C - Em - F - G (using iii)',
          description: 'The Em adds mystery. Where are we going? The ambiguity is interesting.',
          playAction: { type: 'progression', chords: ['C', 'Em', 'F', 'G'] }
        },
        {
          label: 'C - Am - F - G (using vi)',
          description: 'The Am is pure emotion. This is the "I can\'t help falling" feel.',
          playAction: { type: 'progression', chords: ['C', 'Am', 'F', 'G'] }
        },
        {
          label: 'C - Am - Dm - G (using both vi and ii)',
          description: 'Double minor! Very emotional, then building to resolution.',
          playAction: { type: 'progression', chords: ['C', 'Am', 'Dm', 'G'] }
        }
      ],
      famousSongs: [
        '"Can\'t Help Falling in Love" (Elvis) - Uses vi prominently',
        '"Autumn Leaves" - ii-V-I jazz standard',
        '"Stairway to Heaven" (Led Zeppelin) - Uses iii for mystery',
        '"All of Me" (John Legend) - Beautiful use of ii and vi'
      ]
    },

    // Try It section is now a guided exercise - see interactiveTutorial.js addingEmotionTutorial
    tryIt: null,

    experiment: {
      title: 'Mix and match minor chords',
      prompt: 'Try these combinations to find your favorites:',
      challenges: [
        {
          label: 'All three minors: C - Am - Em - Dm - G - C',
          hint: 'A longer journey using all the minor chords',
          solution: { progression: ['C', 'Am', 'Em', 'Dm', 'G', 'C'] }
        },
        {
          label: 'The mysterious path: Em - Am - Dm - G',
          hint: 'Starting on iii (Em) is unusual and creates instant intrigue',
          solution: { progression: ['Em', 'Am', 'Dm', 'G'] }
        },
        {
          label: 'Maximum emotion: Am - Em - Dm - G - Am',
          hint: 'A minor-focused progression that stays in the emotional space',
          solution: { progression: ['Am', 'Em', 'Dm', 'G', 'Am'] }
        }
      ],
      freePlay: {
        prompt: 'Create your own progression using at least two minor chords. Which minor chord is your favorite? Try starting a progression on each of ii, iii, and vi to see how different they feel.',
        openBuilder: true
      }
    },

    quiz: {
      title: 'Minor Chord Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'In the key of C major, which three chords are naturally minor?',
          options: [
            'C, F, G',
            'Dm, Em, Am (ii, iii, vi)',
            'Cm, Fm, Gm',
            'Bb, Eb, Ab'
          ],
          correctIndex: 1,
          explanation: 'In any major key, the ii, iii, and vi chords are naturally minor. In C major: Dm, Em, Am.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'What is special about the ii-V progression (like Dm-G)?',
          options: [
            'It\'s the loudest progression',
            'It creates strong forward motion toward the I chord',
            'It only works in jazz',
            'It uses only major chords'
          ],
          correctIndex: 1,
          explanation: 'The ii-V progression creates powerful forward motion toward resolution. It\'s the foundation of jazz harmony!'
        },
        {
          id: 'q3',
          type: 'audio_identify',
          question: 'Listen to this progression. Which minor chord creates the main emotional moment?',
          playAction: { type: 'progression', chords: ['C', 'Am', 'F', 'G'] },
          options: ['Dm (ii)', 'Em (iii)', 'Am (vi)'],
          correctIndex: 2,
          explanation: 'The Am (vi) chord is the emotional heart of this progression. It creates that vulnerable, touching feeling.'
        }
      ],
      passingScore: 2
    }
  }
];

export default beginnerLessons;
