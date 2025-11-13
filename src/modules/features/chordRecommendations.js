/**
 * Intelligent Chord Recommendation Engine
 * Provides context-aware chord suggestions with music theory explanations
 */

import { CHORD_DEFINITIONS, ALL_NOTES } from '../../data/music-data.js';

/**
 * Functional harmony categories for chord analysis
 */
const HARMONIC_FUNCTIONS = {
    TONIC: { label: 'Tonic', symbol: 'T', description: 'Home base', commonTalk: 'Stable and resolved' },
    SUBDOMINANT: { label: 'Subdominant', symbol: 'SD', description: 'Journey begins', commonTalk: 'Moving away from home' },
    DOMINANT: { label: 'Dominant', symbol: 'D', description: 'Tension!', commonTalk: 'Wants to go back home' },
    PREDOMINANT: { label: 'Predominant', symbol: 'PD', description: 'Sets up tension', commonTalk: 'Building anticipation' }
};

/**
 * Common progression patterns with examples
 */
const COMMON_PROGRESSIONS = {
    'POP_PROGRESSION': {
        pattern: ['I', 'V', 'vi', 'IV'],
        name: 'Pop Progression',
        examples: ['Let It Be - Beatles', 'Don\'t Stop Believin\' - Journey', 'Someone Like You - Adele']
    },
    'FIFTIES_PROGRESSION': {
        pattern: ['I', 'vi', 'IV', 'V'],
        name: '50s Progression',
        examples: ['Stand By Me - Ben E. King', 'Blue Moon - The Marcels']
    },
    'JAZZ_TURNAROUND': {
        pattern: ['ii', 'V', 'I'],
        name: 'Jazz ii-V-I',
        examples: ['Autumn Leaves', 'Fly Me to the Moon']
    },
    'CIRCLE_OF_FIFTHS': {
        pattern: ['vi', 'ii', 'V', 'I'],
        name: 'Circle of Fifths',
        examples: ['Giant Steps - John Coltrane']
    },
    'ANDALUSIAN_CADENCE': {
        pattern: ['i', 'VII', 'VI', 'V'],
        name: 'Andalusian Cadence',
        examples: ['Hit the Road Jack - Ray Charles']
    }
};

/**
 * Get Roman numeral for a chord degree in a key
 */
function getRomanNumeral(degree, isMinor = false) {
    const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    const minorRomanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];

    const index = (degree - 1) % 7;
    return isMinor ? minorRomanNumerals[index] : romanNumerals[index];
}

/**
 * Get scale degree of a chord root in a key
 */
function getScaleDegree(chordRoot, key) {
    const keyIndex = ALL_NOTES.indexOf(key);
    const chordIndex = ALL_NOTES.indexOf(chordRoot);

    if (keyIndex === -1 || chordIndex === -1) return null;

    // Calculate semitone distance
    let distance = (chordIndex - keyIndex + 12) % 12;

    // Map to scale degree (major scale)
    const degreeMap = {
        0: 1,  // Root (I)
        2: 2,  // 2nd (ii)
        4: 3,  // 3rd (iii)
        5: 4,  // 4th (IV)
        7: 5,  // 5th (V)
        9: 6,  // 6th (vi)
        11: 7  // 7th (vii°)
    };

    return degreeMap[distance] || null;
}

/**
 * Get harmonic function for a chord degree
 */
function getHarmonicFunction(degree) {
    if ([1, 6].includes(degree)) return HARMONIC_FUNCTIONS.TONIC;
    if ([2, 4].includes(degree)) return HARMONIC_FUNCTIONS.SUBDOMINANT;
    if ([5, 7].includes(degree)) return HARMONIC_FUNCTIONS.DOMINANT;
    return HARMONIC_FUNCTIONS.PREDOMINANT;
}

/**
 * Calculate voice leading quality between two chords
 * @returns {number} 0-100 score (higher is smoother)
 */
function calculateVoiceLeadingQuality(chord1Notes, chord2Notes) {
    if (!chord1Notes || !chord2Notes || chord1Notes.length === 0 || chord2Notes.length === 0) {
        return 50; // Neutral score
    }

    // Convert notes to MIDI numbers for comparison
    const noteToMidi = (note) => {
        const noteMap = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
                         'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
        const match = note.match(/^([A-G][#b]?)(\d+)$/);
        if (!match) return null;
        return noteMap[match[1]] + (parseInt(match[2]) * 12);
    };

    const midi1 = chord1Notes.map(noteToMidi).filter(m => m !== null);
    const midi2 = chord2Notes.map(noteToMidi).filter(m => m !== null);

    // Count common tones (voices that don't move)
    const commonTones = midi1.filter(m1 => midi2.some(m2 => m2 === m1)).length;

    // Calculate average movement distance
    let totalMovement = 0;
    let voicesMoving = 0;

    midi1.forEach(m1 => {
        const closestM2 = midi2.reduce((closest, m2) => {
            const dist = Math.abs(m2 - m1);
            return dist < Math.abs(closest - m1) ? m2 : closest;
        }, midi2[0]);

        const movement = Math.abs(closestM2 - m1);
        if (movement > 0) {
            totalMovement += movement;
            voicesMoving++;
        }
    });

    const avgMovement = voicesMoving > 0 ? totalMovement / voicesMoving : 0;

    // Score calculation:
    // - Common tones increase score
    // - Less movement increases score
    const commonToneScore = (commonTones / Math.max(midi1.length, midi2.length)) * 50;
    const movementScore = Math.max(0, 50 - (avgMovement * 5)); // Penalty for large movements

    return Math.min(100, commonToneScore + movementScore);
}

/**
 * Apply style and mood preferences to recommendations
 * Adjusts confidence scores based on user preferences
 */
function applyStyleMoodPreferences(recommendations, style, mood) {
    recommendations.forEach(rec => {
        let bonus = 0;

        // Style-based adjustments
        if (style === 'pop' || style === 'any') {
            // Pop favors major chords and common progressions
            if (rec.type === 'Major') bonus += 5;
        } else if (style === 'jazz') {
            // Jazz favors 7th chords and circle of fifths
            if (rec.type.includes('7')) bonus += 10;
        } else if (style === 'classical') {
            // Classical favors strong voice leading
            if (rec.voiceLeadingScore > 70) bonus += 10;
        } else if (style === 'rock') {
            // Rock favors power chords and simple progressions
            if (rec.type === 'Major') bonus += 5;
        }

        // Mood-based adjustments
        if (mood === 'happy' || mood === 'uplifting') {
            // Happy moods favor major chords
            if (rec.type === 'Major') bonus += 8;
        } else if (mood === 'sad' || mood === 'melancholic') {
            // Sad moods favor minor chords
            if (rec.type === 'Minor') bonus += 8;
        } else if (mood === 'dramatic' || mood === 'tense') {
            // Dramatic moods favor dominant chords
            if (rec.chord && rec.type === 'Major') bonus += 5;
        }

        // Apply bonus (cap at 100)
        rec.confidence = Math.min(100, rec.confidence + bonus);
    });
}

/**
 * Generate intelligent chord recommendations
 * @param {Array} progression - Current chord progression
 * @param {string} key - Current key
 * @param {string} style - Style preference (optional)
 * @param {string} mood - Mood preference (optional)
 * @returns {Array} Array of recommendation objects
 */
export function generateChordRecommendations(progression, key, style = 'any', mood = 'neutral') {
    if (!progression || progression.length === 0) {
        // Starting from scratch - recommend tonic chords
        return getInitialChordRecommendations(key);
    }

    const lastChord = progression[progression.length - 1];
    const lastChordDegree = getScaleDegree(lastChord.root, key);

    if (!lastChordDegree) {
        return getInitialChordRecommendations(key);
    }

    const recommendations = [];

    // Generate recommendations based on harmonic function
    const lastFunction = getHarmonicFunction(lastChordDegree);

    // Common progression rules
    if (lastFunction === HARMONIC_FUNCTIONS.TONIC) {
        // From tonic: can go anywhere, but commonly subdominant or dominant
        recommendations.push(...generateFromTonic(progression, key, lastChord));
    } else if (lastFunction === HARMONIC_FUNCTIONS.SUBDOMINANT) {
        // From subdominant: commonly to dominant or back to tonic
        recommendations.push(...generateFromSubdominant(progression, key, lastChord));
    } else if (lastFunction === HARMONIC_FUNCTIONS.DOMINANT) {
        // From dominant: strong pull to tonic (resolution)
        recommendations.push(...generateFromDominant(progression, key, lastChord));
    }

    // Apply style/mood filtering
    applyStyleMoodPreferences(recommendations, style, mood);

    // Sort by confidence score
    recommendations.sort((a, b) => b.confidence - a.confidence);

    // Return top 5 recommendations
    return recommendations.slice(0, 5);
}

/**
 * Get initial chord recommendations for empty progression
 */
function getInitialChordRecommendations(key) {
    const keyIndex = ALL_NOTES.indexOf(key);
    const tonicChord = key;

    return [{
        chord: tonicChord,
        type: 'Major',
        inversion: 0,
        confidence: 100,
        reasons: [
            {
                category: 'functional_harmony',
                explanation: 'Tonic chord (I) - establishes the key center',
                commonTalk: 'Start at home - this sets the foundation'
            }
        ],
        songExamples: ['Almost all songs start with I']
    }];
}

/**
 * Generate recommendations from tonic
 */
function generateFromTonic(progression, key, lastChord) {
    const recommendations = [];
    const keyIndex = ALL_NOTES.indexOf(key);

    // IV - Subdominant (common next move)
    const IV_root = ALL_NOTES[(keyIndex + 5) % 12];
    recommendations.push({
        chord: IV_root,
        type: 'Major',
        inversion: 0,
        confidence: 90,
        reasons: [
            {
                category: 'functional_harmony',
                explanation: 'Moves to subdominant (IV), creating motion away from tonic',
                commonTalk: 'Starting the journey - this creates movement'
            },
            {
                category: 'common_progression',
                explanation: 'Part of the I-IV-V progression used in countless songs',
                commonTalk: 'Classic move used everywhere'
            }
        ],
        songExamples: ['Let It Be', 'Twist and Shout', 'La Bamba'],
        voiceLeadingScore: calculateVoiceLeadingQuality(lastChord.notes, [IV_root + '4'])
    });

    // V - Dominant (creates tension)
    const V_root = ALL_NOTES[(keyIndex + 7) % 12];
    recommendations.push({
        chord: V_root,
        type: 'Major',
        inversion: 0,
        confidence: 85,
        reasons: [
            {
                category: 'functional_harmony',
                explanation: 'Moves to dominant (V), creating tension that wants to resolve',
                commonTalk: 'Building tension - makes listener want resolution'
            }
        ],
        songExamples: ['Wild Thing', 'Louie Louie'],
        voiceLeadingScore: calculateVoiceLeadingQuality(lastChord.notes, [V_root + '4'])
    });

    // vi - Relative minor (deceptive)
    const vi_root = ALL_NOTES[(keyIndex + 9) % 12];
    recommendations.push({
        chord: vi_root,
        type: 'Minor',
        inversion: 0,
        confidence: 80,
        reasons: [
            {
                category: 'functional_harmony',
                explanation: 'Relative minor (vi) adds emotional depth',
                commonTalk: 'Adds a touch of melancholy or thoughtfulness'
            },
            {
                category: 'common_progression',
                explanation: 'Part of the famous I-V-vi-IV "pop progression"',
                commonTalk: 'Used in countless hit songs'
            }
        ],
        songExamples: ['Someone Like You - Adele', 'Let It Be - Beatles'],
        voiceLeadingScore: calculateVoiceLeadingQuality(lastChord.notes, [vi_root + '4'])
    });

    return recommendations;
}

/**
 * Generate recommendations from subdominant
 */
function generateFromSubdominant(progression, key, lastChord) {
    const recommendations = [];
    const keyIndex = ALL_NOTES.indexOf(key);

    // V - Dominant (natural progression)
    const V_root = ALL_NOTES[(keyIndex + 7) % 12];
    recommendations.push({
        chord: V_root,
        type: 'Major',
        inversion: 0,
        confidence: 95,
        reasons: [
            {
                category: 'functional_harmony',
                explanation: 'Classic subdominant to dominant motion (IV→V)',
                commonTalk: 'Building even more tension before going home'
            },
            {
                category: 'voice_leading',
                explanation: 'Smooth voice leading with minimal movement',
                commonTalk: 'Flows naturally from the previous chord'
            }
        ],
        songExamples: ['Every major pop song', 'The Beatles - Hey Jude'],
        voiceLeadingScore: calculateVoiceLeadingQuality(lastChord.notes, [V_root + '4'])
    });

    // I - Tonic (plagal cadence)
    const I_root = key;
    recommendations.push({
        chord: I_root,
        type: 'Major',
        inversion: 0,
        confidence: 75,
        reasons: [
            {
                category: 'functional_harmony',
                explanation: 'Plagal cadence (IV→I) - the "Amen" ending',
                commonTalk: 'Gentle, soft resolution back home'
            }
        ],
        songExamples: ['Amen', 'Let It Be - Beatles ending'],
        voiceLeadingScore: calculateVoiceLeadingQuality(lastChord.notes, [I_root + '4'])
    });

    return recommendations;
}

/**
 * Generate recommendations from dominant
 */
function generateFromDominant(progression, key, lastChord) {
    const recommendations = [];
    const keyIndex = ALL_NOTES.indexOf(key);

    // I - Tonic (perfect authentic cadence)
    const I_root = key;
    recommendations.push({
        chord: I_root,
        type: 'Major',
        inversion: 0,
        confidence: 95,
        reasons: [
            {
                category: 'functional_harmony',
                explanation: 'Perfect authentic cadence (V→I) - strongest resolution in music',
                commonTalk: 'Coming home - the most satisfying resolution'
            },
            {
                category: 'expectation',
                explanation: 'The dominant chord creates strong expectation for tonic',
                commonTalk: 'This is what your ear expects and wants to hear'
            }
        ],
        songExamples: ['Almost every song ends this way'],
        voiceLeadingScore: calculateVoiceLeadingQuality(lastChord.notes, [I_root + '4'])
    });

    // vi - Relative minor (deceptive cadence)
    const vi_root = ALL_NOTES[(keyIndex + 9) % 12];
    recommendations.push({
        chord: vi_root,
        type: 'Minor',
        inversion: 0,
        confidence: 70,
        reasons: [
            {
                category: 'functional_harmony',
                explanation: 'Deceptive cadence (V→vi) - surprises the listener',
                commonTalk: 'Fakes out the ear - creates emotional surprise'
            },
            {
                category: 'songwriting',
                explanation: 'Delays resolution, keeping the song interesting',
                commonTalk: 'Keeps things interesting instead of ending too soon'
            }
        ],
        songExamples: ['God Only Knows - Beach Boys', 'Creep - Radiohead'],
        voiceLeadingScore: calculateVoiceLeadingQuality(lastChord.notes, [vi_root + '4'])
    });

    return recommendations;
}

/**
 * Analyze current progression
 * @param {Array} progression - Current chord progression
 * @param {string} key - Current key
 * @returns {Object} Analysis object
 */
export function analyzeProgression(progression, key) {
    if (!progression || progression.length === 0) {
        return {
            romanNumerals: [],
            functions: [],
            commonName: null,
            mood: 'Neutral',
            complexity: 0,
            voiceLeadingQuality: 100,
            similarSongs: []
        };
    }

    // Convert to Roman numerals
    const romanNumerals = progression.map(chord => {
        const degree = getScaleDegree(chord.root, key);
        if (!degree) return '?';
        const isMinor = chord.type === 'Minor' || chord.type === 'Diminished';
        return getRomanNumeral(degree, isMinor);
    });

    // Get harmonic functions
    const functions = progression.map(chord => {
        const degree = getScaleDegree(chord.root, key);
        return degree ? getHarmonicFunction(degree) : null;
    }).filter(f => f !== null);

    // Check for common progressions
    let commonName = null;
    let similarSongs = [];

    for (const [key, pattern] of Object.entries(COMMON_PROGRESSIONS)) {
        if (romanNumerals.join('-') === pattern.pattern.join('-')) {
            commonName = pattern.name;
            similarSongs = pattern.examples;
            break;
        }
    }

    // Calculate average voice leading quality
    let totalVLQuality = 0;
    for (let i = 0; i < progression.length - 1; i++) {
        totalVLQuality += calculateVoiceLeadingQuality(
            progression[i].notes,
            progression[i + 1].notes
        );
    }
    const voiceLeadingQuality = progression.length > 1
        ? Math.round(totalVLQuality / (progression.length - 1))
        : 100;

    // Determine mood
    const minorCount = progression.filter(c => c.type === 'Minor').length;
    const majorCount = progression.filter(c => c.type === 'Major').length;
    let mood = 'Neutral';
    if (majorCount > minorCount * 1.5) mood = 'Uplifting';
    else if (minorCount > majorCount * 1.5) mood = 'Melancholic';
    else if (majorCount > minorCount) mood = 'Positive';
    else mood = 'Thoughtful';

    // Calculate complexity (0-5 stars)
    let complexity = 1;
    if (progression.length > 4) complexity++;
    if (progression.some(c => c.type.includes('7'))) complexity++;
    if (progression.some(c => c.inversion > 0)) complexity++;
    if (voiceLeadingQuality < 60) complexity++;
    complexity = Math.min(5, complexity);

    return {
        romanNumerals,
        functions,
        commonName,
        mood,
        complexity,
        voiceLeadingQuality,
        similarSongs
    };
}
