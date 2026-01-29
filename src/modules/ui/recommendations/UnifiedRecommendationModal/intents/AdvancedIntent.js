/**
 * Advanced Intent Renderer for Chord Tab
 *
 * Handles advanced harmonic techniques:
 * - Borrowed Chords (Modal Interchange)
 * - Secondary Dominants
 * - Chromatic Mediants
 *
 * Extracted from ChordTab.js for maintainability.
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { CHORD_DEFINITIONS } from '../../../../../data/music-data.js';
import { spellNoteInKey } from '../../../../utils/noteUtils.js';
import { getCurrentKey, getProgressionData } from '../../../../state/trainerState.js';
import { modalState } from '../ModalState.js';
import { hideAllScoreTooltips, getInversionLabel } from '../MusicUtils.js';
import { setupHoldToPlay } from '../AudioPlayback.js';

// ============================================================================
// CONSTANTS
// ============================================================================

// Normalized notes array for interval calculations
const ALL_NOTES_NORM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper: Normalize note for comparison (convert flats to sharps)
 */
function normalizeNoteForComparison(note) {
    const enharmonics = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
    return enharmonics[note] || note;
}

/**
 * Helper: Get chord notes for display in explanation modals
 */
function getChordNotesForDisplay(root, type) {
    const chordDef = CHORD_DEFINITIONS[type];
    if (!chordDef) return [root];

    const notes = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    const rootIndex = notes.findIndex(n => normalizeNoteForComparison(n) === normalizeNoteForComparison(root));
    if (rootIndex === -1) return [root];

    return chordDef.intervals.slice(0, 3).map(interval => {
        const noteIndex = (rootIndex + interval) % 12;
        return notes[noteIndex];
    });
}

/**
 * Helper: Get chord name for a scale degree
 */
function getChordInKeyForDegree(degree, key) {
    const notes = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    const keyIndex = notes.indexOf(key);
    if (keyIndex === -1) return degree;

    const degreeToSemitone = {
        'I': 0, 'ii': 2, 'II': 2, 'iii': 4, 'III': 4, 'IV': 5, 'iv': 5,
        'V': 7, 'vi': 9, 'VI': 9, 'vii': 11, 'VII': 11
    };

    const semitone = degreeToSemitone[degree];
    if (semitone === undefined) return degree;

    const noteIndex = (keyIndex + semitone) % 12;
    const chordRoot = notes[noteIndex];

    // Determine quality based on degree
    const minorDegrees = ['ii', 'iii', 'vi'];
    const isMinor = minorDegrees.includes(degree);

    return isMinor ? `${chordRoot}m` : chordRoot;
}

/**
 * Helper: Convert mode identifiers to readable names
 */
function formatModeName(mode) {
    if (!mode) return '';
    const modeNames = {
        'parallel-minor': 'Parallel Minor',
        'dorian': 'Dorian',
        'phrygian': 'Phrygian',
        'lydian': 'Lydian',
        'mixolydian': 'Mixolydian',
        'aeolian': 'Aeolian'
    };
    return modeNames[mode] || mode.charAt(0).toUpperCase() + mode.slice(1);
}

/**
 * Normalize key to sharp notation for index calculations
 */
function normalizeKeyForIndex(key) {
    return key.replace('b', '#')
        .replace('Db', 'C#')
        .replace('Eb', 'D#')
        .replace('Gb', 'F#')
        .replace('Ab', 'G#')
        .replace('Bb', 'A#');
}

// ============================================================================
// CHORD GENERATORS
// ============================================================================

/**
 * Generate borrowed chords for a given key
 */
function generateBorrowedChordsForKey(key) {
    const keyIndex = ALL_NOTES_NORM.indexOf(normalizeKeyForIndex(key));
    const borrowed = [];

    // From Parallel Minor: bIII, iv, bVI, bVII
    const bIII = ALL_NOTES_NORM[(keyIndex + 3) % 12];
    borrowed.push({
        root: bIII,
        type: 'Major',
        display: `${spellNoteInKey(bIII, key)}`,
        numeral: 'bIII',
        description: 'Adds rock/blues color',
        placementHint: 'Try between I and IV, or in I-bIII-IV-I progressions',
        source: 'Parallel Minor',
        color: '#8b5cf6'
    });

    const iv = ALL_NOTES_NORM[(keyIndex + 5) % 12];
    borrowed.push({
        root: iv,
        type: 'Minor',
        display: `${spellNoteInKey(iv, key)}m`,
        numeral: 'iv',
        description: 'Minor subdominant - melancholy touch',
        placementHint: 'Try before I (plagal cadence) or as substitute for IV before V',
        source: 'Parallel Minor',
        color: '#8b5cf6'
    });

    const bVI = ALL_NOTES_NORM[(keyIndex + 8) % 12];
    borrowed.push({
        root: bVI,
        type: 'Major',
        display: `${spellNoteInKey(bVI, key)}`,
        numeral: 'bVI',
        description: 'Dramatic, uplifting surprise',
        placementHint: 'Try after V for deceptive cadence, or before V as pre-dominant',
        source: 'Parallel Minor',
        color: '#8b5cf6'
    });

    const bVII = ALL_NOTES_NORM[(keyIndex + 10) % 12];
    borrowed.push({
        root: bVII,
        type: 'Major',
        display: `${spellNoteInKey(bVII, key)}`,
        numeral: 'bVII',
        description: 'Rock/folk staple - bluesy, earthy',
        placementHint: 'Try before I (bVII-I) or in bVII-IV-I patterns',
        source: 'Mixolydian',
        color: '#a855f7'
    });

    // From Dorian: IV (major IV in minor)
    const IV = ALL_NOTES_NORM[(keyIndex + 5) % 12];
    borrowed.push({
        root: IV,
        type: 'Major',
        display: `${spellNoteInKey(IV, key)}`,
        numeral: 'IV',
        description: 'Major IV in minor key - Dorian brightness',
        placementHint: 'In minor keys: try before i or v for unexpected lift',
        source: 'Dorian',
        color: '#a855f7'
    });

    // From Lydian: #IV dim
    const sharpIV = ALL_NOTES_NORM[(keyIndex + 6) % 12];
    borrowed.push({
        root: sharpIV,
        type: 'Diminished',
        display: `${spellNoteInKey(sharpIV, key)}°`,
        numeral: '#iv°',
        description: 'Dreamy, floating quality',
        placementHint: 'Try as passing chord between IV and V',
        source: 'Lydian',
        color: '#c084fc'
    });

    return borrowed;
}

/**
 * Generate secondary dominants for a given key
 */
function generateSecondaryDominantsForKey(key) {
    const keyIndex = ALL_NOTES_NORM.indexOf(normalizeKeyForIndex(key));
    const secondaryDoms = [];

    // V/ii - resolves to ii
    const ii = ALL_NOTES_NORM[(keyIndex + 2) % 12];
    const VofII = ALL_NOTES_NORM[(keyIndex + 9) % 12];
    secondaryDoms.push({
        root: VofII,
        type: 'Dominant 7th',
        display: `${spellNoteInKey(VofII, key)}7`,
        numeral: 'V7/ii',
        description: `Pulls strongly to ${spellNoteInKey(ii, key)}m`,
        source: `Resolves to ii (${spellNoteInKey(ii, key)}m)`,
        color: '#f59e0b'
    });

    // V/iii - resolves to iii
    const iii = ALL_NOTES_NORM[(keyIndex + 4) % 12];
    const VofIII = ALL_NOTES_NORM[(keyIndex + 11) % 12];
    secondaryDoms.push({
        root: VofIII,
        type: 'Dominant 7th',
        display: `${spellNoteInKey(VofIII, key)}7`,
        numeral: 'V7/iii',
        description: `Pulls strongly to ${spellNoteInKey(iii, key)}m`,
        source: `Resolves to iii (${spellNoteInKey(iii, key)}m)`,
        color: '#f59e0b'
    });

    // V/IV - resolves to IV
    const IV = ALL_NOTES_NORM[(keyIndex + 5) % 12];
    const VofIV = ALL_NOTES_NORM[(keyIndex + 0) % 12];
    secondaryDoms.push({
        root: VofIV,
        type: 'Dominant 7th',
        display: `${spellNoteInKey(VofIV, key)}7`,
        numeral: 'V7/IV',
        description: `Pulls strongly to ${spellNoteInKey(IV, key)} - bluesy!`,
        source: `Resolves to IV (${spellNoteInKey(IV, key)})`,
        color: '#f59e0b'
    });

    // V/V - resolves to V (the most common)
    const V = ALL_NOTES_NORM[(keyIndex + 7) % 12];
    const VofV = ALL_NOTES_NORM[(keyIndex + 2) % 12];
    secondaryDoms.push({
        root: VofV,
        type: 'Dominant 7th',
        display: `${spellNoteInKey(VofV, key)}7`,
        numeral: 'V7/V',
        description: `The classic - pulls to ${spellNoteInKey(V, key)}`,
        source: `Resolves to V (${spellNoteInKey(V, key)})`,
        color: '#f59e0b'
    });

    // V/vi - resolves to vi
    const vi = ALL_NOTES_NORM[(keyIndex + 9) % 12];
    const VofVI = ALL_NOTES_NORM[(keyIndex + 4) % 12];
    secondaryDoms.push({
        root: VofVI,
        type: 'Dominant 7th',
        display: `${spellNoteInKey(VofVI, key)}7`,
        numeral: 'V7/vi',
        description: `Pulls strongly to ${spellNoteInKey(vi, key)}m`,
        source: `Resolves to vi (${spellNoteInKey(vi, key)}m)`,
        color: '#f59e0b'
    });

    return secondaryDoms;
}

/**
 * Generate chromatic mediants for a given key
 */
function generateChromaticMediantsForKey(key) {
    const keyIndex = ALL_NOTES_NORM.indexOf(normalizeKeyForIndex(key));
    const mediants = [];

    // Upper chromatic mediants (a major 3rd up)
    const upperMajor = ALL_NOTES_NORM[(keyIndex + 4) % 12];
    mediants.push({
        root: upperMajor,
        type: 'Major',
        display: `${spellNoteInKey(upperMajor, key)}`,
        numeral: 'III',
        description: 'Bright, cinematic shift upward',
        source: 'Upper chromatic mediant',
        color: '#06b6d4'
    });

    // Lower chromatic mediants (major 3rd down)
    const lowerMajor = ALL_NOTES_NORM[(keyIndex + 8) % 12];
    mediants.push({
        root: lowerMajor,
        type: 'Major',
        display: `${spellNoteInKey(lowerMajor, key)}`,
        numeral: 'bVI',
        description: 'Dramatic, unexpected shift down',
        source: 'Lower chromatic mediant',
        color: '#06b6d4'
    });

    // Minor 3rd chromatic mediants
    const upperMinor = ALL_NOTES_NORM[(keyIndex + 3) % 12];
    mediants.push({
        root: upperMinor,
        type: 'Major',
        display: `${spellNoteInKey(upperMinor, key)}`,
        numeral: 'bIII',
        description: 'Rich, colorful shift - film score favorite',
        source: 'Upper minor chromatic mediant',
        color: '#0891b2'
    });

    const lowerMinor = ALL_NOTES_NORM[(keyIndex + 9) % 12];
    mediants.push({
        root: lowerMinor,
        type: 'Major',
        display: `${spellNoteInKey(lowerMinor, key)}`,
        numeral: 'VI',
        description: 'Bold, confident shift',
        source: 'Lower minor chromatic mediant',
        color: '#0891b2'
    });

    // Neapolitan chord
    const bII = ALL_NOTES_NORM[(keyIndex + 1) % 12];
    mediants.push({
        root: bII,
        type: 'Major',
        display: `${spellNoteInKey(bII, key)}`,
        numeral: 'bII',
        description: 'Neapolitan - exotic, mysterious quality',
        source: 'Neapolitan chord',
        color: '#14b8a6'
    });

    return mediants;
}

// ============================================================================
// SCORING
// ============================================================================

/**
 * Score how well an advanced chord follows the selected chord
 * Returns { score: 0-100, reasons: string[], isRecommended: boolean }
 */
function scoreAdvancedChordInContext(advancedChord, context, sectionType) {
    if (!context.hasContext || !context.selectedChord) {
        return { score: 0, reasons: [], isRecommended: false };
    }

    const { selectedChord, key } = context;
    const reasons = [];
    let score = 0;

    // Normalize roots for comparison
    const selectedRoot = normalizeNoteForComparison(selectedChord.root);
    const advancedRoot = normalizeNoteForComparison(advancedChord.root);

    // Calculate interval between selected chord root and advanced chord root
    const selectedIdx = ALL_NOTES_NORM.indexOf(selectedRoot);
    const advancedIdx = ALL_NOTES_NORM.indexOf(advancedRoot);
    const interval = (advancedIdx - selectedIdx + 12) % 12;

    // === SCORING CRITERIA ===

    // 1. Secondary Dominant resolving to selected chord's function
    if (sectionType === 'secondary-dominant') {
        const target = advancedChord.numeral.replace('V7/', '');
        const selectedType = selectedChord.type;
        const isMinorSelected = selectedType === 'Minor' || selectedType === 'Minor 7th';

        // Map scale degrees to intervals from tonic
        const degreeIntervals = { 'ii': 2, 'iii': 4, 'IV': 5, 'V': 7, 'vi': 9 };
        const targetInterval = degreeIntervals[target];

        // Calculate what interval the selected chord is from the key
        const keyIdx = ALL_NOTES_NORM.indexOf(normalizeNoteForComparison(key));
        const selectedIntervalFromKey = (selectedIdx - keyIdx + 12) % 12;

        // If the secondary dominant resolves TO the selected chord, it's a setup
        if (targetInterval === selectedIntervalFromKey) {
            score += 40;
            reasons.push(`Sets up ${advancedChord.display} - ${selectedChord.root} resolution`);
        }

        // If selected chord could lead INTO this secondary dominant
        if (interval === 5) { // Perfect 4th up
            score += 25;
            reasons.push('Smooth voice leading from selected chord');
        }
        if (interval === 7) { // Perfect 5th up
            score += 20;
            reasons.push('Strong root motion by 5th');
        }
    }

    // 2. Borrowed chords - evaluate modal color
    if (sectionType === 'borrowed') {
        // bVI after V creates deceptive cadence feel
        if (advancedChord.numeral === 'bVI' && selectedChord.type?.includes('Dominant')) {
            score += 45;
            reasons.push('Classic deceptive cadence: V - bVI');
        }
        // bVII after I or IV is very common in rock/pop
        if (advancedChord.numeral === 'bVII') {
            if (interval === 10) {
                score += 30;
                reasons.push('Natural mixolydian movement');
            }
        }
        // iv after IV creates powerful minor plagal feel
        if (advancedChord.numeral === 'iv' && selectedChord.type === 'Major' && interval === 0) {
            score += 35;
            reasons.push('Modal interchange: major to minor subdominant');
        }
        // bIII after I or vi
        if (advancedChord.numeral === 'bIII') {
            if (interval === 3) {
                score += 30;
                reasons.push('Colorful chromatic mediant relationship');
            }
        }
        // Smooth voice leading (step-wise root motion)
        if (interval === 1 || interval === 2 || interval === 10 || interval === 11) {
            score += 15;
            reasons.push('Smooth chromatic/step-wise root motion');
        }
    }

    // 3. Chromatic mediants - evaluate dramatic shift potential
    if (sectionType === 'chromatic-mediant') {
        // Major 3rd relationships (interval 4 or 8)
        if (interval === 4 || interval === 8) {
            score += 40;
            reasons.push('Major 3rd chromatic mediant: dramatic color shift');
        }
        // Minor 3rd relationships (interval 3 or 9)
        if (interval === 3 || interval === 9) {
            score += 35;
            reasons.push('Minor 3rd chromatic mediant: rich harmonic color');
        }
        // Neapolitan (bII) works especially well before V or as surprise
        if (advancedChord.numeral === 'bII') {
            if (selectedChord.type?.includes('Dominant')) {
                score += 30;
                reasons.push('Neapolitan approach: unexpected before dominant');
            }
            score += 20;
            reasons.push('Neapolitan chord: exotic, mysterious quality');
        }
    }

    // 4. Universal bonuses - Common tone bonus
    const selectedNotes = getChordNotesForDisplay(selectedChord.root, selectedChord.type);
    const advancedNotes = getChordNotesForDisplay(advancedChord.root, advancedChord.type);
    const commonTones = selectedNotes.filter(n =>
        advancedNotes.some(a => normalizeNoteForComparison(a) === normalizeNoteForComparison(n))
    );
    if (commonTones.length > 0) {
        score += commonTones.length * 8;
        reasons.push(`${commonTones.length} common tone${commonTones.length > 1 ? 's' : ''} for smooth voice leading`);
    }

    // Determine if recommended (threshold)
    const isRecommended = score >= 25;

    return { score, reasons, isRecommended };
}

// ============================================================================
// EXPLANATION MODALS
// ============================================================================

/**
 * Show detailed explanation modal for advanced harmonic techniques
 */
function showAdvancedExplanationModal(item) {
    // Hide any open score tooltips before opening this modal
    hideAllScoreTooltips();

    // Remove existing modal if present
    const existingModal = document.getElementById('advanced-explanation-modal');
    if (existingModal) existingModal.remove();

    const { type, chordRoot, chordType, key, borrowedFrom, target, mediantDetails,
            contextChord, recommendationReasons, isRecommended } = item;
    const chordSymbol = CHORD_DEFINITIONS[chordType]?.symbol || '';
    const chordName = `${chordRoot}${chordSymbol}`;

    // Generate content based on type
    let title = '';
    let headerGradient = '';

    if (type === 'modal-interchange') {
        title = `Modal Interchange: ${chordName}`;
        headerGradient = 'from-violet-600 to-purple-600';
    } else if (type === 'secondary-dominant') {
        title = `Secondary Dominant: ${chordName}`;
        headerGradient = 'from-amber-500 to-orange-500';
    } else if (type === 'chromatic-mediant') {
        title = `Chromatic Mediant: ${chordName}`;
        headerGradient = 'from-cyan-500 to-teal-500';
    }

    // Build context chord display name
    let contextDisplay = '';
    if (contextChord) {
        const contextSymbol = CHORD_DEFINITIONS[contextChord.type]?.symbol || '';
        contextDisplay = `${contextChord.root}${contextSymbol}`;
    }

    // Generate recommendation section HTML
    const generateRecommendationSection = () => {
        if (!isRecommended || !recommendationReasons || recommendationReasons.length === 0) {
            return '';
        }

        const reasonsList = recommendationReasons.map(r =>
            `<li class="flex items-start gap-2"><span class="text-emerald-500 mt-0.5">OK</span><span>${r}</span></li>`
        ).join('');

        return `
            <div class="bg-emerald-50 rounded-lg p-4 border-2 border-emerald-300 mb-4">
                <div class="flex items-center gap-2 mb-2">
                    <span class="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded uppercase">Recommended</span>
                    <span class="text-emerald-700 text-sm font-medium">after ${contextDisplay}</span>
                </div>
                <h4 class="font-semibold text-emerald-800 mb-2">Why This Chord Works Here</h4>
                <ul class="text-sm text-emerald-700 space-y-1">
                    ${reasonsList}
                </ul>
            </div>
        `;
    };

    // Function to generate content based on selected key
    const generateContent = (selectedKey) => {
        const recommendationHTML = generateRecommendationSection();
        let explanationHTML = '';

        if (type === 'modal-interchange') {
            explanationHTML = generateModalInterchangeExplanation(chordRoot, chordType, selectedKey, borrowedFrom);
        } else if (type === 'secondary-dominant') {
            explanationHTML = generateSecondaryDominantExplanation(chordRoot, chordType, selectedKey, target);
        } else if (type === 'chromatic-mediant') {
            explanationHTML = generateChromaticMediantExplanation(chordRoot, chordType, selectedKey, mediantDetails);
        }

        return recommendationHTML + explanationHTML;
    };

    const modalHTML = `
        <div id="advanced-explanation-modal" class="fixed inset-0 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.6); z-index: 100001;">
            <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col">
                <!-- Header -->
                <div class="bg-gradient-to-r ${headerGradient} px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 class="text-lg font-bold text-white">${title}</h2>
                        <p class="text-white/80 text-sm mt-1">Key of ${key} major</p>
                    </div>
                    <button id="close-advanced-modal" class="text-white/80 hover:text-white transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <!-- Content -->
                <div id="advanced-modal-content" class="p-6 overflow-y-auto flex-1">
                    ${generateContent(key)}
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 bg-gray-50 border-t flex justify-end">
                    <button id="dismiss-advanced-modal" class="px-4 py-2 bg-gradient-to-r ${headerGradient} text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium">
                        Got it!
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add event listeners
    const modal = document.getElementById('advanced-explanation-modal');
    const closeBtn = document.getElementById('close-advanced-modal');
    const dismissBtn = document.getElementById('dismiss-advanced-modal');

    const closeModal = () => modal.remove();

    closeBtn.addEventListener('click', closeModal);
    dismissBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

/**
 * Generate modal interchange explanation content
 */
function generateModalInterchangeExplanation(chordRoot, chordType, key, borrowedFrom) {
    const modeName = formatModeName(borrowedFrom);
    const chordSymbol = CHORD_DEFINITIONS[chordType]?.symbol || '';
    const chordName = `${chordRoot}${chordSymbol}`;

    // Determine what the diatonic equivalent would be
    const chordDef = CHORD_DEFINITIONS[chordType];
    const isMinor = chordDef?.intervals?.includes(3);
    const diatonicType = isMinor ? 'Major' : 'Minor';
    const diatonicSymbol = CHORD_DEFINITIONS[diatonicType]?.symbol || '';
    const diatonicName = `${chordRoot}${diatonicSymbol}`;

    // Get chord notes
    const borrowedNotes = getChordNotesForDisplay(chordRoot, chordType);
    const diatonicNotes = getChordNotesForDisplay(chordRoot, diatonicType);

    // Find the altered note
    const alteredNote = borrowedNotes.find(n => !diatonicNotes.some(d => normalizeNoteForComparison(d) === normalizeNoteForComparison(n)));
    const originalNote = diatonicNotes.find(n => !borrowedNotes.some(b => normalizeNoteForComparison(b) === normalizeNoteForComparison(n)));

    return `
        <div class="space-y-4">
            <div class="prose prose-sm max-w-none text-gray-700">
                <p><strong>Modal Interchange</strong> (also called "borrowed chords") means borrowing a chord from a parallel key or mode.</p>
            </div>

            <!-- Chord Comparison Table -->
            <div class="bg-gray-50 rounded-lg p-4 border">
                <h4 class="font-semibold text-gray-800 mb-3">Chord Comparison</h4>
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b">
                            <th class="text-left py-2 text-gray-600">Source</th>
                            <th class="text-left py-2 text-gray-600">Chord</th>
                            <th class="text-left py-2 text-gray-600">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="border-b">
                            <td class="py-2 text-gray-500">${key} major (diatonic)</td>
                            <td class="py-2 font-medium">${diatonicName}</td>
                            <td class="py-2">${diatonicNotes.join(' - ')}</td>
                        </tr>
                        <tr>
                            <td class="py-2 text-violet-600 font-medium">${modeName}</td>
                            <td class="py-2 font-bold text-violet-700">${chordName}</td>
                            <td class="py-2">${borrowedNotes.map(n =>
                                n === alteredNote ? `<span class="text-violet-600 font-bold">${n}</span>` : n
                            ).join(' - ')}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Key Change -->
            ${alteredNote && originalNote ? `
            <div class="bg-violet-50 rounded-lg p-4 border border-violet-200">
                <h4 class="font-semibold text-violet-800 mb-2">The Key Change</h4>
                <p class="text-sm text-violet-700">
                    The <strong>${originalNote}</strong> becomes <strong>${alteredNote}</strong>,
                    changing the chord quality and adding ${isMinor ? 'a melancholy, bittersweet' : 'a brighter, unexpected'} color.
                </p>
            </div>
            ` : ''}

            <!-- Why It Works -->
            <div class="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <h4 class="font-semibold text-emerald-800 mb-2">Why It Works</h4>
                <ul class="text-sm text-emerald-700 space-y-1">
                    <li>* The root (${chordRoot}) is familiar from ${key} major</li>
                    <li>* ${isMinor ? 'The minor quality adds instant emotional depth' : 'The unexpected quality creates harmonic interest'}</li>
                    <li>* Creates chromatic voice leading that pulls the ear</li>
                </ul>
            </div>

            <!-- Musical Context -->
            <div class="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <h4 class="font-semibold text-amber-800 mb-2">Try This Progression</h4>
                <p class="text-sm text-amber-700 font-mono">
                    ${key} - ${diatonicName} - ${chordName} - ${key}
                </p>
                <p class="text-xs text-amber-600 mt-1">
                    The shift from ${diatonicName} to ${chordName} creates that classic "borrowed chord" moment.
                </p>
            </div>
        </div>
    `;
}

/**
 * Generate secondary dominant explanation content
 */
function generateSecondaryDominantExplanation(chordRoot, chordType, key, target) {
    const chordSymbol = CHORD_DEFINITIONS[chordType]?.symbol || '';
    const chordName = `${chordRoot}${chordSymbol}`;

    // Calculate the target chord
    const targetChord = getChordInKeyForDegree(target, key);

    return `
        <div class="space-y-4">
            <div class="prose prose-sm max-w-none text-gray-700">
                <p>A <strong>Secondary Dominant</strong> is a dominant chord that resolves to a chord other than the tonic. It "borrows" the V-I relationship to create tension toward any chord.</p>
            </div>

            <!-- Function Diagram -->
            <div class="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <h4 class="font-semibold text-amber-800 mb-3">How It Functions</h4>
                <div class="flex items-center justify-center gap-3 text-lg font-mono">
                    <span class="px-3 py-2 bg-amber-200 rounded font-bold text-amber-800">${chordName}</span>
                    <span class="text-amber-600">-></span>
                    <span class="px-3 py-2 bg-amber-100 rounded text-amber-700">${targetChord}</span>
                </div>
                <p class="text-center text-sm text-amber-700 mt-2">
                    <strong>${chordName}</strong> acts as the V chord of <strong>${targetChord}</strong>
                </p>
            </div>

            <!-- The Notation -->
            <div class="bg-gray-50 rounded-lg p-4 border">
                <h4 class="font-semibold text-gray-800 mb-2">Roman Numeral Notation</h4>
                <p class="text-sm text-gray-600">
                    This chord is written as <strong class="text-amber-600">V/${target}</strong> (read as "five of ${target}").
                </p>
                <p class="text-sm text-gray-600 mt-1">
                    It means: "the dominant chord that wants to resolve to the ${target} chord"
                </p>
            </div>

            <!-- Why It Works -->
            <div class="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <h4 class="font-semibold text-emerald-800 mb-2">Why It Works</h4>
                <ul class="text-sm text-emerald-700 space-y-1">
                    <li>* Contains a leading tone that pulls strongly to ${targetChord}</li>
                    <li>* Creates the powerful V-I resolution, just targeting a different chord</li>
                    <li>* Adds chromatic notes that create forward momentum</li>
                </ul>
            </div>

            <!-- Try It -->
            <div class="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                <h4 class="font-semibold text-indigo-800 mb-2">Try This Progression</h4>
                <p class="text-sm text-indigo-700 font-mono">
                    ${key} - ${chordName} - ${targetChord} - ...
                </p>
                <p class="text-xs text-indigo-600 mt-1">
                    Notice how ${chordName} creates tension that's satisfied when ${targetChord} arrives.
                </p>
            </div>
        </div>
    `;
}

/**
 * Generate chromatic mediant explanation content
 */
function generateChromaticMediantExplanation(chordRoot, chordType, key, mediantDetails) {
    const chordSymbol = CHORD_DEFINITIONS[chordType]?.symbol || '';
    const chordName = `${chordRoot}${chordSymbol}`;
    const mediantType = mediantDetails?.type || 'chromatic mediant';

    return `
        <div class="space-y-4">
            <div class="prose prose-sm max-w-none text-gray-700">
                <p>A <strong>Chromatic Mediant</strong> is a chord a third away from another chord, with an altered quality that creates a colorful, unexpected shift.</p>
            </div>

            <!-- What Makes It Chromatic -->
            <div class="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
                <h4 class="font-semibold text-cyan-800 mb-2">The Chromatic Relationship</h4>
                <p class="text-sm text-cyan-700">
                    <strong>${chordName}</strong> is a third away from the previous chord, but with chromatic alterations that create a dramatic color shift.
                </p>
                ${mediantType ? `<p class="text-xs text-cyan-600 mt-1">Type: ${mediantType}</p>` : ''}
            </div>

            <!-- Why It Works -->
            <div class="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <h4 class="font-semibold text-emerald-800 mb-2">Why It Works</h4>
                <ul class="text-sm text-emerald-700 space-y-1">
                    <li>* Usually shares one common tone with the previous chord</li>
                    <li>* Creates smooth voice leading despite the "far" harmonic relationship</li>
                    <li>* The chromatic movement surprises the ear in a pleasing way</li>
                    <li>* Popular in film scores for dramatic key changes</li>
                </ul>
            </div>

            <!-- Sound Quality -->
            <div class="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <h4 class="font-semibold text-purple-800 mb-2">The Sound</h4>
                <p class="text-sm text-purple-700">
                    Chromatic mediants create a "lifting" or "shifting" sensation - like the harmonic equivalent of changing the lighting in a room. The music feels transported somewhere new.
                </p>
            </div>

            <!-- Famous Examples -->
            <div class="bg-gray-50 rounded-lg p-4 border">
                <h4 class="font-semibold text-gray-800 mb-2">Famous Uses</h4>
                <p class="text-sm text-gray-600">
                    Film composers like John Williams use chromatic mediants extensively. Listen for that "magical" key change feeling in scores like Star Wars and Harry Potter.
                </p>
            </div>
        </div>
    `;
}

// ============================================================================
// SECTION CREATORS
// ============================================================================

/**
 * Create the Borrowed Chords section for the Advanced tab
 */
function createAdvancedSection_BorrowedChords(key, context, addChordToProgression) {
    const section = document.createElement('div');
    section.style.cssText = `
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
    `;

    // Section header
    const sectionHeader = document.createElement('div');
    sectionHeader.style.cssText = `
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        color: white;
        padding: 10px 14px;
        font-weight: 600;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    sectionHeader.innerHTML = `<span>*</span> Borrowed Chords (Modal Interchange)`;
    section.appendChild(sectionHeader);

    // Explanation
    const explanation = document.createElement('div');
    explanation.style.cssText = `
        padding: 10px 14px;
        background: #faf5ff;
        border-bottom: 1px solid #e9d5ff;
        font-size: 12px;
        color: #6b21a8;
    `;
    explanation.textContent = `Borrowed from parallel modes. These add emotional depth - minor chords borrowed into major keys add melancholy, while major chords in minor keys add brightness.`;
    section.appendChild(explanation);

    // Chord cards container
    const cardsContainer = document.createElement('div');
    cardsContainer.style.cssText = `
        padding: 12px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 10px;
    `;

    // Get borrowed chords for the current key
    let borrowedChords = generateBorrowedChordsForKey(key);

    // Analyze progression for context-aware suggestions
    const progressionData = getProgressionData() || [];
    if (progressionData.length > 0) {
        const keyIndex = ALL_NOTES_NORM.indexOf(normalizeKeyForIndex(key));

        // Calculate scale degrees for progression chords
        const getScaleDegree = (root) => {
            const rootIndex = ALL_NOTES_NORM.indexOf(normalizeKeyForIndex(root || ''));
            if (rootIndex === -1) return null;
            return ((rootIndex - keyIndex + 12) % 12);
        };

        // Find specific chords in progression
        const hasV = progressionData.some(c => getScaleDegree(c.root) === 7);
        const hasI = progressionData.some(c => getScaleDegree(c.root) === 0);
        const hasIV = progressionData.some(c => getScaleDegree(c.root) === 5);
        const lastChord = progressionData[progressionData.length - 1];
        const lastDegree = getScaleDegree(lastChord?.root);

        // Find chord positions for specific suggestions
        const vPositions = progressionData.map((c, i) => getScaleDegree(c.root) === 7 ? i : -1).filter(i => i !== -1);
        const iPositions = progressionData.map((c, i) => getScaleDegree(c.root) === 0 ? i : -1).filter(i => i !== -1);
        const ivPositions = progressionData.map((c, i) => getScaleDegree(c.root) === 5 ? i : -1).filter(i => i !== -1);

        // Add context suggestions to borrowed chords
        borrowedChords = borrowedChords.map(chord => {
            const suggestions = [];

            if (chord.numeral === 'bVI') {
                if (hasV) {
                    const vChord = progressionData[vPositions[0]];
                    const vDisplay = vChord ? `${vChord.root}` : 'V';
                    suggestions.push(`Place after ${vDisplay} (chord ${vPositions[0] + 1}) for deceptive cadence`);
                }
                if (lastDegree === 7) {
                    suggestions.push(`Your progression ends on V - this would create a surprise ending!`);
                }
            }

            if (chord.numeral === 'bVII') {
                if (hasI) {
                    const iChord = progressionData[iPositions[0]];
                    const iDisplay = iChord ? `${iChord.root}` : 'I';
                    suggestions.push(`Place before ${iDisplay} (chord ${iPositions[0] + 1}) for rock cadence`);
                }
            }

            if (chord.numeral === 'iv') {
                if (hasI) {
                    const iChord = progressionData[iPositions[0]];
                    suggestions.push(`Place before ${iChord?.root || 'I'} for melancholy plagal cadence`);
                }
                if (hasV) {
                    suggestions.push(`Use as pre-dominant before V`);
                }
            }

            if (chord.numeral === 'bIII') {
                if (hasI && hasIV) {
                    suggestions.push(`Insert between I and IV for classic rock movement`);
                }
            }

            if (chord.numeral === '#iv°') {
                if (hasIV && hasV) {
                    const ivChord = progressionData[ivPositions[0]];
                    const ivPos = ivPositions[0];
                    if (vPositions.some(vp => vp === ivPos + 1)) {
                        suggestions.push(`Insert between ${ivChord?.root || 'IV'} and V (chords ${ivPos + 1}-${ivPos + 2}) as passing chord`);
                    }
                }
            }

            return {
                ...chord,
                contextSuggestion: suggestions.length > 0 ? suggestions[0] : null
            };
        });
    }

    // Score and sort by recommendation if we have context
    if (context.hasContext) {
        borrowedChords = borrowedChords.map(chord => ({
            ...chord,
            scoring: scoreAdvancedChordInContext(chord, context, 'borrowed')
        })).sort((a, b) => b.scoring.score - a.scoring.score);
    }

    borrowedChords.forEach(chord => {
        const card = createAdvancedChordCard(chord, key, 'borrowed', context, chord.scoring, addChordToProgression);
        cardsContainer.appendChild(card);
    });

    section.appendChild(cardsContainer);
    return section;
}

/**
 * Create the Secondary Dominants section for the Advanced tab
 */
function createAdvancedSection_SecondaryDominants(key, context, addChordToProgression) {
    const section = document.createElement('div');
    section.style.cssText = `
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
    `;

    // Section header
    const sectionHeader = document.createElement('div');
    sectionHeader.style.cssText = `
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: white;
        padding: 10px 14px;
        font-weight: 600;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    sectionHeader.innerHTML = `<span>*</span> Secondary Dominants`;
    section.appendChild(sectionHeader);

    // Explanation
    const explanation = document.createElement('div');
    explanation.style.cssText = `
        padding: 10px 14px;
        background: #fffbeb;
        border-bottom: 1px solid #fde68a;
        font-size: 12px;
        color: #92400e;
    `;
    explanation.textContent = `Dominant 7th chords that resolve to non-tonic chords. They create strong pull toward their target, adding forward momentum and harmonic interest.`;
    section.appendChild(explanation);

    // Chord cards container
    const cardsContainer = document.createElement('div');
    cardsContainer.style.cssText = `
        padding: 12px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 10px;
    `;

    // Generate secondary dominants
    let secondaryDominants = generateSecondaryDominantsForKey(key);

    // Score and sort by recommendation if we have context
    if (context.hasContext) {
        secondaryDominants = secondaryDominants.map(chord => ({
            ...chord,
            scoring: scoreAdvancedChordInContext(chord, context, 'secondary-dominant')
        })).sort((a, b) => b.scoring.score - a.scoring.score);
    }

    secondaryDominants.forEach(chord => {
        const card = createAdvancedChordCard(chord, key, 'secondary-dominant', context, chord.scoring, addChordToProgression);
        cardsContainer.appendChild(card);
    });

    section.appendChild(cardsContainer);
    return section;
}

/**
 * Create the Chromatic Mediants section for the Advanced tab
 */
function createAdvancedSection_ChromaticMediants(key, context, addChordToProgression) {
    const section = document.createElement('div');
    section.style.cssText = `
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
    `;

    // Section header
    const sectionHeader = document.createElement('div');
    sectionHeader.style.cssText = `
        background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
        color: white;
        padding: 10px 14px;
        font-weight: 600;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    sectionHeader.innerHTML = `<span>*</span> Chromatic Mediants`;
    section.appendChild(sectionHeader);

    // Explanation
    const explanation = document.createElement('div');
    explanation.style.cssText = `
        padding: 10px 14px;
        background: #ecfeff;
        border-bottom: 1px solid #a5f3fc;
        font-size: 12px;
        color: #155e75;
    `;
    explanation.textContent = `Major chords a third apart with chromatic root movement. Used in film scores for dramatic shifts - they share one note while the others move chromatically.`;
    section.appendChild(explanation);

    // Chord cards container
    const cardsContainer = document.createElement('div');
    cardsContainer.style.cssText = `
        padding: 12px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 10px;
    `;

    // Generate chromatic mediants
    let chromaticMediants = generateChromaticMediantsForKey(key);

    // Score and sort by recommendation if we have context
    if (context.hasContext) {
        chromaticMediants = chromaticMediants.map(chord => ({
            ...chord,
            scoring: scoreAdvancedChordInContext(chord, context, 'chromatic-mediant')
        })).sort((a, b) => b.scoring.score - a.scoring.score);
    }

    chromaticMediants.forEach(chord => {
        const card = createAdvancedChordCard(chord, key, 'chromatic-mediant', context, chord.scoring, addChordToProgression);
        cardsContainer.appendChild(card);
    });

    section.appendChild(cardsContainer);
    return section;
}

/**
 * Create a chord card for the advanced section
 */
function createAdvancedChordCard(chordInfo, key, sectionType, context, scoring, addChordToProgression) {
    const isRecommended = scoring?.isRecommended || false;
    const reasons = scoring?.reasons || [];

    const card = document.createElement('div');

    // Different styling for recommended vs non-recommended cards
    if (isRecommended) {
        card.style.cssText = `
            background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
            border: 2px solid #22c55e;
            border-radius: 6px;
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            transition: all 0.15s;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(34, 197, 94, 0.15);
        `;
    } else {
        card.style.cssText = `
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 10px 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            transition: all 0.15s;
            cursor: pointer;
        `;
    }

    const defaultBorderColor = isRecommended ? '#22c55e' : '#e5e7eb';
    const defaultBoxShadow = isRecommended ? '0 2px 8px rgba(34, 197, 94, 0.15)' : 'none';

    card.addEventListener('mouseenter', () => {
        card.style.borderColor = '#a78bfa';
        card.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.25)';
    });
    card.addEventListener('mouseleave', () => {
        card.style.borderColor = defaultBorderColor;
        card.style.boxShadow = defaultBoxShadow;
    });

    // Recommended badge row (if recommended)
    if (isRecommended && context?.selectedChord) {
        const chordDef = CHORD_DEFINITIONS[context.selectedChord.type];
        const symbol = chordDef?.symbol || '';
        const selectedDisplay = `${context.selectedChord.root}${symbol}`;

        const badgeRow = document.createElement('div');
        badgeRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 2px;
        `;
        badgeRow.innerHTML = `
            <span style="
                background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                color: white;
                font-size: 9px;
                font-weight: 600;
                padding: 2px 6px;
                border-radius: 3px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            ">Recommended</span>
            <span style="font-size: 10px; color: #16a34a;">after ${selectedDisplay}</span>
        `;
        card.appendChild(badgeRow);
    }

    // Top row: Info button, chord name, and numeral
    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

    // Left side: Info button + chord name
    const leftSide = document.createElement('div');
    leftSide.style.cssText = 'display: flex; align-items: center; gap: 6px;';

    // Info button for tooltip
    const infoBtn = document.createElement('button');
    infoBtn.textContent = '?';
    infoBtn.title = 'Learn more about this technique';
    infoBtn.style.cssText = `
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 1px solid #a78bfa;
        background: #f5f3ff;
        color: #7c3aed;
        font-size: 10px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.15s;
        flex-shrink: 0;
    `;
    infoBtn.addEventListener('mouseenter', () => {
        infoBtn.style.background = '#7c3aed';
        infoBtn.style.color = 'white';
    });
    infoBtn.addEventListener('mouseleave', () => {
        infoBtn.style.background = '#f5f3ff';
        infoBtn.style.color = '#7c3aed';
    });
    infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = {
            chordRoot: chordInfo.root,
            chordType: chordInfo.type,
            key: key,
            contextChord: context?.selectedChord || null,
            recommendationReasons: reasons,
            isRecommended: isRecommended
        };

        if (sectionType === 'borrowed') {
            item.type = 'modal-interchange';
            item.borrowedFrom = chordInfo.source;
        } else if (sectionType === 'secondary-dominant') {
            item.type = 'secondary-dominant';
            item.target = chordInfo.numeral.replace('V7/', '');
        } else if (sectionType === 'chromatic-mediant') {
            item.type = 'chromatic-mediant';
            item.mediantDetails = { type: chordInfo.source };
        }

        showAdvancedExplanationModal(item);
    });
    leftSide.appendChild(infoBtn);

    const chordName = document.createElement('span');
    chordName.style.cssText = `font-weight: 600; font-size: 14px; color: ${isRecommended ? '#166534' : '#1f2937'};`;
    chordName.textContent = chordInfo.display;
    leftSide.appendChild(chordName);

    const numeral = document.createElement('span');
    numeral.style.cssText = `
        font-size: 11px;
        color: white;
        background: ${chordInfo.color || '#8b5cf6'};
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
    `;
    numeral.textContent = chordInfo.numeral;

    topRow.appendChild(leftSide);
    topRow.appendChild(numeral);
    card.appendChild(topRow);

    // Recommendation reasons (if recommended, show first reason)
    if (isRecommended && reasons.length > 0) {
        const reasonsDiv = document.createElement('div');
        reasonsDiv.style.cssText = `
            font-size: 10px;
            color: #15803d;
            background: #dcfce7;
            padding: 4px 8px;
            border-radius: 4px;
            line-height: 1.3;
        `;
        const displayReasons = reasons.slice(0, 2).join(' * ');
        reasonsDiv.textContent = displayReasons;
        card.appendChild(reasonsDiv);
    }

    // Description
    const description = document.createElement('div');
    description.style.cssText = `font-size: 11px; color: ${isRecommended ? '#166534' : '#6b7280'}; line-height: 1.3;`;
    description.textContent = chordInfo.description;
    card.appendChild(description);

    // Placement hint (if available)
    if (chordInfo.placementHint) {
        const hint = document.createElement('div');
        hint.style.cssText = `
            font-size: 10px;
            color: #7c3aed;
            background: #f5f3ff;
            padding: 4px 8px;
            border-radius: 4px;
            border-left: 2px solid #a78bfa;
            line-height: 1.3;
            margin-top: 2px;
        `;
        hint.textContent = chordInfo.placementHint;
        card.appendChild(hint);
    }

    // Context-specific suggestion (if available from progression analysis)
    if (chordInfo.contextSuggestion) {
        const contextHint = document.createElement('div');
        contextHint.style.cssText = `
            font-size: 10px;
            color: #059669;
            background: #ecfdf5;
            padding: 4px 8px;
            border-radius: 4px;
            border-left: 2px solid #10b981;
            line-height: 1.3;
            margin-top: 2px;
            font-weight: 500;
        `;
        contextHint.innerHTML = `* ${chordInfo.contextSuggestion}`;
        card.appendChild(contextHint);
    }

    // Source/mode if applicable (hide if recommended to save space)
    if (chordInfo.source && !isRecommended) {
        const source = document.createElement('div');
        source.style.cssText = 'font-size: 10px; color: #9ca3af; font-style: italic;';
        source.textContent = chordInfo.source;
        card.appendChild(source);
    }

    // Action buttons
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 6px; margin-top: 4px;';

    // Play button
    const playBtn = document.createElement('button');
    playBtn.innerHTML = 'Play';
    playBtn.title = 'Hold to preview';
    playBtn.style.cssText = `
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${isRecommended ? '#bbf7d0' : '#dbeafe'};
        color: ${isRecommended ? '#166534' : '#1d4ed8'};
        border: 1px solid ${isRecommended ? '#86efac' : '#bfdbfe'};
        cursor: pointer;
        font-size: 10px;
        transition: all 0.15s;
    `;
    setupHoldToPlay(playBtn, { root: chordInfo.root, type: chordInfo.type, inversion: 0 });
    actions.appendChild(playBtn);

    // Add button
    const addBtn = document.createElement('button');
    addBtn.innerHTML = '+';
    addBtn.title = 'Add to progression';
    addBtn.style.cssText = `
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${isRecommended ? '#22c55e' : '#e0e7ff'};
        color: ${isRecommended ? 'white' : '#4338ca'};
        border: 1px solid ${isRecommended ? '#16a34a' : '#c7d2fe'};
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.15s;
    `;
    addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        addChordToProgression({ root: chordInfo.root, type: chordInfo.type, inversion: 0 });
    });
    actions.appendChild(addBtn);

    card.appendChild(actions);

    // Click card to add
    card.addEventListener('click', () => {
        addChordToProgression({ root: chordInfo.root, type: chordInfo.type, inversion: 0 });
    });

    return card;
}

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

/**
 * Advanced Intent - render function
 * Exposes advanced harmonic techniques for users who want to explore beyond diatonic harmony
 * Now context-aware: recommends and sorts chords based on the selected chord
 *
 * @param {HTMLElement} container - The container to render into
 * @param {Function} addChordToProgression - Callback to add chord to progression
 */
function renderAdvancedIntent(container, addChordToProgression) {
    container.innerHTML = '';

    const key = getCurrentKey() || 'C';
    const progressionData = getProgressionData() || [];

    // Get selected chord context
    const selectedIndex = modalState.selectedProgressionIndex;
    const selectedChord = selectedIndex >= 0 && progressionData[selectedIndex]
        ? progressionData[selectedIndex]
        : null;

    // Build context object for scoring
    const context = {
        selectedChord,
        selectedIndex,
        key,
        progressionData,
        hasContext: !!selectedChord
    };

    // Header section - context-aware
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
        border: 1px solid #c4b5fd;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 16px;
    `;

    if (selectedChord) {
        const chordDef = CHORD_DEFINITIONS[selectedChord.type];
        const symbol = chordDef?.symbol || '';
        const spelledRoot = spellNoteInKey(selectedChord.root, key);
        const selectedDisplay = `${spelledRoot}${symbol}`;

        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-size: 18px;">*</span>
                <strong style="color: #5b21b6; font-size: 14px;">Advanced Chords to Follow ${selectedDisplay}</strong>
            </div>
            <p style="color: #6d28d9; font-size: 12px; margin: 0;">
                <strong style="color: #7c3aed;">Recommended chords</strong> are sorted to the top of each section based on how well they follow <strong>${selectedDisplay}</strong> (position #${selectedIndex + 1}).
            </p>
        `;
    } else {
        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-size: 18px;">*</span>
                <strong style="color: #5b21b6; font-size: 14px;">Advanced Harmonic Techniques</strong>
            </div>
            <p style="color: #6d28d9; font-size: 12px; margin: 0;">
                Explore chords beyond the standard diatonic palette. <strong>Select a chord</strong> from your progression above to see personalized recommendations.
            </p>
        `;
    }
    container.appendChild(header);

    // Create tabbed sections for different categories
    const sections = document.createElement('div');
    sections.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

    // 1. Borrowed Chords Section
    sections.appendChild(createAdvancedSection_BorrowedChords(key, context, addChordToProgression));

    // 2. Secondary Dominants Section
    sections.appendChild(createAdvancedSection_SecondaryDominants(key, context, addChordToProgression));

    // 3. Chromatic Mediants Section
    sections.appendChild(createAdvancedSection_ChromaticMediants(key, context, addChordToProgression));

    container.appendChild(sections);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    // Main render function
    renderAdvancedIntent,

    // Section creators
    createAdvancedSection_BorrowedChords,
    createAdvancedSection_SecondaryDominants,
    createAdvancedSection_ChromaticMediants,
    createAdvancedChordCard,

    // Chord generators
    generateBorrowedChordsForKey,
    generateSecondaryDominantsForKey,
    generateChromaticMediantsForKey,

    // Scoring
    scoreAdvancedChordInContext,

    // Explanation modals
    showAdvancedExplanationModal,
    generateModalInterchangeExplanation,
    generateSecondaryDominantExplanation,
    generateChromaticMediantExplanation,

    // Helpers
    getChordNotesForDisplay,
    normalizeNoteForComparison,
    getChordInKeyForDegree,
    formatModeName
};
