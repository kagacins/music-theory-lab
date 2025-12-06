/**
 * Foundational Learning Path
 *
 * These lessons cover the absolute basics of music theory before
 * introducing chords. Perfect for complete beginners.
 *
 * All exercises use the embedded virtual piano keyboard within the lesson.
 * No need to navigate to other tabs until the chord lessons.
 *
 * LESSON ORDERING:
 * - Lessons are numbered automatically based on array position (see index.js)
 * - To reorder lessons, simply move them in this array
 * - IDs are semantic (no numbers) for stability when reordering
 * - Tutorials are mapped by ID in lessonViewer.js (to avoid circular imports)
 */

export const foundationalLessons = [
  // =====================================================
  // What is a Note?
  // =====================================================
  {
    id: 'lesson-what-is-note',
    path: 'beginner',
    title: 'What is a Note?',
    subtitle: 'Understanding the basic building blocks of music',
    estimatedTime: '5 min',
    icon: '🎹',

    // LEARN Section
    learn: {
      introduction: `Music is made of **sounds**, and the most fundamental sound in music is called a **note**.

A note is a single, specific pitch - like pressing one key on a piano or plucking one string on a guitar.

Notes are named using the first seven letters of the alphabet: **A, B, C, D, E, F, G**

After G, the pattern repeats: A, B, C, D, E, F, G, A, B, C...

On a piano, the **white keys** play these seven notes. The pattern of white and black keys repeats over and over across the entire keyboard.`,

      keyPoints: [
        {
          title: 'Notes are named A through G',
          explanation: 'Musicians use only 7 letter names for notes: A, B, C, D, E, F, G. After G, we start over at A.',
          analogy: 'Like days of the week - after Sunday comes Monday, the cycle repeats.'
        },
        {
          title: 'The white keys are the natural notes',
          explanation: 'On a piano, the white keys play the "natural" notes - A, B, C, D, E, F, G. These are the foundation of Western music.',
          analogy: 'Think of white keys as the main characters, black keys as supporting characters.'
        },
        {
          title: 'C is often our starting point',
          explanation: 'While the notes go A-G, musicians often start with C. The C major scale (all white keys) is the most common starting point for learning.',
          analogy: 'Like how "1" is the start of counting, even though numbers go on forever.'
        },
        {
          title: 'Finding C on a piano',
          explanation: 'Look for groups of 2 black keys. The white key immediately to the LEFT of any group of 2 black keys is always C.',
          analogy: 'It\'s like a landmark - once you find C, you can figure out all the other notes.'
        }
      ],

      summary: 'A note is a single musical pitch. Notes are named A through G and then repeat. On a piano, white keys play these natural notes, and C (left of the 2 black keys) is our starting reference point.'
    },

    // HEAR IT Section
    hearIt: {
      title: 'Listen to individual notes',
      examples: [
        {
          label: 'Middle C (the most famous note)',
          description: 'This is "middle C" - the C near the center of a piano. It\'s the starting point for almost everything.',
          playAction: { type: 'single_note', note: 'C4' }
        },
        {
          label: 'D (the next white key)',
          description: 'One white key to the right of C. Notice it sounds "higher" than C.',
          playAction: { type: 'single_note', note: 'D4' }
        },
        {
          label: 'E, F, G (continuing up)',
          description: 'Listen to each note going higher and higher.',
          playAction: { type: 'sequence', notes: ['E4', 'F4', 'G4'], tempo: 100 }
        },
        {
          label: 'The full scale: C to C',
          description: 'All 8 white keys from C to the next C. This is the C major scale!',
          playAction: { type: 'sequence', notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], tempo: 120 }
        }
      ],
      famousSongs: [
        '"Do-Re-Mi" (Sound of Music) - teaches the scale C-D-E-F-G-A-B-C',
        '"Mary Had a Little Lamb" - uses just 3 notes: E, D, C',
        '"Twinkle Twinkle Little Star" - C, C, G, G, A, A, G'
      ]
    },

    // TRY IT Section - Uses embedded keyboard
    tryIt: {
      title: 'Find and play notes',
      instructions: 'Use the virtual piano keyboard above to explore individual notes. Click or tap the keys to hear them!',
      useEmbeddedKeyboard: true,
      exercises: [
        {
          step: 1,
          instruction: 'Find and play middle C (it\'s labeled on the keyboard)',
          hint: 'C is the white key to the left of the 2 black keys',
          validation: { type: 'play_note', value: 'C' }
        },
        {
          step: 2,
          instruction: 'Now play D - the next white key to the right',
          hint: 'D is between the two black keys',
          validation: { type: 'play_note', value: 'D' }
        },
        {
          step: 3,
          instruction: 'Play E, then F, then G',
          hint: 'Notice how each note sounds higher than the last',
          validation: { type: 'play_sequence', value: ['E', 'F', 'G'] }
        },
        {
          step: 4,
          instruction: 'Continue with A and B',
          hint: 'A and B come before C in the alphabet, but sound higher on the keyboard!',
          validation: { type: 'play_sequence', value: ['A', 'B'] }
        },
        {
          step: 5,
          instruction: 'Play the complete scale: C, D, E, F, G, A, B, then the next C',
          hint: 'The second C is one octave higher - same note, higher pitch',
          validation: { type: 'play_sequence', value: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'] }
        }
      ],
      successMessage: 'Excellent! You\'ve learned the seven natural notes: C, D, E, F, G, A, B. These are the foundation of all Western music!'
    },

    // EXPERIMENT Section - Uses embedded keyboard
    experiment: {
      title: 'Explore the natural notes',
      prompt: 'Use the keyboard below to experiment with different notes:',
      useEmbeddedKeyboard: true,
      challenges: [
        {
          label: 'Play "Mary Had a Little Lamb"',
          hint: 'The notes are: E, D, C, D, E, E, E - try playing them in rhythm!',
          solution: { sequence: ['E', 'D', 'C', 'D', 'E', 'E', 'E'] }
        },
        {
          label: 'Play all 7 notes in order, then backwards',
          hint: 'Forward: C-D-E-F-G-A-B. Backward: B-A-G-F-E-D-C',
          solution: { explore: true }
        },
        {
          label: 'Play notes randomly and listen',
          hint: 'Get used to how each note sounds - can you start to recognize them by ear?',
          solution: { explore: true }
        }
      ],
      freePlay: {
        prompt: 'Play around with the keyboard! Try to find your own melodies using only the white keys.',
        useEmbeddedKeyboard: true
      }
    },

    // QUIZ Section
    quiz: {
      title: 'Test your knowledge',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'How many natural note names are there in music?',
          options: ['5 notes', '7 notes (A-G)', '12 notes', '26 notes (full alphabet)'],
          correctIndex: 1,
          explanation: 'There are 7 natural notes: A, B, C, D, E, F, G. After G, the pattern repeats starting at A again.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'How do you find C on a piano?',
          options: [
            'It\'s the first white key on the left',
            'It\'s the white key to the LEFT of any group of 2 black keys',
            'It\'s the white key to the RIGHT of any group of 3 black keys',
            'It\'s always in the exact middle of the piano'
          ],
          correctIndex: 1,
          explanation: 'C is always the white key immediately to the left of a group of 2 black keys. This pattern repeats across the keyboard.'
        },
        {
          id: 'q3',
          type: 'audio_identify',
          question: 'Listen to these two notes. Which one is higher?',
          playAction: { type: 'comparison', notes: ['C4', 'G4'] },
          options: ['The first note (C)', 'The second note (G)'],
          correctIndex: 1,
          explanation: 'G is higher than C because it\'s further up the keyboard (or later in the alphabet from C).'
        }
      ],
      passingScore: 2
    }
  },

  // =====================================================
  // Sharps, Flats & Half Steps
  // =====================================================
  {
    id: 'lesson-sharps-flats',
    path: 'beginner',
    title: 'Sharps, Flats & Half Steps',
    subtitle: 'Understanding the black keys and the spaces between notes',
    estimatedTime: '6 min',
    icon: '♯♭',

    learn: {
      introduction: `You know the 7 white keys: A, B, C, D, E, F, G. But what about the **black keys**?

The black keys are the notes **in between** the white keys. They're named using two symbols:

- **Sharp (#)** = "raised" = one step HIGHER
- **Flat (b)** = "lowered" = one step LOWER

So the black key between C and D can be called:
- **C# (C sharp)** - C raised up
- **Db (D flat)** - D lowered down

They're the SAME key with two names! This is called an **enharmonic equivalent**.

The distance from one key to the very next key (black or white) is called a **half step** or **semitone**. This is the smallest step in Western music.`,

      keyPoints: [
        {
          title: 'Sharp (#) raises a note',
          explanation: 'Adding a sharp to any note makes it one half step higher. C# is one step above C.',
          analogy: 'Like turning up the volume by one click - a small but noticeable change.'
        },
        {
          title: 'Flat (b) lowers a note',
          explanation: 'Adding a flat to any note makes it one half step lower. Db is one step below D.',
          analogy: 'Like going down one stair step - not far, but definitely down.'
        },
        {
          title: 'Same sound, two names',
          explanation: 'C# and Db are the exact same key! The name depends on musical context. This is true for all black keys.',
          analogy: 'Like "William" and "Bill" - same person, different names depending on the situation.'
        },
        {
          title: 'There are 12 unique notes',
          explanation: '7 natural notes + 5 black keys = 12 total unique notes. After 12 half steps, you\'re back to the same note, just higher.',
          analogy: 'Like a clock with 12 hours - after 12, you\'re back where you started.'
        }
      ],

      summary: 'Sharps (#) raise notes one half step, flats (b) lower them. Black keys have two names (C#/Db, D#/Eb, etc.). There are 12 unique notes total, and a half step is the smallest distance between any two notes.'
    },

    hearIt: {
      title: 'Hear the half steps',
      examples: [
        {
          label: 'C to C# (one half step up)',
          description: 'A tiny step higher - this is the smallest musical interval.',
          playAction: { type: 'sequence', notes: ['C4', 'C#4'], tempo: 80 }
        },
        {
          label: 'D to Db (one half step down)',
          description: 'Same distance, going down instead.',
          playAction: { type: 'sequence', notes: ['D4', 'Db4'], tempo: 80 }
        },
        {
          label: 'All 12 notes (chromatic scale)',
          description: 'Every note from C to the next C, using only half steps.',
          playAction: { type: 'sequence', notes: ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5'], tempo: 100 }
        },
        {
          label: 'C# vs Db (same note!)',
          description: 'Listen - they\'re identical! Just different names.',
          playAction: { type: 'comparison', notes: ['C#4', 'Db4'] }
        }
      ],
      famousSongs: [
        '"Jaws" theme - uses half steps for tension (E-F, E-F)',
        '"Pink Panther" - chromatic movement (lots of half steps)',
        '"Flight of the Bumblebee" - rapid chromatic scales'
      ]
    },

    // TRY IT Section - Uses embedded keyboard
    tryIt: {
      title: 'Explore sharps and flats',
      instructions: 'Use the virtual piano keyboard to hear sharps and flats. Click both white and black keys!',
      useEmbeddedKeyboard: true,
      exercises: [
        {
          step: 1,
          instruction: 'Play C, then the black key immediately to its right (C#)',
          hint: 'This is one half step - the smallest distance in music!',
          validation: { type: 'play_sequence', value: ['C', 'C#'] }
        },
        {
          step: 2,
          instruction: 'Now play D, then C# (the black key to its left)',
          hint: 'Going DOWN from D, this same key is called Db (D flat)',
          validation: { type: 'play_sequence', value: ['D', 'C#'] }
        },
        {
          step: 3,
          instruction: 'Play all 5 black keys from left to right',
          hint: 'C#, D#, F#, G#, A# (or Db, Eb, Gb, Ab, Bb)',
          validation: { type: 'play_sequence', value: ['C#', 'D#', 'F#', 'G#', 'A#'] }
        },
        {
          step: 4,
          instruction: 'Play E, then F - notice there\'s NO black key between them!',
          hint: 'E to F is already a half step, even though both are white keys',
          validation: { type: 'play_sequence', value: ['E', 'F'] }
        },
        {
          step: 5,
          instruction: 'Same with B and C - play them and notice no black key between',
          hint: 'B to C is the other "natural half step"',
          validation: { type: 'play_sequence', value: ['B', 'C'] }
        }
      ],
      successMessage: 'You understand sharps and flats! Remember: # = up a half step, b = down a half step, and there are 12 unique notes total.'
    },

    // EXPERIMENT Section - Uses embedded keyboard
    experiment: {
      title: 'Half step adventures',
      prompt: 'Explore the chromatic scale and enharmonic equivalents:',
      useEmbeddedKeyboard: true,
      challenges: [
        {
          label: 'Play the "Jaws" theme: E, F, E, F, E, F (getting faster!)',
          hint: 'E to F is a half step (no black key between) - this creates tension!',
          solution: { sequence: ['E', 'F', 'E', 'F', 'E', 'F'] }
        },
        {
          label: 'Play the chromatic scale: every key from C to C',
          hint: 'C, C#, D, D#, E, F, F#, G, G#, A, A#, B, C (12 half steps!)',
          solution: { sequence: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C'] }
        },
        {
          label: 'Find both natural half steps (no black key between white keys)',
          hint: 'E-F and B-C are the only white key pairs that are next-door neighbors',
          solution: { pairs: [['E', 'F'], ['B', 'C']] }
        }
      ],
      freePlay: {
        prompt: 'Experiment with half steps! Try playing C-C#-D-C#-C (up and back). Notice how the small steps create a slithering, sneaky sound.',
        useEmbeddedKeyboard: true
      }
    },

    quiz: {
      title: 'Sharps & Flats Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'What does a sharp (#) do to a note?',
          options: [
            'Makes it louder',
            'Raises it by one half step',
            'Lowers it by one half step',
            'Makes it longer'
          ],
          correctIndex: 1,
          explanation: 'A sharp (#) raises a note by one half step. C# is one half step higher than C.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'C# and Db are:',
          options: [
            'Different notes that sound similar',
            'The exact same note with two different names',
            'Only the same on certain instruments',
            'Never used in the same song'
          ],
          correctIndex: 1,
          explanation: 'C# and Db are enharmonic equivalents - the same exact pitch with two names. All black keys have two names.'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'How many unique notes are there in Western music?',
          options: ['7 (A through G)', '10 (white and black keys)', '12 (all the keys before the pattern repeats)', '88 (all piano keys)'],
          correctIndex: 2,
          explanation: '7 natural notes + 5 sharps/flats = 12 unique notes. After 12 half steps, you reach the same note in a higher octave.'
        }
      ],
      passingScore: 2
    }
  },

  // =====================================================
  // Octaves & Whole Steps
  // =====================================================
  {
    id: 'lesson-octaves',
    path: 'beginner',
    title: 'Octaves & Whole Steps',
    subtitle: 'Understanding how notes repeat and the bigger step',
    estimatedTime: '5 min',
    icon: '🔄',

    learn: {
      introduction: `You've learned there are 12 unique notes. But a piano has 88 keys! How does that work?

**The notes REPEAT in higher and lower versions.**

When you go up 12 half steps from any note, you reach the SAME note - just higher. This distance is called an **octave**.

- C → (12 half steps) → C (one octave higher)
- The higher C sounds "the same but higher" - it's vibrating exactly twice as fast!

Musicians number the octaves to tell them apart:
- **C4** = "Middle C" (middle of the piano)
- **C5** = One octave higher than middle C
- **C3** = One octave lower than middle C

We also need to understand **whole steps** (also called "tones"):
- A **half step** = one key to the next (smallest step)
- A **whole step** = two half steps = skipping one key`,

      keyPoints: [
        {
          title: 'An octave is 12 half steps',
          explanation: 'When you play all 12 notes and land on the same letter again, that\'s an octave. The two notes sound like "the same note, but different."',
          analogy: 'Like your voice and someone singing the same melody but higher - same tune, different register.'
        },
        {
          title: 'Numbers identify the octave',
          explanation: 'C4 (middle C), C5 (higher), C3 (lower). The number tells you WHICH C on the piano.',
          analogy: 'Like apartment numbers in a building - same floor plan, different floors.'
        },
        {
          title: 'A whole step = 2 half steps',
          explanation: 'C to D is a whole step (skipping C#). This is the distance between most neighboring white keys.',
          analogy: 'If a half step is one stair, a whole step is skipping a stair.'
        },
        {
          title: 'E-F and B-C are only half steps',
          explanation: 'There\'s no black key between E-F or B-C, so these white key pairs are only one half step apart!',
          analogy: 'These are the "short stairs" in the staircase.'
        }
      ],

      summary: 'An octave is 12 half steps - the distance until a note repeats. Notes are numbered by octave (C4 = middle C). A whole step equals 2 half steps. Most white keys are a whole step apart, except E-F and B-C (half steps).'
    },

    hearIt: {
      title: 'Hear octaves and whole steps',
      examples: [
        {
          label: 'Middle C and one octave higher (C4 and C5)',
          description: 'These are both "C" - one sounds higher but they\'re clearly related.',
          playAction: { type: 'sequence', notes: ['C4', 'C5'], tempo: 60 }
        },
        {
          label: 'C4, C5, and C6 (three C\'s)',
          description: 'The same note in three different octaves.',
          playAction: { type: 'sequence', notes: ['C4', 'C5', 'C6'], tempo: 80 }
        },
        {
          label: 'A whole step: C to D',
          description: 'Two half steps - we skip over C#.',
          playAction: { type: 'sequence', notes: ['C4', 'D4'], tempo: 60 }
        },
        {
          label: 'Half step vs whole step',
          description: 'E to F (half step), then E to F# (whole step). Hear the difference?',
          playAction: { type: 'sequence', notes: ['E4', 'F4', 'E4', 'F#4'], tempo: 80 }
        },
        {
          label: 'C4 and C5 together',
          description: 'When played together, octaves sound very "pure" - they blend perfectly.',
          playAction: { type: 'chord_custom', notes: ['C4', 'C5'] }
        }
      ],
      famousSongs: [
        '"Somewhere Over the Rainbow" - opens with an octave leap',
        '"Singin\' in the Rain" - famous octave jump at the start',
        'Many songs use octaves in bass lines for a full sound'
      ]
    },

    // TRY IT Section - Uses embedded keyboard
    tryIt: {
      title: 'Explore octaves and steps',
      instructions: 'Use the virtual piano keyboard to compare octaves and steps. This keyboard shows 3 octaves!',
      useEmbeddedKeyboard: true,
      exercises: [
        {
          step: 1,
          instruction: 'Play the lower C, then the higher C on the keyboard',
          hint: 'Both are labeled "C" - they sound the same but at different pitches',
          validation: { type: 'play_sequence', value: ['C4', 'C5'] }
        },
        {
          step: 2,
          instruction: 'Play C, then D - this is a WHOLE step (2 half steps)',
          hint: 'Notice we skip over C# between them',
          validation: { type: 'play_sequence', value: ['C', 'D'] }
        },
        {
          step: 3,
          instruction: 'Play E, then F - this is only a HALF step',
          hint: 'No black key between E and F!',
          validation: { type: 'play_sequence', value: ['E', 'F'] }
        },
        {
          step: 4,
          instruction: 'Play B, then C - the other natural half step',
          hint: 'B to C is also a half step - no black key between them',
          validation: { type: 'play_sequence', value: ['B', 'C'] }
        },
        {
          step: 5,
          instruction: 'Play up the white keys from C: notice which steps feel bigger',
          hint: 'C-D (big), D-E (big), E-F (small), F-G (big), G-A (big), A-B (big), B-C (small)',
          validation: { type: 'explore' }
        }
      ],
      successMessage: 'You\'ve learned about octaves and the difference between whole and half steps! This pattern (W-W-H-W-W-W-H) is the major scale - coming up next!'
    },

    // EXPERIMENT Section - Uses embedded keyboard
    experiment: {
      title: 'Step size exploration',
      prompt: 'Discover the step patterns on the keyboard:',
      useEmbeddedKeyboard: true,
      challenges: [
        {
          label: 'Play both C\'s on the keyboard together (if possible)',
          hint: 'Octaves played together sound very pure and powerful',
          solution: { notes: ['C4', 'C5'] }
        },
        {
          label: 'Count whole vs half steps from C to C',
          hint: 'C-D (W), D-E (W), E-F (H), F-G (W), G-A (W), A-B (W), B-C (H) = 5 whole + 2 half',
          solution: { explore: true }
        },
        {
          label: 'Play the "Somewhere Over the Rainbow" octave leap',
          hint: 'The word "Some-" goes from C to high C - a full octave jump!',
          solution: { notes: ['C4', 'C5'] }
        }
      ],
      freePlay: {
        prompt: 'Try jumping between octaves! Play low C, then high C, then back. Feel how they\'re the "same" note at different heights.',
        useEmbeddedKeyboard: true
      }
    },

    quiz: {
      title: 'Octaves & Steps Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'How many half steps are in one octave?',
          options: ['7 half steps', '8 half steps', '12 half steps', '14 half steps'],
          correctIndex: 2,
          explanation: 'One octave = 12 half steps. After 12 half steps, you land on the same note in a higher octave.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'Which pairs of white keys are only a half step apart?',
          options: ['C-D and F-G', 'E-F and B-C', 'A-B and D-E', 'All white keys are a whole step apart'],
          correctIndex: 1,
          explanation: 'E-F and B-C are the only white key pairs with no black key between them, making them half steps.'
        },
        {
          id: 'q3',
          type: 'multiple_choice',
          question: 'What does "C4" mean?',
          options: [
            'The 4th C from the left on a piano',
            'A C chord with 4 notes',
            'C in the 4th octave (middle C)',
            'C played 4 times'
          ],
          correctIndex: 2,
          explanation: 'C4 means "C in the 4th octave" - this is middle C, near the center of a standard piano.'
        }
      ],
      passingScore: 2
    }
  },

  // =====================================================
  // Introduction to Scales
  // =====================================================
  {
    id: 'lesson-scales',
    path: 'beginner',
    title: 'Introduction to Scales',
    subtitle: 'The patterns that create different moods in music',
    estimatedTime: '7 min',
    icon: '🎼',

    learn: {
      introduction: `A **scale** is a set of notes arranged in order from low to high (or high to low).

Scales are like musical "color palettes" - they determine which notes sound good together in a piece of music.

The most important scale is the **major scale**. It follows a specific pattern of whole steps (W) and half steps (H):

**W - W - H - W - W - W - H**

Starting from C and following this pattern (using only white keys):
C → D → E → F → G → A → B → C

This is the **C major scale** - the most common scale in Western music!

The pattern creates that "happy, resolved" sound we associate with major keys. The last note (C again) is one octave higher than where we started.`,

      keyPoints: [
        {
          title: 'The major scale pattern: W-W-H-W-W-W-H',
          explanation: 'This pattern works from ANY starting note. It\'s like a recipe - same pattern, different ingredients, same type of result.',
          analogy: 'Like a cookie recipe that works whether you make chocolate chip or peanut butter cookies.'
        },
        {
          title: 'The C major scale uses all white keys',
          explanation: 'C major is special because it fits perfectly on the white keys. That\'s why it\'s often the first scale people learn.',
          analogy: 'It\'s the "training wheels" scale - no sharps or flats to worry about.'
        },
        {
          title: 'Scales create a "home" feeling',
          explanation: 'The first note of a scale (called the "tonic") feels like home. Other notes want to return to it.',
          analogy: 'Like how "home base" in a game is where you feel safe.'
        },
        {
          title: 'Each key has its own scale',
          explanation: 'G major, D major, F major - all follow the same W-W-H-W-W-W-H pattern, just starting from different notes.',
          analogy: 'Like singing "Happy Birthday" in different keys - same tune, different starting pitch.'
        }
      ],

      summary: 'A scale is an ordered set of notes following a pattern. The major scale uses W-W-H-W-W-W-H (whole and half steps). C major (all white keys) is the most common scale. Other major scales follow the same pattern from different starting notes.'
    },

    hearIt: {
      title: 'Listen to scales',
      examples: [
        {
          label: 'C major scale (ascending)',
          description: 'The "Do-Re-Mi" scale - all white keys from C to C.',
          playAction: { type: 'sequence', notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], tempo: 120 }
        },
        {
          label: 'C major scale (descending)',
          description: 'Going back down - notice how it feels like "coming home" when you reach C.',
          playAction: { type: 'sequence', notes: ['C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4'], tempo: 120 }
        },
        {
          label: 'G major scale',
          description: 'Starting from G, we need one sharp (F#) to keep the pattern!',
          playAction: { type: 'sequence', notes: ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'], tempo: 120 }
        },
        {
          label: 'Compare: C major vs C minor',
          description: 'Different scale patterns create completely different moods.',
          playAction: { type: 'comparison_sequences',
            sequences: [
              ['C4', 'D4', 'E4', 'F4', 'G4'],
              ['C4', 'D4', 'Eb4', 'F4', 'G4']
            ],
            tempo: 120
          }
        }
      ],
      famousSongs: [
        '"Do-Re-Mi" (Sound of Music) - teaches the major scale',
        '"Joy to the World" - descending major scale in the melody',
        'Almost all nursery rhymes use the major scale'
      ]
    },

    // TRY IT Section - Uses embedded keyboard
    tryIt: {
      title: 'Build and play the major scale',
      instructions: 'Use the virtual piano keyboard to play the C major scale. Follow the step pattern!',
      useEmbeddedKeyboard: true,
      exercises: [
        {
          step: 1,
          instruction: 'Start with C - this is "Do" (the first note of the scale)',
          hint: 'C is the "home base" of the C major scale',
          validation: { type: 'play_note', value: 'C' }
        },
        {
          step: 2,
          instruction: 'Go up a WHOLE step to D (that\'s "Re")',
          hint: 'C to D skips over C# - a whole step',
          validation: { type: 'play_note', value: 'D' }
        },
        {
          step: 3,
          instruction: 'Another WHOLE step to E (that\'s "Mi")',
          hint: 'D to E skips over D#',
          validation: { type: 'play_note', value: 'E' }
        },
        {
          step: 4,
          instruction: 'Now a HALF step to F (that\'s "Fa") - no black key between E and F!',
          hint: 'E to F is naturally a half step',
          validation: { type: 'play_note', value: 'F' }
        },
        {
          step: 5,
          instruction: 'Continue to G, A, B, then C again to complete the scale',
          hint: 'G-A-B are whole steps, B-C is another half step, then you\'re home!',
          validation: { type: 'play_sequence', value: ['G', 'A', 'B', 'C'] }
        }
      ],
      successMessage: 'You played the C major scale! The pattern W-W-H-W-W-W-H is the foundation of most Western music.'
    },

    // EXPERIMENT Section - Uses embedded keyboard
    experiment: {
      title: 'Scale exploration',
      prompt: 'Explore scale patterns on the keyboard:',
      useEmbeddedKeyboard: true,
      challenges: [
        {
          label: 'Play the C major scale up and down',
          hint: 'C-D-E-F-G-A-B-C then back down C-B-A-G-F-E-D-C',
          solution: { scale: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'B', 'A', 'G', 'F', 'E', 'D', 'C'] }
        },
        {
          label: 'Play "Twinkle Twinkle" using the C major scale',
          hint: 'C-C-G-G-A-A-G (pause) F-F-E-E-D-D-C',
          solution: { explore: true }
        },
        {
          label: 'Feel where the half steps are',
          hint: 'Play slowly from C to C and notice E-F and B-C feel "closer"',
          solution: { explore: true }
        }
      ],
      freePlay: {
        prompt: 'Make up melodies using only the white keys! Since you\'re in C major, they\'ll all sound musical.',
        useEmbeddedKeyboard: true
      }
    },

    quiz: {
      title: 'Scales Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'What is the pattern for a major scale?',
          options: [
            'H-H-W-H-H-W-H',
            'W-W-H-W-W-W-H',
            'W-H-W-H-W-H-W',
            'H-W-W-W-H-W-W'
          ],
          correctIndex: 1,
          explanation: 'The major scale pattern is W-W-H-W-W-W-H (Whole-Whole-Half-Whole-Whole-Whole-Half).'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'Why is the C major scale often taught first?',
          options: [
            'It\'s the loudest scale',
            'It uses only white keys (no sharps or flats)',
            'It was invented first',
            'It has the most notes'
          ],
          correctIndex: 1,
          explanation: 'C major uses only white keys, making it the simplest to visualize and play. All other major scales require at least one sharp or flat.'
        },
        {
          id: 'q3',
          type: 'audio_identify',
          question: 'Listen to this scale. Is it going UP or DOWN?',
          playAction: { type: 'sequence', notes: ['C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4'], tempo: 120 },
          options: ['Up (ascending)', 'Down (descending)'],
          correctIndex: 1,
          explanation: 'This scale is descending - going from high C down to low C.'
        }
      ],
      passingScore: 2
    }
  },

  // =====================================================
  // Understanding Intervals
  // =====================================================
  {
    id: 'lesson-intervals',
    path: 'beginner',
    title: 'Understanding Intervals',
    subtitle: 'The distance between notes - the DNA of melody and harmony',
    estimatedTime: '7 min',
    icon: '↔️',

    learn: {
      introduction: `An **interval** is the distance between two notes. Understanding intervals is key to understanding melody and chords.

Intervals are named by counting the letters from one note to another (including both notes):
- C to D = **2nd** (C-D = 2 letters)
- C to E = **3rd** (C-D-E = 3 letters)
- C to G = **5th** (C-D-E-F-G = 5 letters)

Intervals also have qualities: **major, minor, perfect**.

Some common intervals and their sounds:
- **Minor 2nd** (1 half step) - tense, "Jaws" theme
- **Major 2nd** (2 half steps) - normal step, "Happy Birthday" opening
- **Minor 3rd** (3 half steps) - sad, the "sad" in minor chords
- **Major 3rd** (4 half steps) - happy, the "happy" in major chords
- **Perfect 5th** (7 half steps) - powerful, open, "Star Wars" fanfare
- **Octave** (12 half steps) - same note, higher/lower`,

      keyPoints: [
        {
          title: 'Count letters to find interval numbers',
          explanation: 'C to E: C(1), D(2), E(3) = a 3rd. Always count both the starting and ending notes.',
          analogy: 'Like counting floors in a building - the ground floor and destination both count.'
        },
        {
          title: 'Half steps determine the quality',
          explanation: 'A 3rd can be minor (3 half steps) or major (4 half steps). Same number, different sound!',
          analogy: 'Like small, medium, large shirts - same category, different sizes.'
        },
        {
          title: 'Perfect intervals are special',
          explanation: 'The 4th, 5th, and octave are called "perfect" because they sound very pure and stable.',
          analogy: 'They\'re the "backbone" intervals - very consonant and strong.'
        },
        {
          title: 'Intervals are the building blocks of chords',
          explanation: 'A major chord is built from a major 3rd + minor 3rd stacked. Understanding intervals = understanding chords.',
          analogy: 'Intervals are like atoms; chords are like molecules made of those atoms.'
        }
      ],

      summary: 'Intervals measure the distance between notes. They\'re named by counting letters (2nd, 3rd, 5th, etc.) and have qualities (major, minor, perfect). The major 3rd is the "happy" interval; the minor 3rd is the "sad" interval. Intervals are the foundation of both melody and chords.'
    },

    hearIt: {
      title: 'Hear all intervals from C',
      examples: [
        // Simple intervals (within one octave)
        {
          label: 'Unison (0 half steps): C to C',
          description: 'The same note played twice. Use: Unison melodies in orchestras create power; chanting uses unison for unity.',
          playAction: { type: 'interval', notes: ['C4', 'C4'] }
        },
        {
          label: 'Minor 2nd (1 half step): C to Db',
          description: 'Maximum tension! "Jaws" theme. Use: Horror/suspense music, chromatic passages, creating anxiety.',
          playAction: { type: 'interval', notes: ['C4', 'Db4'] }
        },
        {
          label: 'Major 2nd (2 half steps): C to D',
          description: 'A whole step - "Happy Birthday" opening. Use: Stepwise melodies, scale passages, natural voice leading.',
          playAction: { type: 'interval', notes: ['C4', 'D4'] }
        },
        {
          label: 'Minor 3rd (3 half steps): C to Eb',
          description: 'The "sad" interval - "Greensleeves." Use: Minor chords, blues licks, expressing melancholy or longing.',
          playAction: { type: 'interval', notes: ['C4', 'Eb4'] }
        },
        {
          label: 'Major 3rd (4 half steps): C to E',
          description: 'The "happy" interval - "Oh When the Saints." Use: Major chords, fanfares, expressing joy and triumph.',
          playAction: { type: 'interval', notes: ['C4', 'E4'] }
        },
        {
          label: 'Perfect 4th (5 half steps): C to F',
          description: '"Here Comes the Bride," "Amazing Grace." Use: Hymns, fanfares, horn calls, strong melodic leaps.',
          playAction: { type: 'interval', notes: ['C4', 'F4'] }
        },
        {
          label: 'Tritone (6 half steps): C to Gb',
          description: 'The "devil\'s interval" - "The Simpsons," "Maria." Use: Creating tension in dominant 7th chords, jazz, metal, unease.',
          playAction: { type: 'interval', notes: ['C4', 'Gb4'] }
        },
        {
          label: 'Perfect 5th (7 half steps): C to G',
          description: '"Star Wars," "Twinkle Twinkle." Use: Power chords in rock, open tunings, heroic themes, stability.',
          playAction: { type: 'interval', notes: ['C4', 'G4'] }
        },
        {
          label: 'Minor 6th (8 half steps): C to Ab',
          description: '"Love Story" theme, "The Entertainer." Use: Romantic/bittersweet moments, first inversion minor chords, film scores.',
          playAction: { type: 'interval', notes: ['C4', 'Ab4'] }
        },
        {
          label: 'Major 6th (9 half steps): C to A',
          description: '"My Bonnie Lies Over the Ocean," "NBC" jingle. Use: Warm melodies, 6th chords in jazz, optimistic themes.',
          playAction: { type: 'interval', notes: ['C4', 'A4'] }
        },
        {
          label: 'Minor 7th (10 half steps): C to Bb',
          description: '"Star Trek" theme, "Somewhere" (West Side Story). Use: Dominant 7th chords, blues, creating anticipation.',
          playAction: { type: 'interval', notes: ['C4', 'Bb4'] }
        },
        {
          label: 'Major 7th (11 half steps): C to B',
          description: '"Take On Me" (a-ha), "Don\'t Know Why." Use: Major 7th chords in jazz/bossa nova, dreamy quality, sophistication.',
          playAction: { type: 'interval', notes: ['C4', 'B4'] }
        },
        {
          label: 'Octave (12 half steps): C to C',
          description: '"Somewhere Over the Rainbow." Use: Doubling melodies for power, bass lines, dramatic leaps.',
          playAction: { type: 'interval', notes: ['C4', 'C5'] }
        },
        // Compound intervals (beyond one octave)
        {
          label: 'Minor 9th (13 half steps): C to Db',
          description: 'Octave + minor 2nd. Use: Dark jazz chords (C7b9), flamenco, creating exotic tension. Very dissonant!',
          playAction: { type: 'interval', notes: ['C4', 'Db5'] }
        },
        {
          label: 'Major 9th (14 half steps): C to D',
          description: 'Octave + major 2nd. Use: Add9 and 9th chords - the "shimmer" in Cmaj9. Adds openness without tension.',
          playAction: { type: 'interval', notes: ['C4', 'D5'] }
        },
        {
          label: 'Minor 10th (15 half steps): C to Eb',
          description: 'Octave + minor 3rd. Use: Spread voicings in piano, orchestral arranging. Sounds "bigger" than a simple minor 3rd.',
          playAction: { type: 'interval', notes: ['C4', 'Eb5'] }
        },
        {
          label: 'Major 10th (16 half steps): C to E',
          description: 'Octave + major 3rd. Use: "Alberti bass" patterns, wide piano voicings, rich harmonic spacing.',
          playAction: { type: 'interval', notes: ['C4', 'E5'] }
        },
        {
          label: 'Perfect 11th (17 half steps): C to F',
          description: 'Octave + perfect 4th. Use: Sus4 and 11th chords. Creates "suspended" feeling. Clashes with 3rd - use on minor chords!',
          playAction: { type: 'interval', notes: ['C4', 'F5'] }
        },
        {
          label: 'Augmented 11th / #11 (18 half steps): C to F#',
          description: 'Octave + tritone. Use: Lydian mode sound, maj7#11 chords. The "dreamy" extension - no clash with the 3rd!',
          playAction: { type: 'interval', notes: ['C4', 'Gb5'] }
        },
        {
          label: 'Perfect 12th (19 half steps): C to G',
          description: 'Octave + perfect 5th. Use: Organ stops, overtone series, wide power chord voicings, orchestral doubling.',
          playAction: { type: 'interval', notes: ['C4', 'G5'] }
        },
        {
          label: 'Minor 13th (20 half steps): C to Ab',
          description: 'Octave + minor 6th. Use: Dark 13th chords (C7b13), altered dominants in jazz. Exotic and tense.',
          playAction: { type: 'interval', notes: ['C4', 'Ab5'] }
        },
        {
          label: 'Major 13th (21 half steps): C to A',
          description: 'Octave + major 6th. Use: 13th chords - the "soulful" extension. Adds warmth to dominant chords in jazz/R&B.',
          playAction: { type: 'interval', notes: ['C4', 'A5'] }
        }
      ],
      famousSongs: [
        '"Jaws" - minor 2nd for terror',
        '"Here Comes the Bride" - perfect 4th for ceremony',
        '"The Simpsons" - tritone for quirky tension',
        '"Star Wars" - perfect 5th for heroism',
        '"My Bonnie" - major 6th for warmth',
        '"Somewhere Over the Rainbow" - octave for wonder',
        'Jazz ballads - 9ths and 13ths for sophistication'
      ]
    },

    // TRY IT Section - Uses embedded keyboard
    tryIt: {
      title: 'Build and hear intervals',
      instructions: 'Use the virtual piano keyboard to play intervals. Listen to how each one sounds!',
      useEmbeddedKeyboard: true,
      exercises: [
        {
          step: 1,
          instruction: 'Play C, then E - this is a major 3rd (the "happy" sound)',
          hint: 'Count: C(1), D(2), E(3) = 3rd. It has 4 half steps, making it "major"',
          validation: { type: 'play_sequence', value: ['C', 'E'] }
        },
        {
          step: 2,
          instruction: 'Now play C, then Eb (the black key between D and E) - this is a minor 3rd',
          hint: 'Same letter count (3rd), but only 3 half steps = "minor" (sad sound)',
          validation: { type: 'play_sequence', value: ['C', 'Eb'] }
        },
        {
          step: 3,
          instruction: 'Play C, then G - this is a perfect 5th (powerful and open)',
          hint: 'C-D-E-F-G = 5 letters. 5ths are called "perfect" because they sound so pure.',
          validation: { type: 'play_sequence', value: ['C', 'G'] }
        },
        {
          step: 4,
          instruction: 'Play the "Jaws" interval: E then F (minor 2nd)',
          hint: 'Just one half step creates maximum tension!',
          validation: { type: 'play_sequence', value: ['E', 'F'] }
        },
        {
          step: 5,
          instruction: 'Play an octave: C, then the higher C',
          hint: 'Both are C - the same note at different heights. Very pure sound!',
          validation: { type: 'play_sequence', value: ['C4', 'C5'] }
        }
      ],
      successMessage: 'You can now hear the difference between intervals! This understanding is the foundation for building chords in the next lesson.'
    },

    // EXPERIMENT Section - Uses embedded keyboard
    experiment: {
      title: 'Interval ear training',
      prompt: 'Practice recognizing intervals by their sound:',
      useEmbeddedKeyboard: true,
      challenges: [
        {
          label: 'Compare major 3rd vs minor 3rd',
          hint: 'Play C-E (major, happy) then C-Eb (minor, sad) - hear the mood difference!',
          solution: { intervals: [['C', 'E'], ['C', 'Eb']] }
        },
        {
          label: 'Find a perfect 5th from different starting notes',
          hint: 'From G, count up 5: G-A-B-C-D. From F, count up 5: F-G-A-B-C',
          solution: { explore: true }
        },
        {
          label: 'Play the "Here Comes the Bride" interval',
          hint: 'C to F is a perfect 4th (5 half steps) - the first two notes of the wedding march',
          solution: { interval: ['C', 'F'] }
        }
      ],
      freePlay: {
        prompt: 'Pick any note and find its major 3rd, minor 3rd, perfect 5th, and octave. This skill will help you build chords by ear!',
        useEmbeddedKeyboard: true
      }
    },

    quiz: {
      title: 'Intervals Quiz',
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          question: 'What interval is C to E?',
          options: ['2nd', '3rd', '4th', '5th'],
          correctIndex: 1,
          explanation: 'C(1), D(2), E(3) = a 3rd. Count both the starting and ending notes.'
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          question: 'What is the difference between a major 3rd and a minor 3rd?',
          options: [
            'Major is louder',
            'Major has 4 half steps, minor has 3 half steps',
            'Major goes up, minor goes down',
            'There is no difference'
          ],
          correctIndex: 1,
          explanation: 'A major 3rd = 4 half steps (C to E). A minor 3rd = 3 half steps (C to Eb). The major 3rd sounds happy, the minor 3rd sounds sad.'
        },
        {
          id: 'q3',
          type: 'audio_identify',
          question: 'Listen to this interval. Does it sound happy/bright or sad/dark?',
          playAction: { type: 'interval', notes: ['C4', 'Eb4'] },
          options: ['Happy/bright (major 3rd)', 'Sad/dark (minor 3rd)'],
          correctIndex: 1,
          explanation: 'This is a minor 3rd (C to Eb) - it has that characteristic sad, dark quality.'
        }
      ],
      passingScore: 2
    }
  }
];

export default foundationalLessons;
