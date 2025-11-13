/**
 * Unified Chord Suggestion System
 * Provides consistent chord recommendations across Chord Builder and Progression Builder
 */

import { CHORD_DEFINITIONS, ALL_NOTES } from '../../data/music-data.js';
import { getInvertedChordNotes, noteToMidi } from '../utils/noteUtils.js';

/**
 * Musical styles for suggestion filtering
 */
export const SUGGESTION_STYLES = [
    { id: 'balanced', label: 'Balanced Blend', description: 'Mix of common and interesting progressions' },
    { id: 'pop', label: 'Top 40 / Pop', description: 'Radio-friendly, catchy progressions' },
    { id: 'jazz', label: 'Jazz / Complex', description: 'Sophisticated harmony with extensions' },
    { id: 'classical', label: 'Classical / Traditional', description: 'Time-tested voice leading' },
    { id: 'rock', label: 'Rock / Power', description: 'Strong, driving progressions' },
    { id: 'indie', label: 'Indie / Alternative', description: 'Unexpected, creative choices' }
];

/**
 * Intended moods for suggestion filtering
 */
export const SUGGESTION_MOODS = [
    { id: 'bright', label: '😊 Happy / Bright', description: 'Uplifting and positive' },
    { id: 'dark', label: '😔 Melancholic / Dark', description: 'Somber and introspective' },
    { id: 'jazzy', label: '🎷 Jazzy / Complex', description: 'Sophisticated and colorful' },
    { id: 'tense', label: '⚡ Tense / Dramatic', description: 'Suspenseful and intense' },
    { id: 'calm', label: '😌 Calm / Peaceful', description: 'Relaxed and serene' },
    { id: 'energetic', label: '⚡ Energetic / Driving', description: 'Active and forward-moving' }
];

/**
 * Generate chord suggestions based on current chord, style, and mood
 * @param {string} currentChordType - The current chord type (e.g., 'Major', 'Minor')
 * @param {string} currentRoot - The current chord root note
 * @param {string} style - Musical style preference
 * @param {string} mood - Intended mood
 * @param {number} currentInversion - Current inversion (optional, defaults to 0)
 * @returns {Array<{nextChord:string, nextRoot:string, nextInversion:number, reason:string, confidence:number}>}
 */
export function generateUnifiedChordSuggestions(currentChordType, currentRoot, style = 'balanced', mood = 'bright', currentInversion = 0) {
    const suggestions = [];

    // Base suggestions by chord quality and mood
    const baseSuggestions = getBaseSuggestions(currentChordType, mood);

    // Apply style filtering
    const styledSuggestions = applyStyleFilter(baseSuggestions, style);

    // For each chord type, find multiple good inversion options
    styledSuggestions.forEach(sug => {
        const inversionOptions = scoredInversionOptions(currentChordType, currentRoot, currentInversion, sug.nextChord);

        // Add top 2-3 inversions of each chord type as separate suggestions
        inversionOptions.slice(0, 3).forEach((invOption, index) => {
            suggestions.push({
                nextChord: sug.nextChord,
                nextRoot: currentRoot,
                nextInversion: invOption.inversion,
                reason: index === 0 ? sug.reason : `${sug.reason} (${invOption.quality})`,
                confidence: Math.max(60, (sug.confidence || 85) - (index * 10) + invOption.score)
            });
        });
    });

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    // Return top 8-10 suggestions (more variety!)
    return suggestions.slice(0, 10);
}

/**
 * Get base suggestions based on chord type and mood
 */
function getBaseSuggestions(currentChordType, mood) {
    const suggestions = [];

    if (mood === 'bright') {
        switch (currentChordType) {
            case 'Major':
                suggestions.push({ nextChord: 'Major 7th', reason: 'Jazzy and bright extension of the major triad', confidence: 90 });
                suggestions.push({ nextChord: 'Dominant 7th', reason: 'Creates uplifting forward motion', confidence: 85 });
                suggestions.push({ nextChord: 'Add9', reason: 'Modern, open sound that adds color', confidence: 80 });
                suggestions.push({ nextChord: 'Major 6th', reason: 'Sweet, retro feel with stable resolution', confidence: 75 });
                break;
            case 'Minor':
                suggestions.push({ nextChord: 'Major', reason: 'Brightens the mood with major quality', confidence: 90 });
                suggestions.push({ nextChord: 'Major 7th', reason: 'Lifts into major with jazz color', confidence: 85 });
                suggestions.push({ nextChord: 'Add9', reason: 'Opens up the sound while maintaining major tonality', confidence: 80 });
                break;
            case 'Dominant 7th':
                suggestions.push({ nextChord: 'Major', reason: 'Classic resolution that feels complete', confidence: 95 });
                suggestions.push({ nextChord: 'Major 7th', reason: 'Jazzy resolution with added sophistication', confidence: 85 });
                break;
            default:
                suggestions.push({ nextChord: 'Major', reason: 'Bright and stable', confidence: 80 });
                suggestions.push({ nextChord: 'Add9', reason: 'Modern and colorful', confidence: 75 });
        }
    } else if (mood === 'dark') {
        switch (currentChordType) {
            case 'Major':
                suggestions.push({ nextChord: 'Minor', reason: 'Shifts to darker, more introspective territory', confidence: 90 });
                suggestions.push({ nextChord: 'Minor 7th', reason: 'Adds melancholic depth', confidence: 85 });
                suggestions.push({ nextChord: 'Diminished', reason: 'Creates tension and unease', confidence: 75 });
                break;
            case 'Minor':
                suggestions.push({ nextChord: 'Minor 7th', reason: 'Deepens the melancholic feel', confidence: 90 });
                suggestions.push({ nextChord: 'Diminished', reason: 'Adds dramatic tension', confidence: 85 });
                suggestions.push({ nextChord: 'Half Diminished 7th', reason: 'Jazz-inflected darkness', confidence: 80 });
                break;
            case 'Dominant 7th':
                suggestions.push({ nextChord: 'Minor', reason: 'Resolves with a darker, somber quality', confidence: 90 });
                suggestions.push({ nextChord: 'Minor 7th', reason: 'Adds depth to minor resolution', confidence: 85 });
                break;
            default:
                suggestions.push({ nextChord: 'Minor', reason: 'Dark and introspective', confidence: 80 });
                suggestions.push({ nextChord: 'Minor 7th', reason: 'Melancholic depth', confidence: 75 });
        }
    } else if (mood === 'jazzy') {
        switch (currentChordType) {
            case 'Major':
                suggestions.push({ nextChord: 'Major 7th', reason: 'Classic jazz color', confidence: 95 });
                suggestions.push({ nextChord: 'Major 9th', reason: 'Extended harmony for sophistication', confidence: 90 });
                suggestions.push({ nextChord: 'Dominant 7th', reason: 'Creates forward momentum', confidence: 85 });
                break;
            case 'Minor':
                suggestions.push({ nextChord: 'Minor 7th', reason: 'Essential jazz minor sound', confidence: 95 });
                suggestions.push({ nextChord: 'Minor 9th', reason: 'Lush extended minor harmony', confidence: 90 });
                suggestions.push({ nextChord: 'Half Diminished 7th', reason: 'Sophisticated jazz color', confidence: 85 });
                break;
            case 'Dominant 7th':
                suggestions.push({ nextChord: 'Major 7th', reason: 'Smooth jazz resolution', confidence: 95 });
                suggestions.push({ nextChord: 'Minor 7th', reason: 'Creates ii-V-i feel', confidence: 90 });
                suggestions.push({ nextChord: 'Dominant 7th', reason: 'Extended dominant chain', confidence: 80 });
                break;
            default:
                suggestions.push({ nextChord: 'Major 7th', reason: 'Jazz sophistication', confidence: 85 });
                suggestions.push({ nextChord: 'Dominant 7th', reason: 'Forward motion', confidence: 80 });
        }
    } else if (mood === 'tense') {
        switch (currentChordType) {
            case 'Major':
                suggestions.push({ nextChord: 'Diminished', reason: 'Creates immediate tension', confidence: 90 });
                suggestions.push({ nextChord: 'Augmented', reason: 'Unstable and suspenseful', confidence: 85 });
                suggestions.push({ nextChord: 'Dominant 7th', reason: 'Builds anticipation', confidence: 80 });
                break;
            case 'Minor':
                suggestions.push({ nextChord: 'Diminished', reason: 'Heightens dramatic tension', confidence: 90 });
                suggestions.push({ nextChord: 'Half Diminished 7th', reason: 'Unresolved and suspenseful', confidence: 85 });
                suggestions.push({ nextChord: 'Dominant 7th', reason: 'Creates urgency', confidence: 80 });
                break;
            case 'Dominant 7th':
                suggestions.push({ nextChord: 'Diminished', reason: 'Maximum tension', confidence: 90 });
                suggestions.push({ nextChord: 'Augmented', reason: 'Unstable resolution', confidence: 85 });
                suggestions.push({ nextChord: 'Dominant 7th', reason: 'Sustained tension', confidence: 80 });
                break;
            default:
                suggestions.push({ nextChord: 'Diminished', reason: 'Dramatic tension', confidence: 85 });
                suggestions.push({ nextChord: 'Dominant 7th', reason: 'Forward drive', confidence: 80 });
        }
    } else if (mood === 'calm') {
        switch (currentChordType) {
            case 'Major':
                suggestions.push({ nextChord: 'Major 7th', reason: 'Peaceful and stable', confidence: 90 });
                suggestions.push({ nextChord: 'Major 6th', reason: 'Gentle and relaxed', confidence: 85 });
                suggestions.push({ nextChord: 'Add9', reason: 'Spacious and airy', confidence: 80 });
                break;
            case 'Minor':
                suggestions.push({ nextChord: 'Minor 7th', reason: 'Soft and contemplative', confidence: 90 });
                suggestions.push({ nextChord: 'Minor 6th', reason: 'Bittersweet calm', confidence: 85 });
                suggestions.push({ nextChord: 'Major', reason: 'Gentle lift', confidence: 80 });
                break;
            default:
                suggestions.push({ nextChord: 'Major', reason: 'Stable and peaceful', confidence: 85 });
                suggestions.push({ nextChord: 'Major 7th', reason: 'Serene sophistication', confidence: 80 });
        }
    } else if (mood === 'energetic') {
        switch (currentChordType) {
            case 'Major':
                suggestions.push({ nextChord: 'Dominant 7th', reason: 'Drives forward with energy', confidence: 95 });
                suggestions.push({ nextChord: 'Major', reason: 'Maintains upbeat momentum', confidence: 85 });
                suggestions.push({ nextChord: 'Add9', reason: 'Adds color while keeping energy', confidence: 80 });
                break;
            case 'Minor':
                suggestions.push({ nextChord: 'Dominant 7th', reason: 'Creates forward thrust', confidence: 90 });
                suggestions.push({ nextChord: 'Major', reason: 'Brightens with energy', confidence: 85 });
                suggestions.push({ nextChord: 'Minor 7th', reason: 'Maintains drive', confidence: 80 });
                break;
            case 'Dominant 7th':
                suggestions.push({ nextChord: 'Major', reason: 'Powerful resolution', confidence: 95 });
                suggestions.push({ nextChord: 'Dominant 7th', reason: 'Sustained momentum', confidence: 85 });
                break;
            default:
                suggestions.push({ nextChord: 'Dominant 7th', reason: 'Forward energy', confidence: 85 });
                suggestions.push({ nextChord: 'Major', reason: 'Strong and driving', confidence: 80 });
        }
    }

    // Fallback if no suggestions
    if (suggestions.length === 0) {
        suggestions.push({ nextChord: 'Major', reason: 'Stable resolution', confidence: 70 });
        suggestions.push({ nextChord: 'Minor', reason: 'Contrasting quality', confidence: 65 });
    }

    return suggestions;
}

/**
 * Apply style filtering to adjust confidence scores
 */
function applyStyleFilter(suggestions, style) {
    return suggestions.map(sug => {
        let confidenceBonus = 0;

        if (style === 'pop') {
            // Pop favors simpler chords
            if (['Major', 'Minor', 'Dominant 7th'].includes(sug.nextChord)) {
                confidenceBonus = 10;
            }
            if (sug.nextChord.includes('9th') || sug.nextChord.includes('Diminished')) {
                confidenceBonus = -15;
            }
        } else if (style === 'jazz') {
            // Jazz favors extended chords
            if (sug.nextChord.includes('7th') || sug.nextChord.includes('9th')) {
                confidenceBonus = 15;
            }
        } else if (style === 'classical') {
            // Classical favors traditional progressions
            if (['Major', 'Minor', 'Dominant 7th', 'Diminished'].includes(sug.nextChord)) {
                confidenceBonus = 10;
            }
        } else if (style === 'rock') {
            // Rock favors power and simplicity
            if (['Major', 'Minor', 'Dominant 7th', 'Power 5th'].includes(sug.nextChord)) {
                confidenceBonus = 12;
            }
        } else if (style === 'indie') {
            // Indie favors unexpected choices
            if (sug.nextChord.includes('Add') || sug.nextChord.includes('6th') || sug.nextChord.includes('Augmented')) {
                confidenceBonus = 15;
            }
        }

        return {
            ...sug,
            confidence: Math.min(100, (sug.confidence || 75) + confidenceBonus)
        };
    });
}

/**
 * Score all inversion options based on voice leading quality
 * Returns sorted array of inversions with scores and quality descriptions
 * @param {string} currentChordType - Current chord type
 * @param {string} currentRoot - Current root note
 * @param {number} currentInversion - Current inversion
 * @param {string} nextChordType - Next chord type
 * @returns {Array<{inversion:number, score:number, quality:string}>}
 */
function scoredInversionOptions(currentChordType, currentRoot, currentInversion, nextChordType) {
    // Helper: get all notes as MIDI numbers
    const getChordMidi = (chordType, inversion) => {
        try {
            const res = getInvertedChordNotes(
                currentRoot,
                chordType,
                inversion,
                currentRoot,
                0,
                'sharp',
                'full'
            );
            return (res.specificNotes || []).map(note => noteToMidi(note));
        } catch (e) {
            return [];
        }
    };

    const currentMidi = getChordMidi(currentChordType, currentInversion);
    if (currentMidi.length === 0) return [{ inversion: 0, score: 0, quality: 'default' }];

    const def = CHORD_DEFINITIONS[nextChordType];
    if (!def) return [{ inversion: 0, score: 0, quality: 'default' }];

    const scoredInversions = [];

    // Evaluate each possible inversion
    for (let inv = 0; inv < def.intervals.length; inv++) {
        const nextMidi = getChordMidi(nextChordType, inv);
        if (nextMidi.length === 0) continue;

        let score = 0;
        let qualities = [];

        // 1. Bass movement (most important) - prefer smaller intervals
        const bassDiff = Math.abs(nextMidi[0] - currentMidi[0]);
        const bassScore = Math.max(0, 15 - bassDiff); // 0-15 points
        score += bassScore;
        if (bassDiff === 0) qualities.push('static bass');
        else if (bassDiff <= 2) qualities.push('smooth bass');
        else if (bassDiff <= 5) qualities.push('stepwise bass');

        // 2. Common tones - notes shared between chords
        const commonTones = currentMidi.filter(n1 =>
            nextMidi.some(n2 => n2 % 12 === n1 % 12)
        ).length;
        const commonToneScore = commonTones * 5; // 0-15 points (up to 3 common tones)
        score += commonToneScore;
        if (commonTones >= 2) qualities.push(`${commonTones} common tones`);

        // 3. Total voice movement - prefer minimal total movement
        const totalMovement = currentMidi.reduce((sum, curr, i) => {
            if (i >= nextMidi.length) return sum;
            const minDist = Math.min(
                ...nextMidi.map(next => Math.abs(next - curr))
            );
            return sum + minDist;
        }, 0);
        const movementScore = Math.max(0, 20 - (totalMovement / 2)); // 0-20 points
        score += movementScore;
        if (totalMovement <= 5) qualities.push('very smooth');
        else if (totalMovement <= 10) qualities.push('smooth');

        // 4. Voice range - prefer mid-range voicings
        const avgPitch = nextMidi.reduce((a, b) => a + b, 0) / nextMidi.length;
        const rangePenalty = Math.abs(avgPitch - 60); // Penalty for being far from middle C
        const rangeScore = Math.max(0, 10 - (rangePenalty / 3)); // 0-10 points
        score += rangeScore;

        // 5. Contrary motion bonus - bass and soprano moving in opposite directions
        if (currentMidi.length > 1 && nextMidi.length > 1) {
            const bassMovement = nextMidi[0] - currentMidi[0];
            const sopranoMovement = nextMidi[nextMidi.length - 1] - currentMidi[currentMidi.length - 1];
            if (bassMovement !== 0 && sopranoMovement !== 0 &&
                Math.sign(bassMovement) !== Math.sign(sopranoMovement)) {
                score += 5;
                qualities.push('contrary motion');
            }
        }

        scoredInversions.push({
            inversion: inv,
            score: Math.round(score),
            quality: qualities.length > 0 ? qualities.join(', ') : 'standard voicing',
            bassMovement: bassDiff,
            commonTones: commonTones
        });
    }

    // Sort by score (highest first)
    scoredInversions.sort((a, b) => {
        // Primary sort by score
        if (b.score !== a.score) return b.score - a.score;
        // Tie-breaker: prefer fewer bass movement
        if (a.bassMovement !== b.bassMovement) return a.bassMovement - b.bassMovement;
        // Tie-breaker: prefer more common tones
        return b.commonTones - a.commonTones;
    });

    return scoredInversions;
}

/**
 * LEGACY: Simple inversion chooser (kept for backwards compatibility)
 * Choose optimal inversion to minimize bass movement
 */
function chooseOptimalInversion(currentChordType, currentRoot, currentInversion, nextChordType) {
    const options = scoredInversionOptions(currentChordType, currentRoot, currentInversion, nextChordType);
    return options.length > 0 ? options[0].inversion : 0;
}

/**
 * Get style label by ID
 */
export function getStyleLabel(styleId) {
    const style = SUGGESTION_STYLES.find(s => s.id === styleId);
    return style ? style.label : 'Balanced Blend';
}

/**
 * Get mood label by ID
 */
export function getMoodLabel(moodId) {
    const mood = SUGGESTION_MOODS.find(m => m.id === moodId);
    return mood ? mood.label : '😊 Happy / Bright';
}
