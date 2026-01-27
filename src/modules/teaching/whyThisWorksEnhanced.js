/**
 * Why This Works 2.0 - Enhanced Explanation Panel
 * Phase 2 of Tier 1: Teaching-Composition Integration
 *
 * Features:
 * - A/B audio comparison (current chord vs suggested)
 * - Skill level toggle (beginner/intermediate/advanced)
 * - Chord notes display badge
 * - Key-aware transition explanations with note names
 * - Alternative resolutions with playback
 * - Voice leading diagrams for dominant chords
 * - Expandable detail sections
 */

import { getWhyThisWorks, SKILL_LEVEL_INFO, FUNCTION_COLORS } from '../../data/theoryExplanations/index.js';
import { getChordNotes, getInvertedChordNotes } from '../utils/noteUtils.js';
import { CHORD_DEFINITIONS } from '../../data/music-data.js';

// ============================================================================
// INVERSION DISPLAY HELPERS
// ============================================================================

/**
 * Get a superscript inversion label for display
 * @param {number} inversion - The inversion number (0 = root, 1 = 1st, etc.)
 * @returns {string} Superscript label or empty string
 */
function getInversionLabel(inversion) {
    if (!inversion || inversion === 0) return '';
    const superscripts = { 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵' };
    return superscripts[inversion] || `⁽${inversion}⁾`;
}

// ============================================================================
// SCALE DEGREE MAPPINGS FOR KEY-AWARE FEATURES
// ============================================================================

const SCALE_DEGREES_TO_ROOTS = {
    'C': { I: 'C', ii: 'D', iii: 'E', IV: 'F', V: 'G', vi: 'A', vii: 'B', bVII: 'Bb', bVI: 'Ab', bIII: 'Eb' },
    'G': { I: 'G', ii: 'A', iii: 'B', IV: 'C', V: 'D', vi: 'E', vii: 'F#', bVII: 'F', bVI: 'Eb', bIII: 'Bb' },
    'D': { I: 'D', ii: 'E', iii: 'F#', IV: 'G', V: 'A', vi: 'B', vii: 'C#', bVII: 'C', bVI: 'Bb', bIII: 'F' },
    'A': { I: 'A', ii: 'B', iii: 'C#', IV: 'D', V: 'E', vi: 'F#', vii: 'G#', bVII: 'G', bVI: 'F', bIII: 'C' },
    'E': { I: 'E', ii: 'F#', iii: 'G#', IV: 'A', V: 'B', vi: 'C#', vii: 'D#', bVII: 'D', bVI: 'C', bIII: 'G' },
    'B': { I: 'B', ii: 'C#', iii: 'D#', IV: 'E', V: 'F#', vi: 'G#', vii: 'A#', bVII: 'A', bVI: 'G', bIII: 'D' },
    'F': { I: 'F', ii: 'G', iii: 'A', IV: 'Bb', V: 'C', vi: 'D', vii: 'E', bVII: 'Eb', bVI: 'Db', bIII: 'Ab' },
    'Bb': { I: 'Bb', ii: 'C', iii: 'D', IV: 'Eb', V: 'F', vi: 'G', vii: 'A', bVII: 'Ab', bVI: 'Gb', bIII: 'Db' },
    'Eb': { I: 'Eb', ii: 'F', iii: 'G', IV: 'Ab', V: 'Bb', vi: 'C', vii: 'D', bVII: 'Db', bVI: 'Cb', bIII: 'Gb' },
    'Ab': { I: 'Ab', ii: 'Bb', iii: 'C', IV: 'Db', V: 'Eb', vi: 'F', vii: 'G', bVII: 'Gb', bVI: 'Fb', bIII: 'Cb' }
};

// ============================================================================
// STATE
// ============================================================================

let currentSkillLevel = 'simple';
let currentComparison = null;
let isPlaying = false;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the enhanced Why This Works module
 */
export function initWhyThisWorksEnhanced() {
    // Load skill level preference
    const saved = localStorage.getItem('theorySkillLevel');
    if (saved && ['simple', 'intermediate', 'advanced'].includes(saved)) {
        currentSkillLevel = saved;
    }

    // Expose global functions
    window.showEnhancedWhyThisWorks = showEnhancedWhyThisWorks;
    window.setEnhancedSkillLevel = setSkillLevel;
    window.playComparisonChord = playComparisonChord;
    window.playABComparison = playABComparison;
    window.playForwardResolution = playForwardResolution;
    window.closeEnhancedWTW = closeModal;

    // Override the standard showWhyThisWorks to use enhanced version
    // This makes all existing "Why?" buttons use the new enhanced panel
    window.showWhyThisWorks = showEnhancedWhyThisWorks;
}

// ============================================================================
// SKILL LEVEL
// ============================================================================

/**
 * Set the skill level for explanations
 * @param {string} level - 'simple', 'intermediate', or 'advanced'
 */
function setSkillLevel(level) {
    if (!['simple', 'intermediate', 'advanced'].includes(level)) return;

    currentSkillLevel = level;
    localStorage.setItem('theorySkillLevel', level);

    // Update UI if modal is open
    updateSkillLevelUI();

    // Refresh content if comparison is active
    if (currentComparison) {
        updateExplanationContent();
    }
}

/**
 * Update skill level button UI
 */
function updateSkillLevelUI() {
    ['simple', 'intermediate', 'advanced'].forEach(level => {
        const btn = document.getElementById(`ewtw-level-${level}`);
        if (btn) {
            if (level === currentSkillLevel) {
                btn.classList.remove('bg-gray-100', 'text-gray-700');
                btn.classList.add('bg-indigo-600', 'text-white');
            } else {
                btn.classList.remove('bg-indigo-600', 'text-white');
                btn.classList.add('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
            }
        }
    });
}

// ============================================================================
// AUDIO COMPARISON
// ============================================================================

/**
 * Play a single chord for comparison (with inversion support)
 * @param {string} which - 'current' or 'suggested'
 */
async function playComparisonChord(which) {
    if (!currentComparison || isPlaying) return;

    const chord = which === 'current' ? currentComparison.currentChord : currentComparison.suggestedChord;
    if (!chord || !chord.root) {
        console.warn('[WhyThisWorksEnhanced] No chord data for', which);
        if (window.showToast) {
            window.showToast('No chord data available', { type: 'warning' });
        }
        return;
    }

    isPlaying = true;
    // Pass inversion and pre-computed notes for accurate playback
    await playChord(chord.root, chord.type, 1.2, chord.inversion || 0, chord.notes);

    // Visual feedback
    const btn = document.getElementById(`ewtw-play-${which}`);
    if (btn) {
        btn.classList.add('ring-2', 'ring-indigo-400');
        setTimeout(() => {
            btn.classList.remove('ring-2', 'ring-indigo-400');
            isPlaying = false;
        }, 1200);
    } else {
        isPlaying = false;
    }
}

/**
 * Play A/B comparison (current then suggested) with inversion support
 */
async function playABComparison() {
    if (!currentComparison || isPlaying) return;

    const currentChord = currentComparison.currentChord;
    const suggestedChord = currentComparison.suggestedChord;

    // Need at least the suggested chord to play
    if (!suggestedChord || !suggestedChord.root) {
        if (window.showToast) {
            window.showToast('No chord data available for comparison', { type: 'warning' });
        }
        return;
    }

    isPlaying = true;
    const btn = document.getElementById('ewtw-play-compare');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Playing...';
    }

    // Play current chord first (if available) - with inversion support
    if (currentChord && currentChord.root) {
        await playChord(currentChord.root, currentChord.type, 1, currentChord.inversion || 0, currentChord.notes);
        // Wait for chord to finish
        await new Promise(resolve => setTimeout(resolve, 1300));
    }

    // Play suggested chord - with inversion support
    await playChord(suggestedChord.root, suggestedChord.type, 1, suggestedChord.inversion || 0, suggestedChord.notes);

    // Reset after delay (include inversions in symbols)
    setTimeout(() => {
        isPlaying = false;
        if (btn) {
            btn.disabled = false;
            const currentSymbol = getChordSymbol(currentChord?.root, currentChord?.type, currentChord?.inversion);
            const suggestedSymbol = getChordSymbol(suggestedChord.root, suggestedChord.type, suggestedChord.inversion);
            btn.innerHTML = `
                <span class="text-indigo-400">▶</span>
                <span class="text-gray-400">${currentSymbol}</span>
                <span>→</span>
                <span class="font-bold">${suggestedSymbol}</span>
            `;
        }
    }, 1200);
}

/**
 * Play forward resolution (suggested chord → next chord in progression)
 */
async function playForwardResolution() {

    if (!currentComparison) {
        console.warn('[WhyThisWorksEnhanced] No currentComparison');
        return;
    }

    // Note: Don't check isPlaying here - let playChordSequence handle it
    // to avoid race condition where we set isPlaying=true before calling
    // playChordSequence which also checks isPlaying

    const suggestedChord = currentComparison.suggestedChord;
    const nextChord = currentComparison.nextChord;


    if (!suggestedChord || !suggestedChord.root) {
        console.warn('[WhyThisWorksEnhanced] No suggested chord');
        if (window.showToast) {
            window.showToast('No chord data available', { type: 'warning' });
        }
        return;
    }

    if (!nextChord || !nextChord.root) {
        console.warn('[WhyThisWorksEnhanced] No next chord');
        if (window.showToast) {
            window.showToast('No next chord in progression', { type: 'info' });
        }
        return;
    }

    const btn = document.getElementById('ewtw-play-forward');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>Playing...</span>';
    }


    // Play suggested → next chord (pass full chord objects including inversion and notes)
    // playChordSequence handles isPlaying state internally
    await playChordSequence([
        {
            root: suggestedChord.root,
            type: suggestedChord.type,
            inversion: suggestedChord.inversion || 0,
            notes: suggestedChord.notes
        },
        {
            root: nextChord.root,
            type: nextChord.type,
            inversion: nextChord.inversion || 0,
            notes: nextChord.notes
        }
    ], 1);

    // Reset button after sequence completes (include inversion in labels)
    setTimeout(() => {
        if (btn) {
            btn.disabled = false;
            const suggestedSymbol = getChordSymbol(suggestedChord.root, suggestedChord.type, suggestedChord.inversion);
            const nextSymbol = getChordSymbol(nextChord.root, nextChord.type, nextChord.inversion);
            btn.innerHTML = `
                <span class="text-emerald-400">▶</span>
                <span class="font-bold">${suggestedSymbol}</span>
                <span>→</span>
                <span class="text-gray-400">${nextSymbol}</span>
            `;
        }
    }, 2200);
}

/**
 * Play a chord sequence with inversion support
 * @param {Array} chords - Array of {root, type, inversion?, notes?} objects
 * @param {number} chordDuration - Duration per chord in seconds
 */
async function playChordSequence(chords, chordDuration = 0.8) {
    if (!chords || chords.length === 0 || isPlaying) return;

    try {
        if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
            await Tone.start();
        }

        const piano = window.getPiano ? window.getPiano() : null;
        if (!piano || typeof Tone === 'undefined') {
            console.warn('[WhyThisWorksEnhanced] Piano or Tone.js not available');
            return;
        }

        isPlaying = true;
        const now = Tone.now();
        chords.forEach((chord, index) => {
            if (!chord.root) return;

            let notes = [];
            // Use pre-computed notes if available (respects original voicing/octave)
            if (chord.notes && chord.notes.length > 0) {
                notes = [...chord.notes];
            } else if (chord.inversion && chord.inversion > 0) {
                // Use getInvertedChordNotes for inversions
                const chordInfo = getInvertedChordNotes(chord.root, chord.type || 'Major', chord.inversion);
                notes = chordInfo?.specificNotes || [];
            } else {
                // Root position - use getChordNotes
                const chordInfo = getChordNotes(chord.root, chord.type || 'Major');
                notes = chordInfo?.specificNotes || [];
            }

            if (notes.length > 0) {
                piano.triggerAttackRelease(notes, chordDuration * 0.9, now + (index * chordDuration));
            }
        });

        // Reset playing state after sequence completes
        setTimeout(() => {
            isPlaying = false;
        }, chords.length * chordDuration * 1000 + 200);
    } catch (err) {
        console.error('[WhyThisWorksEnhanced] Error playing sequence:', err);
        isPlaying = false;
    }
}

/**
 * Play a chord using Tone.js with inversion support
 * @param {string} root - Chord root
 * @param {string} type - Chord type
 * @param {number} duration - Duration in seconds
 * @param {number} [inversion=0] - Inversion (0 = root position)
 * @param {Array} [precomputedNotes=null] - Pre-computed notes if available
 */
async function playChord(root, type, duration = 1, inversion = 0, precomputedNotes = null) {
    if (!root) {
        console.warn('[WhyThisWorksEnhanced] No root note provided');
        return;
    }

    try {
        // Ensure audio context is started
        if (typeof Tone !== 'undefined' && Tone.context.state !== 'running') {
            await Tone.start();
        }

        let notes = [];
        // Use pre-computed notes if available (respects original voicing/octave)
        if (precomputedNotes && precomputedNotes.length > 0) {
            notes = [...precomputedNotes];
        } else if (inversion && inversion > 0) {
            // Use getInvertedChordNotes for inversions
            const chordInfo = getInvertedChordNotes(root, type || 'Major', inversion);
            notes = chordInfo?.specificNotes || [];
        } else {
            // Root position
            const chordInfo = getChordNotes(root, type || 'Major');
            notes = chordInfo?.specificNotes || [];
        }


        if (notes.length === 0) {
            console.warn('[WhyThisWorksEnhanced] No notes found for chord');
            return;
        }

        const piano = window.getPiano ? window.getPiano() : null;
        if (piano && typeof Tone !== 'undefined') {
            const now = Tone.now();
            piano.triggerAttackRelease(notes, duration, now);
        } else {
            console.warn('[WhyThisWorksEnhanced] Piano or Tone.js not available');
        }
    } catch (err) {
        console.error('[WhyThisWorksEnhanced] Error playing chord:', err);
    }
}

// ============================================================================
// KEY-AWARE HELPERS
// ============================================================================

/**
 * Get chord note names for display (without octave numbers)
 * @param {string} root - Chord root
 * @param {string} type - Chord type
 * @returns {Array} Array of note names
 */
function getChordNoteNames(root, type) {
    const chordInfo = getChordNotes(root, type);
    if (!chordInfo?.specificNotes) return [];
    // Strip octave numbers and sanitize double sharps/flats for display
    return chordInfo.specificNotes.map(n => {
        const noteWithoutOctave = n.replace(/[0-9]/g, '');
        return sanitizeNoteName(noteWithoutOctave);
    });
}

/**
 * Get alternative chord resolutions with playback data
 * @param {string} romanNumeral - Current chord's roman numeral
 * @param {string} key - Current key
 * @param {Object} prevChordData - Previous chord data (includes inversion and notes)
 * @returns {Array} Alternative resolution suggestions
 */
function getAlternativeResolutions(romanNumeral, key, prevChordData) {
    const keyRoot = key?.replace('m', '') || 'C';
    const isMinorKey = key?.includes('m');
    const degrees = SCALE_DEGREES_TO_ROOTS[keyRoot] || SCALE_DEGREES_TO_ROOTS['C'];
    const alternatives = [];
    const baseNumeral = romanNumeral?.replace(/[0-9majø°]+$/gi, '');

    if (!prevChordData) return alternatives;

    // Include inversion and notes from prevChordData for accurate playback
    const prevRoot = prevChordData.root;
    const prevType = prevChordData.type;
    const prevInversion = prevChordData.inversion || 0;
    const prevNotes = prevChordData.notes;

    // Helper to create fromChord with full data
    const makeFromChord = () => ({
        root: prevRoot,
        type: prevType,
        inversion: prevInversion,
        notes: prevNotes
    });

    // Alternative toChords are typically root position (inversion: 0)
    // Different alternatives based on what chord we're explaining
    if (baseNumeral === 'I' || baseNumeral === 'i') {
        alternatives.push({
            numeral: 'vi',
            description: 'A "surprise" ending (deceptive cadence)',
            fromChord: makeFromChord(),
            toChord: { root: degrees.vi, type: 'Minor', inversion: 0 }
        });
        alternatives.push({
            numeral: 'IV',
            description: 'Goes somewhere unexpected',
            fromChord: makeFromChord(),
            toChord: { root: degrees.IV, type: 'Major', inversion: 0 }
        });
    } else if (baseNumeral === 'V' || baseNumeral === 'v') {
        alternatives.push({
            numeral: 'V7',
            description: 'Add the 7th for stronger pull',
            fromChord: makeFromChord(),
            toChord: { root: degrees.V, type: 'Dominant 7th', inversion: 0 }
        });
        alternatives.push({
            numeral: 'vii°',
            description: 'Darker, more intense tension',
            fromChord: makeFromChord(),
            toChord: { root: degrees.vii, type: 'Diminished', inversion: 0 }
        });
    } else if (baseNumeral === 'IV') {
        alternatives.push({
            numeral: 'ii',
            description: 'Smoother, more sophisticated',
            fromChord: makeFromChord(),
            toChord: { root: degrees.ii, type: 'Minor', inversion: 0 }
        });
        alternatives.push({
            numeral: 'iv',
            description: 'Borrowed minor - adds emotion',
            fromChord: makeFromChord(),
            toChord: { root: degrees.IV, type: 'Minor', inversion: 0 }
        });
    } else if (baseNumeral === 'ii') {
        alternatives.push({
            numeral: 'IV',
            description: 'Brighter subdominant option',
            fromChord: makeFromChord(),
            toChord: { root: degrees.IV, type: 'Major', inversion: 0 }
        });
    } else if (baseNumeral === 'vi') {
        alternatives.push({
            numeral: 'IV',
            description: 'Brighter, more open feel',
            fromChord: makeFromChord(),
            toChord: { root: degrees.IV, type: 'Major', inversion: 0 }
        });
    }

    return alternatives.slice(0, 3);
}

/**
 * Get chord display with symbol (e.g., "Dm7", "Cmaj7", "G7¹")
 * @param {string} root - Chord root
 * @param {string} type - Chord type
 * @param {number} [inversion=0] - Inversion number (0 = root position)
 * @returns {string} Display string with symbol and inversion superscript
 */
function getChordSymbol(root, type, inversion = 0) {
    if (!root) return '';

    let symbol = root;
    if (type && type !== 'Major') {
        const chordDef = CHORD_DEFINITIONS[type];
        if (chordDef?.symbol) {
            symbol = `${root}${chordDef.symbol}`;
        } else {
            // Manual fallback for common types
            const typeSymbols = {
                'Minor': 'm',
                'Diminished': '°',
                'Augmented': '+',
                'Dominant 7th': '7',
                'Major 7th': 'maj7',
                'Minor 7th': 'm7',
                'Diminished 7th': '°7',
                'Half Diminished 7th': 'ø7',
                'Augmented 7th': '+7',
                'Minor Major 7th': 'mMaj7',
                'Suspended 2nd': 'sus2',
                'Suspended 4th': 'sus4',
                'Add 9': 'add9'
            };
            symbol = `${root}${typeSymbols[type] || ''}`;
        }
    }

    // Append inversion superscript if not root position
    return symbol + getInversionLabel(inversion);
}

/**
 * Sanitize note name to avoid double sharps/flats
 * Converts F## to G, Cb to B, etc.
 * @param {string} note - Note name potentially with double accidentals
 * @returns {string} Sanitized note name
 */
function sanitizeNoteName(note) {
    if (!note) return note;

    // Handle double sharps
    if (note.includes('##')) {
        const base = note.replace('##', '');
        const noteOrder = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const idx = noteOrder.indexOf(base.charAt(0));
        if (idx !== -1) {
            // Move up one whole step (two semitones)
            const newIdx = (idx + 1) % 7;
            // Handle special cases (E## = G, B## = D)
            if (base.charAt(0) === 'E' || base.charAt(0) === 'B') {
                return noteOrder[newIdx] + '#' + note.slice(base.length);
            }
            return noteOrder[newIdx] + note.slice(base.length);
        }
    }

    // Handle double flats
    if (note.includes('bb')) {
        const base = note.replace('bb', '');
        const noteOrder = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const idx = noteOrder.indexOf(base.charAt(0));
        if (idx !== -1) {
            const newIdx = (idx - 1 + 7) % 7;
            // Handle special cases (Fbb = Eb, Cbb = Bb)
            if (base.charAt(0) === 'F' || base.charAt(0) === 'C') {
                return noteOrder[newIdx] + 'b' + note.slice(base.length);
            }
            return noteOrder[newIdx] + note.slice(base.length);
        }
    }

    return note;
}

// ============================================================================
// MAIN DISPLAY
// ============================================================================

/**
 * Show the enhanced Why This Works modal
 * Supports both new format and legacy format from UnifiedRecommendationModal
 *
 * New format:
 * @param {Object} options.currentChord - Current/previous chord {root, type, roman}
 * @param {Object} options.suggestedChord - Suggested chord {root, type, roman}
 * @param {Object} options.nextChord - Next chord in progression {root, type, roman}
 * @param {string} options.key - Musical key
 * @param {string} options.reason - Short reason text
 * @param {Array} options.reasons - Detailed reasons array
 * @param {Object} options.scores - Score breakdown
 *
 * Legacy format (from UnifiedRecommendationModal):
 * @param {string} options.romanNumeral - Roman numeral of suggested chord
 * @param {string} options.chord - Spelled chord name (e.g., "Cmaj")
 * @param {string} options.type - Chord type
 * @param {string} options.reason - Reason text
 * @param {string} options.key - Current key
 * @param {string} options.root - Root note
 * @param {string} options.prevChord - Previous chord roman numeral
 * @param {Object} options.prevChordData - Previous chord data
 * @param {Object} options.nextChordData - Next chord data {root, type, roman}
 */
function showEnhancedWhyThisWorks(options) {
    // Transform legacy format to new format
    let currentChord, suggestedChord, nextChord, key, reason, reasons, scores;

    if (options.romanNumeral !== undefined) {
        // Legacy format from UnifiedRecommendationModal
        // IMPORTANT: Always capture inversion data for accurate playback and display
        suggestedChord = {
            root: options.root || options.chord?.replace(/[^A-G#b]/g, '') || '',
            type: options.type || 'Major',
            roman: options.romanNumeral,
            inversion: options.inversion || 0,
            notes: options.notes || null  // Pre-computed notes if available
        };
        currentChord = options.prevChordData ? {
            root: options.prevChordData.root,
            type: options.prevChordData.type || 'Major',
            roman: options.prevChord,
            inversion: options.prevChordData.inversion || 0,
            notes: options.prevChordData.notes || null
        } : null;
        nextChord = options.nextChordData ? {
            root: options.nextChordData.root,
            type: options.nextChordData.type || 'Major',
            roman: options.nextChordData.roman,
            inversion: options.nextChordData.inversion || 0,
            notes: options.nextChordData.notes || null
        } : null;
        key = options.key;
        reason = options.reason;
        reasons = options.reasons || [];
        scores = options.scores || null;
    } else {
        // New format - ensure inversion is captured
        currentChord = options.currentChord ? {
            ...options.currentChord,
            inversion: options.currentChord.inversion || 0
        } : null;
        suggestedChord = options.suggestedChord ? {
            ...options.suggestedChord,
            inversion: options.suggestedChord.inversion || 0
        } : null;
        nextChord = options.nextChord ? {
            ...options.nextChord,
            inversion: options.nextChord.inversion || 0
        } : null;
        key = options.key;
        reason = options.reason;
        reasons = options.reasons || [];
        scores = options.scores || null;
    }

    // Remove existing modal FIRST (before setting new comparison data)
    const existingModal = document.getElementById('enhanced-wtw-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Now set the new comparison data
    currentComparison = {
        currentChord,
        suggestedChord,
        nextChord,
        key,
        reason,
        reasons,
        scores
    };

    // Build explanation using BOTH sources:
    // 1. Theory database provides skill-level-aware explanations (simple/intermediate/advanced)
    // 2. Recommendation engine provides context-specific reason as supplementary info
    //
    // Note: Simple-level theory explanations may use example notes (e.g., "D major in C")
    // but intermediate/advanced levels use Roman numerals which are key-agnostic
    let explanation = {
        title: suggestedChord?.roman || 'Chord',
        explanation: 'This chord works well in this context.',
        function: 'unknown',
        contextReason: reason || null  // Store engine's reason for additional context
    };

    // Get skill-level-specific explanation from theory database
    // Pass the key for context-aware chord name substitution
    try {
        const theoryInfo = getWhyThisWorks(
            suggestedChord?.roman,
            currentChord?.roman,
            null,
            currentSkillLevel,
            key  // Pass key for chord name substitution
        );
        if (theoryInfo) {
            // Use theory database content - it has different content per skill level
            if (theoryInfo.explanation) {
                explanation.explanation = theoryInfo.explanation;
            }
            explanation.title = theoryInfo.title || explanation.title;
            explanation.function = theoryInfo.function || explanation.function;
            explanation.color = theoryInfo.color;
            explanation.feeling = theoryInfo.feeling;
            explanation.whenToUse = theoryInfo.whenToUse;
            if (theoryInfo.contextualInfo && currentChord?.roman) {
                explanation.contextualInfo = theoryInfo.contextualInfo;
            }
        } else if (reason) {
            // No theory entry for this chord, fall back to engine's reason
            explanation.explanation = reason;
        }
    } catch (err) {
        if (reason) {
            explanation.explanation = reason;
        }
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'enhanced-wtw-modal';
    modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-4';
    // Pass the normalized currentComparison, not the raw options
    modal.innerHTML = createModalHTML(explanation, currentComparison);

    // Add styles
    addStyles();

    // Add to DOM
    document.body.appendChild(modal);

    // Setup event listeners
    setupModalEvents();

    // Update skill level UI
    updateSkillLevelUI();
}

/**
 * Create the modal HTML
 */
function createModalHTML(explanation, comparisonData) {
    const { currentChord, suggestedChord, nextChord, key, reasons, scores } = comparisonData;

    const currentDisplay = getChordDisplay(currentChord);
    const suggestedDisplay = getChordDisplay(suggestedChord);
    // Include inversion in chord symbols for accurate display
    const currentSymbol = currentChord ? getChordSymbol(currentChord.root, currentChord.type, currentChord.inversion) : '';
    const suggestedSymbol = suggestedChord ? getChordSymbol(suggestedChord.root, suggestedChord.type, suggestedChord.inversion) : '';
    const nextSymbol = nextChord ? getChordSymbol(nextChord.root, nextChord.type, nextChord.inversion) : '';
    const hasCurrentChord = currentChord && currentChord.root;
    const hasNextChord = nextChord && nextChord.root;
    const functionColor = explanation.color || FUNCTION_COLORS[explanation.function] || '#6366f1';

    return `
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="window.closeEnhancedWTW()"></div>

        <!-- Modal Content -->
        <div class="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden" onclick="event.stopPropagation()">
            <!-- Header -->
            <div class="px-6 py-4 border-b bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-xl font-bold">Why This Works</h2>
                        <p class="text-sm text-white/80">Understanding ${suggestedSymbol || suggestedDisplay} in ${key}</p>
                    </div>
                    <button onclick="window.closeEnhancedWTW()" class="p-2 hover:bg-white/20 rounded-lg transition">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Scrollable Content -->
            <div class="overflow-y-auto max-h-[calc(90vh-180px)] p-6 space-y-5">

                <!-- Hear It Section - Well Organized -->
                <div class="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200">
                    <h3 class="text-sm font-bold text-indigo-800 mb-3 flex items-center gap-2">
                        <span>🎵</span> Hear It
                    </h3>

                    <!-- Play just the suggested chord -->
                    <div class="mb-3">
                        <div class="text-xs text-gray-500 mb-1">Play this chord:</div>
                        <button id="ewtw-play-suggested"
                                class="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium text-white transition flex items-center justify-center gap-2 cursor-pointer">
                            <span>▶</span> ${suggestedSymbol || suggestedDisplay}
                        </button>
                    </div>

                    <!-- Context playback - side by side -->
                    ${hasCurrentChord || hasNextChord ? `
                    <div class="text-xs text-gray-500 mb-1">Hear in context:</div>
                    <div class="flex gap-2">
                        ${hasCurrentChord ? `
                        <button id="ewtw-play-compare"
                                class="flex-1 px-3 py-2 bg-white border-2 border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 rounded-lg text-xs font-medium text-indigo-700 transition flex items-center justify-center gap-1 cursor-pointer"
                                title="How we got here">
                            <span class="text-indigo-400">▶</span>
                            <span class="text-gray-400">${currentSymbol}</span>
                            <span>→</span>
                            <span class="font-bold">${suggestedSymbol}</span>
                        </button>
                        ` : ''}
                        ${hasNextChord ? `
                        <button id="ewtw-play-forward"
                                class="flex-1 px-3 py-2 bg-white border-2 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 rounded-lg text-xs font-medium text-emerald-700 transition flex items-center justify-center gap-1 cursor-pointer"
                                title="Where it leads">
                            <span class="text-emerald-400">▶</span>
                            <span class="font-bold">${suggestedSymbol}</span>
                            <span>→</span>
                            <span class="text-gray-400">${nextSymbol}</span>
                        </button>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>

                <!-- Skill Level Toggle -->
                <div class="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <span class="text-sm font-medium text-gray-600">Explanation Level:</span>
                    <div class="flex gap-1">
                        <button id="ewtw-level-simple" onclick="window.setEnhancedSkillLevel('simple')"
                                class="px-3 py-1.5 text-xs font-medium rounded-lg transition ${currentSkillLevel === 'simple' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                            Beginner
                        </button>
                        <button id="ewtw-level-intermediate" onclick="window.setEnhancedSkillLevel('intermediate')"
                                class="px-3 py-1.5 text-xs font-medium rounded-lg transition ${currentSkillLevel === 'intermediate' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                            Intermediate
                        </button>
                        <button id="ewtw-level-advanced" onclick="window.setEnhancedSkillLevel('advanced')"
                                class="px-3 py-1.5 text-xs font-medium rounded-lg transition ${currentSkillLevel === 'advanced' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
                            Advanced
                        </button>
                    </div>
                </div>

                <!-- Main Explanation -->
                <div id="ewtw-explanation-content">
                    ${buildExplanationContent(explanation, comparisonData)}
                </div>

                <!-- Score Breakdown (if available) -->
                ${scores ? buildScoreBreakdown(scores) : ''}

                <!-- Detailed Reasons (if available) -->
                ${reasons && reasons.length > 0 ? buildDetailedReasons(reasons) : ''}

            </div>

            <!-- Footer -->
            <div class="px-6 py-3 bg-gray-50 border-t flex items-center justify-between">
                <button onclick="window.closeEnhancedWTW()" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">
                    Close
                </button>
                <button onclick="window.closeEnhancedWTW()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition">
                    Got It!
                </button>
            </div>
        </div>
    `;
}

/**
 * Build the main explanation content
 */
function buildExplanationContent(explanation, comparisonData) {
    const functionColor = explanation.color || FUNCTION_COLORS[explanation.function] || '#6366f1';
    const functionName = getFunctionName(explanation.function);
    const { suggestedChord, currentChord, key } = comparisonData || {};

    // Get chord notes for display
    const chordNotes = suggestedChord?.root
        ? getChordNoteNames(suggestedChord.root, suggestedChord.type || 'Major')
        : [];

    // Detect if this is a dominant chord (for voice leading display)
    const baseNumeral = suggestedChord?.roman?.replace(/[0-9majø°]+$/gi, '') || '';
    const isDominant = explanation.function === 'dominant' ||
        ['V', 'v', 'VII', 'vii'].includes(baseNumeral);

    // Get key info for voice leading
    const keyRoot = key?.replace('m', '') || 'C';
    const isMinorKey = key?.includes('m');
    const tonicType = isMinorKey ? 'Minor' : 'Major';
    const tonicNotes = getChordNoteNames(keyRoot, tonicType);

    // Get alternative resolutions - pass full chord data including inversion and notes
    const alternatives = getAlternativeResolutions(
        suggestedChord?.roman,
        key,
        currentChord ? {
            root: currentChord.root,
            type: currentChord.type,
            inversion: currentChord.inversion || 0,
            notes: currentChord.notes
        } : null
    );

    return `
        <!-- Function Badge -->
        <div class="flex items-center gap-2 mb-3">
            <span class="px-3 py-1 rounded-full text-sm font-medium text-white" style="background: ${functionColor}">
                ${explanation.title || comparisonData?.suggestedChord?.roman || 'Chord'}
            </span>
            ${functionName ? `<span class="text-sm text-gray-500">· ${functionName} function</span>` : ''}
        </div>

        <!-- Chord Notes Display Badge -->
        ${chordNotes.length > 0 ? `
            <div class="mb-4 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-50 to-blue-50 rounded-xl border border-sky-200">
                <span class="text-sm font-medium text-sky-700">Notes:</span>
                <span class="font-bold text-sky-900 tracking-wider">${chordNotes.join(' – ')}</span>
            </div>
        ` : ''}

        <!-- Main Explanation -->
        <div class="prose prose-sm max-w-none">
            <p class="text-gray-700 leading-relaxed">${explanation.explanation || comparisonData?.reason || 'This chord works well in this context.'}</p>
        </div>

        <!-- Contextual Info (if transitioning from previous chord) -->
        ${explanation.contextualInfo ? `
            <div class="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 class="text-sm font-bold text-blue-800 mb-1 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                    The Transition
                </h4>
                <p class="text-sm text-blue-700">${explanation.contextualInfo}</p>
            </div>
        ` : ''}

        <!-- Voice Leading Diagram (for dominant chords) -->
        ${isDominant && chordNotes.length >= 3 && tonicNotes.length >= 2 ? `
            <div class="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <h4 class="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
                    <span>↗️</span> Voice Leading
                </h4>
                <div class="font-mono text-sm text-amber-900 space-y-1">
                    <div>${chordNotes[1] || 'Leading tone'} → ${tonicNotes[0] || keyRoot} <span class="text-amber-600 text-xs">(leading tone resolves UP)</span></div>
                    ${chordNotes[3] ? `<div>${chordNotes[3]} → ${tonicNotes[1] || ''} <span class="text-amber-600 text-xs">(7th resolves DOWN)</span></div>` : ''}
                    <div>${chordNotes[0]} → ${keyRoot} <span class="text-amber-600 text-xs">(root to tonic)</span></div>
                </div>
            </div>
        ` : ''}

        <!-- Feeling/Mood -->
        ${explanation.feeling ? `
            <div class="mt-3 flex items-center gap-2 text-sm">
                <span class="text-gray-500">Feeling:</span>
                <span class="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">${explanation.feeling}</span>
            </div>
        ` : ''}

        <!-- When to Use -->
        ${explanation.whenToUse ? `
            <div class="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <h4 class="text-sm font-bold text-emerald-800 mb-1">💡 When to Use</h4>
                <p class="text-sm text-emerald-700">${explanation.whenToUse}</p>
            </div>
        ` : ''}

        <!-- Try These Alternatives -->
        ${alternatives.length > 0 ? `
            <div class="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <h4 class="text-sm font-bold text-orange-800 mb-2 flex items-center gap-2">
                    <span>🎵</span> Try These Alternatives
                </h4>
                <div class="space-y-2" id="ewtw-alternatives">
                    ${alternatives.map((alt, idx) => {
                        // Include inversions in chord symbols
                        const toChordSymbol = getChordSymbol(alt.toChord?.root, alt.toChord?.type, alt.toChord?.inversion);
                        const fromChordSymbol = getChordSymbol(alt.fromChord?.root, alt.fromChord?.type, alt.fromChord?.inversion);
                        return `
                            <button class="ewtw-alt-btn w-full flex items-center gap-3 px-3 py-2 bg-white/80 hover:bg-white border border-orange-200 hover:border-orange-400 rounded-lg text-left transition"
                                    data-from-root="${alt.fromChord?.root || ''}"
                                    data-from-type="${alt.fromChord?.type || 'Major'}"
                                    data-from-inversion="${alt.fromChord?.inversion || 0}"
                                    data-to-root="${alt.toChord?.root || ''}"
                                    data-to-type="${alt.toChord?.type || 'Major'}"
                                    data-to-inversion="${alt.toChord?.inversion || 0}">
                                <span class="text-orange-500">▶</span>
                                <span class="font-medium text-orange-800 min-w-[80px]">${fromChordSymbol} → ${toChordSymbol}</span>
                                <span class="text-sm text-orange-700 flex-1">${alt.description}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : ''}
    `;
}

/**
 * Build score breakdown section
 */
function buildScoreBreakdown(scores) {
    const scoreItems = [
        { key: 'voiceLeadingScore', label: 'Voice Leading', color: '#22c55e' },
        { key: 'functionScore', label: 'Harmonic Function', color: '#3b82f6' },
        { key: 'styleFit', label: 'Style Fit', color: '#8b5cf6' },
        { key: 'moodFit', label: 'Mood Fit', color: '#ec4899' }
    ].filter(item => scores[item.key] !== undefined);

    if (scoreItems.length === 0) return '';

    return `
        <div class="mt-4">
            <button onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('svg').classList.toggle('rotate-180')"
                    class="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition">
                <span class="text-sm font-medium text-gray-700">Score Breakdown</span>
                <svg class="w-4 h-4 text-gray-500 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </button>
            <div class="hidden mt-2 p-3 bg-white border rounded-lg space-y-2">
                ${scoreItems.map(item => `
                    <div class="flex items-center gap-3">
                        <span class="text-xs text-gray-600 w-28">${item.label}</span>
                        <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div class="h-full rounded-full" style="width: ${scores[item.key]}%; background: ${item.color}"></div>
                        </div>
                        <span class="text-xs font-medium text-gray-700 w-8">${Math.round(scores[item.key])}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Build detailed reasons section
 */
function buildDetailedReasons(reasons) {
    return `
        <div class="mt-4">
            <button onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('svg').classList.toggle('rotate-180')"
                    class="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition">
                <span class="text-sm font-medium text-gray-700">Detailed Analysis</span>
                <svg class="w-4 h-4 text-gray-500 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </button>
            <div class="hidden mt-2 p-3 bg-white border rounded-lg space-y-2">
                ${reasons.map(r => `
                    <div class="flex items-start gap-2">
                        <span class="text-indigo-500 mt-0.5">•</span>
                        <div class="text-sm">
                            <span class="font-medium text-gray-700">${formatCategory(r.category)}:</span>
                            <span class="text-gray-600">${r.commonTalk || r.explanation}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Update explanation content when skill level changes
 * This fetches new skill-level-specific content from the theory database
 */
function updateExplanationContent() {
    if (!currentComparison) return;

    const container = document.getElementById('ewtw-explanation-content');
    if (!container) return;

    // Build explanation using theory database (skill-level-aware)
    let explanation = {
        title: currentComparison.suggestedChord?.roman || 'Chord',
        explanation: 'This chord works well in this context.',
        function: 'unknown',
        contextReason: currentComparison.reason || null
    };

    // Get skill-level-specific explanation from theory database
    // Pass the key for context-aware chord name substitution
    try {
        const theoryInfo = getWhyThisWorks(
            currentComparison.suggestedChord?.roman,
            currentComparison.currentChord?.roman,
            null,
            currentSkillLevel,
            currentComparison.key  // Pass key for chord name substitution
        );
        if (theoryInfo) {
            if (theoryInfo.explanation) {
                explanation.explanation = theoryInfo.explanation;
            }
            explanation.title = theoryInfo.title || explanation.title;
            explanation.function = theoryInfo.function || explanation.function;
            explanation.color = theoryInfo.color;
            explanation.feeling = theoryInfo.feeling;
            explanation.whenToUse = theoryInfo.whenToUse;
            if (theoryInfo.contextualInfo && currentComparison.currentChord?.roman) {
                explanation.contextualInfo = theoryInfo.contextualInfo;
            }
        } else if (currentComparison.reason) {
            explanation.explanation = currentComparison.reason;
        }
    } catch (err) {
        if (currentComparison.reason) {
            explanation.explanation = currentComparison.reason;
        }
    }

    container.innerHTML = buildExplanationContent(explanation, currentComparison);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get chord display name with inversion (e.g., "C Major", "G7 (1st inv)")
 */
function getChordDisplay(chord) {
    if (!chord) return 'Previous';
    if (!chord.root) return chord.roman || 'Chord';
    // Use full type name for clarity
    const typeName = chord.type || 'Major';
    let display = `${chord.root} ${typeName}`;

    // Add inversion text if not root position
    if (chord.inversion && chord.inversion > 0) {
        const inversionNames = { 1: '1st inv', 2: '2nd inv', 3: '3rd inv', 4: '4th inv' };
        display += ` (${inversionNames[chord.inversion] || `${chord.inversion}th inv`})`;
    }
    return display;
}

/**
 * Get function display name
 */
function getFunctionName(func) {
    const names = {
        'tonic': 'Tonic',
        'subdominant': 'Subdominant',
        'dominant': 'Dominant',
        'predominant': 'Pre-dominant'
    };
    return names[func] || '';
}

/**
 * Format category name
 */
function formatCategory(category) {
    if (!category) return 'Analysis';
    return category
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Close the modal
 */
function closeModal() {
    const modal = document.getElementById('enhanced-wtw-modal');
    if (modal) {
        modal.remove();
    }
    currentComparison = null;
}

/**
 * Setup modal event listeners
 */
function setupModalEvents() {
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Setup buttons with a small delay to ensure DOM is ready
    setTimeout(() => {
        // Forward playback button
        const forwardBtn = document.getElementById('ewtw-play-forward');
        if (forwardBtn) {
            forwardBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                playForwardResolution();
            });
        }

        // Compare (backward) playback button
        const compareBtn = document.getElementById('ewtw-play-compare');
        if (compareBtn) {
            compareBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                playABComparison();
            });
        }

        // Suggested chord button
        const suggestedBtn = document.getElementById('ewtw-play-suggested');
        if (suggestedBtn) {
            suggestedBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                playComparisonChord('suggested');
            });
        }

        // Current chord button
        const currentBtn = document.getElementById('ewtw-play-current');
        if (currentBtn) {
            currentBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                playComparisonChord('current');
            });
        }

        // Alternative buttons - include inversions for accurate playback
        const altButtons = document.querySelectorAll('.ewtw-alt-btn');
        altButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const fromRoot = btn.dataset.fromRoot;
                const fromType = btn.dataset.fromType;
                const fromInversion = parseInt(btn.dataset.fromInversion) || 0;
                const toRoot = btn.dataset.toRoot;
                const toType = btn.dataset.toType;
                const toInversion = parseInt(btn.dataset.toInversion) || 0;

                if (fromRoot && toRoot) {
                    await playChordSequence([
                        { root: fromRoot, type: fromType, inversion: fromInversion },
                        { root: toRoot, type: toType, inversion: toInversion }
                    ], 0.9);
                } else if (toRoot) {
                    await playChord(toRoot, toType, 1.5, toInversion);
                }
            });
        });
    }, 50);
}

/**
 * Add CSS styles
 */
function addStyles() {
    if (document.getElementById('ewtw-styles')) return;

    const style = document.createElement('style');
    style.id = 'ewtw-styles';
    style.textContent = `
        #enhanced-wtw-modal {
            animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    showEnhancedWhyThisWorks,
    setSkillLevel,
    closeModal as closeEnhancedWTW
};
