/**
 * "Why This Works" Panel
 *
 * An educational panel that explains music theory concepts in context.
 * Provides multi-level explanations (beginner/intermediate/advanced) for
 * chord functions, progressions, and harmonic relationships.
 *
 * Features (per INTERACTIVE_LEARNING_PLAN.md 1.2):
 * - Multi-level explanations (beginner/intermediate/advanced)
 * - "Hear it" audio preview buttons
 * - "Try the opposite" alternative comparisons
 * - "Tell me more" expansion to deeper levels
 */

import {
  getWhyThisWorks,
  getProgressionInfo,
  getTerm,
  getChordFunction,
  getTransition,
  FUNCTION_COLORS,
  SKILL_LEVEL_INFO
} from '../../data/theoryExplanations/index.js';

import {
  getProgressionData,
  getCurrentKey,
  getSelectedChordIndex,
  getProgressionRomans
} from '../state/trainerState.js';

import { getChordNotes } from '../utils/noteUtils.js';
import { CHORD_DEFINITIONS } from '../../data/music-data.js';

// ===========================================
// STATE
// ===========================================

let currentSkillLevel = 'simple'; // 'simple', 'intermediate', 'advanced'
let currentChordContext = null;
let isPanelVisible = false;

// ===========================================
// HELPERS
// ===========================================

/**
 * Get display name for a chord with its symbol (e.g., "C7", "Dm", "Fmaj7")
 * @param {string} root - The root note (e.g., "C", "D")
 * @param {string} type - The chord type (e.g., "Dominant 7th", "Minor")
 * @returns {string} The display name with symbol
 */
function getChordDisplayName(root, type) {
  if (!root) return '';
  if (!type) return root;

  const chordDef = CHORD_DEFINITIONS[type];
  const symbol = chordDef?.symbol || '';
  return `${root}${symbol}`;
}

/**
 * Get a description of why a chord follows well from the previous chord
 * @param {Object} prevChordData - Previous chord data {root, type, spelled}
 * @param {string} currentChord - Current chord root
 * @param {string} currentType - Current chord type
 * @param {string} key - Musical key
 * @param {string} romanNumeral - Roman numeral of current chord
 * @returns {string} Explanation of the transition
 */
function getTransitionExplanation(prevChordData, currentChord, currentType, key, romanNumeral) {
  if (!prevChordData) return '';

  const prevDisplay = getChordDisplayName(prevChordData.root, prevChordData.type);
  const currDisplay = getChordDisplayName(currentChord, currentType);

  // Get previous chord's likely function based on common patterns
  const keyRoot = key?.replace('m', '') || 'C';

  // Common strong progressions and their explanations
  const progressionReasons = {
    // V → I (Authentic cadence)
    'V-I': `${prevDisplay} is the dominant chord, which has a strong pull to resolve to ${currDisplay}. The leading tone wants to resolve up to the tonic.`,
    'V7-I': `${prevDisplay} creates maximum tension with its tritone interval, which naturally resolves to ${currDisplay}.`,

    // IV → I (Plagal cadence)
    'IV-I': `${prevDisplay} to ${currDisplay} is the "Amen" cadence - a gentle, peaceful resolution often heard at the end of hymns.`,

    // ii → V (Pre-dominant to dominant)
    'ii-V': `${prevDisplay} leads smoothly to ${currDisplay} - this is one of the most common progressions in jazz and pop music.`,
    'ii7-V': `${prevDisplay} shares notes with ${currDisplay}, creating a smooth voice-leading connection.`,

    // I → IV (Tonic to subdominant)
    'I-IV': `${prevDisplay} to ${currDisplay} moves you away from home, creating forward momentum in the song.`,

    // I → V (Tonic to dominant)
    'I-V': `${prevDisplay} to ${currDisplay} creates expectation - the dominant chord will want to return home.`,

    // V → vi (Deceptive cadence)
    'V-vi': `${prevDisplay} to ${currDisplay} is the "deceptive cadence" - you expect resolution to I, but get the relative minor instead. Emotional and surprising!`,

    // IV → V (Subdominant to dominant)
    'IV-V': `${prevDisplay} to ${currDisplay} builds tension - moving from the subdominant toward the dominant creates a strong push to resolve.`,

    // vi → IV (Common pop progression)
    'vi-IV': `${prevDisplay} to ${currDisplay} is part of the famous "4 chord" pop progression. The emotional minor leads to the hopeful major.`,

    // I → vi (Tonic to relative minor)
    'I-vi': `${prevDisplay} to ${currDisplay} shares two common tones, making it a smooth and emotionally satisfying transition.`,
  };

  // Try to match the progression
  const baseNumeral = romanNumeral?.replace(/[0-9majø°]+$/gi, '');

  // Build progression key from context
  // We need to determine what the previous chord's numeral was
  // For now, use common patterns based on the current chord

  // If current is I (tonic), previous was likely V or IV
  if (baseNumeral === 'I' || baseNumeral === 'i') {
    if (prevChordData.type?.includes('7') || prevChordData.type === 'Dominant 7th') {
      return progressionReasons['V7-I'] || `${prevDisplay} creates tension that resolves naturally to ${currDisplay}.`;
    }
    return `${prevDisplay} resolves naturally to ${currDisplay}, which is home base in this key.`;
  }

  // If current is V (dominant), previous was likely ii or IV
  if (baseNumeral === 'V' || baseNumeral === 'v') {
    return `${prevDisplay} leads smoothly into ${currDisplay}, building tension for an eventual resolution.`;
  }

  // If current is IV (subdominant)
  if (baseNumeral === 'IV') {
    return `${prevDisplay} moves to ${currDisplay}, which opens up the harmony and creates forward motion.`;
  }

  // If current is vi (relative minor)
  if (baseNumeral === 'vi') {
    return `${prevDisplay} moves to ${currDisplay}, adding emotional depth while staying connected to the key.`;
  }

  // If current is ii (supertonic)
  if (baseNumeral === 'ii') {
    return `${prevDisplay} to ${currDisplay} is a common setup for the ii-V-I progression.`;
  }

  // Generic fallback
  return `${prevDisplay} connects smoothly to ${currDisplay} in the key of ${key}.`;
}

// ===========================================
// INITIALIZATION
// ===========================================

/**
 * Initialize the Why This Works panel
 */
export function initWhyThisWorksPanel() {
  // Load saved skill level from localStorage
  const savedLevel = localStorage.getItem('theory-skill-level');
  if (savedLevel && ['simple', 'intermediate', 'advanced'].includes(savedLevel)) {
    currentSkillLevel = savedLevel;
  }

  // Always expose global functions first (so they work even if panel HTML isn't created)
  attachEventListeners();

  // Find the trainer sections container
  const trainerContainer = document.querySelector('#trainer-sections-container');
  if (!trainerContainer) {
    console.warn('[WhyThisWorks] Trainer sections container not found - panel will be created on demand');
    return;
  }

  // Create and insert the panel after the recommendations panel
  const panelHTML = createPanelHTML();

  // Find the Smart Suggestions panel and insert after it
  const smartSuggestions = trainerContainer.querySelector('.trainer-section-item');
  if (smartSuggestions && smartSuggestions.nextSibling) {
    smartSuggestions.insertAdjacentHTML('afterend', panelHTML);
  } else {
    trainerContainer.insertAdjacentHTML('beforeend', panelHTML);
  }

  console.log('[WhyThisWorks] Panel initialized successfully');
}

// ===========================================
// HTML TEMPLATE
// ===========================================

/**
 * Create the panel HTML
 */
function createPanelHTML() {
  const levelInfo = SKILL_LEVEL_INFO[currentSkillLevel];

  return `
    <!-- Why This Works Panel -->
    <div id="why-this-works-panel" class="mb-3 trainer-section-item hidden">
      <button onclick="window.toggleWhyThisWorksPanel && window.toggleWhyThisWorksPanel()"
              class="w-full px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-between">
        <span class="flex items-center gap-2">
          <svg class="w-4 h-4 text-white/70 cursor-move drag-handle" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Drag to reorder">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
          </svg>
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path>
          </svg>
          Why This Works
          <span id="wtw-skill-badge" class="text-xs bg-white/20 px-2 py-0.5 rounded-full">${levelInfo.icon} ${levelInfo.name}</span>
        </span>
        <svg id="wtw-chevron" class="w-5 h-5 transform transition-transform" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>
        </svg>
      </button>

      <!-- Content -->
      <div id="wtw-content" class="mt-2 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-200 space-y-4">

        <!-- Skill Level Selector -->
        <div class="flex items-center justify-between bg-white rounded-lg p-2 border border-emerald-200">
          <span class="text-xs font-medium text-emerald-700">Explanation Level:</span>
          <div class="flex gap-1">
            <button onclick="window.setTheorySkillLevel && window.setTheorySkillLevel('simple')"
                    id="wtw-level-simple"
                    class="px-2 py-1 text-xs rounded transition-all ${currentSkillLevel === 'simple' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}">
              🌱 Beginner
            </button>
            <button onclick="window.setTheorySkillLevel && window.setTheorySkillLevel('intermediate')"
                    id="wtw-level-intermediate"
                    class="px-2 py-1 text-xs rounded transition-all ${currentSkillLevel === 'intermediate' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}">
              🌿 Intermediate
            </button>
            <button onclick="window.setTheorySkillLevel && window.setTheorySkillLevel('advanced')"
                    id="wtw-level-advanced"
                    class="px-2 py-1 text-xs rounded transition-all ${currentSkillLevel === 'advanced' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}">
              🌳 Advanced
            </button>
          </div>
        </div>

        <!-- Main Explanation Area -->
        <div id="wtw-explanation" class="bg-white rounded-lg p-4 border border-emerald-300">
          <div id="wtw-placeholder" class="text-center py-6">
            <svg class="w-12 h-12 mx-auto text-emerald-300 mb-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path>
            </svg>
            <p class="text-emerald-600 font-medium">Click "Why?" on any chord suggestion</p>
            <p class="text-sm text-emerald-500 mt-1">to learn why it works in your progression</p>
          </div>
          <div id="wtw-content-area" class="hidden space-y-4">
            <!-- Dynamic content will be inserted here -->
          </div>
        </div>

        <!-- Quick Glossary -->
        <div id="wtw-glossary" class="hidden bg-white rounded-lg p-3 border border-emerald-200">
          <h4 class="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"></path>
            </svg>
            Quick Glossary
          </h4>
          <div id="wtw-glossary-content" class="text-sm text-gray-700 space-y-1">
            <!-- Glossary terms will be inserted here -->
          </div>
        </div>

      </div>
    </div>
  `;
}

// ===========================================
// EVENT LISTENERS
// ===========================================

/**
 * Attach event listeners
 */
function attachEventListeners() {
  // Toggle panel visibility
  window.toggleWhyThisWorksPanel = function() {
    const content = document.getElementById('wtw-content');
    const chevron = document.getElementById('wtw-chevron');

    if (content.classList.contains('hidden')) {
      content.classList.remove('hidden');
      chevron.classList.remove('rotate-180');
    } else {
      content.classList.add('hidden');
      chevron.classList.add('rotate-180');
    }
  };

  // Set skill level
  window.setTheorySkillLevel = function(level) {
    if (!['simple', 'intermediate', 'advanced'].includes(level)) return;

    currentSkillLevel = level;
    localStorage.setItem('theory-skill-level', level);

    // Update button styles
    ['simple', 'intermediate', 'advanced'].forEach(l => {
      const btn = document.getElementById(`wtw-level-${l}`);
      if (btn) {
        if (l === level) {
          btn.classList.remove('bg-emerald-100', 'text-emerald-700', 'hover:bg-emerald-200');
          btn.classList.add('bg-emerald-600', 'text-white');
        } else {
          btn.classList.remove('bg-emerald-600', 'text-white');
          btn.classList.add('bg-emerald-100', 'text-emerald-700', 'hover:bg-emerald-200');
        }
      }
    });

    // Update skill badge
    const badge = document.getElementById('wtw-skill-badge');
    const levelInfo = SKILL_LEVEL_INFO[level];
    if (badge && levelInfo) {
      badge.textContent = `${levelInfo.icon} ${levelInfo.name}`;
    }

    // Refresh current explanation if one is showing
    if (currentChordContext) {
      showWhyThisWorks(currentChordContext);
    }
  };

  // Global function to show explanation for a chord
  window.showWhyThisWorks = showWhyThisWorks;

  // Global function to show panel
  window.openWhyThisWorksPanel = openWhyThisWorksPanel;
}

// ===========================================
// MAIN DISPLAY FUNCTIONS
// ===========================================

/**
 * Ensure the panel HTML exists in the DOM
 */
function ensurePanelExists() {
  if (document.getElementById('why-this-works-panel')) {
    return; // Already exists
  }

  // Try to find a container to insert the panel
  const trainerContainer = document.querySelector('#trainer-sections-container');
  if (trainerContainer) {
    const panelHTML = createPanelHTML();
    const smartSuggestions = trainerContainer.querySelector('.trainer-section-item');
    if (smartSuggestions && smartSuggestions.nextSibling) {
      smartSuggestions.insertAdjacentHTML('afterend', panelHTML);
    } else {
      trainerContainer.insertAdjacentHTML('beforeend', panelHTML);
    }
  }
}

/**
 * Play a chord using Tone.js via window.getPiano()
 * @param {string} root - Chord root note
 * @param {string} type - Chord type
 * @param {number} duration - Duration in seconds (default 1)
 */
function playChordPreview(root, type, duration = 1) {
  try {
    // Get chord notes using the utility
    const chordInfo = getChordNotes(root, type);
    const notes = chordInfo?.specificNotes || [];

    if (notes.length === 0) {
      console.warn('[WhyThisWorks] No notes found for chord:', root, type);
      return;
    }

    // Use Tone.js piano via window.getPiano()
    const piano = window.getPiano ? window.getPiano() : null;
    if (piano && typeof Tone !== 'undefined') {
      const now = Tone.now();
      piano.triggerAttackRelease(notes, duration, now);
    } else {
      console.warn('[WhyThisWorks] Piano or Tone.js not available');
    }
  } catch (err) {
    console.error('[WhyThisWorks] Error playing chord:', err);
  }
}

/**
 * Play a chord progression (sequence of chords)
 * @param {Array} chords - Array of {root, type} objects
 * @param {number} chordDuration - Duration per chord in seconds
 */
function playChordSequence(chords, chordDuration = 0.8) {
  try {
    const piano = window.getPiano ? window.getPiano() : null;
    if (!piano || typeof Tone === 'undefined') {
      console.warn('[WhyThisWorks] Piano or Tone.js not available');
      return;
    }

    const now = Tone.now();
    chords.forEach((chord, index) => {
      const chordInfo = getChordNotes(chord.root, chord.type);
      const notes = chordInfo?.specificNotes || [];
      if (notes.length > 0) {
        piano.triggerAttackRelease(notes, chordDuration * 0.9, now + (index * chordDuration));
      }
    });
  } catch (err) {
    console.error('[WhyThisWorks] Error playing sequence:', err);
  }
}

/**
 * Get the notes in a chord as display strings
 * @param {string} root - Chord root
 * @param {string} type - Chord type
 * @returns {Array} Array of note names
 */
function getChordNoteNames(root, type) {
  const chordInfo = getChordNotes(root, type);
  if (!chordInfo?.specificNotes) return [];
  // Strip octave numbers for display
  return chordInfo.specificNotes.map(n => n.replace(/[0-9]/g, ''));
}

/**
 * Get key-aware explanation with actual note names
 * @param {Object} context - Chord context
 * @param {Object} explanation - Base explanation from database
 * @returns {Object} Enhanced explanation with note-specific info
 */
function buildKeyAwareExplanation(context, explanation) {
  const { chord, type, key, prevChordData, romanNumeral } = context;

  // Get actual notes in the chord
  const chordNotes = getChordNoteNames(chord, type);
  const keyRoot = key?.replace('m', '') || 'C';
  const isMinorKey = key?.includes('m');

  // Build key-specific explanation
  let keySpecificExplanation = explanation.explanation || '';

  // For dominant chords (V, V7), explain the specific notes
  if (romanNumeral === 'V' || romanNumeral === 'V7') {
    const leadingTone = chordNotes[1]; // 3rd of V is leading tone
    const tonicNote = keyRoot;
    keySpecificExplanation = `The ${chord} chord contains ${leadingTone} (the leading tone), which is just a half-step below ${tonicNote}. ` +
      `Your ear expects ${leadingTone} to resolve up to ${tonicNote}. ` +
      (romanNumeral === 'V7'
        ? `The added 7th (${chordNotes[3] || 'F'}) creates even more tension that wants to resolve down.`
        : `This creates a strong pull back to the ${keyRoot} chord.`);
  }
  // For subdominant chords (IV, ii)
  else if (romanNumeral === 'IV' || romanNumeral === 'IVmaj7') {
    keySpecificExplanation = `The ${chord} chord (${chordNotes.join('-')}) moves you away from home on a journey. ` +
      `In the key of ${key}, ${chord} is the "traveling" chord - it sounds open and forward-moving.`;
  }
  else if (romanNumeral === 'ii' || romanNumeral === 'ii7') {
    keySpecificExplanation = `The ${chord} chord (${chordNotes.join('-')}) is the bridge chord in ${key}. ` +
      `It smoothly connects to V because they share common tones, making the progression flow naturally.`;
  }
  // For tonic chords
  else if (romanNumeral === 'I' || romanNumeral === 'Imaj7' || romanNumeral === 'i') {
    keySpecificExplanation = `The ${chord} chord (${chordNotes.join('-')}) is home base in the key of ${key}. ` +
      `Everything revolves around this chord - songs typically start here, end here, and keep returning here.`;
  }
  // For vi chord
  else if (romanNumeral === 'vi' || romanNumeral === 'vi7') {
    const relativeToI = chordNotes.filter(n => {
      const tonicNotes = getChordNoteNames(keyRoot, 'Major');
      return tonicNotes.includes(n);
    });
    keySpecificExplanation = `The ${chord} chord (${chordNotes.join('-')}) shares ${relativeToI.length} notes with the ${keyRoot} chord, ` +
      `which is why it can substitute for home. It adds an emotional, bittersweet quality while still feeling somewhat resolved.`;
  }

  // Add transition context if we have a previous chord
  let transitionExplanation = '';
  if (prevChordData) {
    transitionExplanation = getTransitionExplanation(prevChordData, chord, type, key, romanNumeral);
  }

  return {
    ...explanation,
    keySpecificExplanation,
    transitionExplanation,
    chordNotes,
    keyRoot,
    isMinorKey
  };
}

/**
 * Get alternative chord resolutions to compare
 * Based on the document: "Try These Alternatives" section
 * @param {string} romanNumeral - Current chord's roman numeral
 * @param {string} key - Current key
 * @param {Object} prevChordData - Previous chord data
 * @returns {Array} Alternative resolution suggestions with playable chord data
 */
function getAlternativeResolutions(romanNumeral, key, prevChordData) {
  const keyRoot = key?.replace('m', '') || 'C';
  const isMinorKey = key?.includes('m');

  // Map of scale degrees to chord roots (simplified for common keys)
  const scaleDegreesToRoots = {
    'C': { I: 'C', ii: 'D', iii: 'E', IV: 'F', V: 'G', vi: 'A', vii: 'B', bVII: 'Bb', bVI: 'Ab' },
    'G': { I: 'G', ii: 'A', iii: 'B', IV: 'C', V: 'D', vi: 'E', vii: 'F#', bVII: 'F', bVI: 'Eb' },
    'D': { I: 'D', ii: 'E', iii: 'F#', IV: 'G', V: 'A', vi: 'B', vii: 'C#', bVII: 'C', bVI: 'Bb' },
    'A': { I: 'A', ii: 'B', iii: 'C#', IV: 'D', V: 'E', vi: 'F#', vii: 'G#', bVII: 'G', bVI: 'F' },
    'E': { I: 'E', ii: 'F#', iii: 'G#', IV: 'A', V: 'B', vi: 'C#', vii: 'D#', bVII: 'D', bVI: 'C' },
    'F': { I: 'F', ii: 'G', iii: 'A', IV: 'Bb', V: 'C', vi: 'D', vii: 'E', bVII: 'Eb', bVI: 'Db' },
    'Bb': { I: 'Bb', ii: 'C', iii: 'D', IV: 'Eb', V: 'F', vi: 'G', vii: 'A', bVII: 'Ab', bVI: 'Gb' }
  };

  const degrees = scaleDegreesToRoots[keyRoot] || scaleDegreesToRoots['C'];

  // Different alternatives based on what chord we're explaining
  // These are alternatives for where the PREVIOUS chord could go instead
  const alternatives = [];

  // Get the base numeral without suffixes for matching
  const baseNumeral = romanNumeral.replace(/[0-9majø°]+$/gi, '');

  if (prevChordData) {
    const prevRoot = prevChordData.root;
    const prevType = prevChordData.type;

    // If we're showing why I (tonic) works, show alternatives the previous chord could go to
    if (baseNumeral === 'I' || baseNumeral === 'i') {
      // Alternatives to V → I resolution
      alternatives.push({
        numeral: 'vi',
        description: 'A "surprise" ending (deceptive cadence)',
        fromChord: { root: prevRoot, type: prevType },
        toChord: { root: degrees.vi, type: 'Minor' }
      });
      alternatives.push({
        numeral: 'IV',
        description: 'Goes somewhere unexpected',
        fromChord: { root: prevRoot, type: prevType },
        toChord: { root: degrees.IV, type: 'Major' }
      });
      if (!isMinorKey) {
        alternatives.push({
          numeral: 'iii',
          description: 'Mysterious, floating resolution',
          fromChord: { root: prevRoot, type: prevType },
          toChord: { root: degrees.iii, type: 'Minor' }
        });
      }
    }
    // If V (dominant)
    else if (baseNumeral === 'V' || baseNumeral === 'v') {
      alternatives.push({
        numeral: 'V7',
        description: 'Add the 7th for stronger pull',
        fromChord: { root: prevRoot, type: prevType },
        toChord: { root: degrees.V, type: 'Dominant 7th' }
      });
      alternatives.push({
        numeral: 'vii°',
        description: 'Darker, more intense tension',
        fromChord: { root: prevRoot, type: prevType },
        toChord: { root: degrees.vii, type: 'Diminished' }
      });
    }
    // For IV (subdominant)
    else if (baseNumeral === 'IV') {
      alternatives.push({
        numeral: 'ii',
        description: 'Smoother, more sophisticated journey',
        fromChord: { root: prevRoot, type: prevType },
        toChord: { root: degrees.ii, type: 'Minor' }
      });
      alternatives.push({
        numeral: 'ii7',
        description: 'Jazz bridge chord (ii-V-I)',
        fromChord: { root: prevRoot, type: prevType },
        toChord: { root: degrees.ii, type: 'Minor 7th' }
      });
      alternatives.push({
        numeral: 'iv',
        description: 'Borrowed minor - adds emotion',
        fromChord: { root: prevRoot, type: prevType },
        toChord: { root: degrees.IV, type: 'Minor' }
      });
    }
    // For ii (supertonic)
    else if (baseNumeral === 'ii') {
      alternatives.push({
        numeral: 'IV',
        description: 'Brighter subdominant option',
        fromChord: { root: prevRoot, type: prevType },
        toChord: { root: degrees.IV, type: 'Major' }
      });
      alternatives.push({
        numeral: 'iv',
        description: 'Borrowed minor for darker color',
        fromChord: { root: prevRoot, type: prevType },
        toChord: { root: degrees.IV, type: 'Minor' }
      });
    }
    // For vi (submediant)
    else if (baseNumeral === 'vi') {
      alternatives.push({
        numeral: 'IV',
        description: 'Brighter, more open feel',
        fromChord: { root: prevRoot, type: prevType },
        toChord: { root: degrees.IV, type: 'Major' }
      });
      alternatives.push({
        numeral: 'ii',
        description: 'Leads toward tension (V)',
        fromChord: { root: prevRoot, type: prevType },
        toChord: { root: degrees.ii, type: 'Minor' }
      });
    }
  }

  return alternatives.slice(0, 3);
}

/**
 * Show the enhanced explanation modal with all 1.2 features
 * Per INTERACTIVE_LEARNING_PLAN.md Section 1.2:
 * - Key-aware explanations with actual note names
 * - "Hear the tension" and "Hear it resolve" buttons
 * - Alternative chord comparisons with playback
 * - "Tell me more" expansion with voice leading details
 */
function showFallbackExplanation(context, explanation) {
  console.log('[WhyThisWorks] showFallbackExplanation called');
  console.log('[WhyThisWorks] Context:', JSON.stringify(context, null, 2));
  console.log('[WhyThisWorks] Explanation:', JSON.stringify(explanation, null, 2));

  try {
    // Remove existing modal
    const existingPopup = document.getElementById('wtw-fallback-popup');
    if (existingPopup) existingPopup.remove();
    const existingOverlay = document.getElementById('wtw-fallback-overlay');
    if (existingOverlay) existingOverlay.remove();

    const functionColor = explanation?.color || FUNCTION_COLORS[explanation?.function] || '#6b7280';
    const functionName = getFunctionDisplayName(explanation?.function);

    console.log('[WhyThisWorks] Function:', explanation?.function, 'Color:', functionColor);

    // Build key-aware explanation
    const keyAwareExplanation = buildKeyAwareExplanation(context, explanation);
    console.log('[WhyThisWorks] Key-aware explanation:', keyAwareExplanation);

    // Get alternative resolutions with playback data
    const alternatives = getAlternativeResolutions(context.romanNumeral, context.key, context.prevChordData);

    // Get all skill level explanations for "Tell me more"
    const allLevelExplanations = {
      simple: getWhyThisWorks(context.romanNumeral, context.prevChord, context.nextChord, 'simple'),
      intermediate: getWhyThisWorks(context.romanNumeral, context.prevChord, context.nextChord, 'intermediate'),
      advanced: getWhyThisWorks(context.romanNumeral, context.prevChord, context.nextChord, 'advanced')
    };

    // Get chord display names with symbols (e.g., "G7", "Dm", "Cmaj7")
    const currentChordDisplay = getChordDisplayName(context.chord, context.type);
    const prevChordDisplay = context.prevChordData
      ? getChordDisplayName(context.prevChordData.root, context.prevChordData.type)
      : null;

    // Build transition display with full chord names (e.g., "G7 → C")
    const transitionDisplay = prevChordDisplay
      ? `${prevChordDisplay} → ${currentChordDisplay}`
      : currentChordDisplay;

    // Determine chord function for button display
    // Use the explanation's function property, or detect from roman numeral
    const numeral = context.romanNumeral || '';
    const baseNumeral = numeral.replace(/[0-9majø°]+$/gi, ''); // Strip suffixes to get base
    const chordFunction = explanation?.function || 'unknown';

    // Dominant: V, V7, vii°, VII or function === 'dominant'
    const isDominant = chordFunction === 'dominant' ||
      ['V', 'v', 'VII', 'vii'].includes(baseNumeral) ||
      numeral.startsWith('V') || numeral.startsWith('vii');

    // Subdominant: IV, ii, or function === 'subdominant'
    const isSubdominant = chordFunction === 'subdominant' ||
      ['IV', 'ii', 'II'].includes(baseNumeral) ||
      numeral.startsWith('IV') || numeral.startsWith('ii');

    console.log('[WhyThisWorks] Chord detection:', {
      numeral, baseNumeral, chordFunction, isDominant, isSubdominant
    });

    // Get tonic chord for resolution playback
    const keyRoot = context.key?.replace('m', '') || 'C';
    const isMinorKey = context.key?.includes('m');
    const tonicType = isMinorKey ? 'Minor' : 'Major';

    // Get V chord root for subdominant → dominant playback (needs to be defined before template)
    const scaleDegreesToRoots = {
      'C': 'G', 'G': 'D', 'D': 'A', 'A': 'E', 'E': 'B', 'B': 'F#',
      'F': 'C', 'Bb': 'F', 'Eb': 'Bb', 'Ab': 'Eb', 'Db': 'Ab'
    };
    const dominantRoot = scaleDegreesToRoots[keyRoot] || 'G';
    const dominantChordDisplay = getChordDisplayName(dominantRoot, 'Dominant 7th');
    const tonicChordDisplay = getChordDisplayName(keyRoot, tonicType);

    const popup = document.createElement('div');
    popup.id = 'wtw-fallback-popup';
    popup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      padding: 0;
      max-width: 580px;
      width: 94%;
      max-height: 85vh;
      overflow: hidden;
      z-index: 200000;
      display: flex;
      flex-direction: column;
    `;

    popup.innerHTML = `
      <!-- Header -->
      <div style="background: linear-gradient(135deg, ${functionColor} 0%, ${functionColor}dd 100%); color: white; padding: 20px 24px; position: relative;">
        <button id="wtw-popup-close" style="position: absolute; top: 10px; right: 10px; background: rgba(255,255,255,0.25); border: none; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; color: white; font-size: 28px; display: flex; align-items: center; justify-content: center; transition: background 0.15s; font-weight: 300; z-index: 100;" onmouseover="this.style.background='rgba(255,255,255,0.4)'" onmouseout="this.style.background='rgba(255,255,255,0.25)'">&times;</button>

        <!-- Transition Display per document: "You chose: G → C" -->
        <div style="font-size: 13px; opacity: 0.9; margin-bottom: 8px;">
          ${context.prevChordData ? 'You chose:' : 'Chord:'} <strong>${transitionDisplay}</strong>
          ${context.key ? ` <span style="opacity: 0.8;">(Key of ${context.key})</span>` : ''}
        </div>

        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 56px; height: 56px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700;">
            ${context.romanNumeral}
          </div>
          <div>
            <h3 style="margin: 0; font-size: 20px; font-weight: 700;">${context.chord || ''} ${context.type || ''}</h3>
            <span style="opacity: 0.9; font-size: 14px;">${functionName}</span>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div style="padding: 20px 24px; overflow-y: auto; flex: 1;">

        <!-- 🎯 The Simple Answer (key-aware) -->
        <div style="margin-bottom: 20px;">
          <h4 style="font-size: 16px; font-weight: 600; color: #374151; margin: 0 0 10px 0; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">🎯</span> The Simple Answer
          </h4>
          ${keyAwareExplanation.transitionExplanation ? `
            <p style="color: #4b5563; line-height: 1.7; margin: 0 0 12px 0; font-size: 15px; padding: 12px; background: #f0fdf4; border-radius: 8px; border-left: 3px solid #22c55e;">
              <strong style="color: #15803d;">Why this follows well:</strong> ${keyAwareExplanation.transitionExplanation}
            </p>
          ` : ''}
          <p style="color: #4b5563; line-height: 1.7; margin: 0; font-size: 15px;">
            ${keyAwareExplanation.keySpecificExplanation}
          </p>
        </div>

        <!-- Chord Notes Display Badge -->
        ${keyAwareExplanation.chordNotes?.length > 0 ? `
          <div class="wtw-notes-badge" style="background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%) !important; padding: 12px 18px !important; border-radius: 12px !important; margin-bottom: 18px !important; display: inline-flex !important; align-items: center !important; gap: 10px !important; border: 1px solid #7dd3fc !important; box-shadow: 0 2px 4px rgba(0,0,0,0.05) !important;">
            <span style="font-size: 13px !important; color: #0369a1 !important; font-weight: 500 !important;">Notes:</span>
            <span style="font-weight: 700 !important; color: #0c4a6e !important; letter-spacing: 2px !important; font-size: 15px !important;">${keyAwareExplanation.chordNotes.join(' – ')}</span>
          </div>
        ` : ''}

        <!-- 🎵 Hear It Section with Tension/Resolve buttons -->
        <div style="background: #eff6ff; padding: 16px; border-radius: 10px; margin-bottom: 16px; border: 1px solid #bfdbfe;">
          <h5 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #1e40af; display: flex; align-items: center; gap: 8px;">
            <span>🎵</span> Hear It
          </h5>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            ${isDominant ? `
              <!-- For dominant chords: Hear tension in context, then resolution -->
              <button id="wtw-play-tension" class="wtw-play-btn" data-action="tension" style="display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.15s;">
                <span>▶</span> ${prevChordDisplay ? `Hear ${prevChordDisplay} → ${currentChordDisplay} (tension)` : `Hear ${currentChordDisplay} (tension)`}
              </button>
              <button id="wtw-play-resolve" class="wtw-play-btn" data-action="resolve" style="display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: #22c55e; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.15s;">
                <span>▶</span> Hear ${currentChordDisplay} → ${tonicChordDisplay} (resolve)
              </button>
            ` : isSubdominant ? `
              <!-- For subdominant chords: Hear in context and movement to V -->
              <button id="wtw-play-chord" class="wtw-play-btn" style="display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.15s;">
                <span>▶</span> ${prevChordDisplay ? `Hear ${prevChordDisplay} → ${currentChordDisplay}` : `Play ${currentChordDisplay}`}
              </button>
              <button id="wtw-play-to-dominant" class="wtw-play-btn" data-action="to-dominant" style="display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: #8b5cf6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.15s;">
                <span>▶</span> Hear ${currentChordDisplay} → ${dominantChordDisplay} (to V)
              </button>
            ` : `
              <!-- For other chords: Play in context -->
              <button id="wtw-play-chord" class="wtw-play-btn" style="display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.15s;">
                <span>▶</span> ${prevChordDisplay ? `Hear ${prevChordDisplay} → ${currentChordDisplay}` : `Play ${currentChordDisplay}`}
              </button>
            `}
          </div>
        </div>

        <!-- 🎵 Try These Alternatives (with playback) -->
        ${alternatives.length > 0 ? `
          <div style="background: #fef3c7; padding: 16px; border-radius: 10px; margin-bottom: 16px; border: 1px solid #fcd34d;">
            <h5 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #92400e; display: flex; align-items: center; gap: 8px;">
              <span>🎵</span> Try These Alternatives
            </h5>
            <div style="display: flex; flex-direction: column; gap: 8px;" id="wtw-alternatives">
              ${alternatives.map((alt, idx) => {
                // Format chord name with quality suffix for minor/dim/7th chords
                const toChordName = alt.toChord?.root || alt.numeral;
                const toChordType = alt.toChord?.type || '';
                let toChordSuffix = '';
                if (toChordType === 'Minor 7th' || toChordType === 'm7') {
                  toChordSuffix = 'm7';
                } else if (toChordType === 'Dominant 7th' || toChordType === '7') {
                  toChordSuffix = '7';
                } else if (toChordType === 'Major 7th' || toChordType === 'maj7') {
                  toChordSuffix = 'maj7';
                } else if (toChordType.includes('Diminished')) {
                  toChordSuffix = '°';
                } else if (toChordType.includes('Minor') || toChordType === 'm') {
                  toChordSuffix = 'm';
                }
                const toChordDisplay = toChordName + toChordSuffix;
                const fromChordDisplay = alt.fromChord?.root || '';
                return `
                <button class="wtw-alt-btn" data-idx="${idx}" style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(255,255,255,0.8); border: 1px solid #fcd34d; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.15s;">
                  <span style="color: #3b82f6; font-size: 14px;">▶</span>
                  <span style="font-weight: 600; color: #92400e; min-width: 80px;">${fromChordDisplay} → ${toChordDisplay}</span>
                  <span style="color: #78350f; font-size: 13px; flex: 1;">${alt.description}</span>
                </button>
              `;}).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 💡 Tip / When to Use -->
        ${explanation.whenToUse ? `
          <div style="background: #ecfdf5; padding: 14px 16px; border-radius: 10px; margin-bottom: 16px; border: 1px solid #a7f3d0;">
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <span style="font-size: 18px;">💡</span>
              <div>
                <strong style="color: #065f46; font-size: 13px;">Tip:</strong>
                <span style="color: #047857; font-size: 14px;"> ${explanation.whenToUse}</span>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- 📚 Tell Me the Music Theory (expandable) -->
        <div style="border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
          <button id="wtw-tell-me-more-btn" style="width: 100%; padding: 14px 16px; background: #f9fafb; border: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: 600; color: #374151;">
            <span style="display: flex; align-items: center; gap: 8px;">
              <span>📚</span> Tell Me the Music Theory...
            </span>
            <span id="wtw-expand-icon" style="font-size: 12px; transition: transform 0.2s;">▼</span>
          </button>
          <div id="wtw-advanced-content" style="display: none; padding: 16px; background: white; border-top: 1px solid #e5e7eb;">
            <!-- What musicians call this -->
            <div style="margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 8px;">
              <h6 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #475569;">
                What musicians call this:
              </h6>
              <p style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 500;">
                ${context.romanNumeral === 'V' || context.romanNumeral === 'V7' ? '"Authentic Cadence" or "V-I resolution"' :
                  context.romanNumeral === 'IV' ? '"Subdominant" or "Plagal motion"' :
                  context.romanNumeral === 'ii' || context.romanNumeral === 'ii7' ? '"Supertonic" or "Pre-dominant"' :
                  context.romanNumeral === 'vi' ? '"Submediant" or "Relative minor"' :
                  context.romanNumeral === 'I' ? '"Tonic" - the home chord' :
                  `"${context.romanNumeral}" - ${explanation?.function || 'harmonic'} function`}
              </p>
            </div>

            <!-- Why it works (the science) -->
            ${allLevelExplanations.intermediate?.explanation ? `
              <div style="margin-bottom: 16px;">
                <h6 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #059669;">
                  🌿 Why it works (the science):
                </h6>
                <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
                  ${allLevelExplanations.intermediate.explanation}
                </p>
              </div>
            ` : ''}

            <!-- Voice leading diagram for dominant chords -->
            ${isDominant && keyAwareExplanation.chordNotes?.length >= 3 ? `
              <div style="margin-bottom: 16px; padding: 12px; background: #fef3c7; border-radius: 8px;">
                <h6 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #92400e;">
                  Voice Leading (how notes move):
                </h6>
                <div style="font-family: monospace; font-size: 13px; color: #78350f; line-height: 1.8;">
                  ${keyAwareExplanation.chordNotes[1] || 'B'} → ${keyRoot} (leading tone resolves UP)<br>
                  ${keyAwareExplanation.chordNotes[3] ? `${keyAwareExplanation.chordNotes[3]} → ${getChordNoteNames(keyRoot, tonicType)[1] || 'E'} (7th resolves DOWN)<br>` : ''}
                  ${keyAwareExplanation.chordNotes[0]} → ${keyRoot} or ${getChordNoteNames(keyRoot, tonicType)[2] || 'G'} (root moves to tonic)
                </div>
              </div>
            ` : ''}

            <!-- Advanced theory -->
            ${allLevelExplanations.advanced?.explanation ? `
              <div>
                <h6 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #7c3aed;">
                  🌳 Advanced:
                </h6>
                <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
                  ${allLevelExplanations.advanced.explanation}
                </p>
              </div>
            ` : ''}
          </div>
        </div>

      </div>
    `;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'wtw-fallback-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 199999;
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(popup);

    // Close handlers
    const closePopup = () => {
      popup.remove();
      overlay.remove();
    };

    document.getElementById('wtw-popup-close').addEventListener('click', closePopup);
    overlay.addEventListener('click', closePopup);
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        closePopup();
        document.removeEventListener('keydown', escHandler);
      }
    });

    // === PLAYBACK BUTTON HANDLERS ===
    // (dominantRoot is already defined above before the template)

    // Play the chord (with previous chord context if available)
    const playChordBtn = document.getElementById('wtw-play-chord');
    if (playChordBtn) {
      playChordBtn.addEventListener('click', () => {
        if (context.prevChordData) {
          // Play previous chord → current chord sequence
          playChordSequence([
            { root: context.prevChordData.root, type: context.prevChordData.type },
            { root: context.chord, type: context.type }
          ], 0.9);
        } else {
          // No previous chord, just play the current chord
          playChordPreview(context.chord, context.type, 1.5);
        }
      });
    }

    // Play tension (with previous chord context if available)
    const playTensionBtn = document.getElementById('wtw-play-tension');
    if (playTensionBtn) {
      playTensionBtn.addEventListener('click', () => {
        if (context.prevChordData) {
          // Play previous chord → tension chord sequence
          playChordSequence([
            { root: context.prevChordData.root, type: context.prevChordData.type },
            { root: context.chord, type: context.type }
          ], 0.9);
        } else {
          // No previous chord, just play the tension chord
          playChordPreview(context.chord, context.type, 2);
        }
      });
    }

    // Play resolution (dominant → tonic)
    const playResolveBtn = document.getElementById('wtw-play-resolve');
    if (playResolveBtn) {
      playResolveBtn.addEventListener('click', () => {
        playChordSequence([
          { root: context.chord, type: context.type },
          { root: keyRoot, type: tonicType }
        ], 1);
      });
    }

    // Play subdominant → dominant
    const playToDominantBtn = document.getElementById('wtw-play-to-dominant');
    if (playToDominantBtn) {
      playToDominantBtn.addEventListener('click', () => {
        playChordSequence([
          { root: context.chord, type: context.type },
          { root: dominantRoot, type: 'Major' }
        ], 1);
      });
    }

    // Alternative chord playback buttons
    const altBtns = popup.querySelectorAll('.wtw-alt-btn');
    altBtns.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        const alt = alternatives[idx];
        if (alt?.fromChord && alt?.toChord) {
          playChordSequence([alt.fromChord, alt.toChord], 0.9);
        } else if (alt?.toChord) {
          playChordPreview(alt.toChord.root, alt.toChord.type, 1.5);
        }
      });
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(255,255,255,1)';
        btn.style.transform = 'translateX(4px)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(255,255,255,0.8)';
        btn.style.transform = 'translateX(0)';
      });
    });

    // Hover effects for all play buttons
    popup.querySelectorAll('.wtw-play-btn').forEach(btn => {
      const originalBg = btn.style.background;
      btn.addEventListener('mouseenter', () => {
        btn.style.filter = 'brightness(1.1)';
        btn.style.transform = 'scale(1.02)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.filter = 'brightness(1)';
        btn.style.transform = 'scale(1)';
      });
    });

    // Tell me more expansion
    const tellMeMoreBtn = document.getElementById('wtw-tell-me-more-btn');
    const advancedContent = document.getElementById('wtw-advanced-content');
    const expandIcon = document.getElementById('wtw-expand-icon');

    if (tellMeMoreBtn && advancedContent) {
      tellMeMoreBtn.addEventListener('click', () => {
        const isExpanded = advancedContent.style.display !== 'none';
        advancedContent.style.display = isExpanded ? 'none' : 'block';
        expandIcon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
      });
    }

    console.log('[WhyThisWorks] Enhanced popup created successfully');

  } catch (err) {
    console.error('[WhyThisWorks] Error in showFallbackExplanation:', err);
    alert(`${context.chord || ''} (${context.romanNumeral})\n\n${explanation?.explanation || context.reason || 'This chord works well here.'}`);
  }
}

/**
 * Open the panel and make it visible
 */
function openWhyThisWorksPanel() {
  const panel = document.getElementById('why-this-works-panel');
  const content = document.getElementById('wtw-content');
  const chevron = document.getElementById('wtw-chevron');

  if (panel) {
    panel.classList.remove('hidden');
  }
  if (content) {
    content.classList.remove('hidden');
  }
  if (chevron) {
    chevron.classList.remove('rotate-180');
  }

  isPanelVisible = true;
}

/**
 * Show explanation for a chord in context
 * @param {Object} context - Chord context object
 * @param {string} context.chord - Chord root (e.g., "C", "G")
 * @param {string} context.type - Chord type (e.g., "Major", "minor")
 * @param {string} context.romanNumeral - Roman numeral (e.g., "V", "ii")
 * @param {string} context.prevChord - Previous chord's Roman numeral (optional)
 * @param {string} context.nextChord - Next chord's Roman numeral (optional)
 * @param {Array} context.reasons - Recommendation reasons (optional)
 * @param {number} context.confidence - Confidence score (optional)
 */
function showWhyThisWorks(context) {
  console.log('[WhyThisWorks] Called with context:', context);
  currentChordContext = context;

  // Get the theory explanation
  let explanation;
  try {
    explanation = getWhyThisWorks(
      context.romanNumeral,
      context.prevChord,
      context.nextChord,
      currentSkillLevel
    );
    console.log('[WhyThisWorks] Got explanation:', explanation);
  } catch (err) {
    console.error('[WhyThisWorks] Error getting explanation:', err);
    explanation = {
      title: 'Chord Information',
      explanation: context.reason || 'This chord works well in this context.',
      function: 'unknown'
    };
  }

  // Show the popup modal
  showFallbackExplanation(context, explanation);
}

/**
 * Build the explanation HTML
 */
function buildExplanationHTML(context, explanation, chordFunc) {
  const functionColor = explanation.color || FUNCTION_COLORS[explanation.function] || '#888';
  const functionName = getFunctionDisplayName(explanation.function);

  // Get transition explanation if available
  let transitionHTML = '';
  if (context.prevChord && explanation.contextualInfo) {
    transitionHTML = `
      <div class="p-3 bg-blue-50 rounded-lg border border-blue-200">
        <h5 class="text-sm font-bold text-blue-800 mb-1 flex items-center gap-2">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
          ${context.prevChord} → ${context.romanNumeral}
        </h5>
        <p class="text-sm text-blue-700">${explanation.contextualInfo}</p>
      </div>
    `;
  }

  // Build reasons section from recommendation
  let reasonsHTML = '';
  if (context.reasons && context.reasons.length > 0) {
    reasonsHTML = `
      <div class="p-3 bg-purple-50 rounded-lg border border-purple-200">
        <h5 class="text-sm font-bold text-purple-800 mb-2">Why It's Recommended Here</h5>
        <div class="space-y-2">
          ${context.reasons.map(reason => `
            <div class="flex items-start gap-2">
              <span class="text-purple-500 mt-0.5">•</span>
              <div class="text-sm">
                <span class="font-medium text-purple-700">${formatCategory(reason.category)}:</span>
                <span class="text-purple-600">${reason.commonTalk || reason.explanation}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Build suggestions section
  let suggestionsHTML = '';
  if (explanation.suggestions && explanation.suggestions.length > 0) {
    suggestionsHTML = `
      <div class="p-3 bg-amber-50 rounded-lg border border-amber-200">
        <h5 class="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"></path>
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"></path>
          </svg>
          Common Next Moves
        </h5>
        <div class="flex flex-wrap gap-2">
          ${explanation.suggestions.map(sugg => `
            <span class="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full border border-amber-300">
              → ${sugg}
            </span>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Build advanced section (only for intermediate/advanced)
  let advancedHTML = '';
  if (currentSkillLevel !== 'simple' && chordFunc) {
    const levelData = chordFunc[currentSkillLevel];
    if (levelData) {
      let advancedContent = '';

      if (levelData.function) {
        advancedContent += `<p><strong>Function:</strong> ${levelData.function}</p>`;
      }
      if (levelData.extensions) {
        advancedContent += `<p><strong>Extensions:</strong> ${levelData.extensions}</p>`;
      }
      if (currentSkillLevel === 'advanced') {
        if (levelData.voiceLeading) {
          advancedContent += `<p><strong>Voice Leading:</strong> ${levelData.voiceLeading}</p>`;
        }
        if (levelData.substitutes) {
          advancedContent += `<p><strong>Substitutes:</strong> ${levelData.substitutes}</p>`;
        }
      }

      if (advancedContent) {
        advancedHTML = `
          <div class="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <h5 class="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z"></path>
              </svg>
              ${currentSkillLevel === 'advanced' ? 'Technical Details' : 'Learn More'}
            </h5>
            <div class="text-sm text-gray-700 space-y-1">
              ${advancedContent}
            </div>
          </div>
        `;
      }
    }
  }

  return `
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md"
             style="background-color: ${functionColor}">
          ${context.romanNumeral}
        </div>
        <div>
          <h4 class="text-lg font-bold text-gray-800">${context.chord} ${context.type}</h4>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 text-xs font-medium rounded-full text-white"
                  style="background-color: ${functionColor}">
              ${functionName}
            </span>
            ${context.confidence ? `
              <span class="text-xs text-gray-500">${context.confidence}% match</span>
            ` : ''}
          </div>
        </div>
      </div>
      ${explanation.feeling ? `
        <div class="text-right">
          <span class="text-xs text-gray-500">Feeling</span>
          <p class="text-sm font-medium text-gray-700">${explanation.feeling}</p>
        </div>
      ` : ''}
    </div>

    <!-- Main Explanation -->
    <div class="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
      <h5 class="text-sm font-bold text-emerald-800 mb-2">${explanation.title || 'About This Chord'}</h5>
      <p class="text-sm text-emerald-700 leading-relaxed">${explanation.explanation}</p>
      ${explanation.whenToUse ? `
        <p class="mt-2 text-sm text-emerald-600 italic">
          <strong>Tip:</strong> ${explanation.whenToUse}
        </p>
      ` : ''}
    </div>

    ${transitionHTML}
    ${reasonsHTML}
    ${suggestionsHTML}
    ${advancedHTML}
  `;
}

// ===========================================
// GLOSSARY
// ===========================================

/**
 * Show relevant glossary terms based on context
 */
function showRelevantGlossary(context, explanation) {
  const glossarySection = document.getElementById('wtw-glossary');
  const glossaryContent = document.getElementById('wtw-glossary-content');

  if (!glossarySection || !glossaryContent) return;

  // Determine relevant terms based on context
  const relevantTermKeys = [];

  // Add terms based on chord function
  if (explanation.function === 'tonic') {
    relevantTermKeys.push('tonic', 'resolution');
  } else if (explanation.function === 'dominant') {
    relevantTermKeys.push('dominant', 'leading-tone', 'resolution');
  } else if (explanation.function === 'subdominant') {
    relevantTermKeys.push('subdominant', 'pre-dominant');
  }

  // Add terms based on skill level
  if (currentSkillLevel === 'intermediate' || currentSkillLevel === 'advanced') {
    relevantTermKeys.push('cadence', 'voice-leading');
  }
  if (currentSkillLevel === 'advanced') {
    relevantTermKeys.push('tritone');
  }

  // Get unique terms
  const uniqueTerms = [...new Set(relevantTermKeys)];

  if (uniqueTerms.length === 0) {
    glossarySection.classList.add('hidden');
    return;
  }

  // Build glossary HTML
  const termsHTML = uniqueTerms.map(key => {
    const term = getTerm(key);
    if (!term) return '';

    const definition = currentSkillLevel === 'advanced' ? term.technical : term.simple;

    return `
      <div class="p-2 bg-emerald-50 rounded border border-emerald-100">
        <span class="font-medium text-emerald-800">${term.term}:</span>
        <span class="text-gray-600">${definition}</span>
      </div>
    `;
  }).filter(Boolean).join('');

  if (termsHTML) {
    glossaryContent.innerHTML = termsHTML;
    glossarySection.classList.remove('hidden');
  } else {
    glossarySection.classList.add('hidden');
  }
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Get display name for chord function
 */
function getFunctionDisplayName(func) {
  const names = {
    'tonic': 'Tonic (Home)',
    'dominant': 'Dominant (Tension)',
    'subdominant': 'Subdominant (Journey)'
  };
  return names[func] || func || 'Unknown';
}

/**
 * Format category name for display
 */
function formatCategory(category) {
  if (!category) return '';
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Get Roman numeral for a chord in a key
 * This is a simplified version - the real implementation
 * would use the existing analysis functions
 */
export function getRomanNumeralForChord(chordRoot, chordType, key) {
  // This maps chord roots to Roman numerals based on key
  // Simplified for common cases
  const majorKeyNumerals = {
    'C': { 'C': 'I', 'Dm': 'ii', 'Em': 'iii', 'F': 'IV', 'G': 'V', 'Am': 'vi', 'Bdim': 'vii°' },
    'G': { 'G': 'I', 'Am': 'ii', 'Bm': 'iii', 'C': 'IV', 'D': 'V', 'Em': 'vi', 'F#dim': 'vii°' },
    'D': { 'D': 'I', 'Em': 'ii', 'F#m': 'iii', 'G': 'IV', 'A': 'V', 'Bm': 'vi', 'C#dim': 'vii°' },
    'A': { 'A': 'I', 'Bm': 'ii', 'C#m': 'iii', 'D': 'IV', 'E': 'V', 'F#m': 'vi', 'G#dim': 'vii°' },
    'E': { 'E': 'I', 'F#m': 'ii', 'G#m': 'iii', 'A': 'IV', 'B': 'V', 'C#m': 'vi', 'D#dim': 'vii°' },
    'F': { 'F': 'I', 'Gm': 'ii', 'Am': 'iii', 'Bb': 'IV', 'C': 'V', 'Dm': 'vi', 'Edim': 'vii°' }
  };

  const keyMap = majorKeyNumerals[key];
  if (!keyMap) return context.romanNumeral || '?';

  const chordName = chordRoot + (chordType === 'minor' ? 'm' : chordType === 'diminished' ? 'dim' : '');
  return keyMap[chordName] || keyMap[chordRoot] || '?';
}

// ===========================================
// EXPORTS
// ===========================================

export {
  showWhyThisWorks,
  openWhyThisWorksPanel,
  currentSkillLevel
};
