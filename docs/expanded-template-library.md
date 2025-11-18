# Expanded Progression Template Library

## Overview
This document defines 75+ chord progression templates organized across 9 categories. Each template includes full metadata for the Progression Builder's template browser system.

---

## Template Categories

### Existing Categories (Enhanced)
1. **Pop** - Contemporary and classic pop progressions
2. **Jazz** - Standards, bebop, modal, and fusion
3. **Blues** - Traditional and variations
4. **Rock** - Classic, alternative, punk, metal
5. **Classical** - Common practice period progressions

### New Categories
6. **Gospel/Soul** - Church music and R&B traditions
7. **World** - Latin, Celtic, Mediterranean influences
8. **EDM/Modern** - Electronic and contemporary production

---

## Pop Category (12 Templates)

### Existing (3)
- pop-axis, alternative-pop, doo-wop

### New Templates (9)

```javascript
'pop-sensitive-female': {
    id: 'pop-sensitive-female',
    name: 'Sensitive Female Chord Progression',
    category: TEMPLATE_CATEGORIES.POP,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['vi', 'IV', 'I', 'V'],
    description: 'A reordering of the pop axis that starts on the minor chord for a more introspective feel.',
    tags: ['pop', 'emotional', 'verse', 'melancholy'],
    examples: ['"Apologize" - OneRepublic', '"If I Were a Boy" - Beyoncé', '"Complicated" - Avril Lavigne'],
    arrangement: {
        tempo: 100,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'root-fifth',
        melodyGuide: 'descending-line',
        style: 'ballad'
    },
    usage: 'Great for emotional verses and introspective moments. The minor start creates immediate emotional weight.'
},

'pop-happy': {
    id: 'pop-happy',
    name: 'Pop Happy (I-IV-vi-V)',
    category: TEMPLATE_CATEGORIES.POP,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['I', 'IV', 'vi', 'V'],
    description: 'Bright, optimistic progression that delays the minor chord for maximum uplift.',
    tags: ['pop', 'happy', 'upbeat', 'chorus'],
    examples: ['"Shut Up and Dance" - Walk the Moon', '"Roar" - Katy Perry'],
    arrangement: {
        tempo: 128,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 1,
        bassPattern: 'driving-eighths',
        melodyGuide: 'chord-tones-ascending',
        style: 'dance-pop'
    },
    usage: 'Perfect for upbeat choruses and feel-good anthems.'
},

'pop-journey': {
    id: 'pop-journey',
    name: 'Journey Progression (I-V-vi-iii-IV)',
    category: TEMPLATE_CATEGORIES.POP,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['I', 'V', 'vi', 'iii', 'IV'],
    description: 'Extended pop progression with the iii chord adding sophistication.',
    tags: ['pop', 'emotional', 'extended', '5-chord'],
    examples: ['"Demons" - Imagine Dragons', '"Mirrors" - Justin Timberlake'],
    arrangement: {
        tempo: 90,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'root-fifth',
        melodyGuide: 'stepwise',
        style: 'power-ballad'
    },
    usage: 'Good for verses that need more harmonic movement before a simple chorus.'
},

'pop-80s-power': {
    id: 'pop-80s-power',
    name: '80s Power Ballad (I-V-vi-IV-I-V-IV)',
    category: TEMPLATE_CATEGORIES.POP,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['I', 'V', 'vi', 'IV', 'I', 'V', 'IV'],
    description: 'Extended 80s-style progression with repeated resolution.',
    tags: ['80s', 'power-ballad', 'anthemic', 'retro'],
    examples: ['"Total Eclipse of the Heart" - Bonnie Tyler', '"Alone" - Heart'],
    arrangement: {
        tempo: 76,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'root-octave',
        melodyGuide: 'dramatic-arc',
        style: '80s-ballad'
    },
    usage: 'Ideal for dramatic, building sections with emotional peaks.'
},

'pop-millenial-whoop': {
    id: 'pop-millenial-whoop',
    name: 'Millennial Whoop (I-V-vi-V)',
    category: TEMPLATE_CATEGORIES.POP,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['I', 'V', 'vi', 'V'],
    description: 'Variation that returns to V for continuous momentum.',
    tags: ['pop', 'modern', '2010s', 'chorus'],
    examples: ['"California Gurls" - Katy Perry', '"Good Time" - Owl City'],
    arrangement: {
        tempo: 126,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 1,
        bassPattern: 'driving-eighths',
        melodyGuide: 'pentatonic',
        style: 'summer-pop'
    },
    usage: 'Creates an infectious, endless loop feel perfect for hooks.'
},

'pop-emo': {
    id: 'pop-emo',
    name: 'Emo Pop (vi-IV-I-V)',
    category: TEMPLATE_CATEGORIES.POP,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['vi', 'IV', 'I', 'V'],
    description: 'Starting on vi creates immediate emotional tension.',
    tags: ['emo', 'alternative', 'emotional', 'verse'],
    examples: ['"Welcome to the Black Parade" - MCR', '"Sugar We\'re Going Down" - Fall Out Boy'],
    arrangement: {
        tempo: 100,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'root-fifth',
        melodyGuide: 'angular',
        style: 'emo-pop'
    },
    usage: 'Standard for emo and pop-punk emotional moments.'
},

'pop-chromatic-mediant': {
    id: 'pop-chromatic-mediant',
    name: 'Chromatic Mediant Pop (I-bVI-IV-V)',
    category: TEMPLATE_CATEGORIES.POP,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['I', 'bVI', 'IV', 'V'],
    description: 'Borrowed bVI chord adds unexpected color and drama.',
    tags: ['pop', 'dramatic', 'borrowed-chord', 'cinematic'],
    examples: ['"Radioactive" - Imagine Dragons', '"Rolling in the Deep" - Adele'],
    arrangement: {
        tempo: 92,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'root-fifth',
        melodyGuide: 'dramatic-arc',
        style: 'epic-pop'
    },
    usage: 'Creates a dramatic, cinematic quality. The bVI is a striking moment.'
},

'pop-verse-prechorus': {
    id: 'pop-verse-prechorus',
    name: 'Verse to Pre-Chorus (I-IV-vi-V-IV-V)',
    category: TEMPLATE_CATEGORIES.POP,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['I', 'IV', 'vi', 'V', 'IV', 'V'],
    description: 'Complete verse-prechorus structure with building tension.',
    tags: ['pop', 'structure', 'building', 'prechorus'],
    examples: ['Generic pop song structure'],
    arrangement: {
        tempo: 120,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'quarter-notes',
        melodyGuide: 'building',
        style: 'pop'
    },
    usage: 'A complete section that builds from verse stability to prechorus anticipation.'
},

'pop-singer-songwriter': {
    id: 'pop-singer-songwriter',
    name: 'Singer-Songwriter (I-V/7-vi-IV)',
    category: TEMPLATE_CATEGORIES.POP,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['I', 'V7', 'vi', 'IV'],
    description: 'Classic with dominant 7th for rootsy, organic feel.',
    tags: ['acoustic', 'folk-pop', 'intimate', 'organic'],
    examples: ['"Riptide" - Vance Joy', '"Ho Hey" - Lumineers'],
    arrangement: {
        tempo: 108,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'root-fifth',
        melodyGuide: 'singable',
        style: 'acoustic-pop'
    },
    usage: 'Perfect for acoustic performances and singer-songwriter material.'
}
```

---

## Jazz Category (16 Templates)

### Existing (4)
- jazz-ii-v-i, rhythm-changes, jazz-waltz, take-five-style

### New Templates (12)

```javascript
'jazz-autumn-leaves': {
    id: 'jazz-autumn-leaves',
    name: 'Autumn Leaves Changes',
    category: TEMPLATE_CATEGORIES.JAZZ,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['ii7', 'V7', 'Imaj7', 'IVmaj7', 'viiø7', 'III7', 'vi'],
    description: 'The famous Autumn Leaves A section progression.',
    tags: ['jazz', 'standard', 'autumn-leaves', 'minor-key'],
    examples: ['"Autumn Leaves" - Joseph Kosma'],
    arrangement: {
        tempo: 140,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'walking',
        melodyGuide: 'bebop-lines',
        style: 'swing'
    },
    usage: 'One of the most important jazz progressions to learn. Cycles through related keys.'
},

'jazz-coltrane-changes': {
    id: 'jazz-coltrane-changes',
    name: 'Coltrane Changes',
    category: TEMPLATE_CATEGORIES.JAZZ,
    difficulty: DIFFICULTY_LEVELS.ADVANCED,
    progressions: ['Imaj7', 'bIII7', 'bVImaj7', 'VII7', 'bIImaj7', 'bV7'],
    description: 'Giant Steps-inspired movement by major thirds.',
    tags: ['jazz', 'advanced', 'coltrane', 'giant-steps'],
    examples: ['"Giant Steps" - John Coltrane', '"Countdown" - John Coltrane'],
    arrangement: {
        tempo: 280,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 1,
        bassPattern: 'walking-fast',
        melodyGuide: 'arpeggios',
        style: 'bebop'
    },
    usage: 'Advanced harmony moving through major third cycles. Very challenging to improvise over.'
},

'jazz-minor-ii-v-i': {
    id: 'jazz-minor-ii-v-i',
    name: 'Minor ii-V-i',
    category: TEMPLATE_CATEGORIES.JAZZ,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['iiø7', 'V7b9', 'i7'],
    description: 'The minor key version of ii-V-I with half-diminished and altered dominant.',
    tags: ['jazz', 'minor', 'turnaround', 'essential'],
    examples: ['"Alone Together"', '"Softly as in a Morning Sunrise"'],
    arrangement: {
        tempo: 120,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'walking',
        melodyGuide: 'harmonic-minor',
        style: 'swing'
    },
    usage: 'Essential minor key turnaround. Use harmonic minor scale over the V7.'
},

'jazz-tritone-sub': {
    id: 'jazz-tritone-sub',
    name: 'Tritone Substitution (ii-bII7-I)',
    category: TEMPLATE_CATEGORIES.JAZZ,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['ii7', 'bII7', 'Imaj7'],
    description: 'Classic tritone substitution replacing V7 with bII7.',
    tags: ['jazz', 'substitution', 'chromatic', 'bebop'],
    examples: ['Common bebop device'],
    arrangement: {
        tempo: 140,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'chromatic-descent',
        melodyGuide: 'bebop-lines',
        style: 'bebop'
    },
    usage: 'Creates smooth chromatic bass line (D-Db-C in key of C). Very hip sound.'
},

'jazz-backdoor': {
    id: 'jazz-backdoor',
    name: 'Backdoor ii-V (bVII7-Imaj7)',
    category: TEMPLATE_CATEGORIES.JAZZ,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['iv7', 'bVII7', 'Imaj7'],
    description: 'Approach tonic from a step above instead of below.',
    tags: ['jazz', 'backdoor', 'surprise', 'sophisticated'],
    examples: ['"There Will Never Be Another You"', '"Stella by Starlight"'],
    arrangement: {
        tempo: 130,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'walking',
        melodyGuide: 'mixolydian',
        style: 'swing'
    },
    usage: 'Unexpected resolution that sounds fresh. Great for endings and turnarounds.'
},

'jazz-bird-blues': {
    id: 'jazz-bird-blues',
    name: 'Bird Blues (Bebop Blues)',
    category: TEMPLATE_CATEGORIES.JAZZ,
    difficulty: DIFFICULTY_LEVELS.ADVANCED,
    progressions: ['I7', 'bVII7', 'VI7', 'bVI7', 'V7', 'bV7', 'IV7', '#IVdim7', 'I7', 'VI7', 'ii7', 'V7'],
    description: 'Charlie Parker\'s sophisticated reharmonization of the 12-bar blues.',
    tags: ['jazz', 'bebop', 'blues', 'advanced', 'parker'],
    examples: ['"Blues for Alice" - Charlie Parker', '"Chi Chi" - Charlie Parker'],
    arrangement: {
        tempo: 180,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 1,
        bassPattern: 'walking',
        melodyGuide: 'bebop-scales',
        style: 'bebop'
    },
    usage: 'Advanced blues with chromatic ii-V patterns. Essential for bebop vocabulary.'
},

'jazz-modal-so-what': {
    id: 'jazz-modal-so-what',
    name: 'So What Changes',
    category: TEMPLATE_CATEGORIES.JAZZ,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['i7', 'i7', 'i7', 'i7', 'i7', 'i7', 'i7', 'i7', 'bII7', 'bII7', 'bII7', 'bII7', 'i7', 'i7', 'i7', 'i7'],
    description: 'Modal jazz - 16 bars of Dm7, 8 bars of Ebm7, 8 bars of Dm7.',
    tags: ['jazz', 'modal', 'miles-davis', 'kind-of-blue'],
    examples: ['"So What" - Miles Davis', '"Impressions" - John Coltrane'],
    arrangement: {
        tempo: 136,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'modal-vamp',
        melodyGuide: 'dorian',
        style: 'modal-jazz'
    },
    usage: 'Focus on melodic development over static harmony. Use Dorian mode.'
},

'jazz-confirmation': {
    id: 'jazz-confirmation',
    name: 'Confirmation Changes',
    category: TEMPLATE_CATEGORIES.JAZZ,
    difficulty: DIFFICULTY_LEVELS.ADVANCED,
    progressions: ['Imaj7', 'iv7', 'bVII7', 'Imaj7', 'iii7', 'VI7', 'ii7', 'V7'],
    description: 'First 8 bars of Charlie Parker\'s Confirmation.',
    tags: ['jazz', 'bebop', 'parker', 'standard'],
    examples: ['"Confirmation" - Charlie Parker'],
    arrangement: {
        tempo: 200,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 1,
        bassPattern: 'walking',
        melodyGuide: 'bebop-lines',
        style: 'bebop'
    },
    usage: 'Classic bebop form with backdoor progression in bar 2-3.'
},

'jazz-lady-bird': {
    id: 'jazz-lady-bird',
    name: 'Lady Bird Turnaround',
    category: TEMPLATE_CATEGORIES.JAZZ,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['Imaj7', 'bIIImaj7', 'bVImaj7', 'bIImaj7'],
    description: 'Tadd Dameron\'s famous turnaround moving down by minor thirds.',
    tags: ['jazz', 'turnaround', 'dameron', 'chromatic'],
    examples: ['"Lady Bird" - Tadd Dameron'],
    arrangement: {
        tempo: 140,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'walking',
        melodyGuide: 'major-7-arpeggios',
        style: 'swing'
    },
    usage: 'Beautiful chromatic major 7th movement. Can substitute for a standard turnaround.'
},

'jazz-just-friends': {
    id: 'jazz-just-friends',
    name: 'Just Friends A Section',
    category: TEMPLATE_CATEGORIES.JAZZ,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['IVmaj7', '#IVdim7', 'iii7', 'VI7', 'ii7', 'V7', 'Imaj7', 'Imaj7'],
    description: 'Classic standard progression starting on IV.',
    tags: ['jazz', 'standard', 'common'],
    examples: ['"Just Friends"', '"On a Clear Day"'],
    arrangement: {
        tempo: 160,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'walking',
        melodyGuide: 'chord-tones',
        style: 'swing'
    },
    usage: 'Many standards start on the IV chord. Learn this progression well.'
},

'jazz-bossa-nova': {
    id: 'jazz-bossa-nova',
    name: 'Bossa Nova Progression',
    category: TEMPLATE_CATEGORIES.JAZZ,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['Imaj7', 'viø7', 'II7', 'ii7', 'bII7', 'Imaj7', 'bVImaj7', 'V7'],
    description: 'Brazilian jazz progression with chromatic movement.',
    tags: ['jazz', 'bossa', 'brazilian', 'latin'],
    examples: ['"The Girl from Ipanema"', '"Wave" - Antonio Carlos Jobim'],
    arrangement: {
        tempo: 140,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'bossa',
        melodyGuide: 'smooth-lines',
        style: 'bossa-nova'
    },
    usage: 'Use the bossa nova rhythmic pattern. Smooth, sophisticated harmony.'
},

'jazz-rhythm-bridge': {
    id: 'jazz-rhythm-bridge',
    name: 'Rhythm Changes Bridge',
    category: TEMPLATE_CATEGORIES.JAZZ,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['III7', 'III7', 'VI7', 'VI7', 'II7', 'II7', 'V7', 'V7'],
    description: 'The bridge section of Rhythm Changes (dominants descending in fourths).',
    tags: ['jazz', 'rhythm-changes', 'bridge', 'dominants'],
    examples: ['Any Rhythm Changes tune bridge'],
    arrangement: {
        tempo: 200,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 1,
        bassPattern: 'walking',
        melodyGuide: 'mixolydian',
        style: 'bebop'
    },
    usage: 'Classic dominant chain. Each chord is the V7 of the next.'
}
```

---

## Blues Category (9 Templates)

### Existing (3)
- twelve-bar-blues, minor-blues, slow-blues

### New Templates (6)

```javascript
'blues-quick-change': {
    id: 'blues-quick-change',
    name: 'Quick Change Blues',
    category: TEMPLATE_CATEGORIES.BLUES,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['I7', 'IV7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
    description: '12-bar blues with IV chord in bar 2 for early harmonic interest.',
    tags: ['blues', 'quick-change', 'variation'],
    examples: ['"Sweet Home Chicago"', '"Pride and Joy" - SRV'],
    arrangement: {
        tempo: 120,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 1,
        bassPattern: 'shuffle',
        melodyGuide: 'blues-scale',
        style: 'shuffle-blues'
    },
    usage: 'The quick change to IV in bar 2 creates more movement. Very common variation.'
},

'blues-jazz': {
    id: 'blues-jazz',
    name: 'Jazz Blues',
    category: TEMPLATE_CATEGORIES.BLUES,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['I7', 'IV7', 'I7', 'vi7-II7', 'ii7', 'V7', 'I7', 'VI7', 'ii7', 'V7', 'I7-VI7', 'ii7-V7'],
    description: 'Jazzed up blues with ii-V patterns and passing chords.',
    tags: ['blues', 'jazz', 'bebop', 'sophisticated'],
    examples: ['"Billie\'s Bounce" - Charlie Parker', '"Now\'s the Time" - Charlie Parker'],
    arrangement: {
        tempo: 140,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 1,
        bassPattern: 'walking',
        melodyGuide: 'bebop-blues',
        style: 'bebop'
    },
    usage: 'Standard bebop blues form. Practice ii-V vocabulary in bars 4 and 9-10.'
},

'blues-stormy-monday': {
    id: 'blues-stormy-monday',
    name: 'Stormy Monday Blues',
    category: TEMPLATE_CATEGORIES.BLUES,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['I9', 'IV9', 'I9', 'I9', 'IV9', '#IVdim7', 'I9', 'VI7b9', 'ii9', 'V9', 'I9', 'II9'],
    description: 'T-Bone Walker\'s sophisticated blues with 9th chords and diminished passing chord.',
    tags: ['blues', 'sophisticated', 't-bone-walker', '9th-chords'],
    examples: ['"Stormy Monday" - T-Bone Walker'],
    arrangement: {
        tempo: 60,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 1,
        bassPattern: 'slow-blues',
        melodyGuide: 'bluesy-9ths',
        style: 'slow-blues'
    },
    usage: 'Slow, sophisticated blues with extended chords. The #IVdim7 is iconic.'
},

'blues-eight-bar': {
    id: 'blues-eight-bar',
    name: '8-Bar Blues',
    category: TEMPLATE_CATEGORIES.BLUES,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['I7', 'I7', 'IV7', 'IV7', 'V7', 'IV7', 'I7', 'V7'],
    description: 'Compact 8-bar blues form.',
    tags: ['blues', '8-bar', 'compact'],
    examples: ['"Key to the Highway"', '"Worried Life Blues"'],
    arrangement: {
        tempo: 100,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 1,
        bassPattern: 'shuffle',
        melodyGuide: 'blues-scale',
        style: 'traditional-blues'
    },
    usage: 'Quicker blues form. Works well for certain traditional blues songs.'
},

'blues-16-bar': {
    id: 'blues-16-bar',
    name: '16-Bar Blues',
    category: TEMPLATE_CATEGORIES.BLUES,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'V7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
    description: 'Extended 16-bar blues form with doubled measures.',
    tags: ['blues', '16-bar', 'extended'],
    examples: ['"Watermelon Man" - Herbie Hancock', '"Hoochie Coochie Man"'],
    arrangement: {
        tempo: 100,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 1,
        bassPattern: 'funky',
        melodyGuide: 'blues-scale',
        style: 'funk-blues'
    },
    usage: 'Extended form gives more space for development. Common in funk and soul.'
},

'blues-minor-jazz': {
    id: 'blues-minor-jazz',
    name: 'Minor Jazz Blues',
    category: TEMPLATE_CATEGORIES.BLUES,
    difficulty: DIFFICULTY_LEVELS.ADVANCED,
    progressions: ['i7', 'iv7', 'i7', 'i7', 'iv7', '#ivdim7', 'i7', 'VI7', 'iiø7', 'V7b9', 'i7', 'V7b9'],
    description: 'Minor blues with jazz harmony including altered dominants.',
    tags: ['blues', 'minor', 'jazz', 'sophisticated'],
    examples: ['"Mr. P.C." - John Coltrane', '"Equinox" - John Coltrane'],
    arrangement: {
        tempo: 160,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 1,
        bassPattern: 'walking',
        melodyGuide: 'dorian-harmonic',
        style: 'hard-bop'
    },
    usage: 'Use Dorian over i7, harmonic minor over V7b9. Dark, intense sound.'
}
```

---

## Rock Category (9 Templates)

### Existing (3)
- classic-rock, punk-rock, progressive-rock

### New Templates (6)

```javascript
'rock-power-chord': {
    id: 'rock-power-chord',
    name: 'Power Chord Rock (I-bVII-IV)',
    category: TEMPLATE_CATEGORIES.ROCK,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['I', 'bVII', 'IV'],
    description: 'Classic rock riff using Mixolydian bVII.',
    tags: ['rock', 'power-chords', 'riff', 'mixolydian'],
    examples: ['"Sweet Child O\' Mine" - GNR', '"You Really Got Me" - The Kinks'],
    arrangement: {
        tempo: 120,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'root-octave',
        melodyGuide: 'pentatonic',
        style: 'hard-rock'
    },
    usage: 'Classic rock sound with the bVII giving that rock edge. Use power chords.'
},

'rock-grunge': {
    id: 'rock-grunge',
    name: 'Grunge Progression (i-bVI-bIII-bVII)',
    category: TEMPLATE_CATEGORIES.ROCK,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['i', 'bVI', 'bIII', 'bVII'],
    description: 'Natural minor/Aeolian progression used in 90s grunge.',
    tags: ['grunge', '90s', 'alternative', 'minor'],
    examples: ['"Come as You Are" - Nirvana', '"Black Hole Sun" - Soundgarden'],
    arrangement: {
        tempo: 116,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'root-fifth',
        melodyGuide: 'aeolian',
        style: 'grunge'
    },
    usage: 'Dark, moody sound using all chords from natural minor scale.'
},

'rock-metal-doom': {
    id: 'rock-metal-doom',
    name: 'Doom Metal (i-bII-i-bVI)',
    category: TEMPLATE_CATEGORIES.ROCK,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['i', 'bII', 'i', 'bVI'],
    description: 'Phrygian-influenced heavy metal progression.',
    tags: ['metal', 'doom', 'phrygian', 'heavy'],
    examples: ['"Black Sabbath" - Black Sabbath', '"South of Heaven" - Slayer'],
    arrangement: {
        tempo: 60,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 4,
        bassPattern: 'slow-root',
        melodyGuide: 'phrygian',
        style: 'doom-metal'
    },
    usage: 'The bII creates extreme darkness. Play slow and heavy.'
},

'rock-blues-rock': {
    id: 'rock-blues-rock',
    name: 'Blues Rock Shuffle (I-IV-I-V-IV-I)',
    category: TEMPLATE_CATEGORIES.ROCK,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['I', 'IV', 'I', 'V', 'IV', 'I'],
    description: 'Straight-ahead blues-rock shuffle pattern.',
    tags: ['rock', 'blues-rock', 'shuffle', 'classic'],
    examples: ['"La Grange" - ZZ Top', '"Rock and Roll" - Led Zeppelin'],
    arrangement: {
        tempo: 170,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'shuffle-bass',
        melodyGuide: 'pentatonic',
        style: 'blues-rock'
    },
    usage: 'High energy blues-rock. Use the shuffle rhythm and pentatonic licks.'
},

'rock-indie-suspended': {
    id: 'rock-indie-suspended',
    name: 'Indie Rock Suspended (I-Isus4-IV-iv)',
    category: TEMPLATE_CATEGORIES.ROCK,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['I', 'Isus4', 'IV', 'iv'],
    description: 'Uses suspended chord and minor IV for indie texture.',
    tags: ['indie', 'alternative', 'suspended', 'dreamy'],
    examples: ['"Creep" - Radiohead (bridge)', 'Various indie songs'],
    arrangement: {
        tempo: 92,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'atmospheric',
        melodyGuide: 'angular',
        style: 'indie-rock'
    },
    usage: 'The suspended chord and borrowed iv create a yearning, indie sound.'
},

'rock-anthemic': {
    id: 'rock-anthemic',
    name: 'Stadium Rock Anthem (I-V-bVII-IV)',
    category: TEMPLATE_CATEGORIES.ROCK,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['I', 'V', 'bVII', 'IV'],
    description: 'Big, anthemic progression for arena rock.',
    tags: ['rock', 'anthem', 'stadium', 'uplifting'],
    examples: ['"Livin\' on a Prayer" - Bon Jovi', '"Don\'t Stop Believin\'" - Journey'],
    arrangement: {
        tempo: 124,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'driving-eighths',
        melodyGuide: 'singable',
        style: 'arena-rock'
    },
    usage: 'The bVII gives that triumphant, fist-pumping feel. Build to big chorus.'
}
```

---

## Classical Category (11 Templates)

### Existing (5)
- circle-of-fifths, pachelbel-canon, classical-waltz, romantic-waltz, baroque-sequence

### New Templates (6)

```javascript
'classical-romanesca': {
    id: 'classical-romanesca',
    name: 'Romanesca (I-V-vi-III-IV-I-IV-V)',
    category: TEMPLATE_CATEGORIES.CLASSICAL,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['I', 'V', 'vi', 'III', 'IV', 'I', 'IV', 'V'],
    description: 'Renaissance-era ground bass pattern, ancestor of the pop progression.',
    tags: ['classical', 'renaissance', 'ground-bass', 'historical'],
    examples: ['Greensleeves (modified)', 'Many Renaissance dances'],
    arrangement: {
        tempo: 72,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'descending-bass',
        melodyGuide: 'counterpoint',
        style: 'renaissance'
    },
    usage: 'Historical progression showing the origin of modern pop harmony.'
},

'classical-passamezzo': {
    id: 'classical-passamezzo',
    name: 'Passamezzo Antico (i-VII-i-V-bIII-VII-i-V-i)',
    category: TEMPLATE_CATEGORIES.CLASSICAL,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['i', 'VII', 'i', 'V', 'bIII', 'VII', 'i', 'V', 'i'],
    description: 'Minor mode Renaissance dance form.',
    tags: ['classical', 'renaissance', 'minor', 'dance'],
    examples: ['Renaissance dance music'],
    arrangement: {
        tempo: 80,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 1,
        bassPattern: 'renaissance-bass',
        melodyGuide: 'modal',
        style: 'renaissance'
    },
    usage: 'Stately Renaissance dance in minor mode. Precursor to many later forms.'
},

'classical-lament': {
    id: 'classical-lament',
    name: 'Lament Bass (i-vii°-III-VII-iv-i-V-i)',
    category: TEMPLATE_CATEGORIES.CLASSICAL,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['i', 'vii°', 'III', 'VII', 'iv', 'i', 'V', 'i'],
    description: 'Descending chromatic bass line expressing grief.',
    tags: ['classical', 'baroque', 'lament', 'chromatic'],
    examples: ['"Dido\'s Lament" - Purcell', '"Crucifixus" - Bach'],
    arrangement: {
        tempo: 54,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'chromatic-descent',
        melodyGuide: 'expressive',
        style: 'baroque'
    },
    usage: 'Expresses deep sorrow through chromatically descending bass. Very powerful.'
},

'classical-deceptive-expansion': {
    id: 'classical-deceptive-expansion',
    name: 'Deceptive Cadence Expansion (I-IV-V-vi-IV-V-I)',
    category: TEMPLATE_CATEGORIES.CLASSICAL,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['I', 'IV', 'V', 'vi', 'IV', 'V', 'I'],
    description: 'Uses deceptive cadence to extend the phrase.',
    tags: ['classical', 'deceptive', 'cadence', 'extension'],
    examples: ['Common classical phrase structure'],
    arrangement: {
        tempo: 100,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'classical-bass',
        melodyGuide: 'melodic-arc',
        style: 'classical'
    },
    usage: 'The V-vi deceptive cadence surprises, requiring another V-I to resolve.'
},

'classical-baroque-sequence': {
    id: 'classical-baroque-sequence',
    name: 'Baroque Sequence (I-IV-vii°-iii-vi-ii-V-I)',
    category: TEMPLATE_CATEGORIES.CLASSICAL,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['I', 'IV', 'vii°', 'iii', 'vi', 'ii', 'V', 'I'],
    description: 'Descending thirds sequence through all diatonic chords.',
    tags: ['classical', 'baroque', 'sequence', 'diatonic'],
    examples: ['Bach, Vivaldi sequences'],
    arrangement: {
        tempo: 80,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 1,
        bassPattern: 'arpeggiated',
        melodyGuide: 'sequences',
        style: 'baroque'
    },
    usage: 'Pattern moves down by thirds, up by fourth. Classic Baroque idiom.'
},

'classical-sonata-transition': {
    id: 'classical-sonata-transition',
    name: 'Sonata Form Transition (I-V-V/V-V)',
    category: TEMPLATE_CATEGORIES.CLASSICAL,
    difficulty: DIFFICULTY_LEVELS.ADVANCED,
    progressions: ['I', 'I', 'V', 'V/V', 'V'],
    description: 'Modulating transition from tonic to dominant key area.',
    tags: ['classical', 'sonata-form', 'modulation', 'transition'],
    examples: ['Classical sonata movements'],
    arrangement: {
        tempo: 120,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 4,
        bassPattern: 'alberti-bass',
        melodyGuide: 'motivic',
        style: 'classical'
    },
    usage: 'Shows how classical music modulates from I to V for second theme.'
}
```

---

## Gospel/Soul Category (8 Templates) - NEW

```javascript
'gospel-amen': {
    id: 'gospel-amen',
    name: 'Amen Cadence (IV-I)',
    category: TEMPLATE_CATEGORIES.GOSPEL,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['IV', 'I', 'IV', 'I'],
    description: 'The plagal "Amen" cadence repeated for gospel feel.',
    tags: ['gospel', 'church', 'plagal', 'worship'],
    examples: ['Church hymns', 'Traditional gospel endings'],
    arrangement: {
        tempo: 76,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'gospel-bass',
        melodyGuide: 'pentatonic',
        style: 'gospel'
    },
    usage: 'The fundamental gospel sound. Repeat for church ending feel.'
},

'gospel-shout': {
    id: 'gospel-shout',
    name: 'Gospel Shout (I-IV-I-V-IV-I)',
    category: TEMPLATE_CATEGORIES.GOSPEL,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['I', 'IV', 'I', 'V', 'IV', 'I'],
    description: 'High-energy gospel progression for praise sections.',
    tags: ['gospel', 'praise', 'shout', 'energetic'],
    examples: ['Traditional gospel music', 'Kirk Franklin'],
    arrangement: {
        tempo: 140,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 1,
        bassPattern: 'gospel-walking',
        melodyGuide: 'call-response',
        style: 'gospel-shout'
    },
    usage: 'Used during high-energy praise moments. Add 7ths and 9ths for color.'
},

'gospel-modern': {
    id: 'gospel-modern',
    name: 'Contemporary Gospel (I-iii7-vi7-IV)',
    category: TEMPLATE_CATEGORIES.GOSPEL,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['Imaj7', 'iii7', 'vi7', 'IVmaj7'],
    description: 'Modern worship/gospel progression with 7th chords throughout.',
    tags: ['gospel', 'contemporary', 'worship', 'modern'],
    examples: ['Hillsong', 'Elevation Worship', 'Maverick City'],
    arrangement: {
        tempo: 72,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'sustained',
        melodyGuide: 'soaring',
        style: 'modern-worship'
    },
    usage: 'Smooth, modern worship sound. Let chords ring with extensions.'
},

'gospel-soul-turnaround': {
    id: 'gospel-soul-turnaround',
    name: 'Soul Turnaround (I-vi-ii-V)',
    category: TEMPLATE_CATEGORIES.GOSPEL,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['I', 'vi', 'ii', 'V'],
    description: 'Classic soul/R&B turnaround.',
    tags: ['soul', 'r&b', 'turnaround', 'motown'],
    examples: ['"Stand by Me" - Ben E. King', '"Earth Angel"'],
    arrangement: {
        tempo: 76,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'root-fifth',
        melodyGuide: 'soulful',
        style: 'soul'
    },
    usage: 'The classic doo-wop/soul progression. Add 7ths for more sophistication.'
},

'gospel-rb-vamp': {
    id: 'gospel-rb-vamp',
    name: 'R&B Vamp (Imaj9-IVmaj9)',
    category: TEMPLATE_CATEGORIES.GOSPEL,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['Imaj9', 'IVmaj9', 'Imaj9', 'IVmaj9'],
    description: 'Two-chord R&B vamp with lush extensions.',
    tags: ['r&b', 'neo-soul', 'vamp', 'smooth'],
    examples: ['"No Diggity"', 'D\'Angelo', 'Erykah Badu'],
    arrangement: {
        tempo: 90,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'syncopated',
        melodyGuide: 'melismatic',
        style: 'neo-soul'
    },
    usage: 'Hypnotic two-chord groove. Focus on rhythm and vocal runs.'
},

'gospel-neo-soul': {
    id: 'gospel-neo-soul',
    name: 'Neo-Soul Progression (vi9-V9-IV9-Imaj9)',
    category: TEMPLATE_CATEGORIES.GOSPEL,
    difficulty: DIFFICULTY_LEVELS.ADVANCED,
    progressions: ['vi9', 'V9', 'IVmaj9', 'Imaj9'],
    description: 'Sophisticated neo-soul with 9th chords.',
    tags: ['neo-soul', 'r&b', 'sophisticated', 'modern'],
    examples: ['"Untitled (How Does It Feel)" - D\'Angelo'],
    arrangement: {
        tempo: 75,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'electric-bass',
        melodyGuide: 'jazzy-r&b',
        style: 'neo-soul'
    },
    usage: 'Lush, jazzy R&B sound. All 9th chords for that modern vibe.'
},

'gospel-worship-build': {
    id: 'gospel-worship-build',
    name: 'Worship Build (IV-V-vi-I)',
    category: TEMPLATE_CATEGORIES.GOSPEL,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['IV', 'V', 'vi', 'I'],
    description: 'Reordered pop progression common in worship music.',
    tags: ['worship', 'contemporary', 'building', 'anthemic'],
    examples: ['"Oceans" - Hillsong', '"Good Good Father"'],
    arrangement: {
        tempo: 68,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'sustained',
        melodyGuide: 'ascending',
        style: 'modern-worship'
    },
    usage: 'Starting on IV creates lift. Great for building worship sections.'
},

'gospel-soul-bridge': {
    id: 'gospel-soul-bridge',
    name: 'Soul Bridge (iii-vi-ii-V)',
    category: TEMPLATE_CATEGORIES.GOSPEL,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['iii7', 'vi7', 'ii7', 'V7'],
    description: 'Descending diatonic 7th chords for soul bridges.',
    tags: ['soul', 'bridge', 'sophisticated', 'descending'],
    examples: ['Classic Motown bridges'],
    arrangement: {
        tempo: 88,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'walking',
        melodyGuide: 'soulful',
        style: 'soul'
    },
    usage: 'Smooth descending 7th chords. Great for contrasting bridge sections.'
}
```

---

## World Category (5 Templates) - NEW

```javascript
'world-flamenco': {
    id: 'world-flamenco',
    name: 'Andalusian Cadence (i-VII-VI-V)',
    category: TEMPLATE_CATEGORIES.WORLD,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['i', 'VII', 'VI', 'V'],
    description: 'Descending flamenco/Spanish progression.',
    tags: ['flamenco', 'spanish', 'phrygian', 'mediterranean'],
    examples: ['"Hit the Road Jack"', '"Smooth" - Santana', 'Flamenco music'],
    arrangement: {
        tempo: 120,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'flamenco',
        melodyGuide: 'phrygian-dominant',
        style: 'flamenco'
    },
    usage: 'The classic Spanish sound. Use Phrygian dominant scale over V.'
},

'world-celtic': {
    id: 'world-celtic',
    name: 'Celtic Modal (I-bVII-IV-I)',
    category: TEMPLATE_CATEGORIES.WORLD,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['I', 'bVII', 'IV', 'I'],
    description: 'Mixolydian-based Celtic progression.',
    tags: ['celtic', 'irish', 'mixolydian', 'folk'],
    examples: ['Traditional Irish music', '"The Rains of Castamere"'],
    arrangement: {
        tempo: 110,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'drone',
        melodyGuide: 'mixolydian',
        style: 'celtic'
    },
    usage: 'Modal Celtic sound. The bVII is characteristic of Mixolydian mode.'
},

'world-reggae': {
    id: 'world-reggae',
    name: 'Reggae One Drop (I-IV-I-V)',
    category: TEMPLATE_CATEGORIES.WORLD,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['I', 'IV', 'I', 'V'],
    description: 'Basic reggae progression with emphasis on offbeats.',
    tags: ['reggae', 'jamaican', 'one-drop', 'roots'],
    examples: ['"No Woman No Cry" - Bob Marley', '"Three Little Birds"'],
    arrangement: {
        tempo: 75,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'reggae-bass',
        melodyGuide: 'offbeat',
        style: 'reggae'
    },
    usage: 'Emphasize the offbeat (skank) and bass on beats 1 and 3.'
},

'world-latin-montuno': {
    id: 'world-latin-montuno',
    name: 'Son Montuno (I-IV-V-IV)',
    category: TEMPLATE_CATEGORIES.WORLD,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['I', 'IV', 'V', 'IV'],
    description: 'Cuban son/salsa progression.',
    tags: ['latin', 'salsa', 'cuban', 'montuno'],
    examples: ['Salsa music', 'Buena Vista Social Club'],
    arrangement: {
        tempo: 180,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 1,
        bassPattern: 'tumbao',
        melodyGuide: 'clave-based',
        style: 'salsa'
    },
    usage: 'Use clave rhythm pattern. Piano plays montuno pattern.'
},

'world-middle-eastern': {
    id: 'world-middle-eastern',
    name: 'Hijaz Scale Progression (i-bII-i-V)',
    category: TEMPLATE_CATEGORIES.WORLD,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['i', 'bII', 'i', 'V'],
    description: 'Middle Eastern/North African progression using Hijaz mode.',
    tags: ['middle-eastern', 'arabic', 'hijaz', 'phrygian'],
    examples: ['Traditional Arabic music', 'Klezmer'],
    arrangement: {
        tempo: 100,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'drone',
        melodyGuide: 'hijaz',
        style: 'middle-eastern'
    },
    usage: 'Use Hijaz/Phrygian dominant scale. The bII is characteristic.'
}
```

---

## EDM/Modern Category (5 Templates) - NEW

```javascript
'edm-four-chord': {
    id: 'edm-four-chord',
    name: 'EDM Anthem (I-V-vi-IV)',
    category: TEMPLATE_CATEGORIES.EDM,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['I', 'V', 'vi', 'IV'],
    description: 'Standard EDM progression with the drop on I.',
    tags: ['edm', 'dance', 'drop', 'festival'],
    examples: ['"Don\'t You Worry Child" - Swedish House Mafia', '"Wake Me Up" - Avicii'],
    arrangement: {
        tempo: 128,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'sidechain',
        melodyGuide: 'arpeggiated',
        style: 'progressive-house'
    },
    usage: 'Build up to the drop on I. Use sidechain compression on bass.'
},

'edm-trance': {
    id: 'edm-trance',
    name: 'Trance Progression (i-VI-III-VII)',
    category: TEMPLATE_CATEGORIES.EDM,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['i', 'VI', 'III', 'VII'],
    description: 'Uplifting trance progression in minor.',
    tags: ['trance', 'uplifting', 'emotional', 'electronic'],
    examples: ['Classic trance anthems', 'Armin van Buuren'],
    arrangement: {
        tempo: 138,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 4,
        bassPattern: 'rolling-bass',
        melodyGuide: 'supersaw',
        style: 'trance'
    },
    usage: 'Long chord holds with building supersaw. Very emotional, euphoric sound.'
},

'edm-future-bass': {
    id: 'edm-future-bass',
    name: 'Future Bass (I-vi-IV-V)',
    category: TEMPLATE_CATEGORIES.EDM,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['Imaj7', 'vi7', 'IVmaj7', 'V7'],
    description: 'Modern future bass with 7th chords and pitch bends.',
    tags: ['future-bass', 'modern', 'chords', 'flume'],
    examples: ['Flume', 'San Holo', 'Illenium'],
    arrangement: {
        tempo: 150,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'wobbly',
        melodyGuide: 'pitch-bent',
        style: 'future-bass'
    },
    usage: 'Use chord stabs with sidechain and pitch modulation on synths.'
},

'edm-house': {
    id: 'edm-house',
    name: 'Deep House Vamp (i7-IV7)',
    category: TEMPLATE_CATEGORIES.EDM,
    difficulty: DIFFICULTY_LEVELS.BEGINNER,
    progressions: ['i7', 'IV7', 'i7', 'IV7'],
    description: 'Minimal two-chord deep house progression.',
    tags: ['house', 'deep-house', 'minimal', 'groove'],
    examples: ['Disclosure', 'Kaytranada'],
    arrangement: {
        tempo: 124,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 2,
        bassPattern: 'four-on-floor',
        melodyGuide: 'rhodes-stabs',
        style: 'deep-house'
    },
    usage: 'Minimal chords, maximum groove. Let the rhythm drive the track.'
},

'edm-dubstep': {
    id: 'edm-dubstep',
    name: 'Dubstep Build (i-bVI-bIII-bVII)',
    category: TEMPLATE_CATEGORIES.EDM,
    difficulty: DIFFICULTY_LEVELS.INTERMEDIATE,
    progressions: ['i', 'bVI', 'bIII', 'bVII'],
    description: 'Epic dubstep buildup progression.',
    tags: ['dubstep', 'drop', 'bass', 'epic'],
    examples: ['Skrillex', 'Zomboy', 'Excision'],
    arrangement: {
        tempo: 140,
        timeSignature: { num: 4, denom: 4 },
        measuresPerChord: 4,
        bassPattern: 'halfstep',
        melodyGuide: 'arpeggio-build',
        style: 'dubstep'
    },
    usage: 'Build tension then drop on the i with heavy bass. All natural minor.'
}
```

---

## Summary

### Total Templates: 75

| Category | Existing | New | Total |
|----------|----------|-----|-------|
| Pop | 3 | 9 | 12 |
| Jazz | 4 | 12 | 16 |
| Blues | 3 | 6 | 9 |
| Rock | 3 | 6 | 9 |
| Classical | 5 | 6 | 11 |
| Gospel/Soul | 0 | 8 | 8 |
| World | 0 | 5 | 5 |
| EDM/Modern | 0 | 5 | 5 |
| **Total** | **18** | **57** | **75** |

Note: The existing count is 18 (not 24) because some templates were counted as part of non-4/4 templates which are kept separate.

### New Category Constants Required

```javascript
const TEMPLATE_CATEGORIES = {
    POP: 'Pop',
    JAZZ: 'Jazz',
    CLASSICAL: 'Classical',
    ROCK: 'Rock',
    BLUES: 'Blues',
    GOSPEL: 'Gospel/Soul',    // NEW
    WORLD: 'World',           // NEW
    EDM: 'EDM/Modern',        // NEW
    CUSTOM: 'Custom'
};
```

---

## Implementation Notes

1. **Roman Numeral Parsing**: Extended chords (maj7, 9, etc.) require enhanced parsing
2. **Arrangement Metadata**: New bassPattern and melodyGuide values need handlers
3. **Category Tabs**: UI needs to accommodate 8+ categories (consider scrolling)
4. **Search**: All templates have comprehensive tags for filtering
5. **Difficulty**: Even distribution across Beginner/Intermediate/Advanced

---

## Next Steps

1. Add these templates to `progressionTemplates.js`
2. Update category constants
3. Enhance roman numeral parser for extended chord types
4. Update template browser UI for new categories
5. Test all templates load correctly
