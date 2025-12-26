/**
 * Theory Moments Configuration
 * Defines the content for contextual learning popups
 * Part of Tier 1: Teaching-Composition Integration
 */

// ============================================================================
// THEORY MOMENT DEFINITIONS
// ============================================================================

/**
 * Theory moment types with their detection criteria and educational content
 */
export const THEORY_MOMENTS = {
    // Modal Interchange (Borrowed Chords)
    'modal-interchange': {
        icon: '✨',
        title: 'Modal Interchange!',
        triggers: ['bVI', 'bVII', 'bIII', 'iv', 'bII', '#iv°'],
        content: {
            simple: 'You borrowed a chord from a parallel key! This adds unexpected color to your progression.',
            intermediate: 'Modal interchange means borrowing chords from a parallel mode. This chord comes from the parallel minor, adding darkness or drama to your major key.',
            advanced: 'This borrowed chord introduces chromatic tones from the parallel mode. The voice leading creates interesting half-step motion that draws the ear while maintaining harmonic coherence.'
        },
        chordSpecific: {
            'bVI': {
                title: 'The Flat VI Chord!',
                content: {
                    simple: 'This dramatic chord comes from the minor key. It feels like a surprise twist!',
                    intermediate: 'The bVI is borrowed from parallel minor. It creates a dramatic, cinematic quality often used in rock and film music.',
                    advanced: 'The bVI contains the b6 and b3 scale degrees from minor, creating a chromatic mediant relationship with the tonic. Often resolves to V or bVII.'
                },
                famousSongs: ['Creep - Radiohead', 'Space Oddity - David Bowie', 'My Heart Will Go On']
            },
            'bVII': {
                title: 'The Flat VII Chord!',
                content: {
                    simple: 'This rock-sounding chord gives your music an edgier, folk-rock feel!',
                    intermediate: 'The bVII comes from Mixolydian mode or parallel minor. It\'s a rock and folk staple that avoids the strong pull of the dominant V.',
                    advanced: 'The bVII is the most commonly borrowed chord. It creates a "backdoor" resolution to I (bVII-I) or can lead to IV. The whole-step bass motion feels relaxed compared to V-I.'
                },
                famousSongs: ['Hey Jude - Beatles', 'Sweet Home Alabama', 'Let It Be - Beatles']
            },
            'bIII': {
                title: 'The Flat III Chord!',
                content: {
                    simple: 'This open-sounding chord adds brightness despite being "borrowed" from minor!',
                    intermediate: 'The bIII creates a chromatic mediant relationship with the tonic. It\'s often used for its surprising yet consonant quality.',
                    advanced: 'The bIII is a chromatic mediant sharing one common tone with I. It introduces the b3 and b7 degrees, often moving to IV or bVI in the "Creep" progression.'
                },
                famousSongs: ['Creep - Radiohead', 'Mad World', 'Where Is My Mind - Pixies']
            },
            'iv': {
                title: 'Minor iv Chord!',
                content: {
                    simple: 'Using minor iv instead of major IV adds a touch of sadness or nostalgia.',
                    intermediate: 'The minor iv is borrowed from parallel minor. The b6 degree (minor 3rd of iv) creates a poignant, melancholic quality.',
                    advanced: 'The minor iv introduces the b6 scale degree. In voice leading, this tone often descends chromatically to the 5th of the tonic. Classic in "Amen" cadence variants.'
                },
                famousSongs: ['Creep - Radiohead', 'In My Life - Beatles', 'Something - Beatles']
            },
            'bII': {
                title: 'Neapolitan Chord!',
                content: {
                    simple: 'This exotic-sounding chord adds drama and tension, often before the final cadence.',
                    intermediate: 'The Neapolitan (bII) is a major chord on the flattened second degree. It typically resolves to V, creating a dramatic pre-dominant function.',
                    advanced: 'The Neapolitan contains b2 and b6 degrees. In first inversion (bII6), the bass note is scale degree 4, creating smooth voice leading to V. A staple of classical drama.'
                },
                famousSongs: ['Classical pieces', 'Film scores', 'Phantom of the Opera']
            }
        },
        lessonLink: 'modal-interchange-lesson',
        color: '#ec4899' // Pink
    },

    // Deceptive Cadence
    'deceptive-cadence': {
        icon: '🎯',
        title: 'Deceptive Cadence!',
        triggers: [['V', 'vi'], ['V7', 'vi']],
        content: {
            simple: 'Instead of going home to the I chord, you surprised us with vi! It\'s like a plot twist in music.',
            intermediate: 'The deceptive cadence (V-vi) subverts the expected V-I resolution. The vi shares two notes with I, providing harmonic continuity while delaying closure.',
            advanced: 'V-vi works because vi shares the 1st and 3rd scale degrees with I. The resolution is "deceptive" because dominant function typically resolves to tonic, but vi (submediant) has tonic-like function.'
        },
        famousSongs: ['Hello - Adele', 'Let It Be - Beatles', 'Hallelujah - Leonard Cohen'],
        lessonLink: 'cadences-lesson',
        color: '#3b82f6' // Blue
    },

    // Plagal Cadence
    'plagal-cadence': {
        icon: '🙏',
        title: 'Plagal Cadence!',
        triggers: [['IV', 'I'], ['iv', 'I']],
        content: {
            simple: 'This is the "Amen" cadence! You\'ll hear it at the end of hymns and many pop songs.',
            intermediate: 'The plagal cadence (IV-I) provides a softer resolution than the authentic cadence. It\'s called the "Amen" cadence from its use in church music.',
            advanced: 'IV-I lacks the leading tone resolution of V-I, creating a more subdued arrival. The 4th scale degree descends to 3, while the bass moves by perfect fourth. Often used as a tag after an authentic cadence.'
        },
        famousSongs: ['Let It Be - Beatles (ending)', 'Amen (hymns)', 'With or Without You - U2'],
        lessonLink: 'cadences-lesson',
        color: '#22c55e' // Green
    },

    // Perfect Authentic Cadence
    'perfect-cadence': {
        icon: '🏠',
        title: 'Perfect Authentic Cadence!',
        triggers: [['V', 'I'], ['V7', 'I']],
        content: {
            simple: 'This is the strongest "ending" in music! V to I feels like coming home.',
            intermediate: 'The perfect authentic cadence (V-I) is the most conclusive cadence in tonal music. The leading tone (7th scale degree) in V resolves up to the tonic.',
            advanced: 'V-I contains two tendency tone resolutions: the leading tone rises to tonic, and the 4th degree (7th of V7) falls to 3. This contrary motion creates the strongest sense of closure.'
        },
        famousSongs: ['Almost every classical piece', 'Happy Birthday', 'Most pop song endings'],
        lessonLink: 'cadences-lesson',
        color: '#10b981' // Teal
    },

    // Secondary Dominant
    'secondary-dominant': {
        icon: '🔥',
        title: 'Secondary Dominant!',
        triggers: ['V/V', 'V/ii', 'V/IV', 'V/vi', 'V7/V', 'V7/ii', 'V7/IV', 'V7/vi'],
        content: {
            simple: 'This is a "temporary dominant" - it borrows the power of V to make another chord feel more important!',
            intermediate: 'A secondary dominant ({chord}) temporarily tonicizes another chord. It contains the leading tone of the target chord, creating tension that pulls toward it.',
            advanced: 'Secondary dominants like {chord} introduce chromatic alterations (typically raised notes) to create a leading tone for the target chord. This momentary tonicization adds forward motion and harmonic color.'
        },
        chordSpecific: {
            'V/V': {
                title: 'V/V (Five of Five)!',
                content: {
                    simple: 'This chord makes the V chord feel even more powerful by giving it its own dominant!',
                    intermediate: 'V/V is the dominant of the dominant. It contains a raised 4th scale degree that acts as leading tone to the 5th scale degree.',
                    advanced: 'V/V (or II with raised third) is the most common secondary dominant. In C major, this is D major containing F#, which resolves to G (V).'
                }
            },
            'V/ii': {
                title: 'V/ii (Five of Two)!',
                content: {
                    simple: 'This adds drama before going to the ii chord - very jazz and R&B!',
                    intermediate: 'V/ii creates a mini ii-V pattern, common in jazz. It introduces the raised tonic as leading tone to the 2nd scale degree.',
                    advanced: 'V/ii (or VI with raised third) tonicizes the supertonic. Often part of an extended ii-V-I or sequential harmonic movement.'
                }
            },
            'V/IV': {
                title: 'V/IV (Five of Four)!',
                content: {
                    simple: 'This creates extra anticipation before landing on the IV chord!',
                    intermediate: 'V/IV is simply the I chord with a minor 7th added (I7), but its function is to pull toward IV using the dominant-tonic relationship.',
                    advanced: 'V/IV introduces the b7 scale degree. Since I7 = V7/IV, it creates a temporary tonicization of the subdominant, common in blues and rock.'
                }
            }
        },
        famousSongs: ['Georgia On My Mind', 'I Got Rhythm', 'All of Me'],
        lessonLink: 'secondary-dominants-lesson',
        color: '#f59e0b' // Amber
    },

    // Circle of Fifths Motion
    'circle-of-fifths': {
        icon: '🔄',
        title: 'Circle of Fifths Motion!',
        triggers: 'sequence_of_fifths', // Special detection
        content: {
            simple: 'Your chords are moving in fifths - this is one of the strongest progressions in music!',
            intermediate: 'Circle of fifths motion (roots moving down by 5th/up by 4th) creates powerful forward momentum. Each chord\'s root becomes the 5th of the next.',
            advanced: 'The descending fifth sequence (vi-ii-V-I, or iii-vi-ii-V-I) exploits the dominant-tonic relationship at each step. This creates maximum harmonic pull and is foundational to jazz and common practice harmony.'
        },
        famousSongs: ['Autumn Leaves', 'Fly Me to the Moon', 'I Will Survive'],
        lessonLink: 'circle-of-fifths-lesson',
        color: '#8b5cf6' // Purple
    },

    // Tritone Substitution
    'tritone-sub': {
        icon: '🎷',
        title: 'Tritone Substitution!',
        triggers: ['bII7', 'bII'],
        content: {
            simple: 'This jazzy substitution replaces the V chord with a chord a tritone away - sneaky!',
            intermediate: 'The tritone substitution replaces V7 with bII7. Both chords share the same tritone interval (3rd and 7th swap places), so they resolve similarly.',
            advanced: 'In tritone sub, bII7\'s 3rd = V7\'s 7th and vice versa. This shared tritone means both want to resolve to I. The bII7 adds chromatic bass motion (b2 to 1) instead of 5 to 1.'
        },
        famousSongs: ['Giant Steps - Coltrane', 'Girl From Ipanema', 'Many jazz standards'],
        lessonLink: 'jazz-harmony-lesson',
        color: '#06b6d4' // Cyan
    },

    // Chromatic Mediant
    'chromatic-mediant': {
        icon: '🌈',
        title: 'Chromatic Mediant!',
        triggers: ['bVI', 'bIII', '#III', 'VI'],
        content: {
            simple: 'This colorful chord is a third away from your key center - it sounds magical and unexpected!',
            intermediate: 'Chromatic mediants are chords a third away from tonic with chromatic alterations. They share one common tone with I but sound surprising due to the chromatic notes.',
            advanced: 'Chromatic mediants (bIII, bVI, III, VI) relate to I by third. They share exactly one pitch class with I, creating smooth voice leading despite the chromatic shift. Common in film scores for their dramatic effect.'
        },
        famousSongs: ['Star Wars themes', 'Film scores', 'E.T. theme'],
        lessonLink: 'chromatic-harmony-lesson',
        color: '#a855f7' // Purple
    }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the theory moment config for a given type
 * @param {string} type - The moment type
 * @returns {Object|null} The moment configuration
 */
export function getTheoryMomentConfig(type) {
    return THEORY_MOMENTS[type] || null;
}

/**
 * Get chord-specific content if available
 * @param {string} type - The moment type
 * @param {string} chord - The specific chord (e.g., 'bVI')
 * @returns {Object|null} Chord-specific content
 */
export function getChordSpecificContent(type, chord) {
    const moment = THEORY_MOMENTS[type];
    if (moment && moment.chordSpecific && moment.chordSpecific[chord]) {
        return moment.chordSpecific[chord];
    }
    return null;
}

/**
 * Get all moment types
 * @returns {string[]} Array of moment type keys
 */
export function getAllMomentTypes() {
    return Object.keys(THEORY_MOMENTS);
}

/**
 * Get lesson link for a moment type
 * @param {string} type - The moment type
 * @returns {string|null} The lesson link ID
 */
export function getLessonLink(type) {
    const moment = THEORY_MOMENTS[type];
    return moment ? moment.lessonLink : null;
}
