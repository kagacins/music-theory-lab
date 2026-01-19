/**
 * Theory Moments Module
 * Contextual learning popups that appear when users make interesting harmonic choices
 * Part of Tier 1: Teaching-Composition Integration
 */

import { THEORY_MOMENTS, getTheoryMomentConfig, getChordSpecificContent } from './theoryMomentsConfig.js';
import { BORROWED_CHORDS, CADENCE_PATTERNS } from '../analysis/patternDetection.js';
import { isGuidedModeActive } from '../ui/lessonGuidedMode.js';
import { getExperienceMode } from '../state/globalState.js';

// ============================================================================
// STATE
// ============================================================================

let isEnabled = true;
let currentMoment = null;
let momentHistory = []; // Track shown moments to avoid repetition
let dismissedTypes = new Set(); // Types user has dismissed permanently
const MOMENT_COOLDOWN_MS = 30000; // 30 seconds between moments
let lastMomentTime = 0;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the Theory Moments system
 */
export function initTheoryMoments() {
    // Load preferences from localStorage
    loadPreferences();

    // Update toggle button state to match saved preference
    updateToggleButton();

    // Listen for chord additions
    window.addEventListener('chordAddedForTheory', handleChordAdded);
    window.addEventListener('progressionAnalyzed', handleProgressionAnalyzed);

    // Listen for Experience Mode changes
    // Theory Moments is disabled in Focus mode, enabled in Guided/Explore modes
    window.addEventListener('experienceModeChanged', handleExperienceModeChanged);

    // Sync with current Experience Mode on init
    syncWithExperienceMode();

    // Expose functions globally
    window.toggleTheoryMoments = toggleTheoryMoments;
    window.isTheoryMomentsEnabled = () => isEnabled;
    window.recallTheoryMoment = recallTheoryMoment;
    window.canRecallMoment = canRecallMoment;
}

/**
 * Load user preferences from localStorage
 */
function loadPreferences() {
    try {
        const prefs = localStorage.getItem('theoryMomentsPrefs');
        if (prefs) {
            const parsed = JSON.parse(prefs);
            isEnabled = parsed.enabled !== false;
            dismissedTypes = new Set(parsed.dismissedTypes || []);
        }
    } catch (e) {
        console.warn('[TheoryMoments] Could not load preferences:', e);
    }
}

/**
 * Save user preferences to localStorage
 */
function savePreferences() {
    try {
        localStorage.setItem('theoryMomentsPrefs', JSON.stringify({
            enabled: isEnabled,
            dismissedTypes: Array.from(dismissedTypes)
        }));
    } catch (e) {
        console.warn('[TheoryMoments] Could not save preferences:', e);
    }
}

// ============================================================================
// TOGGLE
// ============================================================================

/**
 * Toggle Theory Moments on/off
 * @param {boolean} [forceState] - Optional forced state
 * @returns {boolean} New enabled state
 */
export function toggleTheoryMoments(forceState) {
    isEnabled = forceState !== undefined ? forceState : !isEnabled;
    savePreferences();

    // Update toggle UI
    updateToggleButton();

    console.log('[TheoryMoments] Enabled:', isEnabled);
    return isEnabled;
}

/**
 * Update the toggle button UI state
 */
function updateToggleButton() {
    const checkbox = document.getElementById('theory-moments-checkbox');
    const status = document.getElementById('theory-moments-status');

    if (checkbox) {
        checkbox.checked = isEnabled;
    }
    if (status) {
        status.textContent = isEnabled ? 'On' : 'Off';
    }
}

// ============================================================================
// EXPERIENCE MODE INTEGRATION
// ============================================================================

/**
 * Handle Experience Mode changes
 * Theory Moments is disabled in Focus mode, enabled in Guided/Explore modes
 */
function handleExperienceModeChanged(event) {
    syncWithExperienceMode();
}

/**
 * Sync Theory Moments enabled state with Experience Mode
 * Focus mode = disabled, Guided/Explore = enabled
 */
function syncWithExperienceMode() {
    const mode = getExperienceMode?.() || 'guided';
    const shouldBeEnabled = mode !== 'focus';

    if (isEnabled !== shouldBeEnabled) {
        isEnabled = shouldBeEnabled;
        updateToggleButton();
        console.log(`[TheoryMoments] ${shouldBeEnabled ? 'Enabled' : 'Disabled'} based on Experience Mode: ${mode}`);

        // If switching to focus mode, hide any visible moment
        if (!shouldBeEnabled) {
            hideTheoryMoment();
        }
    }
}

// ============================================================================
// DETECTION
// ============================================================================

/**
 * Handle chord added event
 * @param {CustomEvent} event - The chord added event
 */
function handleChordAdded(event) {
    console.log('[TheoryMoments] handleChordAdded called, isEnabled:', isEnabled);
    if (!isEnabled) {
        console.log('[TheoryMoments] Theory Moments is disabled, skipping');
        return;
    }

    // Skip during interactive tutorials/exercises
    if (isGuidedModeActive() || window.isTutorialSetupInProgress) {
        console.log('[TheoryMoments] Tutorial active or setup in progress, skipping');
        return;
    }

    const { chord, index, key, progression } = event.detail;
    console.log('[TheoryMoments] Event detail:', {
        chordRoot: chord?.root,
        chordType: chord?.type,
        chordRoman: chord?.roman || chord?.romanNumeral,
        index,
        key
    });

    // Check cooldown
    const now = Date.now();
    const timeSinceLastMoment = now - lastMomentTime;
    if (timeSinceLastMoment < MOMENT_COOLDOWN_MS) {
        console.log('[TheoryMoments] Cooldown active, skipping. Time since last:', timeSinceLastMoment, 'ms');
        return;
    }

    // Detect if this chord creates a theory moment
    const moment = detectTheoryMoment(chord, index, key, progression);
    console.log('[TheoryMoments] detectTheoryMoment result:', moment);

    if (moment && !dismissedTypes.has(moment.type)) {
        console.log('[TheoryMoments] Showing theory moment:', moment.type);
        lastMomentTime = now;
        showTheoryMoment(moment);
    } else if (moment) {
        console.log('[TheoryMoments] Moment type was dismissed:', moment.type);
    } else {
        console.log('[TheoryMoments] No theory moment detected for this chord');
    }
}

/**
 * Handle progression analyzed event (for pattern-based moments)
 * @param {CustomEvent} event - The analysis event
 */
function handleProgressionAnalyzed(event) {
    if (!isEnabled) return;

    // Skip during interactive tutorials/exercises
    if (isGuidedModeActive() || window.isTutorialSetupInProgress) return;

    const { patterns, key } = event.detail;

    // Check for circle of fifths motion
    if (patterns && patterns.sequences) {
        const fifthsSequence = patterns.sequences.find(s => s.type === 'DESC_5TH');
        if (fifthsSequence && fifthsSequence.positions.length >= 3) {
            const moment = {
                type: 'circle-of-fifths',
                config: getTheoryMomentConfig('circle-of-fifths'),
                chord: null,
                detail: `${fifthsSequence.chords.join(' → ')}`
            };

            if (!dismissedTypes.has(moment.type)) {
                showTheoryMoment(moment);
            }
        }
    }
}

// Note name to semitone mapping for secondary dominant detection
const NOTE_TO_SEMITONE = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'Fb': 4,
    'E#': 5, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9,
    'A#': 10, 'Bb': 10, 'B': 11, 'Cb': 11, 'B#': 0
};

// Major scale intervals in semitones
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

// Roman numeral labels for scale degrees
const SCALE_DEGREE_LABELS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

/**
 * Detect if a chord functions as a secondary dominant based on its root and the key
 * @param {string} chordRoot - The root note of the chord (e.g., "D", "A")
 * @param {string} key - The current key (e.g., "C", "G Major", "Am")
 * @returns {Object|null} Info about the secondary dominant or null
 */
function detectSecondaryDominantByRoot(chordRoot, key) {
    // Extract key root from key signature (e.g., "C Major" -> "C", "Am" -> "A")
    const keyRoot = key.replace(/\s*(major|minor|min|m)$/i, '').trim();

    const keyRootSemitone = NOTE_TO_SEMITONE[keyRoot];
    const chordRootSemitone = NOTE_TO_SEMITONE[chordRoot];

    if (keyRootSemitone === undefined || chordRootSemitone === undefined) {
        return null;
    }

    // Check each diatonic chord to see if this chord is its V (dominant)
    for (let i = 0; i < MAJOR_SCALE_INTERVALS.length; i++) {
        const diatonicRootSemitone = (keyRootSemitone + MAJOR_SCALE_INTERVALS[i]) % 12;

        // The dominant (V) of a chord is 7 semitones above its root
        const dominantOfDiatonic = (diatonicRootSemitone + 7) % 12;

        if (chordRootSemitone === dominantOfDiatonic) {
            // Skip if it's just the regular V chord (V of I)
            if (i === 0) continue;

            // Skip if it's the diatonic V chord itself (which would be V of IV... less common to highlight)
            if (i === 3) continue;

            // This chord is V of the diatonic chord at scale degree i
            const targetLabel = SCALE_DEGREE_LABELS[i];
            return {
                label: `V/${targetLabel}`,
                target: targetLabel,
                targetDegree: i
            };
        }
    }

    return null;
}

/**
 * Detect if a chord creates a teachable moment
 * @param {Object} chord - The added chord
 * @param {number} index - The chord's position in progression
 * @param {string} key - The current key
 * @param {Array} progression - The full progression
 * @returns {Object|null} The theory moment or null
 */
function detectTheoryMoment(chord, index, key, progression) {
    const romanNumeral = chord.romanNumeral || chord.roman;
    console.log('[TheoryMoments] detectTheoryMoment - romanNumeral:', romanNumeral);
    if (!romanNumeral) {
        console.log('[TheoryMoments] No roman numeral found on chord');
        return null;
    }

    // Normalize roman numeral
    const normalized = normalizeRoman(romanNumeral);
    console.log('[TheoryMoments] Normalized roman:', normalized);
    console.log('[TheoryMoments] BORROWED_CHORDS keys:', Object.keys(BORROWED_CHORDS));
    console.log('[TheoryMoments] Is borrowed chord?', BORROWED_CHORDS[normalized] ? 'YES' : 'NO');

    // Check for borrowed chords (modal interchange)
    if (BORROWED_CHORDS[normalized]) {
        const config = getTheoryMomentConfig('modal-interchange');
        const chordSpecific = getChordSpecificContent('modal-interchange', normalized);

        return {
            type: 'modal-interchange',
            config,
            chordSpecific,
            chord: normalized,
            borrowedInfo: BORROWED_CHORDS[normalized]
        };
    }

    // Check for cadence patterns (need previous chord)
    if (index > 0 && progression[index - 1]) {
        const prevRoman = progression[index - 1].romanNumeral || progression[index - 1].roman;
        const prevNormalized = normalizeRoman(prevRoman);

        // Deceptive cadence: V -> vi
        if ((prevNormalized === 'V' || prevNormalized === 'V7') &&
            (normalized === 'vi' || normalized === 'vi7')) {
            return {
                type: 'deceptive-cadence',
                config: getTheoryMomentConfig('deceptive-cadence'),
                chord: `${prevNormalized} → ${normalized}`
            };
        }

        // Plagal cadence: IV -> I
        if ((prevNormalized === 'IV' || prevNormalized === 'iv') &&
            (normalized === 'I' || normalized === 'Imaj7')) {
            return {
                type: 'plagal-cadence',
                config: getTheoryMomentConfig('plagal-cadence'),
                chord: `${prevNormalized} → ${normalized}`
            };
        }

        // Perfect authentic cadence: V -> I (less frequent to show)
        // Only show occasionally since it's so common
        if ((prevNormalized === 'V' || prevNormalized === 'V7') &&
            (normalized === 'I' || normalized === 'Imaj7')) {
            // Only show 20% of the time for PAC since it's so common
            if (Math.random() < 0.2) {
                return {
                    type: 'perfect-cadence',
                    config: getTheoryMomentConfig('perfect-cadence'),
                    chord: `${prevNormalized} → ${normalized}`
                };
            }
        }
    }

    // Check for secondary dominants (explicit V/x notation)
    if (romanNumeral.includes('/')) {
        const config = getTheoryMomentConfig('secondary-dominant');
        const chordSpecific = getChordSpecificContent('secondary-dominant', normalized);

        return {
            type: 'secondary-dominant',
            config,
            chordSpecific,
            chord: normalized
        };
    }

    // Check for secondary dominants based on chord root and type
    // A Major or Dominant 7th chord that is V of a diatonic chord
    const chordType = chord.type || '';
    const chordRoot = chord.root || '';
    const isSecondaryDomType = /^(Major|Dominant\s*7th?)$/i.test(chordType);

    if (isSecondaryDomType && chordRoot && key) {
        const secondaryDomInfo = detectSecondaryDominantByRoot(chordRoot, key);
        if (secondaryDomInfo) {
            const config = getTheoryMomentConfig('secondary-dominant');
            return {
                type: 'secondary-dominant',
                config,
                chord: secondaryDomInfo.label,
                targetChord: secondaryDomInfo.target
            };
        }
    }

    // Check for tritone substitution (bII or bII7)
    if (normalized === 'bII' || normalized === 'bII7') {
        // Check if it's before I (true tritone sub context)
        if (index < progression.length - 1) {
            const nextRoman = progression[index + 1]?.romanNumeral || progression[index + 1]?.roman;
            if (nextRoman && (normalizeRoman(nextRoman) === 'I' || normalizeRoman(nextRoman) === 'V')) {
                return {
                    type: 'tritone-sub',
                    config: getTheoryMomentConfig('tritone-sub'),
                    chord: normalized
                };
            }
        }
    }

    return null;
}

/**
 * Normalize roman numeral for comparison
 * @param {string} roman - The roman numeral
 * @returns {string} Normalized roman
 */
function normalizeRoman(roman) {
    if (!roman) return '';
    // Convert Unicode symbols to ASCII for consistent comparison
    // ♭ (U+266D) → b, ♯ (U+266F) → #
    let normalized = roman
        .replace(/♭/g, 'b')
        .replace(/♯/g, '#');
    // Keep accidentals (b, #) and base numeral, remove extensions and quality modifiers
    // bVII7 -> bVII, Imaj7 -> I, V7 -> V
    return normalized.replace(/(maj|min|add|sus|dim|aug|°)/gi, '').replace(/7|9|11|13/g, '');
}

// ============================================================================
// DISPLAY
// ============================================================================

// Store the last shown moment for recall functionality
let lastShownMoment = null;
let autoHideTimeoutId = null;
let isHovering = false;

/**
 * Show a theory moment popup
 * @param {Object} moment - The moment to display
 */
function showTheoryMoment(moment) {
    if (!moment || !moment.config) return;

    // Remove any existing moment
    hideTheoryMoment(true); // true = don't clear lastShownMoment

    // Store for recall
    lastShownMoment = moment;

    // Get user's skill level (default to simple)
    const skillLevel = localStorage.getItem('theorySkillLevel') || 'simple';

    // Build content
    const config = moment.config;
    const chordSpecific = moment.chordSpecific;

    // Use chord-specific title/content if available
    const title = chordSpecific?.title || config.title;
    const famousSongs = chordSpecific?.famousSongs || config.famousSongs || [];

    // Create the popup element
    const popup = document.createElement('div');
    popup.id = 'theory-moment-popup';
    popup.className = 'fixed top-4 right-4 z-[99998] max-w-sm animate-slide-in';
    popup.style.cssText = `
        animation: slideInRight 0.3s ease-out;
    `;

    popup.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl border-l-4 overflow-hidden" style="border-color: ${config.color}">
            <!-- Header -->
            <div class="px-4 py-3 flex items-center justify-between" style="background: linear-gradient(135deg, ${config.color}22, ${config.color}11)">
                <div class="flex items-center gap-2">
                    <span class="text-2xl">${config.icon}</span>
                    <h3 class="font-bold text-gray-800">${title}</h3>
                </div>
                <button id="theory-moment-close" class="text-gray-400 hover:text-gray-600 transition p-1" title="Close">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            <!-- Content -->
            <div class="px-4 py-3">
                <p id="theory-moment-content" class="text-gray-700 text-sm leading-relaxed"></p>

                ${moment.borrowedInfo ? `
                    <div class="mt-2 px-2 py-1 bg-gray-50 rounded text-xs text-gray-500">
                        <strong>Source:</strong> ${moment.borrowedInfo.source} ·
                        <strong>Quality:</strong> ${moment.borrowedInfo.color}
                    </div>
                ` : ''}

                ${famousSongs.length > 0 ? `
                    <div class="mt-2 text-xs text-gray-500">
                        <strong>Hear it in:</strong> ${famousSongs.slice(0, 2).join(', ')}
                    </div>
                ` : ''}
            </div>

            <!-- Footer with skill level selector -->
            <div class="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <label class="text-xs text-gray-500">Detail:</label>
                    <select id="theory-moment-skill-level" class="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-indigo-500">
                        <option value="simple" ${skillLevel === 'simple' ? 'selected' : ''}>Beginner</option>
                        <option value="intermediate" ${skillLevel === 'intermediate' ? 'selected' : ''}>Intermediate</option>
                        <option value="advanced" ${skillLevel === 'advanced' ? 'selected' : ''}>Advanced</option>
                    </select>
                </div>
            </div>
        </div>
    `;

    // Add styles if not already present
    addStyles();

    // Add to DOM
    document.body.appendChild(popup);
    currentMoment = moment;

    // Set initial content based on skill level
    updateMomentContent(moment, skillLevel);

    // Track in history
    momentHistory.push({
        type: moment.type,
        chord: moment.chord,
        timestamp: Date.now()
    });

    // Setup event listeners
    document.getElementById('theory-moment-close').addEventListener('click', () => hideTheoryMoment());

    // Skill level change handler
    const skillSelect = document.getElementById('theory-moment-skill-level');
    if (skillSelect) {
        skillSelect.addEventListener('change', (e) => {
            const newLevel = e.target.value;
            localStorage.setItem('theorySkillLevel', newLevel);
            updateMomentContent(moment, newLevel);
        });
    }

    // Hover handling - pause auto-hide while hovering
    isHovering = false;
    popup.addEventListener('mouseenter', () => {
        isHovering = true;
        if (autoHideTimeoutId) {
            clearTimeout(autoHideTimeoutId);
            autoHideTimeoutId = null;
        }
    });

    popup.addEventListener('mouseleave', () => {
        isHovering = false;
        // Start a new 3-second timeout after mouse leaves
        startAutoHideTimer(moment, 3000);
    });

    // Start initial auto-hide timer (10 seconds)
    startAutoHideTimer(moment, 10000);

    // Hide the recall button while popup is visible
    updateRecallButtonVisibility();
}

/**
 * Update the content of the current theory moment based on skill level
 * @param {Object} moment - The moment object
 * @param {string} skillLevel - The skill level (simple, intermediate, advanced)
 */
function updateMomentContent(moment, skillLevel) {
    const contentEl = document.getElementById('theory-moment-content');
    if (!contentEl || !moment) return;

    const config = moment.config;
    const chordSpecific = moment.chordSpecific;

    // Get content for skill level, falling back through levels if not available
    let content = chordSpecific?.content?.[skillLevel]
        || config.content?.[skillLevel]
        || chordSpecific?.content?.simple
        || config.content?.simple
        || 'No content available.';

    // Replace placeholders with actual values
    if (moment.chord) {
        content = content.replace(/\{chord\}/g, moment.chord);
    }
    if (moment.targetChord) {
        content = content.replace(/\{target\}/g, moment.targetChord);
    }

    contentEl.textContent = content;
}

/**
 * Start the auto-hide timer
 * @param {Object} moment - The moment to hide
 * @param {number} delay - Delay in milliseconds
 */
function startAutoHideTimer(moment, delay) {
    if (autoHideTimeoutId) {
        clearTimeout(autoHideTimeoutId);
    }
    autoHideTimeoutId = setTimeout(() => {
        if (currentMoment === moment && !isHovering) {
            hideTheoryMoment();
        }
    }, delay);
}

/**
 * Recall the last shown theory moment
 * @returns {boolean} True if a moment was recalled
 */
export function recallTheoryMoment() {
    if (lastShownMoment) {
        // Reset cooldown so it shows immediately
        lastMomentTime = 0;
        showTheoryMoment(lastShownMoment);
        return true;
    }
    return false;
}

/**
 * Check if there's a moment available to recall
 * @returns {boolean} True if recall is available
 */
export function canRecallMoment() {
    return lastShownMoment !== null;
}

/**
 * Update the visibility of the recall button in the UI
 */
function updateRecallButtonVisibility() {
    const recallBtn = document.getElementById('recall-theory-moment-btn');
    if (recallBtn) {
        // Show button if there's a moment to recall and no popup is currently showing
        if (lastShownMoment && !currentMoment) {
            recallBtn.classList.remove('hidden');
        } else {
            recallBtn.classList.add('hidden');
        }
    }
}

/**
 * Hide the current theory moment
 * @param {boolean} preserveLastMoment - If true, don't clear lastShownMoment (for recall)
 */
function hideTheoryMoment(preserveLastMoment = false) {
    // Clear any pending auto-hide timer
    if (autoHideTimeoutId) {
        clearTimeout(autoHideTimeoutId);
        autoHideTimeoutId = null;
    }

    const popup = document.getElementById('theory-moment-popup');
    if (popup) {
        popup.style.animation = 'slideOutRight 0.2s ease-in forwards';
        setTimeout(() => popup.remove(), 200);
    }
    currentMoment = null;
    isHovering = false;

    // Only clear lastShownMoment if not preserving (allows recall)
    // Note: We typically preserve it so user can recall

    // Show the recall button if we have a moment to recall
    updateRecallButtonVisibility();
}

/**
 * Dismiss a moment type permanently
 * @param {string} type - The moment type to dismiss
 */
function dismissType(type) {
    dismissedTypes.add(type);
    savePreferences();
}

/**
 * Open a lesson by ID
 * @param {string} lessonId - The lesson ID to open
 */
function openLesson(lessonId) {
    // Try to use the lesson viewer if available
    if (window.openLessonById) {
        window.openLessonById(lessonId);
    } else if (window.showLessonViewer) {
        window.showLessonViewer(lessonId);
    } else {
        // Fallback: switch to Learn tab
        if (window.switchTab) {
            window.switchTab('learn');
        }
        console.log('[TheoryMoments] Would open lesson:', lessonId);
    }
}

/**
 * Add CSS styles for animations
 */
function addStyles() {
    if (document.getElementById('theory-moment-styles')) return;

    const style = document.createElement('style');
    style.id = 'theory-moment-styles';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    isEnabled,
    hideTheoryMoment
};

// Initialize on module load
if (typeof window !== 'undefined') {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheoryMoments);
    } else {
        initTheoryMoments();
    }
}
