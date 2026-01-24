/**
 * fullscreenGuidedExercises.js
 *
 * Fullscreen versions of Theory Academy guided exercises.
 * Uses the fullscreen Chord Lab (chordlab-new) and Composition Studio (studio-new).
 *
 * These exercises use the infrastructure from fullscreenTutorialHelpers.js
 * to provide consistent, polished guided experiences.
 */

import {
    // Step builders
    createRootSelectionStep,
    createChordTypeSelectionStep,
    createAddChordStep,
    createTabNavigationStep,
    createInfoStep,
    createPlayChordStep,
    createKeyboardStep,

    // Highlighting helpers
    clearRootButtonHighlights,
    highlightRootButton,
    highlightChordTypeButton,
    removeChordTypeHighlight,
    applyHighlight,
    removeHighlight,

    // Selectors
    getChordTypeSelector,

    // Setup/cleanup
    setupFullscreenTutorial,
    cleanupFullscreenTutorial
} from './fullscreenTutorialHelpers.js';

// ===========================================
// WHAT IS A CHORD - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "What is a Chord?" lesson
 * Teaches chord building in the fullscreen Chord Lab
 */
export const whatIsAChordGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Welcome to the Chord Lab! This is where you build and explore chords.',
        {
            callout: 'The Chord Lab has three main areas: Root selection (left), Chord Library (center), and a piano keyboard (bottom). Let\'s start by selecting the ROOT note!'
        }
    ),

    // ========== SELECT C ROOT ==========
    createRootSelectionStep('C', {
        instruction: 'Click on "C" to select it as our root note.',
        callout: 'The ROOT note is the foundation of a chord. All other notes are measured from here. C is the most common starting point for learning!',
        successMessage: 'C is now our root note!'
    }),

    // ========== POINT OUT CHORD LIBRARY ==========
    createInfoStep(
        'Now look at the Chord Library in the center. This shows all the chord types you can build!',
        {
            spotlight: '#fs-chord-grid-container',
            targetElement: '#fs-chord-grid-container',
            callout: 'Major and Minor are the two most important chord types. They\'re highlighted as "Key Chords" because they\'re the building blocks of nearly all music!'
        }
    ),

    // ========== SELECT MAJOR ==========
    createChordTypeSelectionStep('Major', {
        instruction: 'Click on "Major" to build a C Major chord.',
        callout: 'C Major (C-E-G) has a bright, happy sound. It\'s the most common chord in music!',
        successMessage: 'C Major selected!'
    }),

    // ========== POINT OUT KEYBOARD HIGHLIGHTING ==========
    createKeyboardStep(
        'Look at the piano keyboard! The keys C, E, and G are highlighted.',
        {
            callout: 'The keyboard always shows which notes are in your current chord. These three notes (C-E-G) form the C Major triad - the 1st, 3rd, and 5th notes of the C scale!'
        }
    ),

    // ========== PLAY THE CHORD ==========
    createPlayChordStep({
        instruction: 'Click the Play button or press any highlighted key to hear C Major.',
        callout: 'Listen to how bright and happy it sounds! This is the characteristic "major" quality.',
        successMessage: 'Beautiful! That\'s the sound of a Major chord - bright and happy!'
    }),

    // ========== SWITCH TO MINOR ==========
    createChordTypeSelectionStep('Minor', {
        instruction: 'Now let\'s hear the difference! Click on "Minor" in the chord library.',
        callout: 'C Minor (C-Eb-G) changes just ONE note - the E becomes Eb (E-flat). This small change has a dramatic emotional effect!',
        successMessage: 'C Minor selected!'
    }),

    // ========== NOTICE THE KEYBOARD CHANGE ==========
    createKeyboardStep(
        'Look at the keyboard! Notice that E has moved down to Eb (the black key).',
        {
            callout: 'Major to Minor: the 3rd note moves down by one half step (E → Eb). This tiny change transforms the chord from happy to sad!'
        }
    ),

    // ========== PLAY MINOR ==========
    createPlayChordStep({
        instruction: 'Play the C Minor chord. Hear how it sounds sadder and more emotional!',
        callout: 'That\'s the power of the 3rd note! It\'s called the "quality" of the chord because it determines whether we hear major (happy) or minor (sad).',
        successMessage: 'That\'s a Minor chord! Notice the emotional difference from Major.'
    }),

    // ========== INTRODUCE ARPEGGIO ==========
    {
        instruction: 'Now let\'s try something fun! An ARPEGGIO plays the chord notes one at a time.',
        spotlight: '#fs-chord-grid-container',
        targetElement: '#fs-chord-grid-container',
        callout: 'Look at the chord type buttons - each one has UP (▲) and DOWN (▼) arrows on the right side. These play the chord notes one at a time instead of all together!',
        validation: null,
        successMessage: null,
        onEnter: () => {
            // Highlight a few arpeggio button areas to draw attention
            setTimeout(() => {
                const wrappers = document.querySelectorAll('#fs-chord-grid-container .key-button-wrapper');
                wrappers.forEach((wrapper, i) => {
                    if (i < 3) { // Highlight first 3 wrappers
                        const arpContainer = wrapper.querySelector('div.flex.flex-col.w-8');
                        if (arpContainer) {
                            arpContainer.style.boxShadow = '0 0 10px 3px rgba(34, 197, 94, 0.6)';
                            arpContainer.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
                            arpContainer.style.borderRadius = '4px';
                        }
                    }
                });
            }, 100);
        },
        onExit: () => {
            // Remove highlights
            const wrappers = document.querySelectorAll('#fs-chord-grid-container .key-button-wrapper');
            wrappers.forEach(wrapper => {
                const arpContainer = wrapper.querySelector('div.flex.flex-col.w-8');
                if (arpContainer) {
                    arpContainer.style.boxShadow = '';
                    arpContainer.style.backgroundColor = '';
                    arpContainer.style.borderRadius = '';
                }
            });
        }
    },

    // ========== TRY ARPEGGIO ==========
    {
        instruction: 'Try clicking the ▲ or ▼ arrows on any chord type button to hear an arpeggio.',
        spotlight: '#fs-chord-grid-container',
        targetElement: '#fs-chord-grid-container',
        callout: 'Arpeggios are beautiful for melodies and guitar strumming. Watch the keyboard - each note lights up as it plays!',
        validation: { type: 'chord_played' },
        successMessage: 'Great! Arpeggios are a beautiful way to play chords.',
        onEnter: () => {
            // Highlight arpeggio button areas with pulsing animation
            setTimeout(() => {
                const wrappers = document.querySelectorAll('#fs-chord-grid-container .key-button-wrapper');
                wrappers.forEach((wrapper, i) => {
                    if (i < 4) { // Highlight first 4 wrappers
                        const arpContainer = wrapper.querySelector('div.flex.flex-col.w-8');
                        if (arpContainer) {
                            arpContainer.classList.add('animate-pulse');
                            arpContainer.style.boxShadow = '0 0 12px 4px rgba(139, 92, 246, 0.7)';
                            arpContainer.style.backgroundColor = 'rgba(139, 92, 246, 0.2)';
                            arpContainer.style.borderRadius = '4px';
                        }
                    }
                });
            }, 100);
        },
        onExit: () => {
            // Remove highlights
            const wrappers = document.querySelectorAll('#fs-chord-grid-container .key-button-wrapper');
            wrappers.forEach(wrapper => {
                const arpContainer = wrapper.querySelector('div.flex.flex-col.w-8');
                if (arpContainer) {
                    arpContainer.classList.remove('animate-pulse');
                    arpContainer.style.boxShadow = '';
                    arpContainer.style.backgroundColor = '';
                    arpContainer.style.borderRadius = '';
                }
            });
        }
    },

    // ========== ADD TO PROGRESSION ==========
    createInfoStep(
        'Now let\'s add a chord to a progression! A progression is a sequence of chords that form the harmony of a song.',
        {
            callout: 'The indigo "+" button at the bottom right adds your current chord to the progression.'
        }
    ),

    // ========== BUILD C MAJOR AND ADD ==========
    createChordTypeSelectionStep('Major', {
        instruction: 'First, select "Major" again so we have C Major.',
        successMessage: 'C Major selected!'
    }),

    createAddChordStep('C', 'Major', {
        instruction: 'Click the indigo "+" button to add C Major to your progression.',
        callout: 'This is the first chord of your very first progression!',
        successMessage: 'C Major added to progression!'
    }),

    // ========== TRY G ==========
    createRootSelectionStep('G', {
        instruction: 'Let\'s try G Major. Click "G" in the Root section.',
        callout: 'G Major (G-B-D) is another very common chord. It\'s the V chord in the key of C!',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major" to hear G Major.',
        successMessage: 'G Major selected!'
    }),

    createPlayChordStep({
        instruction: 'Play G Major and compare it to C Major.',
        callout: 'Notice how G Major sounds similar in "quality" (happy/bright) but at a different pitch.',
        successMessage: 'You\'ve built G Major! Same happy quality, different pitch.'
    }),

    // ========== FINAL STEP ==========
    {
        instruction: '🎉 Congratulations! You now understand the basics of chords!',
        callout: 'Key concepts:\n• The ROOT is the foundation\n• MAJOR chords sound happy (1-3-5)\n• MINOR chords sound sad (1-♭3-5)\n• The 3rd determines the quality\n• Explore more chord types in the library!',
        validation: null,
        successMessage: null,
        allowFreeExplore: true
    }
];

// ===========================================
// MAJOR VS MINOR - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Major vs Minor" lesson
 * Focuses on the emotional difference between major and minor triads
 */
export const majorVsMinorGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s feel the emotional difference between Major and Minor triads!',
        {
            callout: 'You\'ll build both a major and minor triad on the same root note (D) to experience how one half-step changes everything.'
        }
    ),

    // ========== SELECT D ROOT ==========
    createRootSelectionStep('D', {
        instruction: 'First, select "D" as our root note.',
        callout: 'We\'ll use D so you can clearly see and hear the difference between F# (major 3rd) and F (minor 3rd).',
        successMessage: 'D is now our root note!'
    }),

    // ========== SELECT MAJOR ==========
    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major" to build D Major.',
        callout: 'D Major Triad = D - F# - A. The F# is the "major 3rd" - 4 half-steps above D.',
        successMessage: 'D Major selected!'
    }),

    // ========== NOTICE KEYBOARD ==========
    createKeyboardStep(
        'Look at the keyboard! D, F#, and A are highlighted.',
        {
            callout: 'The F# (the black key between F and G) is the "major 3rd" - it gives this chord its happy, bright sound.'
        }
    ),

    // ========== PLAY D MAJOR ==========
    createPlayChordStep({
        instruction: 'Play D Major and listen to the bright, uplifting mood.',
        callout: 'This happy sound comes from the F# (major 3rd). It\'s 4 half-steps above D.',
        successMessage: 'Beautiful! That\'s the bright, happy sound of D Major!'
    }),

    // ========== SWITCH TO MINOR ==========
    createChordTypeSelectionStep('Minor', {
        instruction: 'Now click "Minor" to hear the emotional shift.',
        callout: 'D Minor = D - F - A. We\'re changing F# to F (natural) - just ONE half-step lower!',
        successMessage: 'D Minor selected!'
    }),

    // ========== NOTICE THE CHANGE ==========
    createKeyboardStep(
        'Look at the keyboard! The F# has changed to F (the white key).',
        {
            callout: 'The "minor 3rd" (F) is only 3 half-steps above D, compared to 4 for the "major 3rd" (F#). That tiny difference is HUGE emotionally!'
        }
    ),

    // ========== PLAY D MINOR ==========
    createPlayChordStep({
        instruction: 'Play D Minor. Listen to how the mood completely changes!',
        callout: 'Same root (D) and fifth (A), but a completely different feeling. This is the power of the 3rd!',
        successMessage: 'You felt it! That darker, more emotional quality is the sound of a minor triad.'
    }),

    // ========== A/B COMPARISON ==========
    {
        instruction: 'Now do a quick A/B comparison. Switch between Major and Minor a few times.',
        callout: 'Click Major, play it, then Minor, play it. Really feel that emotional shift! Your ear will start to instantly recognize the difference.',
        validation: { type: 'chord_played' },
        successMessage: 'The difference is unmistakable when you hear them side by side!'
    },

    // ========== TRY E ==========
    createRootSelectionStep('E', {
        instruction: 'Let\'s try another root! Select "E".',
        callout: 'E Major = E - G# - B (happy). E Minor = E - G - B (sad). Same pattern - only the 3rd changes!',
        successMessage: 'E selected!'
    }),

    // ========== EXPLORE ==========
    createPlayChordStep({
        instruction: 'Try both E Major and E Minor. Feel the same emotional pattern at a different pitch.',
        callout: 'The Major/Minor emotional difference works the same way for EVERY root note. That\'s what makes it so powerful and universal!',
        successMessage: '🎉 Congratulations! You now understand the fundamental difference between major and minor triads!'
    }),

    // ========== FINAL ==========
    createInfoStep(
        'You\'ve mastered Major vs Minor!',
        {
            callout: 'Key insight: ONE note (the 3rd) determines whether a chord sounds happy (major) or sad (minor). This applies to every root note in music!',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// CHORD INVERSIONS - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Chord Inversions" lesson
 */
export const chordInversionsGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s explore chord inversions!',
        {
            callout: 'An inversion changes which note is in the bass (bottom) while keeping the same chord notes. This dramatically changes how the chord feels - from stable to floating to tense.'
        }
    ),

    // ========== BUILD C MAJOR ==========
    createRootSelectionStep('C', {
        instruction: 'First, let\'s build a C Major chord. Select "C" as the root.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major" to build C Major.',
        callout: 'C Major has 3 notes: C-E-G. We can put ANY of these on the bottom!',
        successMessage: 'C Major selected!'
    }),

    // ========== EXPLAIN ROOT POSITION ==========
    createInfoStep(
        'Right now you\'re hearing ROOT POSITION - the root (C) is in the bass.',
        {
            callout: 'Root Position sounds the most STABLE. It\'s "home base" - solid and grounded.'
        }
    ),

    // ========== PLAY ROOT POSITION ==========
    createPlayChordStep({
        instruction: 'Play the chord in root position. Notice how solid and stable it sounds.',
        successMessage: 'That\'s root position - the foundation!'
    }),

    // ========== POINT OUT INVERSION SELECTOR ==========
    createInfoStep(
        'Look for the Inversion buttons in the Chord Lab.',
        {
            spotlight: '#fs-inversion-buttons',
            targetElement: '#fs-inversion-buttons',
            callout: 'The buttons are: "Root" (root position), "1st" (first inversion), "2nd" (second inversion). These control which note is on the bottom.'
        }
    ),

    // ========== SELECT 1ST INVERSION ==========
    {
        instruction: 'Click "1st" to switch to First Inversion.',
        spotlight: '#fs-inversion-buttons',
        targetElement: '#fs-inversion-buttons',
        callout: 'First Inversion puts the 3rd (E) in the bass. The notes are now E-G-C.',
        validation: { type: 'inversion_selected', value: 1 },
        successMessage: 'First inversion selected!'
    },

    // ========== PLAY 1ST INVERSION ==========
    createPlayChordStep({
        instruction: 'Play first inversion. Notice how it sounds lighter and more "floating".',
        callout: 'The E in the bass creates a lighter feel. Great for passing between chords smoothly!',
        successMessage: 'Lighter and more flowing - that\'s first inversion!'
    }),

    // ========== SELECT 2ND INVERSION ==========
    {
        instruction: 'Now click "2nd" for Second Inversion.',
        spotlight: '#fs-inversion-buttons',
        targetElement: '#fs-inversion-buttons',
        callout: 'Second Inversion puts the 5th (G) in the bass. The notes are now G-C-E.',
        validation: { type: 'inversion_selected', value: 2 },
        successMessage: 'Second inversion selected!'
    },

    // ========== PLAY 2ND INVERSION ==========
    createPlayChordStep({
        instruction: 'Play second inversion. It has more tension than the others!',
        callout: 'The G in the bass creates an "unstable" quality. Classical music often uses this right before resolving home.',
        successMessage: 'More tense and expectant - that\'s second inversion!'
    }),

    // ========== COMPARE ALL THREE ==========
    {
        instruction: 'Now cycle through all three inversions: Root → 1st → 2nd → Root.',
        callout: 'Same notes (C-E-G), completely different feelings!\n• Root = stable (home)\n• 1st = floating (moving)\n• 2nd = tense (needs resolution)',
        validation: { type: 'chord_played' },
        successMessage: 'You hear the difference! Inversions are powerful tools for shaping the feel of your music.'
    },

    // ========== FINAL ==========
    createInfoStep(
        '🎉 You\'ve mastered chord inversions!',
        {
            callout: 'Inversions let you:\n• Create smooth voice leading between chords\n• Add variety without changing harmony\n• Control tension and stability\n\nTry inversions on other chords to hear how they transform!',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// WHY CHORDS MOVE - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Why Chords Move" lesson
 * Teaches tension/resolution through the leading tone and V-I cadence
 */
export const whyChordsMoveGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s discover why certain chords "want" to move to other chords!',
        {
            callout: 'Some notes create tension that wants to resolve. This is the foundation of all chord progressions - the pull from tension to release.'
        }
    ),

    // ========== BUILD G MAJOR ==========
    createRootSelectionStep('G', {
        instruction: 'Let\'s start with G Major - the V chord in the key of C. Click "G".',
        callout: 'G Major is called the "dominant" chord. It has a special note (B) that creates strong tension.',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major" to build G Major.',
        successMessage: 'G Major selected!'
    }),

    // ========== POINT OUT THE LEADING TONE ==========
    createKeyboardStep(
        'Look at the keyboard! Notice the B note - this is the "leading tone".',
        {
            callout: 'The B is only a half-step away from C. It has a strong pull toward C - your ear wants to hear it resolve!'
        }
    ),

    // ========== PLAY G MAJOR ==========
    createPlayChordStep({
        instruction: 'Play G Major. Feel the tension - it sounds "unfinished".',
        callout: 'That B note creates instability. Your ear is waiting for resolution!',
        successMessage: 'You can feel it wants to go somewhere!'
    }),

    // ========== BUILD C MAJOR ==========
    createRootSelectionStep('C', {
        instruction: 'Now let\'s resolve to C Major - the I chord. Click "C".',
        callout: 'C Major is the "home" chord - it will resolve the tension from G Major.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major" to build C Major.',
        successMessage: 'C Major selected!'
    }),

    // ========== PLAY C MAJOR - RESOLUTION ==========
    createPlayChordStep({
        instruction: 'Play C Major. Feel the resolution - that\'s the V-I cadence!',
        callout: 'Ahhh... the tension is released! The B resolved to C. This V-I movement is the most powerful cadence in music.',
        successMessage: 'That satisfying feeling is resolution!'
    }),

    // ========== ADD BOTH TO PROGRESSION ==========
    createInfoStep(
        'Let\'s hear them together. We\'ll add G then C to a progression.',
        {
            callout: 'The V-I cadence (G→C) is the "perfect cadence" - it creates the strongest sense of ending or arrival.'
        }
    ),

    createRootSelectionStep('G', {
        instruction: 'Select G again.',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select Major.',
        successMessage: 'G Major selected!'
    }),

    createAddChordStep('G', 'Major', {
        instruction: 'Add G Major to the progression.',
        successMessage: 'G Major added!'
    }),

    createRootSelectionStep('C', {
        instruction: 'Now select C.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select Major.',
        successMessage: 'C Major selected!'
    }),

    createAddChordStep('C', 'Major', {
        instruction: 'Add C Major to complete the V-I cadence.',
        successMessage: 'C Major added!'
    }),

    // ========== PLAY THE PROGRESSION ==========
    {
        instruction: 'Now play the progression to hear tension → resolution!',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'G (tension) → C (release). This is why nearly every song ends on the I chord!',
        validation: { type: 'chord_played' },
        successMessage: '🎉 You experienced the V-I cadence! This tension-resolution pattern drives all of harmony.'
    },

    // ========== FINAL ==========
    createInfoStep(
        'You\'ve discovered why chords move!',
        {
            callout: 'Key concepts:\n• The leading tone (7th scale degree) pulls toward the root\n• V chord (dominant) creates tension\n• I chord (tonic) provides resolution\n• V-I is the strongest cadence in music!',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// FIRST PROGRESSION - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Your First Progression" lesson
 * Builds the classic I-IV-V-I progression in C (C-F-G-C)
 */
export const firstProgressionGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s build your first chord progression - the famous I-IV-V-I!',
        {
            callout: 'This progression (I-IV-V-I) is the foundation of countless songs. In the key of C, that\'s C-F-G-C.'
        }
    ),

    // ========== BUILD C MAJOR (I) ==========
    createRootSelectionStep('C', {
        instruction: 'Start with C Major - the I chord (home base). Click "C".',
        callout: 'In the key of C, C Major is our "tonic" or I chord. It\'s where we start and where we\'ll end.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'C Major selected!'
    }),

    createPlayChordStep({
        instruction: 'Play C Major - this is home!',
        callout: 'C Major (I) is stable and grounded. This is where most songs in C begin.',
        successMessage: 'That\'s home base!'
    }),

    createAddChordStep('C', 'Major', {
        instruction: 'Add C Major to start your progression.',
        successMessage: 'C Major added - the I chord!'
    }),

    // ========== BUILD F MAJOR (IV) ==========
    createRootSelectionStep('F', {
        instruction: 'Now let\'s add F Major - the IV chord. Click "F".',
        callout: 'F Major is the "subdominant" (IV). It adds warmth and movement away from home.',
        successMessage: 'F selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'F Major selected!'
    }),

    createPlayChordStep({
        instruction: 'Play F Major. Notice how it lifts away from C.',
        callout: 'F Major (IV) creates a sense of departure - we\'re moving somewhere!',
        successMessage: 'That\'s the IV chord!'
    }),

    createAddChordStep('F', 'Major', {
        instruction: 'Add F Major to your progression.',
        successMessage: 'F Major added - the IV chord!'
    }),

    // ========== BUILD G MAJOR (V) ==========
    createRootSelectionStep('G', {
        instruction: 'Now add G Major - the V chord. Click "G".',
        callout: 'G Major is the "dominant" (V). It creates tension that wants to resolve back to C!',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'G Major selected!'
    }),

    createPlayChordStep({
        instruction: 'Play G Major. Feel the tension!',
        callout: 'G Major (V) creates strong tension. Your ear wants to hear it resolve!',
        successMessage: 'That\'s the dominant tension!'
    }),

    createAddChordStep('G', 'Major', {
        instruction: 'Add G Major to your progression.',
        successMessage: 'G Major added - the V chord!'
    }),

    // ========== RETURN TO C MAJOR (I) ==========
    createRootSelectionStep('C', {
        instruction: 'Finally, return to C Major to complete the cycle. Click "C".',
        callout: 'Coming back to C Major (I) after G Major (V) creates that satisfying resolution!',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'C Major selected!'
    }),

    createAddChordStep('C', 'Major', {
        instruction: 'Add C Major to complete your progression!',
        successMessage: 'C Major added - back home!'
    }),

    // ========== PLAY THE COMPLETE PROGRESSION ==========
    {
        instruction: 'Play your I-IV-V-I progression! C → F → G → C',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'This is the foundation of rock, pop, folk, country, and countless other genres!',
        validation: { type: 'chord_played' },
        successMessage: '🎉 You built the most important progression in music!'
    },

    // ========== FINAL ==========
    createInfoStep(
        'Congratulations! You\'ve built your first progression!',
        {
            callout: 'I-IV-V-I breakdown:\n• I (C) = Home, stability\n• IV (F) = Departure, warmth\n• V (G) = Tension, anticipation\n• I (C) = Resolution, return home\n\nThousands of songs use this exact pattern!',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// VOICE LEADING - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Voice Leading" lesson
 * Teaches smooth chord transitions using inversions
 */
export const voiceLeadingGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s learn voice leading - the art of smooth chord transitions!',
        {
            callout: 'Voice leading means moving each note to the nearest note in the next chord. This creates flowing, professional-sounding progressions.'
        }
    ),

    // ========== BUILD C MAJOR ROOT POSITION ==========
    createRootSelectionStep('C', {
        instruction: 'Start with C Major in root position. Click "C".',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'C Major selected!'
    }),

    createPlayChordStep({
        instruction: 'Play C Major in root position.',
        callout: 'C-E-G in root position. Notice where each note sits on the keyboard.',
        successMessage: 'That\'s C Major root position!'
    }),

    createAddChordStep('C', 'Major', {
        instruction: 'Add C Major to start.',
        successMessage: 'C Major added!'
    }),

    // ========== ADD G MAJOR ROOT POSITION (JUMPY) ==========
    createRootSelectionStep('G', {
        instruction: 'Now add G Major in root position.',
        callout: 'If we just use root position for everything, the notes jump around a lot.',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'G Major selected!'
    }),

    createAddChordStep('G', 'Major', {
        instruction: 'Add G Major in root position.',
        successMessage: 'G Major added!'
    }),

    // ========== HEAR THE JUMPY VERSION ==========
    {
        instruction: 'Play the progression. Notice how the notes jump around.',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'Root position C (C-E-G) to root position G (G-B-D) - the notes jump quite a bit!',
        validation: { type: 'chord_played' },
        successMessage: 'Hear the jumpiness? Let\'s fix that with inversions!'
    },

    // ========== CLEAR AND REBUILD WITH INVERSIONS ==========
    createInfoStep(
        'Now let\'s rebuild using inversions for smoother voice leading.',
        {
            callout: 'We\'ll keep the same chords but use inversions so each note moves the shortest distance to the next.'
        }
    ),

    // Build C Major root position
    createRootSelectionStep('C', {
        instruction: 'Start fresh - select C.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'C Major selected!'
    }),

    // Point out inversion selector
    createInfoStep(
        'Now let\'s use inversions. The Inversion buttons control which note is in the bass.',
        {
            spotlight: '#fs-inversion-buttons',
            targetElement: '#fs-inversion-buttons',
            callout: 'Inversions rearrange the same notes to create different bass notes and smoother voice leading.'
        }
    ),

    // Select 2nd inversion for C
    {
        instruction: 'Click "2nd" for second inversion (G in the bass).',
        spotlight: '#fs-inversion-buttons',
        targetElement: '#fs-inversion-buttons',
        callout: 'C Major 2nd inversion = G-C-E. The G in the bass will be close to the next chord!',
        validation: { type: 'inversion_selected', value: 2 },
        successMessage: 'Second inversion selected!'
    },

    createAddChordStep('C', 'Major', {
        instruction: 'Add C Major in 2nd inversion.',
        successMessage: 'C Major (2nd inv) added!'
    }),

    // Build G Major and add
    createRootSelectionStep('G', {
        instruction: 'Now select G.',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'G Major selected!'
    }),

    // Keep root position for G (its G will be close to the C's G)
    createAddChordStep('G', 'Major', {
        instruction: 'Add G Major (root position is fine here).',
        callout: 'G-B-D root position - the G connects smoothly from C\'s 2nd inversion!',
        successMessage: 'G Major added!'
    }),

    // ========== HEAR THE SMOOTH VERSION ==========
    {
        instruction: 'Now play the progression. Notice how much smoother it sounds!',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'The notes glide from one chord to the next instead of jumping. That\'s voice leading!',
        validation: { type: 'chord_played' },
        successMessage: '🎉 Much smoother! The notes flow naturally between chords.'
    },

    // ========== FINAL ==========
    createInfoStep(
        'You\'ve learned voice leading!',
        {
            callout: 'Voice leading principles:\n• Move each note the shortest distance\n• Use inversions to connect chords\n• Common tones (notes in both chords) should stay in place\n• This is how professional arrangers create smooth progressions!',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// POPULAR PROGRESSION - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Popular Progression" lesson
 * Builds the famous I-V-vi-IV (C-G-Am-F) progression
 */
export const popularProgressionGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s build the most popular progression in modern music: I-V-vi-IV!',
        {
            callout: 'This progression (C-G-Am-F in C major) is used in hundreds of hit songs. It\'s sometimes called the "four chord song" progression!'
        }
    ),

    // ========== BUILD C MAJOR (I) ==========
    createRootSelectionStep('C', {
        instruction: 'Start with C Major - the I chord.',
        callout: 'C Major is our home base in the key of C.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'C Major selected!'
    }),

    createAddChordStep('C', 'Major', {
        instruction: 'Add C Major.',
        successMessage: 'C Major added - I chord!'
    }),

    // ========== BUILD G MAJOR (V) ==========
    createRootSelectionStep('G', {
        instruction: 'Add G Major - the V chord.',
        callout: 'G Major creates forward momentum in the progression.',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'G Major selected!'
    }),

    createAddChordStep('G', 'Major', {
        instruction: 'Add G Major.',
        successMessage: 'G Major added - V chord!'
    }),

    // ========== BUILD A MINOR (vi) ==========
    createRootSelectionStep('A', {
        instruction: 'Now add A Minor - the vi chord. Click "A".',
        callout: 'A Minor is the "relative minor" of C Major. It adds emotional depth!',
        successMessage: 'A selected!'
    }),

    createChordTypeSelectionStep('Minor', {
        instruction: 'Select "Minor" - this is our first minor chord!',
        callout: 'The vi chord is always minor in a major key. It adds that emotional, bittersweet quality.',
        successMessage: 'A Minor selected!'
    }),

    createAddChordStep('A', 'Minor', {
        instruction: 'Add A Minor.',
        successMessage: 'A Minor added - vi chord!'
    }),

    // ========== BUILD F MAJOR (IV) ==========
    createRootSelectionStep('F', {
        instruction: 'Finally, add F Major - the IV chord.',
        callout: 'F Major completes the cycle with a warm, uplifting feel.',
        successMessage: 'F selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'F Major selected!'
    }),

    createAddChordStep('F', 'Major', {
        instruction: 'Add F Major to complete the progression!',
        successMessage: 'F Major added - IV chord!'
    }),

    // ========== PLAY THE PROGRESSION ==========
    {
        instruction: 'Play your I-V-vi-IV progression! C → G → Am → F',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'Songs using this: "Let It Be", "No Woman No Cry", "With or Without You", "Someone Like You", and hundreds more!',
        validation: { type: 'chord_played' },
        successMessage: '🎉 You built the most popular progression in modern music!'
    },

    // ========== FINAL ==========
    createInfoStep(
        'You\'ve mastered the popular progression!',
        {
            callout: 'I-V-vi-IV works because:\n• I (C) = Stable home\n• V (G) = Energy and lift\n• vi (Am) = Emotional depth (minor!)\n• IV (F) = Warm resolution back toward I\n\nTry it in other keys!',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// ADDING EMOTION - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Adding Emotion with Minor Chords" lesson
 * Teaches using ii, iii, and vi to add emotional depth
 */
export const addingEmotionGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s explore how minor chords add emotional depth to progressions!',
        {
            callout: 'Major keys have three naturally occurring minor chords: ii, iii, and vi. Each adds a different emotional color.'
        }
    ),

    // ========== INTRODUCE THE MINOR CHORDS IN C ==========
    createInfoStep(
        'In the key of C Major, the minor chords are: Dm (ii), Em (iii), and Am (vi).',
        {
            callout: 'ii = melancholy/longing\niii = mysterious/floating\nvi = bittersweet/emotional\n\nLet\'s feel each one!'
        }
    ),

    // ========== BUILD AND HEAR Dm (ii) ==========
    createRootSelectionStep('D', {
        instruction: 'Let\'s start with D Minor - the ii chord. Click "D".',
        callout: 'D Minor (ii) has a longing, melancholic quality. It\'s often used before V.',
        successMessage: 'D selected!'
    }),

    createChordTypeSelectionStep('Minor', {
        instruction: 'Select "Minor".',
        successMessage: 'D Minor selected!'
    }),

    createPlayChordStep({
        instruction: 'Play D Minor. Feel its yearning quality.',
        callout: 'The ii chord has a sense of longing - it wants to move forward.',
        successMessage: 'That\'s the ii chord - longing and melancholic!'
    }),

    // ========== BUILD AND HEAR Em (iii) ==========
    createRootSelectionStep('E', {
        instruction: 'Now try E Minor - the iii chord. Click "E".',
        callout: 'E Minor (iii) is the least used but most mysterious. It creates a floating, uncertain feeling.',
        successMessage: 'E selected!'
    }),

    createChordTypeSelectionStep('Minor', {
        instruction: 'Select "Minor".',
        successMessage: 'E Minor selected!'
    }),

    createPlayChordStep({
        instruction: 'Play E Minor. Notice its mysterious quality.',
        callout: 'The iii chord is rare but powerful - it creates ambiguity and mystery.',
        successMessage: 'That\'s the iii chord - mysterious and floating!'
    }),

    // ========== BUILD AND HEAR Am (vi) ==========
    createRootSelectionStep('A', {
        instruction: 'Finally, try A Minor - the vi chord. Click "A".',
        callout: 'A Minor (vi) is the most popular minor chord. It\'s the "relative minor" and adds instant emotion.',
        successMessage: 'A selected!'
    }),

    createChordTypeSelectionStep('Minor', {
        instruction: 'Select "Minor".',
        successMessage: 'A Minor selected!'
    }),

    createPlayChordStep({
        instruction: 'Play A Minor. This is the most emotional minor chord.',
        callout: 'The vi chord creates that bittersweet, emotional quality we hear in so many songs.',
        successMessage: 'That\'s the vi chord - bittersweet and emotional!'
    }),

    // ========== BUILD AN EMOTIONAL PROGRESSION ==========
    createInfoStep(
        'Now let\'s build a progression that uses minor chords for emotional impact.',
        {
            callout: 'We\'ll build I - vi - IV - V (C - Am - F - G), a classic emotional progression.'
        }
    ),

    createRootSelectionStep('C', {
        instruction: 'Start with C Major.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'C Major selected!'
    }),

    createAddChordStep('C', 'Major', {
        instruction: 'Add C Major.',
        successMessage: 'C Major added!'
    }),

    createRootSelectionStep('A', {
        instruction: 'Add A Minor for emotional depth.',
        successMessage: 'A selected!'
    }),

    createChordTypeSelectionStep('Minor', {
        instruction: 'Select "Minor".',
        successMessage: 'A Minor selected!'
    }),

    createAddChordStep('A', 'Minor', {
        instruction: 'Add A Minor.',
        successMessage: 'A Minor added - the emotional vi!'
    }),

    createRootSelectionStep('F', {
        instruction: 'Add F Major.',
        successMessage: 'F selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'F Major selected!'
    }),

    createAddChordStep('F', 'Major', {
        instruction: 'Add F Major.',
        successMessage: 'F Major added!'
    }),

    createRootSelectionStep('G', {
        instruction: 'Finish with G Major.',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'G Major selected!'
    }),

    createAddChordStep('G', 'Major', {
        instruction: 'Add G Major.',
        successMessage: 'G Major added!'
    }),

    // ========== PLAY THE EMOTIONAL PROGRESSION ==========
    {
        instruction: 'Play your emotional progression! C → Am → F → G',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'The Am (vi) chord after C creates that instant emotional shift. This is a classic "emotional ballad" progression!',
        validation: { type: 'chord_played' },
        successMessage: '🎉 Beautiful! The minor chord adds so much emotional depth!'
    },

    // ========== FINAL ==========
    createInfoStep(
        'You\'ve learned to add emotion with minor chords!',
        {
            callout: 'Minor chords in major keys:\n• ii (Dm) = Longing, leads to V\n• iii (Em) = Mystery, rarely used\n• vi (Am) = Emotion, most popular\n\nExperiment with placing them in different positions!',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// SEVENTH CHORDS - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Seventh Chords" lesson
 * Introduces Major 7th, Dominant 7th, and Minor 7th chords
 */
export const seventhChordsGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s explore seventh chords - triads with an extra note!',
        {
            callout: 'Seventh chords add a 4th note (the 7th) to a triad. This creates richer, more colorful harmonies used in jazz, R&B, and sophisticated pop.'
        }
    ),

    // ========== MAJOR 7TH ==========
    createRootSelectionStep('C', {
        instruction: 'Let\'s start with C Major 7th. Click "C".',
        callout: 'Major 7th chords have a dreamy, sophisticated sound. They\'re used in jazz and neo-soul.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major 7th', {
        instruction: 'Select "Major 7th" from the chord library.',
        callout: 'Major 7th = Major triad + Major 7th interval (C-E-G-B)',
        successMessage: 'C Major 7th selected!'
    }),

    createKeyboardStep(
        'Look at the keyboard! C-E-G-B - four notes now!',
        {
            callout: 'The B (7th) adds that lush, dreamy quality. Major 7ths sound relaxed and sophisticated.'
        }
    ),

    createPlayChordStep({
        instruction: 'Play C Major 7th. Notice the dreamy, jazzy sound!',
        callout: 'Major 7ths are used in bossa nova, smooth jazz, and neo-soul. Think "relaxed sophistication".',
        successMessage: 'Beautiful! That\'s the lush Major 7th sound!'
    }),

    // ========== DOMINANT 7TH ==========
    createRootSelectionStep('G', {
        instruction: 'Now let\'s try G Dominant 7th - the classic "blues" 7th. Click "G".',
        callout: 'Dominant 7th chords create tension. They\'re THE sound of blues, rock, and jazz.',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Dominant 7th', {
        instruction: 'Select "Dominant 7th" (also just called "7th").',
        callout: 'Dominant 7th = Major triad + Minor 7th interval (G-B-D-F)',
        successMessage: 'G Dominant 7th selected!'
    }),

    createKeyboardStep(
        'Look at the keyboard! G-B-D-F - the F creates tension!',
        {
            callout: 'The flat 7th (F instead of F#) creates tension that wants to resolve. This is the "blues" sound!'
        }
    ),

    createPlayChordStep({
        instruction: 'Play G7. Feel the tension - it wants to resolve to C!',
        callout: 'G7 is the V7 chord in C major. It has even MORE tension than plain G Major!',
        successMessage: 'That\'s the dominant 7th - full of tension!'
    }),

    // ========== MINOR 7TH ==========
    createRootSelectionStep('A', {
        instruction: 'Finally, let\'s try A Minor 7th. Click "A".',
        callout: 'Minor 7th chords are smooth and soulful. They\'re everywhere in R&B and jazz.',
        successMessage: 'A selected!'
    }),

    createChordTypeSelectionStep('Minor 7th', {
        instruction: 'Select "Minor 7th".',
        callout: 'Minor 7th = Minor triad + Minor 7th interval (A-C-E-G)',
        successMessage: 'A Minor 7th selected!'
    }),

    createKeyboardStep(
        'Look at the keyboard! A-C-E-G - smooth and soulful!',
        {
            callout: 'Minor 7ths have a mellow, sophisticated quality. They\'re essential for R&B and jazz.'
        }
    ),

    createPlayChordStep({
        instruction: 'Play Am7. Notice the smooth, mellow quality!',
        callout: 'Minor 7ths are used in funk, R&B, and jazz. They\'re less "sad" than plain minor triads.',
        successMessage: 'Smooth! That\'s the Minor 7th sound!'
    }),

    // ========== BUILD A JAZZY PROGRESSION ==========
    createInfoStep(
        'Let\'s build a progression using all three 7th types!',
        {
            callout: 'We\'ll build a classic jazz progression: Cmaj7 → Am7 → Dm7 → G7'
        }
    ),

    createRootSelectionStep('C', {
        instruction: 'Start with C.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major 7th', {
        instruction: 'Select "Major 7th".',
        successMessage: 'C Major 7th selected!'
    }),

    createAddChordStep('C', 'Major 7th', {
        instruction: 'Add C Major 7th.',
        successMessage: 'Cmaj7 added!'
    }),

    createRootSelectionStep('A', {
        instruction: 'Add Am7.',
        successMessage: 'A selected!'
    }),

    createChordTypeSelectionStep('Minor 7th', {
        instruction: 'Select "Minor 7th".',
        successMessage: 'A Minor 7th selected!'
    }),

    createAddChordStep('A', 'Minor 7th', {
        instruction: 'Add A Minor 7th.',
        successMessage: 'Am7 added!'
    }),

    createRootSelectionStep('D', {
        instruction: 'Add Dm7.',
        successMessage: 'D selected!'
    }),

    createChordTypeSelectionStep('Minor 7th', {
        instruction: 'Select "Minor 7th".',
        successMessage: 'D Minor 7th selected!'
    }),

    createAddChordStep('D', 'Minor 7th', {
        instruction: 'Add D Minor 7th.',
        successMessage: 'Dm7 added!'
    }),

    createRootSelectionStep('G', {
        instruction: 'Finish with G7.',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Dominant 7th', {
        instruction: 'Select "Dominant 7th".',
        successMessage: 'G Dominant 7th selected!'
    }),

    createAddChordStep('G', 'Dominant 7th', {
        instruction: 'Add G Dominant 7th.',
        successMessage: 'G7 added!'
    }),

    // ========== PLAY THE JAZZY PROGRESSION ==========
    {
        instruction: 'Play your jazzy progression! Cmaj7 → Am7 → Dm7 → G7',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'This is a II-V-I with an added vi chord - a classic jazz pattern!',
        validation: { type: 'chord_played' },
        successMessage: '🎉 Smooth! You just played a jazz standard progression!'
    },

    // ========== FINAL ==========
    createInfoStep(
        'You\'ve learned seventh chords!',
        {
            callout: '7th chord types:\n• Major 7th = Dreamy, sophisticated\n• Dominant 7th = Tension, blues/rock\n• Minor 7th = Smooth, soulful\n\nTry adding 7ths to your existing progressions!',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// SECONDARY DOMINANTS - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Secondary Dominants" lesson
 * Teaches V/V, V/vi, and other secondary dominants
 */
export const secondaryDominantsGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s discover secondary dominants - creating tension before ANY chord!',
        {
            callout: 'You know V7 creates tension that resolves to I. But what if you could create that same powerful tension before ANY chord? That\'s secondary dominants!'
        }
    ),

    // ========== EXPLAIN V/V ==========
    createInfoStep(
        'The most common secondary dominant is V/V ("five of five").',
        {
            callout: 'In C major, V is G. The V of G is D7. So D7 → G creates the same tension-resolution as G7 → C, but for the V chord!'
        }
    ),

    // ========== BUILD D7 (V/V) ==========
    createRootSelectionStep('D', {
        instruction: 'Let\'s build D7, the V/V in C major. Click "D".',
        callout: 'D7 is not in the key of C major (it has F#), but it creates powerful tension toward G.',
        successMessage: 'D selected!'
    }),

    createChordTypeSelectionStep('Dominant 7th', {
        instruction: 'Select "Dominant 7th" to make D7.',
        callout: 'D7 contains the tritone F#-C, which resolves to G-B in G major.',
        successMessage: 'D Dominant 7th selected!'
    }),

    createPlayChordStep({
        instruction: 'Play D7. Feel how it wants to resolve to G!',
        callout: 'That F# is "borrowed" from G major. It creates strong pull toward G.',
        successMessage: 'Hear the tension!'
    }),

    createAddChordStep('D', 'Dominant 7th', {
        instruction: 'Add D7 to start your progression.',
        successMessage: 'D7 added!'
    }),

    // ========== BUILD G (target of V/V) ==========
    createRootSelectionStep('G', {
        instruction: 'Now add G Major - the chord D7 resolves to.',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'G Major selected!'
    }),

    createAddChordStep('G', 'Major', {
        instruction: 'Add G Major.',
        successMessage: 'G Major added - resolution!'
    }),

    // ========== HEAR D7 → G ==========
    {
        instruction: 'Play D7 → G. Hear the secondary dominant resolution!',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'D7 → G is V/V → V. The same tension-resolution pattern, but for the V chord!',
        validation: { type: 'chord_played' },
        successMessage: 'That\'s V/V in action!'
    },

    // ========== NOW TRY V/vi ==========
    createInfoStep(
        'Let\'s try another secondary dominant: V/vi (E7 before Am).',
        {
            callout: 'E7 is the V of Am. It intensifies the move to the emotional vi chord.'
        }
    ),

    createRootSelectionStep('C', {
        instruction: 'Start fresh with C Major.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'C Major selected!'
    }),

    createAddChordStep('C', 'Major', {
        instruction: 'Add C Major.',
        successMessage: 'C Major added!'
    }),

    createRootSelectionStep('E', {
        instruction: 'Now add E7 - the V/vi.',
        callout: 'E7 has G# which isn\'t in C major. This "borrowed" note pulls strongly to Am.',
        successMessage: 'E selected!'
    }),

    createChordTypeSelectionStep('Dominant 7th', {
        instruction: 'Select "Dominant 7th".',
        successMessage: 'E Dominant 7th selected!'
    }),

    createAddChordStep('E', 'Dominant 7th', {
        instruction: 'Add E7.',
        successMessage: 'E7 added!'
    }),

    createRootSelectionStep('A', {
        instruction: 'Add A Minor - E7\'s target.',
        successMessage: 'A selected!'
    }),

    createChordTypeSelectionStep('Minor', {
        instruction: 'Select "Minor".',
        successMessage: 'A Minor selected!'
    }),

    createAddChordStep('A', 'Minor', {
        instruction: 'Add A Minor.',
        successMessage: 'A Minor added!'
    }),

    createRootSelectionStep('G', {
        instruction: 'Finish with G Major.',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'G Major selected!'
    }),

    createAddChordStep('G', 'Major', {
        instruction: 'Add G Major.',
        successMessage: 'G Major added!'
    }),

    // ========== PLAY THE PROGRESSION ==========
    {
        instruction: 'Play C → E7 → Am → G. Hear how E7 intensifies the move to Am!',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'The E7 adds drama before Am. Compare to plain C → Em → Am → G - the secondary dominant is much more powerful!',
        validation: { type: 'chord_played' },
        successMessage: '🎉 You\'ve learned secondary dominants!'
    },

    // ========== FINAL ==========
    createInfoStep(
        'You\'ve mastered secondary dominants!',
        {
            callout: 'Key secondary dominants in C:\n• V/V = D7 → G\n• V/vi = E7 → Am\n• V/ii = A7 → Dm\n• V/IV = C7 → F\n\nAny major or minor chord can have a secondary dominant!',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// BORROWED CHORDS - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Borrowed Chords" lesson
 * Teaches ♭VII, iv, ♭VI from parallel minor
 */
export const borrowedChordsGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s explore borrowed chords - stealing colors from the parallel minor!',
        {
            callout: 'When you\'re in C major, you can "borrow" chords from C minor. These chords add emotional depth without changing the key.'
        }
    ),

    // ========== THE ♭VII CHORD ==========
    createInfoStep(
        'The most popular borrowed chord is ♭VII - B♭ in C major.',
        {
            callout: 'B♭ major comes from C minor. It creates an epic, rock sound without the strong pull of the V chord.'
        }
    ),

    createRootSelectionStep('C', {
        instruction: 'Start with C Major.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'C Major selected!'
    }),

    createAddChordStep('C', 'Major', {
        instruction: 'Add C Major.',
        successMessage: 'C Major added!'
    }),

    // Build B♭ - the ♭VII
    createRootSelectionStep('Bb', {
        instruction: 'Now add B♭ Major - the ♭VII borrowed from C minor.',
        callout: 'B♭ has the ♭7 (B♭) from C minor. It sounds powerful and rock-like!',
        successMessage: 'B♭ selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'B♭ Major selected!'
    }),

    createPlayChordStep({
        instruction: 'Play B♭ Major. Hear the borrowed color!',
        callout: 'That B♭ note isn\'t in C major - it\'s borrowed from C minor. Creates instant drama!',
        successMessage: 'That\'s the ♭VII sound!'
    }),

    createAddChordStep('Bb', 'Major', {
        instruction: 'Add B♭ Major.',
        successMessage: 'B♭ Major added!'
    }),

    createRootSelectionStep('F', {
        instruction: 'Add F Major.',
        successMessage: 'F selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'F Major selected!'
    }),

    createAddChordStep('F', 'Major', {
        instruction: 'Add F Major.',
        successMessage: 'F Major added!'
    }),

    createRootSelectionStep('C', {
        instruction: 'Return to C Major.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'C Major selected!'
    }),

    createAddChordStep('C', 'Major', {
        instruction: 'Add C Major.',
        successMessage: 'C Major added!'
    }),

    // ========== HEAR THE ROCK PROGRESSION ==========
    {
        instruction: 'Play C → B♭ → F → C. Classic rock with ♭VII!',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'This is the sound of rock anthems! The B♭ adds power without resolving like a V chord.',
        validation: { type: 'chord_played' },
        successMessage: 'That\'s the epic ♭VII sound!'
    },

    // ========== THE iv CHORD ==========
    createInfoStep(
        'Now let\'s try iv - the most emotional borrowed chord.',
        {
            callout: 'The minor iv (Fm in C) replaces the normal major IV (F). It\'s devastating emotionally - used in countless ballads.'
        }
    ),

    createRootSelectionStep('C', {
        instruction: 'Start with C Major.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'C Major selected!'
    }),

    createAddChordStep('C', 'Major', {
        instruction: 'Add C Major.',
        successMessage: 'C Major added!'
    }),

    createRootSelectionStep('F', {
        instruction: 'Now add F Minor - the borrowed iv.',
        callout: 'F Minor has A♭, the ♭6 from C minor. This note is incredibly expressive!',
        successMessage: 'F selected!'
    }),

    createChordTypeSelectionStep('Minor', {
        instruction: 'Select "Minor" for the borrowed iv chord.',
        successMessage: 'F Minor selected!'
    }),

    createPlayChordStep({
        instruction: 'Play F Minor. Feel the emotional weight!',
        callout: 'That A♭ (the ♭6) is what makes iv so powerful. It\'s used in "Creep," "My Heart Will Go On," and many ballads.',
        successMessage: 'So emotional!'
    }),

    createAddChordStep('F', 'Minor', {
        instruction: 'Add F Minor.',
        successMessage: 'F Minor added - the borrowed iv!'
    }),

    createRootSelectionStep('G', {
        instruction: 'Add G Major.',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'G Major selected!'
    }),

    createAddChordStep('G', 'Major', {
        instruction: 'Add G Major.',
        successMessage: 'G Major added!'
    }),

    // ========== HEAR THE EMOTIONAL PROGRESSION ==========
    {
        instruction: 'Play C → Fm → G. The iv chord creates instant emotion!',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'Compare F Major to F Minor in this spot. The minor iv is much more poignant!',
        validation: { type: 'chord_played' },
        successMessage: '🎉 You\'ve learned borrowed chords!'
    },

    // ========== FINAL ==========
    createInfoStep(
        'You\'ve mastered borrowed chords!',
        {
            callout: 'Popular borrowed chords in major keys:\n• ♭VII (B♭) = Epic, rock power\n• iv (Fm) = Deep emotion, ballads\n• ♭VI (A♭) = Wonder, surprise\n• ♭III (E♭) = Bright but unexpected\n\nBorrow colors to add emotional depth!',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// TENSION AND RELEASE - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Creating Tension and Release" lesson
 * Teaches V7 resolution, deceptive cadences, and suspensions
 */
export const tensionReleaseGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s master tension and release - the heartbeat of all music!',
        {
            callout: 'Music is a journey of tension and resolution. Learning to control this push and pull is the key to emotional songwriting.'
        }
    ),

    // ========== BASIC V7-I RESOLUTION ==========
    createInfoStep(
        'The strongest tension-resolution is V7 → I.',
        {
            callout: 'The dominant 7th (G7 in C) contains a tritone that desperately wants to resolve to the tonic.'
        }
    ),

    createRootSelectionStep('G', {
        instruction: 'Build G7 - maximum tension.',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Dominant 7th', {
        instruction: 'Select "Dominant 7th".',
        successMessage: 'G Dominant 7th selected!'
    }),

    createPlayChordStep({
        instruction: 'Play G7. Feel the tension - it wants to resolve!',
        callout: 'The tritone (B-F) is the most unstable interval. B wants to go to C, F wants to go to E.',
        successMessage: 'That\'s tension!'
    }),

    createAddChordStep('G', 'Dominant 7th', {
        instruction: 'Add G7.',
        successMessage: 'G7 added!'
    }),

    createRootSelectionStep('C', {
        instruction: 'Now resolve to C Major.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'C Major selected!'
    }),

    createAddChordStep('C', 'Major', {
        instruction: 'Add C Major for resolution.',
        successMessage: 'C Major added - resolution!'
    }),

    {
        instruction: 'Play G7 → C. Feel the satisfying resolution!',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'Ahhh... the tension releases! This V7-I is the most powerful cadence in music.',
        validation: { type: 'chord_played' },
        successMessage: 'Maximum satisfaction!'
    },

    // ========== DECEPTIVE CADENCE ==========
    createInfoStep(
        'Now let\'s try a "plot twist" - the deceptive cadence.',
        {
            callout: 'Instead of V7 → I, we go V7 → vi. The ear expects resolution to C but gets Am instead!'
        }
    ),

    createRootSelectionStep('G', {
        instruction: 'Build G7 again.',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Dominant 7th', {
        instruction: 'Select "Dominant 7th".',
        successMessage: 'G Dominant 7th selected!'
    }),

    createAddChordStep('G', 'Dominant 7th', {
        instruction: 'Add G7.',
        successMessage: 'G7 added!'
    }),

    createRootSelectionStep('A', {
        instruction: 'Instead of C, resolve to A Minor (vi)!',
        callout: 'This is the deceptive cadence - V goes to vi instead of I.',
        successMessage: 'A selected!'
    }),

    createChordTypeSelectionStep('Minor', {
        instruction: 'Select "Minor".',
        successMessage: 'A Minor selected!'
    }),

    createAddChordStep('A', 'Minor', {
        instruction: 'Add A Minor for the "plot twist."',
        successMessage: 'A Minor added - surprise!'
    }),

    {
        instruction: 'Play G7 → Am. The deceptive cadence!',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'You expected C but got Am! This extends the phrase and adds emotional depth.',
        validation: { type: 'chord_played' },
        successMessage: 'Surprise resolution!'
    },

    // ========== SUSPENDED CHORD ==========
    createInfoStep(
        'Suspensions create micro-tension that resolves within a chord.',
        {
            callout: 'A sus4 chord replaces the 3rd with the 4th. The 4th "wants" to resolve back to the 3rd.'
        }
    ),

    createRootSelectionStep('C', {
        instruction: 'Build Csus4.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Sus4', {
        instruction: 'Select "Sus4".',
        callout: 'Csus4 = C-F-G. The F (4th) suspends, waiting to resolve to E (3rd).',
        successMessage: 'C Sus4 selected!'
    }),

    createPlayChordStep({
        instruction: 'Play Csus4. Hear how it "hangs"?',
        callout: 'The suspended 4th creates mild tension. It wants to fall to the 3rd.',
        successMessage: 'Suspended tension!'
    }),

    createAddChordStep('C', 'Sus4', {
        instruction: 'Add Csus4.',
        successMessage: 'Csus4 added!'
    }),

    createRootSelectionStep('C', {
        instruction: 'Now resolve to C Major.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major" for resolution.',
        successMessage: 'C Major selected!'
    }),

    createAddChordStep('C', 'Major', {
        instruction: 'Add C Major.',
        successMessage: 'C Major added - suspension resolved!'
    }),

    {
        instruction: 'Play Csus4 → C. A small but satisfying resolution!',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'The F falls to E. This micro-resolution is used everywhere - even within a single chord!',
        validation: { type: 'chord_played' },
        successMessage: '🎉 You\'ve mastered tension and release!'
    },

    // ========== FINAL ==========
    createInfoStep(
        'You understand tension and release!',
        {
            callout: 'Key concepts:\n• V7 → I = Maximum resolution\n• V7 → vi = Deceptive cadence (surprise)\n• sus4 → major = Micro-resolution\n• Delay resolution for emotional impact\n\nGreat music balances tension and release!',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// MELODY-CHORD RELATIONSHIP - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "The Melody-Chord Relationship" lesson
 * Teaches chord tones, passing tones, and melody-harmony interaction
 */
export const melodyChordGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s explore how melodies and chords work together!',
        {
            callout: 'Every melody note has a relationship to the chord underneath. Understanding this is key to writing melodies that "fit."'
        }
    ),

    // ========== CHORD TONES ==========
    createInfoStep(
        'Chord tones are notes that are IN the current chord.',
        {
            callout: 'For C Major (C-E-G), the chord tones are C, E, and G. When your melody lands on these, it sounds stable and "correct."'
        }
    ),

    createRootSelectionStep('C', {
        instruction: 'Build C Major to see its chord tones.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'C Major selected!'
    }),

    createKeyboardStep(
        'Look at the keyboard! C, E, and G are the chord tones.',
        {
            callout: 'C (root), E (3rd), G (5th) - these notes will sound stable when sung or played over C Major.'
        }
    ),

    createPlayChordStep({
        instruction: 'Play C Major. These notes are your "safe" melody notes.',
        callout: 'When in doubt, land on a chord tone! Root (C) is most stable, followed by 5th (G), then 3rd (E).',
        successMessage: 'Those are your chord tones!'
    }),

    createAddChordStep('C', 'Major', {
        instruction: 'Add C Major.',
        successMessage: 'C Major added!'
    }),

    // ========== SHOW 7TH CHORD TONES ==========
    createInfoStep(
        '7th chords add a 4th chord tone - the 7th!',
        {
            callout: 'Cmaj7 = C-E-G-B. Now you have FOUR safe melody notes over this chord.'
        }
    ),

    createRootSelectionStep('A', {
        instruction: 'Build Am7 to see its chord tones.',
        successMessage: 'A selected!'
    }),

    createChordTypeSelectionStep('Minor 7th', {
        instruction: 'Select "Minor 7th".',
        successMessage: 'A Minor 7th selected!'
    }),

    createKeyboardStep(
        'Am7 chord tones: A, C, E, G. Four notes to use in melody!',
        {
            callout: 'With 7th chords, you have more "safe" notes. This is why jazz uses 7ths everywhere!'
        }
    ),

    createAddChordStep('A', 'Minor 7th', {
        instruction: 'Add Am7.',
        successMessage: 'Am7 added!'
    }),

    // ========== BUILD A CHORD-TONE FRIENDLY PROGRESSION ==========
    createInfoStep(
        'Let\'s build a progression and identify chord tones for melody.',
        {
            callout: 'For each chord, the 1-3-5 (and 7 if present) are your "safe" notes. Non-chord tones add movement but should resolve!'
        }
    ),

    createRootSelectionStep('D', {
        instruction: 'Add Dm7 - chord tones D, F, A, C.',
        successMessage: 'D selected!'
    }),

    createChordTypeSelectionStep('Minor 7th', {
        instruction: 'Select "Minor 7th".',
        successMessage: 'D Minor 7th selected!'
    }),

    createAddChordStep('D', 'Minor 7th', {
        instruction: 'Add Dm7.',
        successMessage: 'Dm7 added!'
    }),

    createRootSelectionStep('G', {
        instruction: 'Add G7 - chord tones G, B, D, F.',
        callout: 'Notice: D is a chord tone in BOTH Dm7 and G7. This is a "common tone" - great for smooth melody!',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Dominant 7th', {
        instruction: 'Select "Dominant 7th".',
        successMessage: 'G Dominant 7th selected!'
    }),

    createAddChordStep('G', 'Dominant 7th', {
        instruction: 'Add G7.',
        successMessage: 'G7 added!'
    }),

    createRootSelectionStep('C', {
        instruction: 'Finish with Cmaj7 - chord tones C, E, G, B.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major 7th', {
        instruction: 'Select "Major 7th".',
        successMessage: 'C Major 7th selected!'
    }),

    createAddChordStep('C', 'Major 7th', {
        instruction: 'Add Cmaj7.',
        successMessage: 'Cmaj7 added!'
    }),

    // ========== PLAY THE PROGRESSION ==========
    {
        instruction: 'Play the ii-V-I: Dm7 → G7 → Cmaj7. Think about melody!',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'Melody idea: D (chord tone of Dm7) → D (common tone in G7) → C (chord tone of Cmaj7). The D stays, then steps down to C!',
        validation: { type: 'chord_played' },
        successMessage: '🎉 You understand melody-chord relationships!'
    },

    // ========== FINAL ==========
    createInfoStep(
        'You\'ve learned the melody-chord relationship!',
        {
            callout: 'Key concepts:\n• Chord tones (1-3-5-7) = Stable melody notes\n• Common tones = Notes in multiple chords\n• Non-chord tones = Passing tones, suspensions (add movement)\n• Land on chord tones on strong beats!\n\nGreat melodies balance stability and movement.',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// MODES INTRODUCTION - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Introduction to Modes" lesson
 * Teaches the seven modes and their characteristic sounds
 */
export const modesIntroGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Welcome to the world of modes! Let\'s discover the seven colors of the major scale.',
        {
            callout: 'Modes are scales that use the same notes as a major scale but start on different degrees. Each has its own unique character and emotional quality.'
        }
    ),

    // ========== DORIAN MODE - THE JAZZ MINOR ==========
    createInfoStep(
        'Let\'s start with DORIAN - the jazzy minor mode.',
        {
            callout: 'Dorian is minor with a raised 6th. It sounds sophisticated and hopeful - the sound of "So What" by Miles Davis!'
        }
    ),

    createRootSelectionStep('D', {
        instruction: 'Select D - we\'ll build D Dorian using C major\'s notes.',
        callout: 'D Dorian uses the notes D-E-F-G-A-B-C-D. Same as C major, but D is "home"!',
        successMessage: 'D selected!'
    }),

    createChordTypeSelectionStep('Minor 7th', {
        instruction: 'Select "Minor 7th" - the characteristic Dorian chord.',
        callout: 'Dm7 is the tonic chord in D Dorian. The 7th adds that jazz flavor!',
        successMessage: 'D Minor 7th selected!'
    }),

    createPlayChordStep({
        instruction: 'Play Dm7 - this is your Dorian home chord.',
        callout: 'This smooth minor 7th sound is the heart of modal jazz.',
        successMessage: 'That\'s the Dorian sound!'
    }),

    createAddChordStep('D', 'Minor 7th', {
        instruction: 'Add Dm7 to start a Dorian vamp.',
        successMessage: 'Dm7 added!'
    }),

    // Add the characteristic IV chord (G)
    createRootSelectionStep('G', {
        instruction: 'Now add G - the characteristic chord of Dorian.',
        callout: 'The major IV chord (G) contains the raised 6th (B natural) that makes Dorian special!',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major" - the IV chord is MAJOR in Dorian!',
        callout: 'In natural minor, the iv chord is minor. The major IV is Dorian\'s signature!',
        successMessage: 'G Major selected!'
    }),

    createAddChordStep('G', 'Major', {
        instruction: 'Add G Major.',
        successMessage: 'G added! This is the classic Dorian i-IV vamp!'
    }),

    // ========== MIXOLYDIAN MODE - THE ROCK MODE ==========
    createInfoStep(
        'Now let\'s explore MIXOLYDIAN - the rock/blues mode!',
        {
            callout: 'Mixolydian is major with a lowered 7th. It\'s the sound of "Sweet Home Alabama" and countless rock songs!'
        }
    ),

    createRootSelectionStep('G', {
        instruction: 'Select G for G Mixolydian.',
        callout: 'G Mixolydian uses C major\'s notes starting on G: G-A-B-C-D-E-F-G. The F is the ♭7!',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major" - Mixolydian has a major tonic.',
        successMessage: 'G Major selected!'
    }),

    createAddChordStep('G', 'Major', {
        instruction: 'Add G Major as the Mixolydian tonic.',
        successMessage: 'G added!'
    }),

    createRootSelectionStep('F', {
        instruction: 'Add F - the ♭VII chord that defines Mixolydian.',
        callout: 'The ♭VII (F in G Mixolydian) is the characteristic chord. It contains the ♭7 that makes this mode rock!',
        successMessage: 'F selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'F Major selected!'
    }),

    createAddChordStep('F', 'Major', {
        instruction: 'Add F Major.',
        successMessage: 'F added! G → F is the classic rock Mixolydian sound!'
    }),

    // ========== PLAY THE PROGRESSION ==========
    {
        instruction: 'Play your progression! First half is Dorian, second half is Mixolydian.',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'You built: Dm7→G (Dorian i-IV) then G→F (Mixolydian I-♭VII). Two modes, two different colors!',
        validation: { type: 'chord_played' },
        successMessage: 'You\'re hearing two different modal colors!'
    },

    // ========== FINAL ==========
    createInfoStep(
        'You\'ve explored the two most useful modes!',
        {
            callout: 'Key concepts:\n• DORIAN = minor with raised 6th (jazz, R&B)\n• MIXOLYDIAN = major with lowered 7th (rock, blues)\n• Characteristic chords define the mode\n• Dorian: i-IV vamp • Mixolydian: I-♭VII\n\nThere are 5 more modes to discover: Ionian (major), Phrygian (Spanish), Lydian (dreamy), Aeolian (natural minor), and Locrian (unstable)!',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// MODAL HARMONY - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Modal Harmony" lesson
 * Teaches how to build progressions that stay in a mode
 */
export const modalHarmonyGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s learn to write progressions that stay in a mode!',
        {
            callout: 'Modal harmony requires avoiding V-I cadences that would destroy the modal color. We use characteristic chords and pedal points instead.'
        }
    ),

    // ========== RULE 1: AVOID V-I ==========
    createInfoStep(
        'Rule 1: Avoid V-I cadences - they pull you into major/minor tonality.',
        {
            callout: 'The V-I (like G→C) is so strong it overrides modal feeling. Use ♭VII-I (like B♭→C) instead for Mixolydian, or IV-i for Dorian.'
        }
    ),

    // ========== BUILD A DORIAN PROGRESSION ==========
    createInfoStep(
        'Let\'s build a proper Dorian progression that maintains modal color.',
        {
            callout: 'A Dorian uses the notes of G major, but A is home. Key chords: Am (i), D (IV), G (♭VII).'
        }
    ),

    createRootSelectionStep('A', {
        instruction: 'Select A - we\'ll build A Dorian.',
        successMessage: 'A selected!'
    }),

    createChordTypeSelectionStep('Minor', {
        instruction: 'Select "Minor" for our Dorian tonic.',
        successMessage: 'A Minor selected!'
    }),

    createAddChordStep('A', 'Minor', {
        instruction: 'Add Am as the Dorian tonic.',
        successMessage: 'Am added!'
    }),

    createRootSelectionStep('D', {
        instruction: 'Add D - the characteristic IV chord of A Dorian.',
        callout: 'D major contains F# - the raised 6th that makes Dorian unique! In A natural minor, this would be Dm.',
        successMessage: 'D selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major" - this is the signature Dorian sound!',
        successMessage: 'D Major selected!'
    }),

    createAddChordStep('D', 'Major', {
        instruction: 'Add D Major.',
        successMessage: 'D added! Am→D is the classic Dorian vamp!'
    }),

    // ========== BUILD A LYDIAN PROGRESSION ==========
    createInfoStep(
        'Now let\'s try Lydian - the dreamy, floating mode.',
        {
            callout: 'Lydian is major with a raised 4th (#4). It creates that magical, suspended-in-air feeling.'
        }
    ),

    createRootSelectionStep('F', {
        instruction: 'Select F - we\'ll build F Lydian.',
        callout: 'F Lydian uses C major\'s notes. The #4 is B natural!',
        successMessage: 'F selected!'
    }),

    createChordTypeSelectionStep('Major 7th', {
        instruction: 'Select "Major 7th" for a lush Lydian tonic.',
        successMessage: 'F Major 7th selected!'
    }),

    createAddChordStep('F', 'Major 7th', {
        instruction: 'Add Fmaj7.',
        successMessage: 'Fmaj7 added!'
    }),

    createRootSelectionStep('G', {
        instruction: 'Add G - the II chord that defines Lydian.',
        callout: 'The G major chord contains B (F\'s #4). This is Lydian\'s characteristic chord!',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'G Major selected!'
    }),

    createAddChordStep('G', 'Major', {
        instruction: 'Add G Major.',
        successMessage: 'G added! Fmaj7→G creates that Lydian float!'
    }),

    // ========== PLAY ==========
    {
        instruction: 'Play your modal progressions! First half is Dorian, second half is Lydian.',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'You built: Am→D (Dorian i-IV) then Fmaj7→G (Lydian I-II). Notice how different they feel!',
        validation: { type: 'chord_played' },
        successMessage: 'Modal harmony in action!'
    },

    // ========== FINAL ==========
    createInfoStep(
        'You\'ve learned modal harmony principles!',
        {
            callout: 'Key principles:\n• AVOID V-I cadences (too tonal)\n• Use CHARACTERISTIC CHORDS to define the mode\n• Short VAMPS work better than long progressions\n• PEDAL TONES help anchor the mode\n\nDorian: i-IV • Lydian: I-II • Mixolydian: I-♭VII • Phrygian: i-♭II',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// ADVANCED VOICE LEADING - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Advanced Voice Leading" lesson
 * Teaches guide tones, contrary motion, and voice independence
 */
export const advancedVoiceLeadingGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s master advanced voice leading techniques!',
        {
            callout: 'Great voice leading treats each note as a "voice" that moves melodically. The key is guide tones (3rds and 7ths) and contrary motion.'
        }
    ),

    // ========== GUIDE TONES CONCEPT ==========
    createInfoStep(
        'GUIDE TONES are the 3rd and 7th of each chord - they define the chord\'s character.',
        {
            callout: 'When guide tones move by step or stay the same, the progression sounds smooth. This is why ii-V-I sounds so connected!'
        }
    ),

    // ========== BUILD ii-V-I ==========
    createRootSelectionStep('D', {
        instruction: 'Let\'s trace guide tones through ii-V-I in C. Start with D.',
        callout: 'Dm7 guide tones: F (3rd) and C (7th)',
        successMessage: 'D selected!'
    }),

    createChordTypeSelectionStep('Minor 7th', {
        instruction: 'Select "Minor 7th".',
        successMessage: 'D Minor 7th selected!'
    }),

    createKeyboardStep(
        'Look at the keyboard - find F and C, the guide tones of Dm7.',
        {
            callout: 'F is the 3rd (gives minor quality), C is the 7th (adds color). Watch where these notes go next!'
        }
    ),

    createAddChordStep('D', 'Minor 7th', {
        instruction: 'Add Dm7.',
        successMessage: 'Dm7 added!'
    }),

    createRootSelectionStep('G', {
        instruction: 'Now add G7 - watch the guide tones!',
        callout: 'G7 guide tones: B (3rd) and F (7th). Notice: the C moved to B, but F STAYED!',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Dominant 7th', {
        instruction: 'Select "Dominant 7th".',
        successMessage: 'G Dominant 7th selected!'
    }),

    createKeyboardStep(
        'See how F is still here? And C moved just one step down to B?',
        {
            callout: 'This is smooth voice leading! F→F (common tone), C→B (step). No big jumps!'
        }
    ),

    createAddChordStep('G', 'Dominant 7th', {
        instruction: 'Add G7.',
        successMessage: 'G7 added!'
    }),

    createRootSelectionStep('C', {
        instruction: 'Finish with Cmaj7 - complete the guide tone resolution.',
        callout: 'Cmaj7 guide tones: E (3rd) and B (7th). Watch: B STAYS, F→E!',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major 7th', {
        instruction: 'Select "Major 7th".',
        successMessage: 'C Major 7th selected!'
    }),

    createKeyboardStep(
        'Beautiful! B stayed the same, F moved to E by half-step.',
        {
            callout: 'The complete guide tone path:\n• 3rds: F → B → E (each a half-step!)\n• 7ths: C → F → B (F is common tone, then steps)\n\nThis is why ii-V-I is so smooth!'
        }
    ),

    createAddChordStep('C', 'Major 7th', {
        instruction: 'Add Cmaj7.',
        successMessage: 'Cmaj7 added!'
    }),

    // ========== PLAY ==========
    {
        instruction: 'Play and listen for the smooth voice leading.',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'The guide tones connect like a melody within the chords. This is professional-level voice leading!',
        validation: { type: 'chord_played' },
        successMessage: 'Smooth as silk!'
    },

    // ========== FINAL ==========
    createInfoStep(
        'You\'ve learned advanced voice leading!',
        {
            callout: 'Key concepts:\n• GUIDE TONES = 3rd and 7th (define chord quality)\n• Move guide tones by STEP or keep them (common tones)\n• CONTRARY MOTION = voices move in opposite directions (strongest)\n• Think of each chord tone as a VOICE singing a melody\n\nPractice tracing guide tones through any progression!',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// EXTENDED CHORDS - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Extended Chords" lesson
 * Teaches 9ths, 11ths, and 13ths - the colors of jazz
 */
export const extendedChordsGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s explore extended chords - 9ths, 11ths, and 13ths!',
        {
            callout: 'Extended chords stack more thirds on top of 7th chords. They\'re the rich, complex harmonies of jazz, R&B, and neo-soul.'
        }
    ),

    // ========== 9TH CHORDS ==========
    createInfoStep(
        'The 9TH CHORD adds the 9th (same as the 2nd, but an octave higher) to a 7th chord.',
        {
            callout: '9ths add warmth and sophistication without complexity. Let\'s build a classic ii-V-I with extended chords!'
        }
    ),

    // ========== MINOR 9TH (ii) ==========
    createRootSelectionStep('D', {
        instruction: 'Start with Dm9 - the ii chord with a 9th.',
        callout: 'In jazz, we build ii-V-I with extended chords. Dm9 is the smooth, modern ii chord.',
        successMessage: 'D selected!'
    }),

    createChordTypeSelectionStep('Minor 9th', {
        instruction: 'Select "Minor 9th".',
        callout: 'Minor 9th = 1-♭3-5-♭7-9. Very common in R&B and neo-soul!',
        successMessage: 'D Minor 9th selected!'
    }),

    createKeyboardStep(
        'Dm9 has 5 notes: D-F-A-C-E. The E on top is the 9th.',
        {
            callout: 'The 9th softens the minor quality - it\'s emotional but not heavy. This is the sound of modern jazz and R&B.'
        }
    ),

    createPlayChordStep({
        instruction: 'Play Dm9 - hear the smooth, modern sound.',
        callout: 'This lush minor chord is the perfect ii chord for sophisticated progressions.',
        successMessage: 'Smooth and sophisticated!'
    }),

    createAddChordStep('D', 'Minor 9th', {
        instruction: 'Add Dm9 - the ii chord.',
        successMessage: 'Dm9 added!'
    }),

    // ========== DOMINANT 9TH (V) ==========
    createRootSelectionStep('G', {
        instruction: 'Now add G9 - the soulful V chord.',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Dominant 9th', {
        instruction: 'Select "Dominant 9th".',
        callout: 'Dominant 9 = 1-3-5-♭7-9. This is the sound of blues and soul!',
        successMessage: 'G Dominant 9th selected!'
    }),

    createPlayChordStep({
        instruction: 'Play G9 - feel that blues/soul warmth.',
        callout: 'The 9th adds warmth to the dominant tension. For even more richness, try G13 which adds the 13th!',
        successMessage: 'That\'s the sound of soul!'
    }),

    createAddChordStep('G', 'Dominant 9th', {
        instruction: 'Add G9 - the V chord.',
        successMessage: 'G9 added!'
    }),

    // ========== MAJOR 9TH (I) ==========
    createRootSelectionStep('C', {
        instruction: 'Finish with Cmaj9 - the dreamy I chord.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major 9th', {
        instruction: 'Select "Major 9th" - the dreamy jazz resolution.',
        callout: 'Major 9th = 1-3-5-7-9. The major 7th (B) plus the 9th (D) create a lush, sophisticated sound.',
        successMessage: 'C Major 9th selected!'
    }),

    createKeyboardStep(
        'See all 5 notes? C-E-G-B-D. The D on top is the 9th.',
        {
            callout: 'Cmaj9 is still a tonic chord - just richer! Perfect for endings, intros, and peaceful moments.'
        }
    ),

    createPlayChordStep({
        instruction: 'Play Cmaj9 - listen to how lush it sounds.',
        callout: 'This is the sound of sophistication - the perfect resolution!',
        successMessage: 'Beautiful! That\'s the major 9th sound!'
    }),

    createAddChordStep('C', 'Major 9th', {
        instruction: 'Add Cmaj9 - the I chord.',
        successMessage: 'Cmaj9 added! You\'ve built ii-V-I with 9ths!'
    }),

    // ========== PLAY ==========
    {
        instruction: 'Play your extended ii-V-I: Dm9 → G9 → Cmaj9!',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'This is THE classic jazz progression with extended chords. Notice how much richer it sounds than plain triads!',
        validation: { type: 'chord_played' },
        successMessage: 'You\'re playing jazz harmony!'
    },

    // ========== FINAL ==========
    createInfoStep(
        'You\'ve mastered extended chord basics!',
        {
            callout: 'Extended chord summary:\n• 9TH = adds warmth (works on all chord types)\n• 11TH = adds suspension (avoid on major/dom - use #11)\n• 13TH = adds soulfulness (esp. on dominant chords)\n\nVoicing tip: Omit root & 5th for compact voicings!\n\nTry: Dm9 → G13 → Cmaj9 for classic jazz.',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// COUNTERPOINT - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Counterpoint Fundamentals" lesson
 * Teaches combining independent melodic lines
 */
export const counterpointGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Counterpoint: the art of combining independent melodies!',
        {
            callout: 'In counterpoint, every voice is a melody - not just accompaniment. Bach was the master, but these principles appear everywhere from fugues to rock harmonies.'
        }
    ),

    // ========== TYPES OF MOTION ==========
    createInfoStep(
        'The four types of voice motion define how two melodies relate.',
        {
            callout: '1. PARALLEL - same direction, same interval\n2. SIMILAR - same direction, different intervals\n3. CONTRARY - opposite directions (strongest!)\n4. OBLIQUE - one moves, one stays'
        }
    ),

    // ========== BUILD CONTRARY MOTION EXAMPLE ==========
    createInfoStep(
        'CONTRARY MOTION is the gold standard - voices moving in opposite directions.',
        {
            callout: 'When bass goes down and soprano goes up (or vice versa), each voice maintains independence. This is what Bach did constantly!'
        }
    ),

    createRootSelectionStep('C', {
        instruction: 'Let\'s build a progression with contrary bass motion.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'C Major selected!'
    }),

    createAddChordStep('C', 'Major', {
        instruction: 'Add C Major - bass note is C.',
        successMessage: 'C added!'
    }),

    createRootSelectionStep('G', {
        instruction: 'Now we\'ll use an inversion to create stepwise bass.',
        callout: 'Instead of jumping C→G in the bass, we\'ll use G/B (first inversion) so bass walks C→B.',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'G Major selected!'
    }),

    // Add step for inversion selection
    {
        instruction: 'Select "1st" inversion to put B in the bass.',
        spotlight: '#fs-inversion-buttons',
        targetElement: '#fs-inversion-buttons',
        callout: 'First inversion (G/B) gives us the note B in the bass. Now our bass line can walk: C→B→A...',
        validation: { type: 'inversion_selected', value: 1 },
        successMessage: '1st inversion selected!',
        onEnter: () => {
            const btn = document.querySelector('#fs-inversion-buttons button[data-inversion="1"]');
            if (btn) {
                btn.classList.add('animate-pulse');
                btn.style.boxShadow = '0 0 15px 5px rgba(139, 92, 246, 0.6)';
            }
        },
        onExit: () => {
            const btn = document.querySelector('#fs-inversion-buttons button[data-inversion="1"]');
            if (btn) {
                btn.classList.remove('animate-pulse');
                btn.style.boxShadow = '';
            }
        }
    },

    createAddChordStep('G', 'Major', {
        instruction: 'Add G/B.',
        successMessage: 'G/B added! Bass walked from C to B.'
    }),

    createRootSelectionStep('A', {
        instruction: 'Continue the walking bass with Am.',
        callout: 'Bass continues: C→B→A. This stepwise motion is the essence of good counterpoint!',
        successMessage: 'A selected!'
    }),

    createChordTypeSelectionStep('Minor', {
        instruction: 'Select "Minor".',
        successMessage: 'A Minor selected!'
    }),

    createAddChordStep('A', 'Minor', {
        instruction: 'Add Am.',
        successMessage: 'Am added! Bass line: C→B→A'
    }),

    createRootSelectionStep('F', {
        instruction: 'Finish with F to complete the descending line.',
        callout: 'Our bass line: C→B→A→F (or we could use Dm for C→B→A→D). Either creates beautiful contrary motion with the melody!',
        successMessage: 'F selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'F Major selected!'
    }),

    createAddChordStep('F', 'Major', {
        instruction: 'Add F.',
        successMessage: 'F added!'
    }),

    // ========== PLAY ==========
    {
        instruction: 'Play and listen to the walking bass line!',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'The bass descends: C→B→A→F while the melody can move up. This contrary motion creates beautiful independence!',
        validation: { type: 'chord_played' },
        successMessage: 'That\'s counterpoint in action!'
    },

    // ========== FINAL ==========
    createInfoStep(
        'You\'ve learned basic counterpoint principles!',
        {
            callout: 'Key counterpoint concepts:\n• CONTRARY MOTION = voices in opposite directions (strongest)\n• Use INVERSIONS to create stepwise bass lines\n• Avoid PARALLEL 5ths and octaves (voices lose independence)\n• Each voice should be SINGABLE as a melody\n\nPractice: Take any progression and add inversions to make the bass line walk!',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// MODULATION - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Modulation" lesson
 * Teaches changing keys within a piece
 */
export const modulationGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s learn modulation - the art of changing keys!',
        {
            callout: 'Modulation adds variety and drama by moving to a new key. It\'s like changing the scenery in a story - same characters, new environment!'
        }
    ),

    // ========== COMMON CHORD MODULATION ==========
    createInfoStep(
        'PIVOT CHORD modulation uses a chord common to both keys.',
        {
            callout: 'If C major and G major both contain Em, we can use Em as a "pivot" to smoothly transition from C to G!'
        }
    ),

    // ========== BUILD MODULATION FROM C TO G ==========
    createRootSelectionStep('C', {
        instruction: 'Let\'s modulate from C major to G major. Start in C.',
        successMessage: 'C selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major" - our home key tonic.',
        successMessage: 'C Major selected!'
    }),

    createAddChordStep('C', 'Major', {
        instruction: 'Add C Major - we start in C major.',
        successMessage: 'C added!'
    }),

    createRootSelectionStep('A', {
        instruction: 'Add Am - common chord setup.',
        successMessage: 'A selected!'
    }),

    createChordTypeSelectionStep('Minor', {
        instruction: 'Select "Minor".',
        successMessage: 'A Minor selected!'
    }),

    createAddChordStep('A', 'Minor', {
        instruction: 'Add Am (vi in C major).',
        successMessage: 'Am added!'
    }),

    createRootSelectionStep('E', {
        instruction: 'Now add Em - our PIVOT chord!',
        callout: 'Em is iii in C major BUT ALSO vi in G major. This dual function is the key to smooth modulation!',
        successMessage: 'E selected!'
    }),

    createChordTypeSelectionStep('Minor', {
        instruction: 'Select "Minor".',
        successMessage: 'E Minor selected!'
    }),

    createAddChordStep('E', 'Minor', {
        instruction: 'Add Em - the pivot chord.',
        successMessage: 'Em added - this chord belongs to BOTH keys!'
    }),

    // ========== NEW KEY ==========
    createRootSelectionStep('D', {
        instruction: 'Now add D - the V of G major.',
        callout: 'D major is V in G major. After the pivot (Em = vi in G), this dominant sets up the new tonic!',
        successMessage: 'D selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'D Major selected!'
    }),

    createAddChordStep('D', 'Major', {
        instruction: 'Add D - the V of our new key.',
        successMessage: 'D added! We\'re now clearly in G major.'
    }),

    createRootSelectionStep('G', {
        instruction: 'Finish with G - our new tonic!',
        callout: 'G major is now home. We\'ve modulated from C to G using Em as a pivot!',
        successMessage: 'G selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'G Major selected!'
    }),

    createAddChordStep('G', 'Major', {
        instruction: 'Add G - our new home key.',
        successMessage: 'G added! Modulation complete!'
    }),

    // ========== PLAY ==========
    {
        instruction: 'Play and hear how we shifted from C to G!',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'Path: C (I in C) → Am (vi) → Em (pivot: iii in C = vi in G) → D (V in G) → G (I in G). Smooth!',
        validation: { type: 'chord_played' },
        successMessage: 'You modulated!'
    },

    // ========== FINAL ==========
    createInfoStep(
        'You\'ve learned pivot chord modulation!',
        {
            callout: 'Modulation types:\n• PIVOT CHORD = Use chord common to both keys\n• DIRECT = Jump to new key (dramatic!)\n• CHROMATIC = Use chromatic chords to slide keys\n\nCommon modulations:\n• Up a 4th: C→F (most natural)\n• Up a 5th: C→G (very common)\n• Up a step: C→D (dramatic lift)\n\nPivot chords make the journey smooth!',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// EXOTIC SCALES - Fullscreen Guided Exercise
// ===========================================

/**
 * Fullscreen guided exercise for "Exotic Scales" lesson
 * Teaches scales beyond major/minor
 */
export const exoticScalesGuidedStepsFS = [
    // ========== INTRODUCTION ==========
    createInfoStep(
        'Let\'s explore exotic scales - sounds from around the world!',
        {
            callout: 'Beyond major and minor, there are hundreds of scales used in different cultures. Each has its own unique color and emotional quality!'
        }
    ),

    // ========== HARMONIC MINOR ==========
    createInfoStep(
        'HARMONIC MINOR: Natural minor with a raised 7th.',
        {
            callout: 'Harmonic minor has that classical/Middle Eastern sound. The raised 7th creates a leading tone, but the augmented 2nd between 6th and 7th is exotic!'
        }
    ),

    createRootSelectionStep('A', {
        instruction: 'Let\'s build chords from A harmonic minor.',
        callout: 'A harmonic minor: A-B-C-D-E-F-G#. The G# is what makes it "harmonic".',
        successMessage: 'A selected!'
    }),

    createChordTypeSelectionStep('Minor', {
        instruction: 'Select "Minor" - the tonic of harmonic minor is still minor.',
        successMessage: 'A Minor selected!'
    }),

    createAddChordStep('A', 'Minor', {
        instruction: 'Add Am.',
        successMessage: 'Am added!'
    }),

    createRootSelectionStep('E', {
        instruction: 'Now add E - in harmonic minor, V is MAJOR!',
        callout: 'The raised 7th (G#) makes the V chord major (E-G#-B). This creates the strong V-i resolution!',
        successMessage: 'E selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major" - harmonic minor\'s signature sound.',
        successMessage: 'E Major selected!'
    }),

    createPlayChordStep({
        instruction: 'Play E Major - hear the leading tone!',
        callout: 'The G# in E major wants to resolve up to A. This pull is why composers use harmonic minor!',
        successMessage: 'Classical tension!'
    }),

    createAddChordStep('E', 'Major', {
        instruction: 'Add E Major.',
        successMessage: 'E added! Am→E is the harmonic minor V-i.'
    }),

    // ========== HEAR HARMONIC MINOR ==========
    {
        instruction: 'Play Am → E to hear the harmonic minor V-i!',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'This is the classical minor sound! The E major chord (with G#) creates that dramatic leading tone pull to Am.',
        validation: { type: 'chord_played' },
        successMessage: 'That\'s harmonic minor!'
    },

    // ========== PHRYGIAN DOMINANT ==========
    createInfoStep(
        'Now let\'s explore PHRYGIAN DOMINANT - the scale of flamenco!',
        {
            callout: 'Phrygian Dominant is the 5th mode of harmonic minor. It has a ♭2 AND a major 3rd - very dramatic!'
        }
    ),

    createRootSelectionStep('E', {
        instruction: 'Build E Phrygian Dominant sound.',
        callout: 'E Phrygian Dominant: E-F-G#-A-B-C-D. The F (♭2) and G# (major 3rd) create that Spanish flavor!',
        successMessage: 'E selected!'
    }),

    createChordTypeSelectionStep('Dominant 7th', {
        instruction: 'Select "Dominant 7th" - the characteristic chord.',
        callout: 'E7 captures the Phrygian Dominant sound - a major chord with dominant tension.',
        successMessage: 'E Dominant 7th selected!'
    }),

    createAddChordStep('E', 'Dominant 7th', {
        instruction: 'Add E7.',
        successMessage: 'E7 added!'
    }),

    createRootSelectionStep('F', {
        instruction: 'Add F - the ♭II that defines the Phrygian sound.',
        callout: 'The F chord (♭II) is the heart of Phrygian Dominant. E7→F→E7 is pure flamenco!',
        successMessage: 'F selected!'
    }),

    createChordTypeSelectionStep('Major', {
        instruction: 'Select "Major".',
        successMessage: 'F Major selected!'
    }),

    createAddChordStep('F', 'Major', {
        instruction: 'Add F - the Phrygian ♭II.',
        successMessage: 'F added!'
    }),

    // ========== PLAY PHRYGIAN ==========
    {
        instruction: 'Play and hear the full exotic progression!',
        spotlight: '#fs-play-btn',
        targetElement: '#fs-play-btn',
        callout: 'Your progression: Am→E (harmonic minor) then E7→F (Phrygian Dominant). Two related exotic sounds!',
        validation: { type: 'chord_played' },
        successMessage: 'Exotic scales in action!'
    },

    // ========== FINAL ==========
    createInfoStep(
        'You\'ve explored exotic scale harmony!',
        {
            callout: 'Exotic scales to explore:\n• HARMONIC MINOR: Raised 7th (classical, metal)\n• PHRYGIAN DOMINANT: ♭2 + major 3rd (flamenco)\n• HUNGARIAN MINOR: Two augmented 2nds (dramatic)\n• WHOLE TONE: All whole steps (dreamy, unresolved)\n• DIMINISHED: Alternating W-H or H-W (jazz)\n\nEach scale opens new harmonic worlds!',
            allowFreeExplore: true
        }
    )
];

// ===========================================
// EXPORT MAP FOR LESSON INTEGRATION
// ===========================================

/**
 * Map of lesson IDs to their fullscreen guided steps
 * Used by lessonViewer to get the appropriate steps
 */
export const FULLSCREEN_GUIDED_STEPS = {
    // Beginner lessons
    'lesson-what-is-chord': whatIsAChordGuidedStepsFS,
    'lesson-major-vs-minor': majorVsMinorGuidedStepsFS,
    'lesson-inversions': chordInversionsGuidedStepsFS,
    'lesson-why-chords-move': whyChordsMoveGuidedStepsFS,
    'lesson-first-progression': firstProgressionGuidedStepsFS,
    'lesson-voice-leading': voiceLeadingGuidedStepsFS,
    'lesson-popular-progression': popularProgressionGuidedStepsFS,
    'lesson-adding-emotion': addingEmotionGuidedStepsFS,
    // Intermediate lessons
    'lesson-seventh-chords': seventhChordsGuidedStepsFS,
    'lesson-secondary-dominants': secondaryDominantsGuidedStepsFS,
    'lesson-borrowed-chords': borrowedChordsGuidedStepsFS,
    'lesson-tension-release': tensionReleaseGuidedStepsFS,
    'lesson-melody-chord': melodyChordGuidedStepsFS,
    // Advanced lessons
    'lesson-modes-intro': modesIntroGuidedStepsFS,
    'lesson-modal-harmony': modalHarmonyGuidedStepsFS,
    'lesson-advanced-voice-leading': advancedVoiceLeadingGuidedStepsFS,
    'lesson-extended-chords': extendedChordsGuidedStepsFS,
    'lesson-counterpoint': counterpointGuidedStepsFS,
    'lesson-modulation': modulationGuidedStepsFS,
    'lesson-exotic-scales': exoticScalesGuidedStepsFS,
};

/**
 * Check if a lesson has fullscreen guided steps available
 * @param {string} lessonId - The lesson ID
 * @returns {boolean} True if fullscreen steps exist
 */
export function hasFullscreenGuidedSteps(lessonId) {
    return lessonId in FULLSCREEN_GUIDED_STEPS;
}

/**
 * Get fullscreen guided steps for a lesson
 * @param {string} lessonId - The lesson ID
 * @returns {Array|null} The guided steps array or null
 */
export function getFullscreenGuidedSteps(lessonId) {
    return FULLSCREEN_GUIDED_STEPS[lessonId] || null;
}
