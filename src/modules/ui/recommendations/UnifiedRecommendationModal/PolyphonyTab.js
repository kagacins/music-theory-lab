/**
 * Polyphony/Texture Tab Renderer for Unified Recommendation Modal
 *
 * Handles second voice generation and texture suggestions.
 */

// ============================================================================
// IMPORTS
// ============================================================================

// External data and utilities
import { CHORD_DEFINITIONS } from '../../../../data/music-data.js';
import { spellNoteInKey } from '../../../utils/noteUtils.js';

// State management
import { getCompositionState } from '../../../state/compositionState.js';
import {
    getCurrentKey,
    getProgressionData
} from '../../../state/trainerState.js';

// Modal state (from parent module)
import { modalState } from './ModalState.js';
import { SUGGESTION_STYLES } from '../../../features/unifiedChordSuggestions.js';

// VexFlow rendering utilities
import { createRenderer } from '../../../notation/vexFlowRenderer.js';
import { renderGrandStaffMeasure } from '../../../notation/grandStaff.js';

// ============================================================================
// TEXTURE TYPES
// ============================================================================

// Texture types for adding complementary voices
export const TEXTURE_TYPES = {
    // === UNIVERSAL TEXTURES (work for both clefs) ===
    PARALLEL_THIRDS: {
        id: 'parallel_thirds',
        name: 'Parallel 3rds',
        description: 'Follows melody a third below/above - classic warm harmony',
        icon: '🎵',
        clefs: ['treble', 'bass']
    },
    PARALLEL_SIXTHS: {
        id: 'parallel_sixths',
        name: 'Parallel 6ths',
        description: 'Follows melody a sixth below/above - rich, full sound',
        icon: '🎶',
        clefs: ['treble', 'bass']
    },
    CONTRARY_MOTION: {
        id: 'contrary',
        name: 'Contrary',
        description: 'Moves opposite to melody - creates interesting counterpoint',
        icon: '↕️',
        clefs: ['treble', 'bass']
    },
    PEDAL_ROOT: {
        id: 'pedal_root',
        name: 'Pedal (Root)',
        description: 'Sustained chord root - grounding effect',
        icon: '🔊',
        clefs: ['treble', 'bass']
    },
    PEDAL_FIFTH: {
        id: 'pedal_fifth',
        name: 'Pedal (5th)',
        description: 'Sustained fifth - adds depth without dissonance',
        icon: '🎹',
        clefs: ['treble', 'bass']
    },
    RHYTHMIC_COMPLEMENT: {
        id: 'rhythmic',
        name: 'Rhythmic Fill',
        description: 'Fills gaps where main voice has rests',
        icon: '🥁',
        clefs: ['treble', 'bass']
    },
    HARMONIC_ACCOMPANIMENT: {
        id: 'harmonic_accompaniment',
        name: 'Harmonic',
        description: 'Chord tones following the melody rhythm',
        icon: '🎹',
        clefs: ['treble', 'bass']
    },
    COUNTER_MELODY: {
        id: 'counter',
        name: 'Counter',
        description: 'Independent complementary line with rhythmic interest',
        icon: '🎼',
        clefs: ['treble', 'bass']
    },
    OBLIQUE_MOTION: {
        id: 'oblique',
        name: 'Oblique',
        description: 'One voice holds a chord tone while melody moves',
        icon: '➡️',
        clefs: ['treble', 'bass']
    },
    OCTAVE_DOUBLING: {
        id: 'octave_doubling',
        name: 'Octave',
        description: 'Doubles the melody an octave below/above',
        icon: '8️⃣',
        clefs: ['treble', 'bass']
    },
    CALL_RESPONSE: {
        id: 'call_response',
        name: 'Call/Response',
        description: 'Second voice echoes the melody with delay',
        icon: '🗣️',
        clefs: ['treble', 'bass']
    },
    DRONE: {
        id: 'drone',
        name: 'Drone',
        description: 'Sustained harmony note throughout the measure',
        icon: '🔉',
        clefs: ['treble', 'bass']
    },
    ARPEGGIATED: {
        id: 'arpeggiated',
        name: 'Arpeggio',
        description: 'Broken chord accompaniment following melody rhythm',
        icon: '🎹',
        clefs: ['treble', 'bass']
    },
    // === BASS-SPECIFIC TEXTURES ===
    ALBERTI_BASS: {
        id: 'alberti',
        name: 'Alberti',
        description: 'Classic broken chord: root-5th-3rd-5th pattern',
        icon: '🎹',
        clefs: ['bass']
    },
    WALKING_BASS: {
        id: 'walking',
        name: 'Walking',
        description: 'Stepwise motion connecting chord roots - jazz/blues',
        icon: '🚶',
        clefs: ['bass']
    },
    SHELL_VOICINGS: {
        id: 'shell',
        name: 'Shell',
        description: 'Root + 3rd or Root + 7th - jazz comping style',
        icon: '🐚',
        clefs: ['bass']
    },
    // === TREBLE-SPECIFIC TEXTURES ===
    COMPOUND_TENTHS: {
        id: 'tenths',
        name: '10ths',
        description: 'Compound thirds - wide, open voicing below melody',
        icon: '🔟',
        clefs: ['treble']
    }
};

// ============================================================================
// CURATED BASS PATTERNS
// Selected 19 patterns from 44+ available, organized by use case
// ============================================================================

export const BASS_PATTERN_CATEGORIES = {
    ESSENTIAL: {
        name: 'Essential',
        description: 'Start here - fundamental patterns for any style',
        patterns: ['whole-note', 'root-fifth', 'arpeggio']
    },
    CLASSICAL: {
        name: 'Classical',
        description: 'Traditional piano accompaniment patterns',
        patterns: ['alberti', 'waltz', 'hymn']
    },
    JAZZ: {
        name: 'Jazz',
        description: 'Swing, bebop, and jazz piano styles',
        patterns: ['walking', 'stride', 'shell-voicing', 'bebop']
    },
    ROCK_POP: {
        name: 'Rock/Pop',
        description: 'Modern rock, pop, and dance styles',
        patterns: ['driving-rock', 'power-chord', 'syncopated']
    },
    LATIN: {
        name: 'Latin',
        description: 'Brazilian, Cuban, and Latin American grooves',
        patterns: ['bossa-nova', 'montuno', 'habanera']
    },
    SOUL_FUNK: {
        name: 'Soul/Funk',
        description: 'R&B, Motown, and gospel feels',
        patterns: ['motown', 'funk', 'gospel']
    }
};

export const BASS_PATTERNS = {
    // === ESSENTIAL ===
    'whole-note': {
        name: 'Whole Note',
        description: 'Sustained bass - one note per measure',
        whenToUse: 'Ballads, slow songs, or when learning. Simple and elegant.',
        icon: '🎵'
    },
    'root-fifth': {
        name: 'Root-Fifth',
        description: 'Alternates root and fifth on beats 1 & 3',
        whenToUse: 'Country, folk, simple pop. Classic "boom-chick" feel.',
        icon: '🔀'
    },
    'arpeggio': {
        name: 'Arpeggio',
        description: 'Broken chord (root-3rd-5th-root)',
        whenToUse: 'Pop ballads, acoustic songs. Gentle, flowing motion.',
        icon: '🌊'
    },

    // === CLASSICAL ===
    'alberti': {
        name: 'Alberti Bass',
        description: 'Classical pattern (low-high-mid-high)',
        whenToUse: 'Mozart-style pieces, classical accompaniment.',
        icon: '🎹'
    },
    'waltz': {
        name: 'Waltz',
        description: 'Oom-pah-pah in 3/4 time',
        whenToUse: '3/4 time signatures, waltzes, some ballads.',
        icon: '💃'
    },
    'hymn': {
        name: 'Hymn Style',
        description: 'Block chords on each beat',
        whenToUse: 'Church music, stately pieces, four-part harmony.',
        icon: '⛪'
    },

    // === JAZZ ===
    'walking': {
        name: 'Walking Bass',
        description: 'Stepwise quarter notes between chord tones',
        whenToUse: 'Jazz, swing, blues. Creates forward momentum.',
        icon: '🚶'
    },
    'stride': {
        name: 'Stride',
        description: 'Low bass note → mid-register chord',
        whenToUse: 'Jazz piano, ragtime. Big band piano feel.',
        icon: '🎩'
    },
    'shell-voicing': {
        name: 'Shell Voicing',
        description: 'Root + 3rd or 7th (jazz essentials)',
        whenToUse: 'Jazz comping. Modern, open sound.',
        icon: '🐚'
    },
    'bebop': {
        name: 'Bebop',
        description: 'Chromatic passing tones, complex rhythm',
        whenToUse: 'Bebop jazz. Fast, intricate lines.',
        icon: '🎺'
    },

    // === ROCK/POP ===
    'driving-rock': {
        name: 'Driving Rock',
        description: 'Steady eighth notes on the root',
        whenToUse: 'Rock, punk, energetic pop. Raw energy.',
        icon: '🎸'
    },
    'power-chord': {
        name: 'Power Chord',
        description: 'Root + fifth together (no third)',
        whenToUse: 'Rock, metal. Heavy, powerful sound.',
        icon: '⚡'
    },
    'syncopated': {
        name: 'Syncopated',
        description: 'Off-beat accents and anticipations',
        whenToUse: 'Funk, R&B, modern pop. Groove-oriented.',
        icon: '🔊'
    },

    // === LATIN ===
    'bossa-nova': {
        name: 'Bossa Nova',
        description: 'Syncopated Brazilian pattern',
        whenToUse: 'Bossa nova, smooth jazz. Relaxed, sophisticated.',
        icon: '🌴'
    },
    'montuno': {
        name: 'Montuno',
        description: 'Cuban-style syncopation',
        whenToUse: 'Salsa, Latin jazz. Infectious rhythm.',
        icon: '🎺'
    },
    'habanera': {
        name: 'Habanera',
        description: 'Dotted Cuban rhythm',
        whenToUse: 'Habanera, tango influences. Sultry feel.',
        icon: '🌹'
    },

    // === SOUL/FUNK ===
    'motown': {
        name: 'Motown',
        description: 'Melodic, syncopated soul style',
        whenToUse: 'Soul, R&B, Motown classics. Memorable bass.',
        icon: '🎤'
    },
    'funk': {
        name: 'Funk',
        description: '16th note subdivisions with syncopation',
        whenToUse: 'Funk, disco, dance music. Maximum groove.',
        icon: '🕺'
    },
    'gospel': {
        name: 'Gospel',
        description: 'Root-third patterns with runs',
        whenToUse: 'Gospel, church music, inspirational.',
        icon: '🙏'
    }
};

// Track selected bass pattern in polyphony state
// (polyphonyState.selectedBassPattern will be added)

// Style-specific texture preferences (with scale awareness settings)
// NOTE: Style IDs must match SUGGESTION_STYLES in unifiedChordSuggestions.js
export const STYLE_TEXTURE_PREFERENCES = {
    balanced: {
        preferredTextures: ['parallel_thirds', 'parallel_sixths', 'harmonic_accompaniment', 'passing_tones'],
        intervalBias: 'balanced',       // Mix of intervals
        rhythmDensity: 'moderate',
        chromaticism: 'low',
        voiceLeadingStrictness: 'moderate',
        scaleStrictness: 'strict',      // Stay in key
        chordTonePriority: 'medium'     // Balance between chord tones and passing tones
    },
    pop: {
        preferredTextures: ['parallel_thirds', 'parallel_sixths', 'pedal_root', 'neighbor_tones'],
        intervalBias: 'consonant',      // Prefer 3rds, 6ths
        rhythmDensity: 'moderate',
        chromaticism: 'low',
        voiceLeadingStrictness: 'relaxed',
        scaleStrictness: 'strict',      // Stay strictly in key
        chordTonePriority: 'medium'     // Balance between chord tones and passing tones
    },
    rock: {
        preferredTextures: ['pedal_root', 'pedal_fifth', 'parallel_thirds', 'pedal_motion'],
        intervalBias: 'power',          // Prefer 5ths, octaves
        rhythmDensity: 'driving',
        chromaticism: 'low',
        voiceLeadingStrictness: 'relaxed',
        scaleStrictness: 'strict',      // Stay in key
        chordTonePriority: 'high'       // Emphasize root and fifth
    },
    jazz: {
        preferredTextures: ['contrary', 'counter', 'parallel_sixths', 'suspension', 'passing_tones'],
        intervalBias: 'colorful',       // Include 7ths, 9ths
        rhythmDensity: 'syncopated',
        chromaticism: 'high',
        voiceLeadingStrictness: 'strict',
        scaleStrictness: 'chromatic',   // Allow passing tones, approach notes
        chordTonePriority: 'low'        // More freedom for color tones
    },
    classical: {
        preferredTextures: ['contrary', 'parallel_thirds', 'parallel_sixths', 'suspension', 'imitation'],
        intervalBias: 'balanced',       // Traditional intervals
        rhythmDensity: 'varied',
        chromaticism: 'moderate',
        voiceLeadingStrictness: 'strict',
        scaleStrictness: 'strict',      // Diatonic with occasional accidentals
        chordTonePriority: 'medium'     // Voice leading takes priority
    },
    folk: {
        preferredTextures: ['parallel_thirds', 'pedal_root', 'rhythmic', 'drone'],
        intervalBias: 'simple',         // Diatonic intervals
        rhythmDensity: 'sparse',
        chromaticism: 'none',
        voiceLeadingStrictness: 'relaxed',
        scaleStrictness: 'strict',      // Pure diatonic
        chordTonePriority: 'high'       // Simple chord tones
    },
    rnbSoul: {
        preferredTextures: ['parallel_thirds', 'parallel_sixths', 'counter', 'suspension', 'neighbor_tones'],
        intervalBias: 'smooth',         // Smooth voice leading
        rhythmDensity: 'groovy',
        chromaticism: 'moderate',
        voiceLeadingStrictness: 'moderate',
        scaleStrictness: 'chromatic',   // Some chromatic passing tones
        chordTonePriority: 'medium'     // Balance for smooth lines
    },
    gospel: {
        preferredTextures: ['parallel_thirds', 'parallel_sixths', 'contrary', 'suspension', 'passing_tones'],
        intervalBias: 'rich',           // Full harmonies
        rhythmDensity: 'expressive',
        chromaticism: 'moderate',
        voiceLeadingStrictness: 'moderate',
        scaleStrictness: 'chromatic',   // Gospel uses passing tones
        chordTonePriority: 'medium'     // Rich harmonies with extensions
    },
    blues: {
        preferredTextures: ['pedal_root', 'parallel_thirds', 'rhythmic', 'call_response'],
        intervalBias: 'bluesy',         // Blue notes, b3, b7
        rhythmDensity: 'shuffle',
        chromaticism: 'bluenotes',
        voiceLeadingStrictness: 'relaxed',
        scaleStrictness: 'blues',       // Allow b3, b5, b7 blue notes
        chordTonePriority: 'medium'     // Root emphasis but blue notes allowed
    },
    indie: {
        preferredTextures: ['contrary', 'oblique', 'counter', 'imitation', 'neighbor_tones'],
        intervalBias: 'colorful',       // Unexpected intervals
        rhythmDensity: 'varied',
        chromaticism: 'moderate',
        voiceLeadingStrictness: 'relaxed',
        scaleStrictness: 'chromatic',   // Allow some chromatic passing tones
        chordTonePriority: 'low'        // More freedom for creative choices
    }
};

// Mood adjustments for texture generation (with consonance settings)
export const MOOD_TEXTURE_ADJUSTMENTS = {
    bright: {
        intervalOffset: 0,              // No change
        preferMajor: true,
        dynamicBias: 'forte',
        registerBias: 'higher',
        consonanceLevel: 'high',        // Prefer consonant intervals
        preferChordTones: true,         // Emphasize chord tones
        allowTensions: false            // Avoid 7ths, 9ths
    },
    dark: {
        intervalOffset: -1,             // Slightly lower
        preferMajor: false,
        dynamicBias: 'piano',
        registerBias: 'lower',
        consonanceLevel: 'medium',      // Allow some dissonance
        preferChordTones: true,         // Still emphasize chord tones
        allowTensions: true             // Allow minor 7ths for color
    },
    tense: {
        intervalOffset: 0,
        preferDissonance: true,
        dynamicBias: 'crescendo',
        registerBias: 'compressed',
        consonanceLevel: 'low',         // Allow dissonance for tension
        preferChordTones: false,        // Passing tones create tension
        allowTensions: true             // 7ths, 9ths add tension
    },
    calm: {
        intervalOffset: 0,
        preferConsonance: true,
        dynamicBias: 'piano',
        registerBias: 'middle',
        consonanceLevel: 'high',        // Very consonant
        preferChordTones: true,         // Stable chord tones
        allowTensions: false            // Keep it simple
    }
};

// ============================================================================
// POLYPHONY TAB STATE
// ============================================================================

// Polyphony tab state
export let polyphonyState = {
    selectedStaff: 'treble',        // Which staff to add texture to
    targetVoice: 2,                 // Always voice 2 for texture
    selectedTextureType: 'parallel_thirds',
    selectedChordIndex: 0,          // Which chord/building block
    selectedStyle: 'pop',           // Musical style (synced from global)
    selectedMood: 'bright',         // Current mood (synced from global)
    generatedSuggestions: [],       // Array of generated notes
    previewCanvas: null,            // VexFlow preview canvas
    // Bass pattern state
    selectedBassCategory: 'ESSENTIAL',
    selectedBassPattern: 'root-fifth',
    generatedBassNotes: []          // Generated bass pattern notes
};

// ============================================================================
// MAIN TAB RENDERER
// ============================================================================

/**
 * Create compact texture recommendations display (uses global style from context bar)
 */
function createTextureRecommendationsDisplay() {
    const section = document.createElement('div');
    section.id = 'texture-style-recs';
    section.style.cssText = 'padding: 6px 10px; background: #f0f4ff; border-radius: 6px; font-size: 11px;';

    // Sync polyphonyState with global modalState
    polyphonyState.selectedStyle = modalState.style || 'balanced';
    polyphonyState.selectedMood = modalState.mood || 'bright';

    const stylePrefs = STYLE_TEXTURE_PREFERENCES[polyphonyState.selectedStyle];
    const recommendedTextures = stylePrefs?.preferredTextures?.slice(0, 3) || [];

    // Get style label from SUGGESTION_STYLES (the authoritative source)
    const styleLabel = SUGGESTION_STYLES.find(s => s.id === polyphonyState.selectedStyle)?.label || 'Balanced Blend';

    section.innerHTML = `
        <strong style="color: #667eea;">Recommended for ${styleLabel}:</strong>
        <span style="color: #6b7280; margin-left: 4px;">
            ${recommendedTextures.map(t => {
                const texture = Object.values(TEXTURE_TYPES).find(tx => tx.id === t);
                return texture ? `${texture.icon} ${texture.name}` : t;
            }).join(', ')}
        </span>
    `;

    return section;
}

export function renderPolyphonyTab(container) {
    container.innerHTML = '';

    // Get composition context
    const compositionState = getCompositionState();
    const progressionData = getProgressionData() || [];
    const currentKey = getCurrentKey();

    // Sync polyphonyState with the Progression picker selection
    if (modalState.selectedProgressionIndex >= 0 && modalState.selectedProgressionIndex < progressionData.length) {
        polyphonyState.selectedChordIndex = modalState.selectedProgressionIndex;
    }

    if (!compositionState || progressionData.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6b7280;">
                <div style="font-size: 48px; margin-bottom: 16px;">🎭</div>
                <h3 style="margin: 0 0 8px 0; color: #374151;">Add Texture to Your Composition</h3>
                <p style="margin: 0;">Add chords to your progression first to generate texture recommendations.</p>
            </div>
        `;
        return;
    }

    // Check if multiple chords are selected (shift+click range)
    const hasMultipleSelected = modalState.selectedProgressionStart >= 0 &&
        modalState.selectedProgressionEnd >= 0 &&
        modalState.selectedProgressionStart !== modalState.selectedProgressionEnd;

    if (hasMultipleSelected) {
        const rangeCount = Math.abs(modalState.selectedProgressionEnd - modalState.selectedProgressionStart) + 1;
        container.innerHTML = `
            <div class="rm-empty">
                <div class="rm-empty-icon">☝️</div>
                <h3 class="rm-empty-title">Select a Single Chord</h3>
                <p class="rm-empty-text">You have ${rangeCount} chords selected. Please click on a single chord from the <strong>Progression</strong> bar above to add texture to it.</p>
                <p class="rm-empty-text" style="font-size: 12px; color: #9ca3af; margin-top: 8px;">Tip: Texture is applied one chord at a time. Multi-chord selection is useful in the Melody tab.</p>
            </div>
        `;
        return;
    }

    // Main content (no header - info is available via ? button on tab)
    const content = document.createElement('div');
    content.style.cssText = 'padding: 12px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; max-height: 500px;';

    // Note: Style & Mood now uses the global selector in the context bar
    // Show recommended textures based on current style
    const styleRecsSection = createTextureRecommendationsDisplay();
    content.appendChild(styleRecsSection);

    // Unified Texture Type Selector - same texture types for both clefs
    // Staff toggle determines WHERE the texture is applied (treble Voice 2 or bass)
    const textureSelector = createTextureTypeSelector();
    content.appendChild(textureSelector);

    // 3. VexFlow Preview with dual colors
    const previewSection = createPolyphonyPreview();
    content.appendChild(previewSection);

    // 4. Generated Suggestions
    const suggestionsSection = document.createElement('div');
    suggestionsSection.id = 'polyphony-suggestions';
    suggestionsSection.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;';
    suggestionsSection.innerHTML = `
        <div style="color: #6b7280; text-align: center; padding: 20px;">
            Select a chord and texture type to generate suggestions
        </div>
    `;
    content.appendChild(suggestionsSection);

    container.appendChild(content);

    // Note: "Apply to Voice 2" button removed - use "Apply Selected" in the texture selector instead

    // Auto-generate suggestions on initial load
    setTimeout(() => {
        generatePolyphonySuggestions();
    }, 100);
}

// Note: createStyleMoodSelector removed - Texture tab now uses global style/mood from context bar

function updateTextureRecommendations() {
    const stylePrefs = STYLE_TEXTURE_PREFERENCES[polyphonyState.selectedStyle];
    const recommendedTextures = stylePrefs?.preferredTextures || [];

    document.querySelectorAll('.texture-type-option').forEach(option => {
        const textureId = option.dataset.type;
        const isRecommended = recommendedTextures.includes(textureId);
        const isSelected = textureId === polyphonyState.selectedTextureType;

        // Add a "recommended" badge if this texture is recommended for the style
        let badge = option.querySelector('.recommended-badge');
        if (isRecommended && !badge) {
            badge = document.createElement('span');
            badge.className = 'recommended-badge';
            badge.style.cssText = `
                position: absolute;
                top: 4px;
                right: 4px;
                background: #667eea;
                color: white;
                font-size: 9px;
                padding: 2px 6px;
                border-radius: 10px;
            `;
            badge.textContent = '★';
            option.style.position = 'relative';
            option.appendChild(badge);
        } else if (!isRecommended && badge) {
            badge.remove();
        }
    });
}

function createPolyphonyChordSelector(progressionData, currentKey) {
    const section = document.createElement('div');
    section.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;';

    section.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 12px; color: #374151;">
            Select Building Block / Chord
        </div>
        <div id="polyphony-chord-selector" style="display: flex; flex-wrap: wrap; gap: 8px;">
        </div>
    `;

    const selectorContainer = section.querySelector('#polyphony-chord-selector');

    progressionData.forEach((chord, index) => {
        const chordBtn = document.createElement('button');
        const isSelected = index === polyphonyState.selectedChordIndex;
        const spelledPolyRoot = spellNoteInKey(chord.root, currentKey);
        chordBtn.textContent = `${spelledPolyRoot}${chord.type || ''}`;
        chordBtn.style.cssText = `
            padding: 8px 16px;
            border: 2px solid ${isSelected ? '#667eea' : '#e5e7eb'};
            border-radius: 6px;
            background: ${isSelected ? '#667eea' : 'white'};
            color: ${isSelected ? 'white' : '#374151'};
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        `;
        chordBtn.addEventListener('click', () => {
            polyphonyState.selectedChordIndex = index;
            // Re-render chord selector
            const parent = section.parentElement;
            const newSection = createPolyphonyChordSelector(progressionData, currentKey);
            parent.replaceChild(newSection, section);
            // Auto-regenerate suggestions when chord changes
            generatePolyphonySuggestions();
        });
        selectorContainer.appendChild(chordBtn);
    });

    return section;
}

function createTextureTypeSelector() {
    const section = document.createElement('div');
    section.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px;';

    const currentStaff = polyphonyState.selectedStaff;

    // Generate texture options with clef eligibility check
    const textureOptions = Object.values(TEXTURE_TYPES).map(type => {
        const isEligible = !type.clefs || type.clefs.includes(currentStaff);
        const isSelected = polyphonyState.selectedTextureType === type.id && isEligible;

        // Styling based on eligibility and selection
        const borderColor = !isEligible ? '#e5e7eb' : (isSelected ? '#667eea' : '#e5e7eb');
        const bgColor = !isEligible ? '#f3f4f6' : (isSelected ? '#f0f4ff' : 'white');
        const textColor = !isEligible ? '#9ca3af' : '#374151';
        const cursor = isEligible ? 'pointer' : 'not-allowed';
        const opacity = isEligible ? '1' : '0.5';

        return `
            <div class="texture-type-option" data-type="${type.id}" data-eligible="${isEligible}" title="${type.description}${!isEligible ? ' (not available for ' + currentStaff + ' clef)' : ''}" style="
                padding: 4px 6px;
                border: 1px solid ${borderColor};
                border-radius: 4px;
                background: ${bgColor};
                cursor: ${cursor};
                transition: all 0.15s;
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                opacity: ${opacity};
            ">
                <span style="font-size: 12px;">${type.icon}</span>
                <span style="font-weight: 500; color: ${textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${type.name}</span>
            </div>
        `;
    }).join('');

    const staffLabel = currentStaff === 'bass' ? 'Bass' : 'Treble Voice 2';

    section.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="font-weight: 600; font-size: 12px; color: #374151;">Texture Type</span>
            <select id="polyphony-staff-select" style="padding: 2px 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 10px; background: white;">
                <option value="treble" ${currentStaff === 'treble' ? 'selected' : ''}>Treble (Voice 2)</option>
                <option value="bass" ${currentStaff === 'bass' ? 'selected' : ''}>Bass</option>
            </select>
        </div>
        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px; margin-bottom: 8px;">
            ${textureOptions}
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
            <button id="texture-preview-btn" style="
                flex: 1;
                padding: 4px 8px;
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                font-size: 10px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 3px;
            ">▶ Preview</button>
            <button id="texture-apply-btn" style="
                flex: 1;
                padding: 4px 8px;
                background: #667eea;
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 500;
                cursor: pointer;
            ">Apply Selected</button>
            <span style="font-size: 9px; color: #9ca3af;">→ ${staffLabel}</span>
        </div>
    `;

    // Add event listeners after DOM insertion
    setTimeout(() => {
        const staffSelect = document.getElementById('polyphony-staff-select');
        if (staffSelect) {
            staffSelect.addEventListener('change', (e) => {
                polyphonyState.selectedStaff = e.target.value;
                // Re-render the entire tab to update labels and regenerate suggestions
                const container = document.getElementById('unified-modal-content');
                if (container) {
                    renderPolyphonyTab(container);
                }
            });
        }

        // Texture type selection
        document.querySelectorAll('.texture-type-option').forEach(option => {
            option.addEventListener('click', () => {
                // Check if this texture is eligible for the current clef
                const isEligible = option.dataset.eligible === 'true';
                if (!isEligible) {
                    // Show a toast or just ignore the click
                    if (window.showToast) {
                        window.showToast(`This texture is not available for ${polyphonyState.selectedStaff} clef`, { type: 'info' });
                    }
                    return;
                }

                polyphonyState.selectedTextureType = option.dataset.type;
                document.querySelectorAll('.texture-type-option').forEach(opt => {
                    const optEligible = opt.dataset.eligible === 'true';
                    const isSelected = opt.dataset.type === polyphonyState.selectedTextureType && optEligible;
                    opt.style.borderColor = isSelected ? '#667eea' : '#e5e7eb';
                    opt.style.background = !optEligible ? '#f3f4f6' : (isSelected ? '#f0f4ff' : 'white');
                });
                // Auto-regenerate suggestions when texture type changes
                generatePolyphonySuggestions();
            });
        });

        // Preview button - plays both clefs for the selected chord with the texture applied
        const previewBtn = document.getElementById('texture-preview-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => previewTexture());
        }

        // Apply button - applies the selected texture to the appropriate staff
        const applyBtn = document.getElementById('texture-apply-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => applyTexture());
        }
    }, 0);

    return section;
}

// Note: createBassPatternSelector has been integrated into createTextureTypeSelector
// The bass patterns now appear when staff selector is set to 'bass'

function previewBassPattern() {
    const progressionData = getProgressionData() || [];
    const chordIndex = polyphonyState.selectedChordIndex;
    const chord = progressionData[chordIndex];
    if (!chord) {
        console.warn('[Bass Pattern] No chord selected');
        return;
    }

    const currentKey = getCurrentKey() || 'C';
    const compositionState = getCompositionState();
    const timeSignature = compositionState?.metadata?.timeSignature || { num: 4, denom: 4 };

    // Import and call the bass generator
    import('../../../integration/bassAutoFill.js').then(module => {
        const notes = module.generateBuildingBlockBass(chord, null, chord.beats || 4, {
            bassPattern: polyphonyState.selectedBassPattern,
            key: currentKey,
            timeSignature: timeSignature
        });

        polyphonyState.generatedBassNotes = notes;

        if (notes.length === 0) {
            console.warn('[Bass Pattern] No notes generated');
            return;
        }

        // Get the piano and play the notes as a sequence
        const piano = window.getPiano?.();
        if (!piano) {
            console.warn('[Bass Pattern] Piano not available');
            return;
        }

        // Calculate tempo-based timing
        const tempo = compositionState?.metadata?.tempo || 120;
        const secondsPerBeat = 60 / tempo;

        // Play notes sequentially based on their beat positions
        notes.forEach(note => {
            if (note.isRest) return;
            const pitch = note.pitch || note.pitches?.[0];
            if (!pitch) return;

            const startTime = note.beat * secondsPerBeat;
            const duration = note.duration || '4n';

            setTimeout(() => {
                try {
                    piano.triggerAttackRelease(pitch, duration);
                } catch (e) {
                    console.warn('[Bass Pattern] Play error:', e);
                }
            }, startTime * 1000);
        });

        // Visual feedback on preview button
        const previewBtn = document.getElementById('preview-bass-pattern-btn');
        if (previewBtn) {
            const originalText = previewBtn.textContent;
            previewBtn.textContent = '▶ Playing...';
            previewBtn.style.background = '#f0f4ff';
            setTimeout(() => {
                previewBtn.textContent = originalText;
                previewBtn.style.background = 'white';
            }, (chord.beats || 4) * secondsPerBeat * 1000 + 200);
        }
    }).catch(err => {
        console.warn('[Bass Pattern] Preview error:', err);
    });
}

function applyBassPattern() {
    const progressionData = getProgressionData() || [];
    const chordIndex = polyphonyState.selectedChordIndex;
    const chord = progressionData[chordIndex];
    if (!chord) {
        console.warn('[Bass Pattern] No chord selected');
        return;
    }

    const compositionState = getCompositionState();
    if (!compositionState) {
        console.warn('[Bass Pattern] No composition state');
        return;
    }

    // Use the correct API: setChordBassPattern
    // This sets the pattern name and calls regenerateAutoBassByChordIndex internally
    if (typeof compositionState.setChordBassPattern === 'function') {
        const success = compositionState.setChordBassPattern(chordIndex, polyphonyState.selectedBassPattern);

        if (success) {
            // Refresh notation display
            if (window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
            }

            // Re-render chord cards to show the pattern change
            if (window.renderProgressionDisplay) {
                window.renderProgressionDisplay();
            }

            // Toast notification
            const patternName = BASS_PATTERNS[polyphonyState.selectedBassPattern]?.name || polyphonyState.selectedBassPattern;
            if (window.showToast) {
                window.showToast(`Applied "${patternName}" bass pattern`, { type: 'success' });
            }

            // Show success feedback on button
            const applyBtn = document.getElementById('apply-bass-pattern-btn');
            if (applyBtn) {
                const originalText = applyBtn.textContent;
                applyBtn.textContent = '✓ Applied!';
                applyBtn.style.background = '#10B981';
                setTimeout(() => {
                    applyBtn.textContent = originalText;
                    applyBtn.style.background = '#667eea';
                }, 1500);
            }
        } else {
            console.warn('[Bass Pattern] setChordBassPattern returned false');
            if (window.showToast) {
                window.showToast('Failed to apply bass pattern', { type: 'error' });
            }
        }
    } else {
        console.warn('[Bass Pattern] setChordBassPattern not available on compositionState');
        if (window.showToast) {
            window.showToast('Bass pattern feature not available', { type: 'error' });
        }
    }
}

// ============================================================================
// TEXTURE PREVIEW AND APPLY FUNCTIONS
// These are the main functions called by the unified texture UI buttons
// ============================================================================

/**
 * Preview the selected texture - plays both treble and bass clefs for the selected chord
 * This gives users a complete picture of how the texture will sound in context
 */
function previewTexture() {
    const compositionState = getCompositionState();
    if (!compositionState) return;

    const progressionData = getProgressionData() || [];
    const chordIndex = polyphonyState.selectedChordIndex;
    const chord = progressionData[chordIndex];
    if (!chord) {
        console.warn('[Texture Preview] No chord selected');
        return;
    }

    // Gather ALL notes for this chord - both treble and bass, both voices
    let trebleNotes = [];
    let bassNotes = [];

    if (compositionState.gatherTrebleNotesForChord) {
        trebleNotes = compositionState.gatherTrebleNotesForChord(chordIndex);
    }
    if (compositionState.gatherBassNotesForChord) {
        bassNotes = compositionState.gatherBassNotesForChord(chordIndex);
    }

    // Filter to voice 1 only (existing notes)
    const voice1Treble = trebleNotes.filter(n => (n.voiceIndex || 0) === 0 && !n.isRest && n.type !== 'rest');
    const voice1Bass = bassNotes.filter(n => (n.voiceIndex || 0) === 0 && !n.isRest && n.type !== 'rest');

    // Get the generated texture suggestions (voice 2)
    const voice2Notes = (polyphonyState.generatedSuggestions || []).filter(n => !n.isRest && n.type !== 'rest');

    // Combine all notes based on which staff the texture is applied to
    let allNotes = [];
    if (polyphonyState.selectedStaff === 'treble') {
        // Texture is on treble: combine treble voice 1 + voice 2 suggestions + bass voice 1
        allNotes = [...voice1Treble, ...voice2Notes, ...voice1Bass];
    } else {
        // Texture is on bass: combine treble voice 1 + bass voice 1 + voice 2 suggestions
        allNotes = [...voice1Treble, ...voice1Bass, ...voice2Notes];
    }

    // Sort by beat
    allNotes.sort((a, b) => (a.beat || 0) - (b.beat || 0));

    if (allNotes.length === 0) {
        console.warn('[Texture Preview] No notes to play');
        if (window.showToast) {
            window.showToast('No notes to preview - add melody notes first', { type: 'info' });
        }
        return;
    }

    // Get the piano instrument
    const piano = window.getPiano?.() || (window.getInstrument && window.getInstrument());
    if (!piano) {
        console.warn('[Texture Preview] Piano not available');
        return;
    }

    // Ensure Tone.js context is running
    if (window.Tone && window.Tone.context.state !== 'running') {
        window.Tone.start();
    }

    // Get tempo from composition state
    const tempo = compositionState.metadata?.tempo || 120;
    const beatDuration = 60 / tempo; // seconds per beat
    const baseTime = window.Tone?.now?.() || 0;

    // Calculate total duration for button feedback
    const maxBeat = Math.max(...allNotes.map(n => (n.beat || 0) + getDurationInBeats(n.duration || 'q', n.dotted)));
    const totalDuration = maxBeat * beatDuration;

    // Schedule all notes with their correct beat positions
    allNotes.forEach(note => {
        const pitch = note.pitch || note.pitches?.[0];
        if (!pitch) return;

        const noteBeat = note.beat || 0;
        const startTime = baseTime + noteBeat * beatDuration;
        const durationBeats = getDurationInBeats(note.duration || 'q', note.dotted);
        const noteDuration = durationBeats * beatDuration * 0.9; // 90% for articulation

        try {
            piano.triggerAttackRelease(pitch, noteDuration, startTime);
        } catch (e) {
            // Ignore individual note errors
        }
    });

    // Visual feedback on preview button
    const previewBtn = document.getElementById('texture-preview-btn');
    if (previewBtn) {
        const originalText = previewBtn.innerHTML;
        previewBtn.innerHTML = '▶ Playing...';
        previewBtn.style.background = '#f0f4ff';
        previewBtn.style.borderColor = '#667eea';
        setTimeout(() => {
            previewBtn.innerHTML = originalText;
            previewBtn.style.background = 'white';
            previewBtn.style.borderColor = '#d1d5db';
        }, totalDuration * 1000 + 200);
    }
}

/**
 * Apply the selected texture to the appropriate staff
 * This adds the generated texture notes to Voice 2 of either treble or bass clef
 */
function applyTexture() {
    const compositionState = getCompositionState();
    if (!compositionState) {
        console.warn('[Texture Apply] No composition state');
        return;
    }

    if (!polyphonyState.generatedSuggestions || polyphonyState.generatedSuggestions.length === 0) {
        if (window.showToast) {
            window.showToast('No texture to apply - select a texture type first', { type: 'info' });
        }
        return;
    }

    const staff = polyphonyState.selectedStaff;
    const chordIndex = polyphonyState.selectedChordIndex;

    // Collect unique measures that will be affected
    const affectedMeasures = new Set();
    polyphonyState.generatedSuggestions.forEach(suggestion => {
        affectedMeasures.add(suggestion.sourceMeasure || 0);
    });

    // Clear existing Voice 2 notes in affected measures before adding new ones
    // This prevents duplicate notes when re-applying texture to the same measure
    affectedMeasures.forEach(measureIndex => {
        compositionState.ensureVoiceExists(measureIndex, staff, 1);
        if (compositionState.clearVoice) {
            compositionState.clearVoice(measureIndex, staff, 1);
        } else {
            // Fallback: manually clear the voice notes
            const measure = compositionState.getMeasure(measureIndex);
            if (measure?.notation?.[staff]?.voices?.[1]) {
                measure.notation[staff].voices[1].notes = [];
            }
        }
    });

    // Add each suggestion to voice 2 of the target staff
    polyphonyState.generatedSuggestions.forEach(suggestion => {
        const sourceMeasure = suggestion.sourceMeasure || 0;
        compositionState.ensureVoiceExists(sourceMeasure, staff, 1); // Voice index 1 = Voice 2

        const noteToAdd = {
            type: suggestion.type || 'note',
            pitch: suggestion.pitch,
            pitches: suggestion.pitches,
            duration: suggestion.duration,
            beat: suggestion.beat || 0,
            voiceIndex: 1
        };

        compositionState.addNoteToVoice(sourceMeasure, staff, 1, noteToAdd);
    });

    // Emit event to trigger re-render
    if (compositionState.events) {
        compositionState.events.emit('compositionChanged');
    }

    // Refresh notation display
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }

    // Show success toast
    const textureType = TEXTURE_TYPES[Object.keys(TEXTURE_TYPES).find(
        k => TEXTURE_TYPES[k].id === polyphonyState.selectedTextureType
    )];
    const textureName = textureType?.name || 'Texture';
    const noteCount = polyphonyState.generatedSuggestions.length;
    const staffLabel = staff === 'bass' ? 'Bass' : 'Treble Voice 2';

    if (window.showToast) {
        window.showToast(`${textureName} applied to ${staffLabel} (${noteCount} note${noteCount !== 1 ? 's' : ''})`, { type: 'success' });
    }

    // Visual feedback on apply button
    const applyBtn = document.getElementById('texture-apply-btn');
    if (applyBtn) {
        const originalText = applyBtn.textContent;
        const originalBg = applyBtn.style.background;
        applyBtn.textContent = '✓ Applied!';
        applyBtn.style.background = '#10B981';
        setTimeout(() => {
            applyBtn.textContent = originalText;
            applyBtn.style.background = originalBg || '#667eea';
        }, 1500);
    }
}

function createPolyphonyPreview() {
    const section = document.createElement('div');
    section.style.cssText = 'border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px;';

    section.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 6px; color: #374151; display: flex; align-items: center; justify-content: space-between; font-size: 12px;">
            <span>Preview</span>
            <div style="display: flex; gap: 12px; font-size: 10px; font-weight: normal; align-items: center;">
                <button id="polyphony-play-btn" style="
                    padding: 3px 8px;
                    background: white;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 10px;
                    display: flex;
                    align-items: center;
                    gap: 3px;
                ">&#9654; Play</button>
                <span style="display: flex; align-items: center; gap: 3px;">
                    <span style="width: 10px; height: 10px; background: #000000; border-radius: 2px;"></span>
                    Current
                </span>
                <span style="display: flex; align-items: center; gap: 3px;">
                    <span style="width: 10px; height: 10px; background: #10B981; border-radius: 2px;"></span>
                    Suggested
                </span>
            </div>
        </div>
        <div id="polyphony-preview-container" style="
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            padding: 4px;
            height: 250px;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: visible;
        ">
        </div>
    `;

    // Set up play button listener
    setTimeout(() => {
        const playBtn = document.getElementById('polyphony-play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => playPolyphonyPreview());
        }
    }, 0);

    return section;
}

function updatePolyphonyPreview() {
    const container = document.getElementById('polyphony-preview-container');
    if (!container) return;

    // Get VexFlow
    const VF = window.VexFlow || (window.Vex ? window.Vex.Flow : null);
    if (!VF) {
        container.innerHTML = '<div style="color: #6b7280; text-align: center; padding: 20px;">VexFlow not available</div>';
        return;
    }

    // Get current notes for the selected chord
    const compositionState = getCompositionState();
    if (!compositionState) return;

    const progressionData = getProgressionData() || [];
    const chord = progressionData[polyphonyState.selectedChordIndex];
    if (!chord) return;

    const currentKey = getCurrentKey() || 'C';
    const staff = polyphonyState.selectedStaff; // 'treble' or 'bass'

    // Gather current voice 1 notes for the selected chord
    const gatherTreble = compositionState.gatherTrebleNotesForChord;
    const gatherBass = compositionState.gatherBassNotesForChord;

    const trebleNotes = gatherTreble
        ? gatherTreble.call(compositionState, polyphonyState.selectedChordIndex)
        : [];
    const bassNotes = gatherBass
        ? gatherBass.call(compositionState, polyphonyState.selectedChordIndex)
        : [];

    // Filter to voice 1 only (existing notes)
    let voice1Treble = trebleNotes.filter(n => (n.voiceIndex || 0) === 0);
    let voice1Bass = bassNotes.filter(n => (n.voiceIndex || 0) === 0);

    // Get generated suggestions (voice 2) and add them to the appropriate staff
    const voice2Notes = polyphonyState.generatedSuggestions || [];

    // Mark voice 2 notes with voiceIndex=1 for proper rendering
    const voice2WithIndex = voice2Notes.map(n => ({ ...n, voiceIndex: 1 }));

    // Combine voice 1 and voice 2 notes for the target staff
    let combinedTreble = [...voice1Treble];
    let combinedBass = [...voice1Bass];

    if (staff === 'treble') {
        combinedTreble = [...voice1Treble, ...voice2WithIndex];
    } else {
        combinedBass = [...voice1Bass, ...voice2WithIndex];
    }

    // If no notes to show, display message
    if (combinedTreble.length === 0 && combinedBass.length === 0) {
        const spelledPreviewRoot = spellNoteInKey(chord.root, currentKey);
        container.innerHTML = `<div style="color: #6b7280; text-align: center; padding: 20px;">No notes in ${spelledPreviewRoot}${chord.type || ''} - add melody to see preview</div>`;
        return;
    }

    // Clear container and create canvas
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = 500;
    canvas.height = 240;  // Increased to prevent bass clef clipping, especially with low pedal tones
    canvas.style.cssText = 'max-width: 100%; height: auto;';
    container.appendChild(canvas);

    // Create renderer
    const rendererResult = createRenderer(canvas, canvas.width, canvas.height);
    if (!rendererResult) return;

    const { context } = rendererResult;

    // Use renderGrandStaffMeasure with the combined notes
    try {
        renderGrandStaffMeasure(context, {
            trebleNotes: combinedTreble,
            bassNotes: combinedBass
        }, {
            x: 10,
            y: 10,
            width: 480,
            staffSpacing: 40,
            keySignature: currentKey,
            timeSignature: '4/4',
            showClef: true,
            showKeySignature: true,
            showTimeSignature: false,
            showBrace: true,
            showBarlines: true,
            isFirstInSystem: true,
            isLastInSystem: true,
            measureIndex: 0,
            chord: chord,
            enableHarmonicColoring: false,
            colorSuggestedNotes: true  // Color voice 2 notes green in preview
        });
    } catch (e) {
        console.warn('[Polyphony Preview] Render error:', e);
        container.innerHTML = `<div style="color: #6b7280; text-align: center; padding: 20px;">Preview: ${voice1Treble.length + voice1Bass.length} current + ${voice2Notes.length} suggested notes</div>`;
    }
}

function generatePolyphonySuggestions() {
    const compositionState = getCompositionState();
    const progressionData = getProgressionData() || [];
    const currentKey = getCurrentKey();

    if (!compositionState || progressionData.length === 0) return;

    const chord = progressionData[polyphonyState.selectedChordIndex];
    if (!chord) return;

    // Get notes from the selected chord's measures based on selected staff
    const staff = polyphonyState.selectedStaff;
    let chordNotes = [];

    if (staff === 'treble' && compositionState.gatherTrebleNotesForChord) {
        chordNotes = compositionState.gatherTrebleNotesForChord(polyphonyState.selectedChordIndex);
    } else if (staff === 'bass' && compositionState.gatherBassNotesForChord) {
        chordNotes = compositionState.gatherBassNotesForChord(polyphonyState.selectedChordIndex);
    }

    // Filter to voice 1 only (we're generating voice 2 suggestions)
    chordNotes = chordNotes.filter(n => (n.voiceIndex || 0) === 0);

    // Debug logging
    console.log('[Polyphony] Notes gathered:', chordNotes.length, chordNotes.map(n => n.pitch || n.pitches?.[0]));

    // Generate suggestions based on texture type
    const suggestions = generateTextureNotes(
        chordNotes,
        chord,
        currentKey,
        polyphonyState.selectedTextureType,
        polyphonyState.selectedStaff,
        polyphonyState.selectedChordIndex  // Pass measure/chord index
    );

    polyphonyState.generatedSuggestions = suggestions;

    // Update suggestions display
    const suggestionsContainer = document.getElementById('polyphony-suggestions');
    if (suggestionsContainer) {
        if (suggestions.length === 0) {
            suggestionsContainer.innerHTML = `
                <div style="color: #6b7280; text-align: center; padding: 20px;">
                    No notes found in the selected chord. Add melody notes first.
                </div>
            `;
        } else {
            const textureType = Object.values(TEXTURE_TYPES).find(t => t.id === polyphonyState.selectedTextureType);
            suggestionsContainer.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 8px; color: #374151;">
                    ${textureType?.icon || ''} Generated ${textureType?.name || 'Texture'}
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    ${suggestions.map(note => {
                        const rawPitch = note.pitch || note.pitches?.[0] || 'rest';
                        const spelledNotePitch = rawPitch !== 'rest' ? spellNoteInKey(rawPitch, currentKey) : 'rest';
                        return `
                        <span style="
                            padding: 4px 8px;
                            background: #f0f4ff;
                            border: 1px solid #667eea;
                            border-radius: 4px;
                            font-size: 12px;
                            color: #667eea;
                        ">${spelledNotePitch} (${note.duration})</span>`;
                    }).join('')}
                </div>
                <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">
                    ${suggestions.length} notes will be added to Voice 2 of the ${polyphonyState.selectedStaff} clef
                </div>
            `;
        }
    }

    // Update preview
    updatePolyphonyPreview();
}

// ============================================================================
// TEXTURE GENERATION LOGIC
// ============================================================================

function generateTextureNotes(melodyNotes, chord, key, textureType, staff, measureIndex = 0) {
    if (!melodyNotes || melodyNotes.length === 0) return [];

    const chordRoot = chord.root;
    const chordThird = getThirdFromRoot(chordRoot, chord.type);
    const chordFifth = getFifthFromRoot(chordRoot);
    const suggestions = [];

    // Get style and mood preferences
    const stylePrefs = STYLE_TEXTURE_PREFERENCES[polyphonyState.selectedStyle] || STYLE_TEXTURE_PREFERENCES.balanced;
    const moodAdj = MOOD_TEXTURE_ADJUSTMENTS[polyphonyState.selectedMood] || MOOD_TEXTURE_ADJUSTMENTS.bright;

    // Determine base octaves based on target staff
    // Bass clef should use octaves 2-4 (comfortable reading range), treble clef should use octaves 3-5
    const isBassClef = staff === 'bass';
    const getBaseOctave = (moodBias) => {
        if (isBassClef) {
            // Bass clef: lower = 2, normal = 3, higher = 4
            // (Octave 1 is too low - E1 is below standard piano range and creates excessive ledger lines)
            return moodBias === 'lower' ? 2 : (moodBias === 'higher' ? 4 : 3);
        } else {
            // Treble clef: lower = 3, normal = 4, higher = 5
            return moodBias === 'lower' ? 3 : (moodBias === 'higher' ? 5 : 4);
        }
    };

    // Helper: Ensure a harmony pitch is below the melody pitch (for treble clef V2)
    const ensureBelowMelody = (harmonyPitch, melodyPitch) => {
        const melodyMidi = pitchToMidi(melodyPitch);
        let harmonyMidi = pitchToMidi(harmonyPitch);
        while (harmonyMidi >= melodyMidi) {
            harmonyMidi -= 12;
        }
        return midiToPitch(harmonyMidi, shouldPreferFlats(key));
    };

    // Helper: Ensure a harmony pitch is above the melody pitch (for bass clef V2)
    // In bass clef, V2 (texture) should be ABOVE V1 (bass line) so stems don't cross awkwardly
    const ensureAboveMelody = (harmonyPitch, melodyPitch) => {
        const melodyMidi = pitchToMidi(melodyPitch);
        let harmonyMidi = pitchToMidi(harmonyPitch);
        while (harmonyMidi <= melodyMidi) {
            harmonyMidi += 12;
        }
        return midiToPitch(harmonyMidi, shouldPreferFlats(key));
    };

    // Helper: Find the nearest chord tone below a given pitch (for treble clef harmonic accompaniment)
    // This creates better voice leading by having the accompaniment follow the melody contour
    const findNearestChordToneBelow = (melodyPitch, chordTones) => {
        const melodyMidi = pitchToMidi(melodyPitch);
        let bestPitch = null;
        let bestDistance = Infinity;

        // Try each chord tone at various octaves to find the nearest one below melody
        for (const tone of chordTones) {
            // Try octaves 1-6
            for (let oct = 1; oct <= 6; oct++) {
                const candidatePitch = `${tone}${oct}`;
                const candidateMidi = pitchToMidi(candidatePitch);
                // Must be below melody
                if (candidateMidi < melodyMidi) {
                    const distance = melodyMidi - candidateMidi;
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestPitch = candidatePitch;
                    }
                }
            }
        }

        // Fallback: if no chord tone found below, return first chord tone an octave below melody
        if (!bestPitch) {
            const melodyOctave = parseInt(melodyPitch.match(/\d+/)?.[0] || '4', 10);
            bestPitch = `${chordTones[0]}${melodyOctave - 1}`;
        }

        return midiToPitch(pitchToMidi(bestPitch), shouldPreferFlats(key));
    };

    // Calculate interval adjustments based on style and mood
    const getStyleAdjustedInterval = (baseInterval, preserveDirection = false) => {
        let adjusted = baseInterval;
        const originalSign = baseInterval < 0 ? -1 : 1;

        // Mood offset (small adjustment)
        adjusted += moodAdj.intervalOffset || 0;

        // Style-specific adjustments
        if (stylePrefs.intervalBias === 'power' && Math.abs(baseInterval) < 5) {
            // Rock style: prefer power intervals (5ths, octaves)
            adjusted = baseInterval < 0 ? -7 : 7; // Jump to fifth
        } else if (stylePrefs.intervalBias === 'colorful' && Math.abs(baseInterval) <= 4) {
            // Jazz style: add color, could use 7th or 9th
            // Only adjust in the same direction to avoid flipping
            adjusted = baseInterval + (baseInterval < 0 ? -2 : 2);
        } else if (stylePrefs.intervalBias === 'bluesy') {
            // Blues: occasional blue note (b3, b7)
            if (Math.random() > 0.7) {
                adjusted = baseInterval - 1; // Flatten by a half step
            }
        }

        // Register bias adjustments - but ONLY if we're not preserving direction
        // For parallel thirds/sixths, we want to stay BELOW the melody
        if (!preserveDirection) {
            // Dark mood: lower register
            if (moodAdj.registerBias === 'lower' && adjusted > -5) {
                adjusted -= 12; // Drop an octave
            }
            // Bright mood: higher register
            if (moodAdj.registerBias === 'higher' && adjusted < 0) {
                adjusted += 12; // Raise an octave
            }
        }

        // When preserveDirection is true, ensure we don't flip the sign
        // This keeps parallel motion BELOW the melody (negative interval stays negative)
        if (preserveDirection && originalSign < 0 && adjusted >= 0) {
            // If we accidentally flipped to positive, force it back to negative
            adjusted = -Math.abs(adjusted) || baseInterval;
        }

        return adjusted;
    };

    // Calculate chromatic adjustments
    const applyChromatic = (pitch) => {
        if (stylePrefs.chromaticism === 'high' && Math.random() > 0.8) {
            // Jazz: occasional chromatic passing tone
            return transposePitch(pitch, Math.random() > 0.5 ? 1 : -1);
        }
        if (stylePrefs.chromaticism === 'bluenotes' && Math.random() > 0.7) {
            // Blues: blue notes (flatten by half step)
            return transposePitch(pitch, -1);
        }
        return pitch;
    };

    // Get the current style for scale validation
    const currentStyle = polyphonyState.selectedStyle || 'pop';

    switch (textureType) {
        case 'parallel_thirds':
            // Transpose each melody note by a diatonic third
            // For treble: third below melody; for bass: third above melody
            // Note: NO voice range clamping - parallel motion must follow melody exactly
            melodyNotes.forEach(note => {
                if (note.isRest || note.type === 'rest') {
                    suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                } else {
                    const pitch = note.pitch || note.pitches?.[0];
                    if (pitch) {
                        // For treble: third below (-2 scale degrees); for bass: third above (+2)
                        const diatonicInterval = isBassClef ? 2 : -2;
                        let transposed = transposeDiatonic(pitch, key, diatonicInterval);

                        // Safety check based on staff type
                        const melodyMidi = pitchToMidi(pitch);
                        let harmonyMidi = pitchToMidi(transposed);
                        if (isBassClef) {
                            // Bass: harmony should be ABOVE melody
                            if (harmonyMidi <= melodyMidi) {
                                harmonyMidi += 12;
                                transposed = midiToPitch(harmonyMidi, shouldPreferFlats(key));
                            }
                        } else {
                            // Treble: harmony should be BELOW melody
                            if (harmonyMidi >= melodyMidi) {
                                harmonyMidi -= 12;
                                transposed = midiToPitch(harmonyMidi, shouldPreferFlats(key));
                            }
                        }

                        suggestions.push({
                            ...note,
                            pitch: transposed,
                            pitches: [transposed],
                            voiceIndex: 1,
                            sourceMeasure: measureIndex
                        });
                    }
                }
            });
            break;

        case 'parallel_sixths':
            // Transpose each melody note by a diatonic sixth
            // For treble: sixth below melody; for bass: sixth above melody
            // Note: NO voice range clamping - parallel motion must follow melody exactly
            melodyNotes.forEach(note => {
                if (note.isRest || note.type === 'rest') {
                    suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                } else {
                    const pitch = note.pitch || note.pitches?.[0];
                    if (pitch) {
                        // For treble: sixth below (-5 scale degrees); for bass: sixth above (+5)
                        const diatonicInterval = isBassClef ? 5 : -5;
                        let transposed = transposeDiatonic(pitch, key, diatonicInterval);

                        // Safety check based on staff type
                        const melodyMidi = pitchToMidi(pitch);
                        let harmonyMidi = pitchToMidi(transposed);
                        if (isBassClef) {
                            // Bass: harmony should be ABOVE melody
                            if (harmonyMidi <= melodyMidi) {
                                harmonyMidi += 12;
                                transposed = midiToPitch(harmonyMidi, shouldPreferFlats(key));
                            }
                        } else {
                            // Treble: harmony should be BELOW melody
                            if (harmonyMidi >= melodyMidi) {
                                harmonyMidi -= 12;
                                transposed = midiToPitch(harmonyMidi, shouldPreferFlats(key));
                            }
                        }

                        suggestions.push({
                            ...note,
                            pitch: transposed,
                            pitches: [transposed],
                            voiceIndex: 1,
                            sourceMeasure: measureIndex
                        });
                    }
                }
            });
            break;

        case 'contrary':
            // Contrary motion: counter-voice moves opposite to melody motion
            // For treble: start below melody; for bass: start above melody
            {
                // Initial interval: for treble go below; for bass go above
                const baseInterval = moodAdj.registerBias === 'lower' ? 5 : 3; // fifth vs third
                const initialInterval = isBassClef ? baseInterval : -baseInterval;
                const voiceRange = isBassClef ? 'bass_mid' : 'treble_mid';
                let counterVoicePitch = null;
                let prevMelodyPitch = null;

                melodyNotes.forEach((note, i) => {
                    if (note.isRest || note.type === 'rest') {
                        suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                        return;
                    }

                    const currPitch = note.pitch || note.pitches?.[0];
                    if (!currPitch) {
                        suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                        return;
                    }

                    if (i === 0 || !prevMelodyPitch || !counterVoicePitch) {
                        // First note: start counter-voice at initial interval
                        let transposed = transposePitch(currPitch, initialInterval);
                        // SCALE VALIDATION: Snap to nearest scale tone
                        transposed = validateAndConstrainPitch(transposed, key, currentStyle, voiceRange);
                        counterVoicePitch = transposed;
                        prevMelodyPitch = currPitch;
                        suggestions.push({
                            ...note,
                            pitch: transposed,
                            pitches: [transposed],
                            voiceIndex: 1,
                            sourceMeasure: measureIndex
                        });
                    } else {
                        // Calculate melody motion in semitones
                        const melodyMotion = getPitchDifference(currPitch, prevMelodyPitch);

                        // Counter-voice moves in opposite direction
                        // For strict voice leading, move by same amount; for relaxed, scale it down
                        const multiplier = stylePrefs.voiceLeadingStrictness === 'strict' ? 1.0 : 0.5;
                        const counterMotion = Math.round(-melodyMotion * multiplier);

                        // Apply the motion to the counter-voice
                        let newCounterPitch = transposePitch(counterVoicePitch, counterMotion);
                        // SCALE VALIDATION: Snap to nearest scale tone
                        newCounterPitch = validateAndConstrainPitch(newCounterPitch, key, currentStyle, voiceRange);

                        counterVoicePitch = newCounterPitch;
                        prevMelodyPitch = currPitch;

                        suggestions.push({
                            ...note,
                            pitch: newCounterPitch,
                            pitches: [newCounterPitch],
                            voiceIndex: 1,
                            sourceMeasure: measureIndex
                        });
                    }
                });
            }
            break;

        case 'pedal_root':
            // Sustained root note - octave based on mood AND target staff
            {
                const pedalOctave = getBaseOctave(moodAdj.registerBias);
                // Duration based on style rhythm density
                const pedalDuration = stylePrefs.rhythmDensity === 'sparse' ? 'w' :
                                     stylePrefs.rhythmDensity === 'driving' ? 'h' : 'w';
                let pedalPitch = `${chordRoot}${pedalOctave}`;

                // For bass clef, ensure pedal is ABOVE the lowest V1 note
                // For treble clef, ensure pedal is BELOW the highest V1 note
                if (isBassClef && melodyNotes.length > 0) {
                    // Find the lowest V1 pitch
                    const lowestV1 = melodyNotes
                        .filter(n => !n.isRest && n.type !== 'rest')
                        .map(n => n.pitch || n.pitches?.[0])
                        .filter(Boolean)
                        .reduce((lowest, pitch) => {
                            if (!lowest) return pitch;
                            return pitchToMidi(pitch) < pitchToMidi(lowest) ? pitch : lowest;
                        }, null);
                    if (lowestV1) {
                        pedalPitch = ensureAboveMelody(pedalPitch, lowestV1);
                    }
                } else if (!isBassClef && melodyNotes.length > 0) {
                    // For treble clef, ensure pedal is below the highest V1 note
                    const highestV1 = melodyNotes
                        .filter(n => !n.isRest && n.type !== 'rest')
                        .map(n => n.pitch || n.pitches?.[0])
                        .filter(Boolean)
                        .reduce((highest, pitch) => {
                            if (!highest) return pitch;
                            return pitchToMidi(pitch) > pitchToMidi(highest) ? pitch : highest;
                        }, null);
                    if (highestV1) {
                        pedalPitch = ensureBelowMelody(pedalPitch, highestV1);
                    }
                }

                suggestions.push({
                    type: 'note',
                    pitch: pedalPitch,
                    pitches: [pedalPitch],
                    duration: pedalDuration,
                    beat: 0,
                    voiceIndex: 1,
                    sourceMeasure: measureIndex
                });
            }
            break;

        case 'pedal_fifth':
            // Sustained fifth - octave based on mood AND target staff
            {
                const fifthOctave = getBaseOctave(moodAdj.registerBias);
                const fifth = getFifthFromRoot(chordRoot);
                const fifthDuration = stylePrefs.rhythmDensity === 'sparse' ? 'w' :
                                     stylePrefs.rhythmDensity === 'driving' ? 'h' : 'w';
                let fifthPitch = `${fifth}${fifthOctave}`;

                // For bass clef, ensure fifth pedal is ABOVE the lowest V1 note
                // For treble clef, ensure fifth pedal is BELOW the highest V1 note
                if (isBassClef && melodyNotes.length > 0) {
                    const lowestV1 = melodyNotes
                        .filter(n => !n.isRest && n.type !== 'rest')
                        .map(n => n.pitch || n.pitches?.[0])
                        .filter(Boolean)
                        .reduce((lowest, pitch) => {
                            if (!lowest) return pitch;
                            return pitchToMidi(pitch) < pitchToMidi(lowest) ? pitch : lowest;
                        }, null);
                    if (lowestV1) {
                        fifthPitch = ensureAboveMelody(fifthPitch, lowestV1);
                    }
                } else if (!isBassClef && melodyNotes.length > 0) {
                    const highestV1 = melodyNotes
                        .filter(n => !n.isRest && n.type !== 'rest')
                        .map(n => n.pitch || n.pitches?.[0])
                        .filter(Boolean)
                        .reduce((highest, pitch) => {
                            if (!highest) return pitch;
                            return pitchToMidi(pitch) > pitchToMidi(highest) ? pitch : highest;
                        }, null);
                    if (highestV1) {
                        fifthPitch = ensureBelowMelody(fifthPitch, highestV1);
                    }
                }

                suggestions.push({
                    type: 'note',
                    pitch: fifthPitch,
                    pitches: [fifthPitch],
                    duration: fifthDuration,
                    beat: 0,
                    voiceIndex: 1,
                    sourceMeasure: measureIndex
                });
            }
            break;

        case 'rhythmic':
            // Fill gaps where melody has rests - chord tone selection based on style
            // This creates rhythmic interest by placing notes where the melody is silent
            {
                const chordTones = getChordTonesForStyle(chordRoot, chord.type, stylePrefs);
                let chordToneIndex = 0;
                const baseOctave = getBaseOctave(moodAdj.registerBias);

                // Find reference pitch for position awareness (lowest for bass, highest for treble)
                let referencePitch = null;
                if (melodyNotes.length > 0) {
                    const nonRestNotes = melodyNotes
                        .filter(n => !n.isRest && n.type !== 'rest')
                        .map(n => n.pitch || n.pitches?.[0])
                        .filter(Boolean);
                    if (nonRestNotes.length > 0) {
                        if (isBassClef) {
                            // For bass clef, find lowest V1 pitch to ensure fills are above
                            referencePitch = nonRestNotes.reduce((lowest, pitch) => {
                                if (!lowest) return pitch;
                                return pitchToMidi(pitch) < pitchToMidi(lowest) ? pitch : lowest;
                            }, null);
                        } else {
                            // For treble clef, find highest V1 pitch to ensure fills are below
                            referencePitch = nonRestNotes.reduce((highest, pitch) => {
                                if (!highest) return pitch;
                                return pitchToMidi(pitch) > pitchToMidi(highest) ? pitch : highest;
                            }, null);
                        }
                    }
                }

                melodyNotes.forEach(note => {
                    if (note.isRest || note.type === 'rest') {
                        // Cycle through chord tones for variety
                        const tone = chordTones[chordToneIndex % chordTones.length];
                        let fillPitch = `${tone}${baseOctave}`;

                        // Position fill notes appropriately relative to V1 notes
                        if (referencePitch) {
                            if (isBassClef) {
                                fillPitch = ensureAboveMelody(fillPitch, referencePitch);
                            } else {
                                fillPitch = ensureBelowMelody(fillPitch, referencePitch);
                            }
                        }

                        suggestions.push({
                            type: 'note',
                            pitch: fillPitch,
                            pitches: [fillPitch],
                            duration: note.duration,
                            beat: note.beat,
                            voiceIndex: 1,
                            sourceMeasure: note.sourceMeasure
                        });
                        chordToneIndex++;
                    }
                });
            }
            break;

        case 'harmonic_accompaniment':
            // Full harmonic accompaniment - chord tones following melody rhythm
            // Unlike 'rhythmic', this adds notes for ALL melody notes, creating constant harmony
            {
                const accompChordTones = getChordTonesForStyle(chordRoot, chord.type, stylePrefs);
                let accompToneIndex = 0;
                const baseOctave = getBaseOctave(moodAdj.registerBias);
                melodyNotes.forEach(note => {
                    if (note.isRest || note.type === 'rest') {
                        // Keep rests as rests in accompaniment for breathing room
                        suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                    } else {
                        const melodyPitch = note.pitch || note.pitches?.[0];
                        let accompPitch;

                        if (melodyPitch) {
                            if (isBassClef) {
                                // Bass clef: cycle through chord tones, positioned above bass line
                                const tone = accompChordTones[accompToneIndex % accompChordTones.length];
                                accompPitch = `${tone}${baseOctave}`;
                                accompPitch = ensureAboveMelody(accompPitch, melodyPitch);
                            } else {
                                // Treble clef: find nearest chord tone BELOW melody for better voice leading
                                // This makes the accompaniment "follow" the melody contour
                                accompPitch = findNearestChordToneBelow(melodyPitch, accompChordTones);
                            }
                        } else {
                            // Fallback: use cycling chord tones
                            const tone = accompChordTones[accompToneIndex % accompChordTones.length];
                            accompPitch = `${tone}${baseOctave}`;
                        }

                        suggestions.push({
                            type: 'note',
                            pitch: accompPitch,
                            pitches: [accompPitch],
                            duration: note.duration,
                            beat: note.beat,
                            voiceIndex: 1,
                            sourceMeasure: measureIndex
                        });
                        accompToneIndex++;
                    }
                });
            }
            break;

        case 'counter':
            // Independent counter-melody - creates melodic interest with its own contour
            // Complexity varies by style: jazz uses more varied intervals, folk/pop stays simpler
            // For treble: counter-melody below; for bass: counter-melody above
            {
                const counterComplexity = stylePrefs.intervalBias === 'colorful' ? 'complex' :
                                         stylePrefs.intervalBias === 'simple' ? 'simple' : 'moderate';
                const baseOctave = getBaseOctave(moodAdj.registerBias);
                // Direction multiplier: negative for treble (below), positive for bass (above)
                const dirMult = isBassClef ? 1 : -1;

                melodyNotes.forEach((note, i) => {
                    if (note.isRest || note.type === 'rest') {
                        // For jazz/complex styles, fill in rests with chord tones for more activity
                        if (counterComplexity === 'complex') {
                            suggestions.push({
                                type: 'note',
                                pitch: `${chordRoot}${baseOctave}`,
                                pitches: [`${chordRoot}${baseOctave}`],
                                duration: note.duration,
                                beat: note.beat,
                                voiceIndex: 1,
                                sourceMeasure: measureIndex
                            });
                        } else {
                            // Simpler styles: respect the rest for cleaner texture
                            suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                        }
                    } else {
                        // Interval pattern based on complexity
                        let interval;
                        if (counterComplexity === 'complex') {
                            // Jazz: more varied intervals (3rds, 6ths, 7ths) for color
                            const intervals = [3, 4, 8, 9, 10];
                            interval = intervals[i % intervals.length] * dirMult;
                        } else if (counterComplexity === 'simple') {
                            // Folk/Pop: stick to consonant 3rds and 6ths
                            interval = (i % 2 === 0 ? 3 : 8) * dirMult;
                        } else {
                            // Moderate: alternating 3rds and 5ths
                            interval = (i % 2 === 0 ? 3 : 5) * dirMult;
                        }
                        // Apply style adjustments while preserving direction
                        interval = getStyleAdjustedInterval(interval, true);
                        const pitch = note.pitch || note.pitches?.[0];
                        if (pitch) {
                            let transposed = transposePitch(pitch, interval);
                            // Validate against scale (jazz/blues allow chromatic passing tones)
                            transposed = validateNoteForStyle(transposed, key, currentStyle);
                            // For treble: ensure counter-melody stays below the melody
                            // For bass: ensure counter-melody stays above the bass line
                            if (isBassClef) {
                                transposed = ensureAboveMelody(transposed, pitch);
                            } else {
                                transposed = ensureBelowMelody(transposed, pitch);
                            }
                            suggestions.push({
                                ...note,
                                pitch: transposed,
                                pitches: [transposed],
                                voiceIndex: 1,
                                sourceMeasure: measureIndex
                            });
                        }
                    }
                });
            }
            break;

        // === NEW TEXTURE TYPES ===

        case 'oblique':
            // Oblique motion: one voice holds a chord tone while melody moves
            {
                // Use staff-appropriate octave
                const heldOctave = getBaseOctave(moodAdj.registerBias);
                // Jazz uses fifth for more color, other styles use root
                const useRoot = stylePrefs.intervalBias !== 'colorful';
                let heldNote = useRoot ? `${chordRoot}${heldOctave}` : `${chordFifth}${heldOctave}`;
                // Scale validation without clamping
                heldNote = validateNoteForStyle(heldNote, key, currentStyle);

                // Generate held note for each melody note position
                melodyNotes.forEach(note => {
                    if (note.isRest || note.type === 'rest') {
                        suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                    } else {
                        const melodyPitch = note.pitch || note.pitches?.[0];
                        // Ensure held note is below melody (treble) or above bass line (bass)
                        let validHeld = heldNote;
                        if (melodyPitch) {
                            if (isBassClef) {
                                validHeld = ensureAboveMelody(heldNote, melodyPitch);
                            } else {
                                validHeld = ensureBelowMelody(heldNote, melodyPitch);
                            }
                        }
                        suggestions.push({
                            ...note,
                            pitch: validHeld,
                            pitches: [validHeld],
                            voiceIndex: 1,
                            sourceMeasure: measureIndex
                        });
                    }
                });
            }
            break;

        case 'octave_doubling':
            // Octave doubling: doubles the melody an octave below (or above for bass clef)
            // NO clamping - octave doubling must be exact to sound correct
            melodyNotes.forEach(note => {
                if (note.isRest || note.type === 'rest') {
                    suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                } else {
                    const pitch = note.pitch || note.pitches?.[0];
                    if (pitch) {
                        // For treble clef: double an octave below
                        // For bass clef: double an octave above (bass melodies are typically low)
                        const octaveDirection = isBassClef ? 12 : -12;
                        const transposed = transposePitch(pitch, octaveDirection);
                        suggestions.push({
                            ...note,
                            pitch: transposed,
                            pitches: [transposed],
                            voiceIndex: 1,
                            sourceMeasure: measureIndex
                        });
                    }
                }
            });
            break;

        case 'call_response':
            // Call & Response: second voice echoes the melody with delay
            {
                // Delay in beats (1 beat for dense styles, 2 for sparse)
                const delayBeats = stylePrefs.rhythmDensity === 'sparse' ? 2 : 1;
                // Transpose interval: for treble go below, for bass go above
                const echoInterval = isBassClef ? 2 : -2; // Diatonic third above or below

                melodyNotes.forEach((note, i) => {
                    if (note.isRest || note.type === 'rest') return;

                    const pitch = note.pitch || note.pitches?.[0];
                    if (!pitch) return;

                    const newBeat = (note.beat || 0) + delayBeats;
                    // Only add if it fits within the measure (assuming 4 beats)
                    if (newBeat < 4) {
                        let echoPitch = transposeDiatonic(pitch, key, echoInterval);
                        // Scale validation without clamping
                        echoPitch = validateNoteForStyle(echoPitch, key, currentStyle);
                        // For treble clef, ensure echo stays below the melody note
                        // For bass clef, ensure echo stays above the bass line
                        if (isBassClef) {
                            echoPitch = ensureAboveMelody(echoPitch, pitch);
                        } else {
                            echoPitch = ensureBelowMelody(echoPitch, pitch);
                        }

                        suggestions.push({
                            type: 'note',
                            pitch: echoPitch,
                            pitches: [echoPitch],
                            duration: note.duration,
                            beat: newBeat,
                            voiceIndex: 1,
                            sourceMeasure: measureIndex
                        });
                    }
                });
            }
            break;

        case 'drone':
            // Drone/Sustained: sustained harmony note throughout the measure
            {
                // Use staff-appropriate octave
                const droneOctave = getBaseOctave(moodAdj.registerBias);
                // Higher moods use fifth, otherwise root
                let dronePitch = moodAdj.registerBias === 'higher'
                    ? `${chordFifth}${droneOctave}`
                    : `${chordRoot}${droneOctave}`;

                // Scale validation without clamping
                dronePitch = validateNoteForStyle(dronePitch, key, currentStyle);

                // For bass clef, ensure drone is ABOVE the lowest V1 note
                // For treble clef, ensure drone is BELOW the highest V1 note
                if (isBassClef && melodyNotes.length > 0) {
                    const lowestV1 = melodyNotes
                        .filter(n => !n.isRest && n.type !== 'rest')
                        .map(n => n.pitch || n.pitches?.[0])
                        .filter(Boolean)
                        .reduce((lowest, pitch) => {
                            if (!lowest) return pitch;
                            return pitchToMidi(pitch) < pitchToMidi(lowest) ? pitch : lowest;
                        }, null);
                    if (lowestV1) {
                        dronePitch = ensureAboveMelody(dronePitch, lowestV1);
                    }
                } else if (!isBassClef && melodyNotes.length > 0) {
                    const highestV1 = melodyNotes
                        .filter(n => !n.isRest && n.type !== 'rest')
                        .map(n => n.pitch || n.pitches?.[0])
                        .filter(Boolean)
                        .reduce((highest, pitch) => {
                            if (!highest) return pitch;
                            return pitchToMidi(pitch) > pitchToMidi(highest) ? pitch : highest;
                        }, null);
                    if (highestV1) {
                        dronePitch = ensureBelowMelody(dronePitch, highestV1);
                    }
                }

                // Single whole note for the entire measure
                suggestions.push({
                    type: 'note',
                    pitch: dronePitch,
                    pitches: [dronePitch],
                    duration: 'w', // Whole note
                    beat: 0,
                    voiceIndex: 1,
                    sourceMeasure: measureIndex
                });
            }
            break;

        case 'arpeggiated':
            // Arpeggiated Harmony: broken chord accompaniment following melody rhythm
            {
                // Get staff-appropriate octave for chord tones
                const arpOctave = getBaseOctave(moodAdj.registerBias);
                const chordTones = [
                    `${chordRoot}${arpOctave}`,
                    `${chordThird}${arpOctave}`,
                    `${chordFifth}${arpOctave}`
                ];

                melodyNotes.forEach((note, i) => {
                    if (note.isRest || note.type === 'rest') {
                        suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                    } else {
                        const melodyPitch = note.pitch || note.pitches?.[0];
                        // Cycle through chord tones
                        let arpNote = chordTones[i % chordTones.length];
                        // Scale validation without clamping
                        arpNote = validateNoteForStyle(arpNote, key, currentStyle);
                        // For treble clef, ensure arpeggio note is below the melody
                        // For bass clef, ensure arpeggio note is above the bass line
                        if (melodyPitch) {
                            if (isBassClef) {
                                arpNote = ensureAboveMelody(arpNote, melodyPitch);
                            } else {
                                arpNote = ensureBelowMelody(arpNote, melodyPitch);
                            }
                        }
                        suggestions.push({
                            ...note,
                            pitch: arpNote,
                            pitches: [arpNote],
                            voiceIndex: 1,
                            sourceMeasure: measureIndex
                        });
                    }
                });
            }
            break;

        case 'suspension':
            // Suspension/Resolution: Hold a note from melody, creating tension, then resolve stepwise
            // Classic 4-3, 7-6, 9-8 suspensions
            {
                const baseOctave = getBaseOctave(moodAdj.registerBias);
                let prevMelodyPitch = null;

                melodyNotes.forEach((note, i) => {
                    if (note.isRest || note.type === 'rest') {
                        suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                        prevMelodyPitch = null;
                        return;
                    }

                    const currPitch = note.pitch || note.pitches?.[0];
                    if (!currPitch) {
                        suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                        return;
                    }

                    if (i === 0 || !prevMelodyPitch) {
                        // First note: start with a chord tone (third below for treble, above for bass)
                        const interval = isBassClef ? 3 : -3;
                        let susNote = transposePitch(currPitch, interval);
                        susNote = validateNoteForStyle(susNote, key, currentStyle);
                        suggestions.push({
                            ...note,
                            pitch: susNote,
                            pitches: [susNote],
                            voiceIndex: 1,
                            sourceMeasure: measureIndex
                        });
                        prevMelodyPitch = currPitch;
                    } else {
                        // Create suspension: hold previous harmony note, then resolve
                        // On even beats: hold (suspension), on odd beats: resolve stepwise
                        if (i % 2 === 1) {
                            // Suspension: repeat previous pitch (tension)
                            const prevInterval = isBassClef ? 3 : -3;
                            let susNote = transposePitch(prevMelodyPitch, prevInterval);
                            susNote = validateNoteForStyle(susNote, key, currentStyle);
                            suggestions.push({
                                ...note,
                                pitch: susNote,
                                pitches: [susNote],
                                voiceIndex: 1,
                                sourceMeasure: measureIndex
                            });
                        } else {
                            // Resolution: move stepwise to chord tone
                            const interval = isBassClef ? 3 : -3;
                            let resNote = transposePitch(currPitch, interval);
                            resNote = validateNoteForStyle(resNote, key, currentStyle);
                            suggestions.push({
                                ...note,
                                pitch: resNote,
                                pitches: [resNote],
                                voiceIndex: 1,
                                sourceMeasure: measureIndex
                            });
                        }
                        prevMelodyPitch = currPitch;
                    }
                });
            }
            break;

        case 'passing_tones':
            // Passing Tones: Fill melodic gaps with scale-wise motion
            // Creates smooth, flowing lines between melody notes
            {
                const baseOctave = getBaseOctave(moodAdj.registerBias);
                let prevMelodyPitch = null;

                melodyNotes.forEach((note, i) => {
                    if (note.isRest || note.type === 'rest') {
                        suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                        prevMelodyPitch = null;
                        return;
                    }

                    const currPitch = note.pitch || note.pitches?.[0];
                    if (!currPitch) {
                        suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                        return;
                    }

                    // Calculate harmony note (third below for treble, above for bass)
                    const harmonyInterval = isBassClef ? 3 : -3;
                    let harmonyNote = transposePitch(currPitch, harmonyInterval);

                    if (prevMelodyPitch && i > 0) {
                        // Check if there's a gap to fill with passing tone
                        const prevHarmony = transposePitch(prevMelodyPitch, harmonyInterval);
                        const gap = getPitchDifference(harmonyNote, prevHarmony);

                        // If gap is larger than a step (>2 semitones), we could add passing tones
                        // For now, we create stepwise motion toward the target
                        if (Math.abs(gap) > 2) {
                            // Move by step toward target (simplified - just move 1-2 semitones)
                            const stepDir = gap > 0 ? 1 : -1;
                            harmonyNote = transposePitch(prevHarmony, stepDir * 2);
                        }
                    }

                    harmonyNote = validateNoteForStyle(harmonyNote, key, currentStyle);
                    if (isBassClef) {
                        harmonyNote = ensureAboveMelody(harmonyNote, currPitch);
                    } else {
                        harmonyNote = ensureBelowMelody(harmonyNote, currPitch);
                    }

                    suggestions.push({
                        ...note,
                        pitch: harmonyNote,
                        pitches: [harmonyNote],
                        voiceIndex: 1,
                        sourceMeasure: measureIndex
                    });

                    prevMelodyPitch = currPitch;
                });
            }
            break;

        case 'neighbor_tones':
            // Neighbor Tones: Embellish with upper/lower neighbor motion
            // Alternates between chord tone and neighbor, creating ornamental effect
            {
                const baseOctave = getBaseOctave(moodAdj.registerBias);

                melodyNotes.forEach((note, i) => {
                    if (note.isRest || note.type === 'rest') {
                        suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                        return;
                    }

                    const currPitch = note.pitch || note.pitches?.[0];
                    if (!currPitch) {
                        suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                        return;
                    }

                    // Base harmony (third below for treble, above for bass)
                    const harmonyInterval = isBassClef ? 3 : -3;
                    let harmonyNote = transposePitch(currPitch, harmonyInterval);

                    // Alternate: chord tone, upper neighbor, chord tone, lower neighbor
                    const pattern = i % 4;
                    if (pattern === 1) {
                        // Upper neighbor (+1 or +2 semitones)
                        harmonyNote = transposePitch(harmonyNote, 2);
                    } else if (pattern === 3) {
                        // Lower neighbor (-1 or -2 semitones)
                        harmonyNote = transposePitch(harmonyNote, -2);
                    }
                    // pattern 0 and 2 stay on chord tone

                    harmonyNote = validateNoteForStyle(harmonyNote, key, currentStyle);
                    if (isBassClef) {
                        harmonyNote = ensureAboveMelody(harmonyNote, currPitch);
                    } else {
                        harmonyNote = ensureBelowMelody(harmonyNote, currPitch);
                    }

                    suggestions.push({
                        ...note,
                        pitch: harmonyNote,
                        pitches: [harmonyNote],
                        voiceIndex: 1,
                        sourceMeasure: measureIndex
                    });
                });
            }
            break;

        case 'pedal_motion':
            // Pedal + Motion: Bass pedal (root) while second voice adds melodic motion
            // Creates two-part texture: static foundation + moving line
            {
                const pedalOctave = getBaseOctave('lower'); // Pedal is always in lower register
                const motionOctave = getBaseOctave(moodAdj.registerBias);
                const pedalNote = `${chordRoot}${pedalOctave}`;

                // For this texture, we generate TWO notes per melody note:
                // 1. The pedal (sustained or repeated)
                // 2. A moving inner voice

                melodyNotes.forEach((note, i) => {
                    if (note.isRest || note.type === 'rest') {
                        suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                        return;
                    }

                    const currPitch = note.pitch || note.pitches?.[0];
                    if (!currPitch) {
                        suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                        return;
                    }

                    // Inner voice: cycle through chord tones (third, fifth, root)
                    const chordTones = [chordThird, chordFifth, chordRoot];
                    const innerTone = chordTones[i % chordTones.length];
                    let innerNote = `${innerTone}${motionOctave}`;
                    innerNote = validateNoteForStyle(innerNote, key, currentStyle);

                    // For treble staff, ensure inner voice is below melody
                    // For bass staff, ensure inner voice is above bass line
                    if (currPitch) {
                        if (isBassClef) {
                            innerNote = ensureAboveMelody(innerNote, currPitch);
                        } else {
                            innerNote = ensureBelowMelody(innerNote, currPitch);
                        }
                    }

                    // Output the inner voice (pedal is implied by the texture name but
                    // we only have one voice slot, so we prioritize the moving voice)
                    suggestions.push({
                        ...note,
                        pitch: innerNote,
                        pitches: [innerNote],
                        voiceIndex: 1,
                        sourceMeasure: measureIndex
                    });
                });
            }
            break;

        case 'imitation':
            // Imitation/Canon: Delayed melodic imitation at a different pitch
            // Classic contrapuntal technique - second voice echoes melody
            {
                const delayBeats = stylePrefs.rhythmDensity === 'sparse' ? 2 : 1;
                // Imitation interval: fifth below for treble, fifth above for bass
                const imitationInterval = isBassClef ? 7 : -7; // Perfect fifth

                melodyNotes.forEach((note, i) => {
                    if (note.isRest || note.type === 'rest') return;

                    const pitch = note.pitch || note.pitches?.[0];
                    if (!pitch) return;

                    const newBeat = (note.beat || 0) + delayBeats;
                    // Only add if it fits within the measure
                    if (newBeat < 4) {
                        // Transpose by imitation interval
                        let imitationPitch = transposePitch(pitch, imitationInterval);
                        imitationPitch = validateNoteForStyle(imitationPitch, key, currentStyle);

                        // For treble, ensure imitation stays below original
                        // For bass, ensure imitation stays above bass line
                        if (isBassClef) {
                            imitationPitch = ensureAboveMelody(imitationPitch, pitch);
                        } else {
                            imitationPitch = ensureBelowMelody(imitationPitch, pitch);
                        }

                        suggestions.push({
                            type: 'note',
                            pitch: imitationPitch,
                            pitches: [imitationPitch],
                            duration: note.duration,
                            beat: newBeat,
                            voiceIndex: 1,
                            sourceMeasure: measureIndex
                        });
                    }
                });
            }
            break;

        // === NEW CLEF-SPECIFIC TEXTURES ===

        case 'alberti':
            // Alberti Bass: Classic broken chord pattern root-5th-3rd-5th
            // Bass clef only - creates flowing accompaniment
            {
                const albertiOctave = getBaseOctave(moodAdj.registerBias);
                const root = `${chordRoot}${albertiOctave}`;
                const third = `${chordThird}${albertiOctave}`;
                const fifth = `${chordFifth}${albertiOctave}`;

                // Alberti pattern: root-5th-3rd-5th repeated
                const pattern = [root, fifth, third, fifth];

                // Generate 4 eighth notes per measure (or match melody rhythm)
                const beatsPerMeasure = 4;
                for (let beat = 0; beat < beatsPerMeasure; beat++) {
                    const patternNote = pattern[beat % pattern.length];
                    suggestions.push({
                        type: 'note',
                        pitch: patternNote,
                        pitches: [patternNote],
                        duration: '8n',
                        beat: beat,
                        voiceIndex: 1,
                        sourceMeasure: measureIndex
                    });
                }
            }
            break;

        case 'walking':
            // Walking Bass: Stepwise motion connecting chord roots
            // Bass clef only - jazz/blues style
            {
                const walkOctave = getBaseOctave(moodAdj.registerBias);
                const rootPitch = `${chordRoot}${walkOctave}`;

                // Get scale tones for walking motion
                const isMinorKey = key.endsWith('m') || key.includes('minor');

                // Walking bass typically: root, passing tone, passing tone, approach note
                // We'll create quarter notes walking toward the next chord root
                const beatsPerMeasure = 4;

                for (let beat = 0; beat < beatsPerMeasure; beat++) {
                    let walkPitch;
                    if (beat === 0) {
                        // Beat 1: chord root
                        walkPitch = rootPitch;
                    } else if (beat === 3) {
                        // Beat 4: approach note (half step or whole step to next root)
                        // For now, use the 7th scale degree as approach
                        walkPitch = transposeDiatonic(rootPitch, key, -1);
                    } else {
                        // Beats 2-3: scale-wise motion (3rd, 5th, or passing tones)
                        const scaleStep = beat === 1 ? 2 : 4; // 3rd on beat 2, 5th on beat 3
                        walkPitch = transposeDiatonic(rootPitch, key, scaleStep);
                    }

                    walkPitch = validateNoteForStyle(walkPitch, key, currentStyle);

                    suggestions.push({
                        type: 'note',
                        pitch: walkPitch,
                        pitches: [walkPitch],
                        duration: '4n',
                        beat: beat,
                        voiceIndex: 1,
                        sourceMeasure: measureIndex
                    });
                }
            }
            break;

        case 'shell':
            // Shell Voicings: Root + 3rd or Root + 7th
            // Bass clef only - jazz comping style
            {
                const shellOctave = getBaseOctave(moodAdj.registerBias);
                const root = `${chordRoot}${shellOctave}`;

                // Determine if chord has a 7th
                const has7th = chord.type && (
                    chord.type.includes('7') ||
                    chord.type.includes('Major 7') ||
                    chord.type.includes('Minor 7') ||
                    chord.type.includes('Dominant')
                );

                // Shell voicing: root + 3rd, or root + 7th for 7th chords
                let shellNote;
                if (has7th) {
                    // Use 7th (10 semitones for dominant/minor 7th, 11 for major 7th)
                    const isMaj7 = chord.type.includes('Major 7');
                    const seventhInterval = isMaj7 ? 11 : 10;
                    shellNote = transposePitch(root, seventhInterval);
                } else {
                    // Use 3rd
                    shellNote = `${chordThird}${shellOctave}`;
                }

                // Play as half notes or whole note chord
                suggestions.push({
                    type: 'note',
                    pitch: root,
                    pitches: [root, shellNote], // Chord with both notes
                    duration: '2n',
                    beat: 0,
                    voiceIndex: 1,
                    sourceMeasure: measureIndex
                });

                // Repeat on beat 3 for rhythmic interest
                suggestions.push({
                    type: 'note',
                    pitch: root,
                    pitches: [root, shellNote],
                    duration: '2n',
                    beat: 2,
                    voiceIndex: 1,
                    sourceMeasure: measureIndex
                });
            }
            break;

        case 'tenths':
            // Compound Tenths: 10th below melody (octave + 3rd)
            // Treble clef only - wide, open voicing
            {
                melodyNotes.forEach(note => {
                    if (note.isRest || note.type === 'rest') {
                        suggestions.push({ ...note, voiceIndex: 1, sourceMeasure: measureIndex });
                    } else {
                        const pitch = note.pitch || note.pitches?.[0];
                        if (pitch) {
                            // 10th below = -16 semitones (octave + major 3rd)
                            // Use diatonic transposition for correct scale degree
                            let tenthPitch = transposeDiatonic(pitch, key, -9); // 9 scale degrees down = 10th
                            tenthPitch = validateNoteForStyle(tenthPitch, key, currentStyle);

                            suggestions.push({
                                ...note,
                                pitch: tenthPitch,
                                pitches: [tenthPitch],
                                voiceIndex: 1,
                                sourceMeasure: measureIndex
                            });
                        }
                    }
                });
            }
            break;

        default:
            break;
    }

    return suggestions;
}

// ============================================================================
// HELPER FUNCTIONS - PITCH MANIPULATION
// ============================================================================

// Helper: Transpose a pitch by semitones
function transposePitch(pitch, semitones) {
    if (!pitch) return pitch;

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    // Map flats to their sharp equivalents
    const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B' };

    // Match both sharps and flats
    const match = pitch.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return pitch;

    let [, noteName, octaveStr] = match;
    let octave = parseInt(octaveStr, 10);

    // Convert flats to sharps for index lookup
    if (noteName.includes('b')) {
        noteName = flatToSharp[noteName] || noteName;
    }

    let noteIndex = noteNames.indexOf(noteName);

    if (noteIndex === -1) return pitch;

    noteIndex += semitones;
    while (noteIndex < 0) {
        noteIndex += 12;
        octave--;
    }
    while (noteIndex >= 12) {
        noteIndex -= 12;
        octave++;
    }

    return `${noteNames[noteIndex]}${octave}`;
}

// Helper: Compare two pitches (returns 1 if second is higher, -1 if lower, 0 if same)
function comparePitches(pitch1, pitch2) {
    const noteValues = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };

    const match1 = pitch1.match(/^([A-G]#?)(\d+)$/);
    const match2 = pitch2.match(/^([A-G]#?)(\d+)$/);
    if (!match1 || !match2) return 0;

    const val1 = parseInt(match1[2], 10) * 12 + (noteValues[match1[1]] || 0);
    const val2 = parseInt(match2[2], 10) * 12 + (noteValues[match2[1]] || 0);

    if (val1 > val2) return 1;
    if (val1 < val2) return -1;
    return 0;
}

// Helper: Get the semitone difference between two pitches (pitch1 - pitch2)
function getPitchDifference(pitch1, pitch2) {
    const noteValues = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };

    const match1 = pitch1.match(/^([A-G][#b]?)(\d+)$/);
    const match2 = pitch2.match(/^([A-G][#b]?)(\d+)$/);
    if (!match1 || !match2) return 0;

    const val1 = parseInt(match1[2], 10) * 12 + (noteValues[match1[1]] || 0);
    const val2 = parseInt(match2[2], 10) * 12 + (noteValues[match2[1]] || 0);

    return val1 - val2;
}

// Helper: Get the absolute MIDI-like value of a pitch (for comparison)
function getPitchValue(pitch) {
    if (!pitch) return 0;
    const noteValues = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };

    const match = pitch.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return 0;

    return parseInt(match[2], 10) * 12 + (noteValues[match[1]] || 0);
}

// Helper: Get the fifth from a root note
function getFifthFromRoot(root) {
    const fifths = {
        'C': 'G', 'C#': 'G#', 'D': 'A', 'D#': 'A#', 'E': 'B', 'F': 'C',
        'F#': 'C#', 'G': 'D', 'G#': 'D#', 'A': 'E', 'A#': 'F', 'B': 'F#'
    };
    return fifths[root] || 'G';
}

// Helper: Get the third from a root note (major or minor based on chord type)
function getThirdFromRoot(root, chordType) {
    const majorThirds = {
        'C': 'E', 'C#': 'F', 'D': 'F#', 'D#': 'G', 'E': 'G#', 'F': 'A',
        'F#': 'A#', 'G': 'B', 'G#': 'C', 'A': 'C#', 'A#': 'D', 'B': 'D#'
    };
    const minorThirds = {
        'C': 'D#', 'C#': 'E', 'D': 'F', 'D#': 'F#', 'E': 'G', 'F': 'G#',
        'F#': 'A', 'G': 'A#', 'G#': 'B', 'A': 'C', 'A#': 'C#', 'B': 'D'
    };

    const isMinor = chordType && (chordType.includes('m') || chordType.includes('min'));
    return isMinor ? (minorThirds[root] || 'E') : (majorThirds[root] || 'E');
}

// Helper: Get the seventh from a root note
function getSeventhFromRoot(root, isMajorSeventh = false) {
    const majorSevenths = {
        'C': 'B', 'C#': 'C', 'D': 'C#', 'D#': 'D', 'E': 'D#', 'F': 'E',
        'F#': 'F', 'G': 'F#', 'G#': 'G', 'A': 'G#', 'A#': 'A', 'B': 'A#'
    };
    const dominantSevenths = {
        'C': 'A#', 'C#': 'B', 'D': 'C', 'D#': 'C#', 'E': 'D', 'F': 'D#',
        'F#': 'E', 'G': 'F', 'G#': 'F#', 'A': 'G', 'A#': 'G#', 'B': 'A'
    };

    return isMajorSeventh ? (majorSevenths[root] || 'B') : (dominantSevenths[root] || 'Bb');
}

// Helper: Get chord tones based on style preferences
// Smart 7th selection based on chord function:
// - If chord already has a 7th, use that specific 7th
// - For Major triads adding color: use major 7th (diatonic, sounds like Imaj7)
// - For Minor triads adding color: use minor 7th (diatonic, sounds like m7)
// - Dominant 7th only for explicit dominant chords
function getChordTonesForStyle(root, chordType, stylePrefs) {
    const third = getThirdFromRoot(root, chordType);
    const fifth = getFifthFromRoot(root);

    // Determine the appropriate 7th based on chord type
    let seventh = null;
    const type = chordType || '';

    // Check if chord already specifies a 7th
    if (type.includes('Major 7') || type.includes('maj7')) {
        // Major 7th chord - use major 7th
        seventh = getSeventhFromRoot(root, true);
    } else if (type.includes('Dominant 7') || type === '7' || type.includes('7th') && !type.includes('Major') && !type.includes('Minor') && !type.includes('Diminished')) {
        // Dominant 7th chord - use dominant (minor) 7th
        seventh = getSeventhFromRoot(root, false);
    } else if (type.includes('Minor 7') || type.includes('m7') || type.includes('min7')) {
        // Minor 7th chord - use minor 7th
        seventh = getSeventhFromRoot(root, false);
    } else if (type.includes('Diminished 7') || type.includes('dim7')) {
        // Diminished 7th - use diminished 7th (double-flatted)
        seventh = getSeventhFromRoot(root, false); // Approximation
    } else if (type.includes('Half-Diminished') || type.includes('m7b5')) {
        // Half-diminished - use minor 7th
        seventh = getSeventhFromRoot(root, false);
    } else {
        // Triad without explicit 7th - choose based on chord quality for "color" styles
        const isMinor = type.includes('Minor') || type.includes('m') || type.includes('min');
        if (isMinor) {
            // Minor triad: if adding color, use minor 7th (diatonic)
            seventh = getSeventhFromRoot(root, false);
        } else {
            // Major triad: if adding color, use MAJOR 7th (diatonic, not dominant!)
            // This makes C Major -> Cmaj7 sound, not C7 which implies V function
            seventh = getSeventhFromRoot(root, true);
        }
    }

    switch (stylePrefs.intervalBias) {
        case 'colorful':
            // Jazz/Indie: include 7ths for color (now using appropriate 7th type)
            return [root, third, fifth, seventh];
        case 'power':
            // Rock: root and fifth primarily
            return [root, fifth, root];
        case 'rich':
            // Gospel: full triads with some extensions
            return [root, third, fifth, seventh];
        case 'bluesy':
            // Blues: use dominant 7th for that bluesy sound regardless of chord type
            const bluesy7th = getSeventhFromRoot(root, false); // Always dominant/minor 7th for blues
            return [root, third, fifth, bluesy7th];
        case 'simple':
        case 'consonant':
        default:
            // Pop/Folk: basic triad only
            return [root, third, fifth];
    }
}

// ============================================================================
// SCALE VALIDATION UTILITIES
// These functions ensure generated texture notes are in key
// ============================================================================

// Scale intervals (semitones from root)
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // Natural minor

// Blue note intervals for jazz/blues styles (b3, b5, b7 relative to major scale)
const BLUE_NOTE_INTERVALS = [3, 6, 10]; // Minor 3rd, dim 5th, minor 7th

// Parse key string to MIDI pitch class (C=0, C#=1, etc.)
function parseKeyRoot(key) {
    const noteMap = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    const keyRoot = key.replace(/m$/, '').replace(' Major', '').replace(' Minor', '').replace(' minor', '');
    return noteMap[keyRoot] ?? 0;
}

// Check if a MIDI note number is in the current scale
function isInScale(midiNote, keyRoot, scaleIntervals) {
    const pitchClass = ((midiNote % 12) - keyRoot + 12) % 12;
    return scaleIntervals.includes(pitchClass);
}

// Check if a MIDI note is a blue note (for jazz/blues styles)
function isBlueNote(midiNote, keyRoot) {
    const pitchClass = ((midiNote % 12) - keyRoot + 12) % 12;
    return BLUE_NOTE_INTERVALS.includes(pitchClass);
}

// Snap a MIDI note to the nearest scale tone
function nearestScaleTone(midiNote, keyRoot, scaleIntervals, direction = 'nearest') {
    if (isInScale(midiNote, keyRoot, scaleIntervals)) return midiNote;

    let up = midiNote + 1;
    let down = midiNote - 1;

    // Search up to 6 semitones in each direction (half an octave)
    while (!isInScale(up, keyRoot, scaleIntervals) && up < midiNote + 7) up++;
    while (!isInScale(down, keyRoot, scaleIntervals) && down > midiNote - 7) down--;

    if (direction === 'up') return up;
    if (direction === 'down') return down;
    // Default: return the closer one (ties go to upper)
    return (up - midiNote) <= (midiNote - down) ? up : down;
}

// Convert pitch string (e.g., "C4", "F#5") to MIDI note number
function pitchToMidi(pitch) {
    if (!pitch) return 60; // Default to middle C
    const match = pitch.match(/^([A-Ga-g][#b]?)(\d+)$/);
    if (!match) return 60;

    const noteMap = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };

    const noteName = match[1][0].toUpperCase() + (match[1].length > 1 ? match[1][1] : '');
    const octave = parseInt(match[2], 10);
    const noteValue = noteMap[noteName] ?? 0;

    return (octave + 1) * 12 + noteValue;
}

// Convert MIDI note number back to pitch string
function midiToPitch(midi, preferFlats = false) {
    const sharpNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const noteArray = preferFlats ? flatNotes : sharpNotes;
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return noteArray[noteIndex] + octave;
}

// Determine if a key prefers flat spellings
function shouldPreferFlats(key) {
    const flatKeys = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'];
    const keyRoot = key.replace(' Major', '').replace(' Minor', '').replace(' minor', '');
    return flatKeys.includes(keyRoot);
}

// Validate a generated pitch against the scale, with style-aware chromaticism
function validateNoteForStyle(pitch, key, style) {
    const midiNote = pitchToMidi(pitch);
    const keyRoot = parseKeyRoot(key);
    const isMinorKey = key.endsWith('m') || key.includes('minor') || key.includes('Minor');
    const scaleIntervals = isMinorKey ? MINOR_SCALE_INTERVALS : MAJOR_SCALE_INTERVALS;

    // Already in scale - keep it
    if (isInScale(midiNote, keyRoot, scaleIntervals)) {
        return pitch;
    }

    // For blues/jazz styles, allow blue notes
    if ((style === 'blues' || style === 'jazz') && isBlueNote(midiNote, keyRoot)) {
        return pitch; // Keep the chromatic blue note for authentic feel
    }

    // Otherwise, snap to nearest scale tone
    const validMidi = nearestScaleTone(midiNote, keyRoot, scaleIntervals);
    return midiToPitch(validMidi, shouldPreferFlats(key));
}

// Check if a MIDI note is a chord tone (root, 3rd, or 5th of the chord)
function isChordToneMidi(midiNote, chordRoot, chordType) {
    const rootMidi = pitchToMidi(chordRoot + '4') % 12;
    const pitchClass = midiNote % 12;
    const interval = (pitchClass - rootMidi + 12) % 12;

    // Determine if chord is minor
    const isMinor = chordType && (
        chordType.toLowerCase().includes('minor') ||
        chordType.toLowerCase().includes('min') ||
        chordType === 'Diminished' ||
        chordType === 'Half-Diminished 7th'
    );

    // Chord tone intervals
    // Root: 0, Minor 3rd: 3, Major 3rd: 4, Perfect 5th: 7, Diminished 5th: 6
    const chordTones = isMinor ? [0, 3, 7] : [0, 4, 7];

    // Also include dim 5th for diminished chords
    if (chordType === 'Diminished' || chordType === 'Half-Diminished 7th') {
        chordTones.push(6);
    }

    return chordTones.includes(interval);
}

// Voice range constraints (MIDI note numbers)
const VOICE_RANGES = {
    treble_high: { min: 60, max: 84 },   // C4-C6 (above melody)
    treble_mid: { min: 48, max: 72 },    // C3-C5 (below melody, typical texture range)
    bass: { min: 28, max: 55 }           // E1-G3
};

// Clamp a MIDI note to stay within a voice range (using octave transposition)
function clampToVoiceRange(midiNote, rangeName = 'treble_mid') {
    const range = VOICE_RANGES[rangeName] || VOICE_RANGES.treble_mid;

    while (midiNote < range.min) midiNote += 12;
    while (midiNote > range.max) midiNote -= 12;

    return midiNote;
}

// Main validation function: validates pitch, snaps to scale, and clamps to range
function validateAndConstrainPitch(pitch, key, style, rangeName = 'treble_mid') {
    // Step 1: Validate against scale (with style-aware chromaticism)
    const scaledPitch = validateNoteForStyle(pitch, key, style);

    // Step 2: Clamp to voice range
    const midiNote = pitchToMidi(scaledPitch);
    const clampedMidi = clampToVoiceRange(midiNote, rangeName);

    // Step 3: Convert back to pitch string with correct spelling
    return midiToPitch(clampedMidi, shouldPreferFlats(key));
}

// ============================================================================
// DIATONIC TRANSPOSITION
// For proper parallel motion (thirds, sixths), we transpose by scale degrees
// rather than semitones to maintain diatonic relationships
// ============================================================================

// Get all scale pitches in order (for diatonic transposition)
function getScalePitches(keyRoot, scaleIntervals) {
    return scaleIntervals.map(interval => (keyRoot + interval) % 12);
}

// Find the scale degree (0-6) of a MIDI note within the scale
// Returns -1 if the note is not in the scale
function getScaleDegree(midiNote, keyRoot, scaleIntervals) {
    const pitchClass = ((midiNote % 12) - keyRoot + 12) % 12;
    const index = scaleIntervals.indexOf(pitchClass);
    return index;
}

// Transpose a pitch by a number of scale degrees (diatonic transposition)
// scaleDegrees: positive = up, negative = down
// Example: in C major, transposeDiatonic("E4", key, -2) = "C4" (down a third)
function transposeDiatonic(pitch, key, scaleDegrees) {
    const midiNote = pitchToMidi(pitch);
    const keyRoot = parseKeyRoot(key);
    const isMinorKey = key.endsWith('m') || key.includes('minor') || key.includes('Minor');
    const scaleIntervals = isMinorKey ? MINOR_SCALE_INTERVALS : MAJOR_SCALE_INTERVALS;

    // Get the scale degree of the input note
    let currentDegree = getScaleDegree(midiNote, keyRoot, scaleIntervals);

    // If note is not in scale, snap to nearest scale tone first
    if (currentDegree === -1) {
        const snappedMidi = nearestScaleTone(midiNote, keyRoot, scaleIntervals);
        currentDegree = getScaleDegree(snappedMidi, keyRoot, scaleIntervals);
    }

    // Calculate the target scale degree (with wrapping)
    const targetDegree = currentDegree + scaleDegrees;

    // Calculate octave adjustment (each 7 degrees = 1 octave)
    const octaveShift = Math.floor(targetDegree / 7);
    const normalizedDegree = ((targetDegree % 7) + 7) % 7; // Ensure positive modulo

    // Get the interval for the target scale degree
    const targetInterval = scaleIntervals[normalizedDegree];

    // Calculate the base octave of the original note
    const baseOctave = Math.floor(midiNote / 12);

    // Calculate the new MIDI note
    const newMidi = (baseOctave + octaveShift) * 12 + keyRoot + targetInterval;

    return midiToPitch(newMidi, shouldPreferFlats(key));
}

// ============================================================================
// PLAYBACK & APPLICATION
// ============================================================================

function playPolyphonyPreview() {
    const compositionState = getCompositionState();
    if (!compositionState) return;

    const progressionData = getProgressionData() || [];
    const chord = progressionData[polyphonyState.selectedChordIndex];
    if (!chord) return;

    const staff = polyphonyState.selectedStaff;

    // Gather current voice 1 notes
    let voice1Notes = [];
    if (staff === 'treble' && compositionState.gatherTrebleNotesForChord) {
        voice1Notes = compositionState.gatherTrebleNotesForChord(polyphonyState.selectedChordIndex);
    } else if (staff === 'bass' && compositionState.gatherBassNotesForChord) {
        voice1Notes = compositionState.gatherBassNotesForChord(polyphonyState.selectedChordIndex);
    }
    voice1Notes = voice1Notes.filter(n => (n.voiceIndex || 0) === 0 && !n.isRest && n.type !== 'rest');

    // Get suggested voice 2 notes
    const voice2Notes = (polyphonyState.generatedSuggestions || []).filter(n => !n.isRest && n.type !== 'rest');

    // Combine all notes and sort by beat
    const allNotes = [...voice1Notes, ...voice2Notes].sort((a, b) => (a.beat || 0) - (b.beat || 0));

    if (allNotes.length === 0) {
        return;
    }

    // Use Tone.js instrument (same approach as playPhrase)
    try {
        const instrument = window.getInstrument && window.getInstrument();
        if (!instrument) {
            console.warn('[Polyphony] Instrument not available');
            return;
        }

        // Ensure Tone.js context is running
        if (window.Tone && window.Tone.context.state !== 'running') {
            window.Tone.start();
        }

        // Get tempo from composition state
        const tempo = compositionState.metadata?.tempo || 120;
        const beatDuration = 60 / tempo; // seconds per beat

        const baseTime = window.Tone?.now?.() || 0;

        // Schedule all notes with their correct beat positions
        allNotes.forEach(note => {
            const pitch = note.pitch || note.pitches?.[0];
            if (!pitch) return;

            const noteBeat = note.beat || 0;
            const startTime = baseTime + noteBeat * beatDuration;
            const durationBeats = getDurationInBeats(note.duration || 'q', note.dotted);
            const noteDuration = durationBeats * beatDuration * 0.9; // 90% for articulation

            try {
                instrument.triggerAttackRelease(pitch, noteDuration, startTime);
            } catch (e) {
                // Ignore individual note errors
            }
        });
    } catch (e) {
        console.warn('[Polyphony] Could not play preview:', e);
    }
}

// Helper to get duration in beats
// Supports both VexFlow format ('h', 'q', 'hd') and Tone.js format ('2n', '4n', '2n.')
function getDurationInBeats(duration, dotted = false) {
    const durationMap = {
        // VexFlow format
        'w': 4, 'h': 2, 'q': 1, '8': 0.5, '16': 0.25, '32': 0.125,
        'hd': 3, 'qd': 1.5, '8d': 0.75, '16d': 0.375,
        // Tone.js format
        '1n': 4, '2n': 2, '4n': 1, '8n': 0.5, '16n': 0.25, '32n': 0.125,
        '1n.': 6, '2n.': 3, '4n.': 1.5, '8n.': 0.75, '16n.': 0.375
    };

    // Check for dotted in string (both formats)
    const hasDotInString = duration?.includes('.') || duration?.endsWith('d');
    if (hasDotInString) {
        return durationMap[duration] || 1;
    }

    // If separate dotted flag is true, multiply base duration by 1.5
    const baseBeats = durationMap[duration] || 1;
    if (dotted) {
        return baseBeats * 1.5;
    }

    return baseBeats;
}

function applyPolyphonySuggestions() {
    const compositionState = getCompositionState();
    if (!compositionState || polyphonyState.generatedSuggestions.length === 0) {
        return;
    }

    // Find the measures that belong to the selected chord
    const chordIndex = polyphonyState.selectedChordIndex;
    const staff = polyphonyState.selectedStaff;

    polyphonyState.generatedSuggestions.forEach((s, i) => {
    });

    // Collect unique measures that will be affected
    const affectedMeasures = new Set();
    polyphonyState.generatedSuggestions.forEach(suggestion => {
        affectedMeasures.add(suggestion.sourceMeasure || 0);
    });

    // Clear existing Voice 2 notes in affected measures before adding new ones
    // This prevents duplicate notes when re-applying texture to the same measure
    affectedMeasures.forEach(measureIndex => {
        compositionState.ensureVoiceExists(measureIndex, staff, 1);
        if (compositionState.clearVoice) {
            compositionState.clearVoice(measureIndex, staff, 1);
        } else {
            // Fallback: manually clear the voice notes
            const measure = compositionState.getMeasure(measureIndex);
            if (measure?.notation?.[staff]?.voices?.[1]) {
                console.log(`[Polyphony] Clearing existing Voice 2 in measure ${measureIndex} (fallback)`);
                measure.notation[staff].voices[1].notes = [];
            }
        }
    });

    // Add each suggestion to voice 2 of the target staff
    polyphonyState.generatedSuggestions.forEach(suggestion => {
        const sourceMeasure = suggestion.sourceMeasure || 0;
        compositionState.ensureVoiceExists(sourceMeasure, staff, 1); // Voice index 1 = Voice 2

        const noteToAdd = {
            type: suggestion.type || 'note',
            pitch: suggestion.pitch,
            pitches: suggestion.pitches,
            duration: suggestion.duration,
            beat: suggestion.beat || 0,
            voiceIndex: 1
        };

        compositionState.addNoteToVoice(sourceMeasure, staff, 1, noteToAdd);
    });


    // Emit event to trigger re-render
    if (compositionState.events) {
        compositionState.events.emit('compositionChanged');
    }

    // Show success toast
    const textureType = TEXTURE_TYPES[Object.keys(TEXTURE_TYPES).find(
        k => TEXTURE_TYPES[k].id === polyphonyState.selectedTextureType
    )];
    const textureName = textureType?.name || 'Texture';
    const noteCount = polyphonyState.generatedSuggestions.length;
    if (window.showToast) {
        window.showToast(`${textureName} applied to Voice 2 (${noteCount} note${noteCount !== 1 ? 's' : ''})`, 'success');
    }

    // Keep modal open so user can continue applying textures to other measures
}
