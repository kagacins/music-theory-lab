/**
 * 3D Chord Explorer Modal
 *
 * Visual exploration interface for ALL possible next chord combinations.
 * Provides:
 * - 3D rectangular prism visualization (Root × Type × Inversion)
 * - Color-coded scoring (Green = strong, Red = weak)
 * - Comprehensive filterable data table
 * - Full scoring transparency (harmonic, voice leading, style, mood)
 * - Playback capabilities for any chord
 */

import { generateComprehensiveRecommendations } from '../features/comprehensiveChordRecommendations.js';
import { CHORD_DEFINITIONS, INVERSION_NAMES, ALL_NOTES } from '../../data/music-data.js';
import { getInvertedChordNotes } from '../utils/noteUtils.js';
import { SUGGESTION_STYLES, SUGGESTION_MOODS } from '../features/unifiedChordSuggestions.js';
import {
    WEIGHT_PRESETS,
    APPROACH_PRESETS,
    GENRE_TEMPLATES,
    getSavedWeights,
    saveWeights,
    resetWeightsToDefault,
    applyPreset,
    normalizeWeights
} from '../config/weightPresets.js';
// Tone.js is loaded via script tag in index.html, available as global 'Tone'

/**
 * Helper: Check if two weight objects are equal (within tolerance)
 */
function weightsMatch(weights1, weights2) {
    const keys = Object.keys(weights1);
    const tolerance = 0.01; // 1% tolerance for floating point comparison

    // Check if all keys exist in both objects
    if (!keys.every(key => key in weights2)) return false;

    // Check if all values match within tolerance
    return keys.every(key => {
        const diff = Math.abs(weights1[key] - weights2[key]);
        return diff < tolerance;
    });
}

/**
 * Find which preset (if any) matches the given weights
 */
function findMatchingPreset(weights) {
    // Check all presets
    for (const [key, preset] of Object.entries(WEIGHT_PRESETS)) {
        if (preset.requiresContext) continue; // Skip context-aware preset
        if (weightsMatch(weights, preset.weights)) {
            return key;
        }
    }
    return null;
}

/**
 * Show the comprehensive chord explorer modal
 * @param {string} currentRoot - Current chord root
 * @param {string} currentChordType - Current chord type
 * @param {number} currentInversion - Current inversion
 * @param {string} key - Musical key
 * @param {string} style - Musical style
 * @param {string} mood - Intended mood
 * @param {Function} onAddChord - Callback to add chord to progression
 * @param {Function} onPlayChord - Callback to preview chord
 * @param {Function} onStopChord - Callback to stop preview
 */
export function showChordExplorerModal(currentRoot, currentChordType, currentInversion, key, style, mood, onAddChord, onPlayChord, onStopChord) {
    // Remove existing explorer if any
    const existing = document.getElementById('chord-explorer-
    if (existing) existing.remove();

    // Track current style and mood (can be changed by user)
    // Read from localStorage if available (to sync with preceding modal), otherwise use passed values
    let currentStyle = localStorage.getItem('chord-suggestion-style') || style;
    let currentMood = localStorage.getItem('chord-suggestion-mood') || mood;
    // Track current inversion (can be changed by user)
    let activeInversion = currentInversion;
    
    // Function to determine tension direction based on mood
    function getTensionDirection(moodValue) {
        if (moodValue === 'bright' || moodValue === 'calm') {
            return 'resolve';
        } else if (moodValue === 'tense' || moodValue === 'energetic') {
            return 'build';
        }
        return 'maintain';
    }

    // Function to generate ALL recommendations
    function generateRecommendations(customWeights = null) {
        const tensionDirection = getTensionDirection(currentMood);
        return generateAllRecommendations(
        currentRoot,
        currentChordType,
            activeInversion, // Use active inversion
            key,
            currentStyle,
            currentMood,
            tensionDirection,
    }

    // Generate initial recommendations
    let allRecommendations = generateRecommendations();

    // Create modal overlay
    const overlay = document.createElement('
    overlay.id = 'chord-explorer-modal';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.75);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100000;
        padding: 20px;
    `;
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    // Create modal content
    const modal = document.createElement('
    modal.style.cssText = `
        background-color: white;
        border-radius: 12px;
        width: 95%;
        max-width: 1400px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        overflow-y: auto;
        overflow-x: hidden;
    `;
    modal.onclick = (e) => e.stopPropagation();

    // Header
    const header = document.createElement('
    header.style.cssText = `
        padding: 20px 24px;
        border-bottom: 2px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
    `;

    const titleSection = document.createElement('
    const title = document.createElement('h2');
    title.textContent = '🔬 Comprehensive Chord Explorer';
    title.style.cssText = 'margin: 0; font-size: 24px; font-weight: 700;';
    const subtitle = document.createElement('
    const chordSymbol = CHORD_DEFINITIONS[currentChordType]?.symbol || '';
    subtitle.id = 'explorer-subtitle';
    subtitle.textContent = `Analyzing ALL possible next chords after ${currentRoot}${chordSymbol} (${INVERSION_NAMES[activeInversion] || activeInversion})`;
    subtitle.style.cssText = 'margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;';
    titleSection.appendChild(title);
    titleSection.appendChild(subtitle);

    const closeBtn = document.createElement('
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
        background: rgba(255, 255, 255, 0.2);
        border: none;
        font-size: 32px;
        color: white;
        cursor: pointer;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    `;
    closeBtn.onmouseenter = () => closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
    closeBtn.onmouseleave = () => closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    closeBtn.onclick = () => overlay.remove();

    header.appendChild(titleSection);
    header.appendChild(closeBtn);

    // Function to show loading splash screen
    function showLoadingSplash() {
        contentArea.innerHTML = '';
        const loadingDiv = document.createElement('
        loadingDiv.style.display = 'flex';
        loadingDiv.style.flexDirection = 'column';
        loadingDiv.style.alignItems = 'center';
        loadingDiv.style.justifyContent = 'center';
        loadingDiv.style.padding = '60px 20px';
        loadingDiv.style.color = '#6b7280';

        const iconContainer = document.createElement('
        iconContainer.style.fontSize = '48px';
        iconContainer.style.marginBottom = '16px';
        iconContainer.innerHTML = '🎵 🎶';
        iconContainer.style.animation = 'pulse 1.5s ease-in-out infinite';

        const loadingText = document.createElement('
        loadingText.textContent = 'Updating Suggestions...';
        loadingText.style.fontSize = '18px';
        loadingText.style.fontWeight = '600';
        loadingText.style.color = '#374151';

        loadingDiv.appendChild(iconContainer);
        loadingDiv.appendChild(loadingText);
        contentArea.appendChild(loadingDiv);

        // Add keyframe animation for pulse
        if (!document.getElementById('pulse-animation-style')) {
            const style = document.createElement('
            style.id = 'pulse-animation-style';
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.1); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Function to update recommendations when style/mood changes
    function updateRecommendations() {
        // Show loading splash immediately
        showLoadingSplash();

        // Use setTimeout to allow UI to update before heavy computation
        setTimeout(() => {
            // Save to localStorage to sync with preceding modal
            localStorage.setItem('chord-suggestion-style', currentStyle);
            localStorage.setItem('chord-suggestion-mood', currentMood);

            // Dispatch custom event to notify suggestion modals of the change
            const event = new CustomEvent('chord-suggestion-preference-changed', {
                detail: {
                    style: currentStyle,
                    mood: currentMood
                }
            });
            document.dispatchEvent(event);

            // Regenerate recommendations
            allRecommendations = generateRecommendations();

            // Re-render current tab
            renderTabContent();
        }, 10);
    }

    // Tab navigation with inline style/mood controls
    const tabNav = document.createElement('
    tabNav.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 24px;
        background-color: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
    `;

    // Tab buttons container
    const tabButtonsContainer = document.createElement('
    tabButtonsContainer.style.cssText = 'display: flex; gap: 8px;';

    const tabs = [
        { id: 'visualization', label: '🎨 3D Visualization', icon: '🎨' },
        { id: 'table', label: '📊 Data Table', icon: '📊' }
    ];

    let activeTab = 'visualization';

    tabs.forEach(tab => {
        const btn = document.createElement('
        btn.textContent = tab.label;
        btn.style.cssText = `
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            background-color: ${tab.id === activeTab ? '#667eea' : 'transparent'};
            color: ${tab.id === activeTab ? 'white' : '#6b7280'};
        `;
        btn.onclick = () => switchTab(tab.id);
        tabButtonsContainer.appendChild(btn);
    });

    // Compact style/mood controls on the right
    const controlsContainer = document.createElement('
    controlsContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    // Style selector (compact)
    const styleLabel = document.createElement('
    styleLabel.textContent = 'Style:';
    styleLabel.style.cssText = 'font-size: 11px; font-weight: 600; color: #6b7280; white-space: nowrap;';
    
    const styleSelect = document.createElement('
    styleSelect.id = 'explorer-style-select';
    styleSelect.style.cssText = 'padding: 4px 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 11px; background-color: white; min-width: 100px;';
    
    SUGGESTION_STYLES.forEach(s => {
        const option = document.createElement('
        option.value = s.id;
        option.textContent = s.label;
        if (s.id === currentStyle) option.selected = true;
        styleSelect.appendChild(option);
    });
    
    styleSelect.addEventListener('change', () => {
        currentStyle = styleSelect.value;
        updateRecommendations();
    });

    // Mood selector (compact)
    const moodLabel = document.createElement('
    moodLabel.textContent = 'Mood:';
    moodLabel.style.cssText = 'font-size: 11px; font-weight: 600; color: #6b7280; white-space: nowrap;';
    
    const moodSelect = document.createElement('
    moodSelect.id = 'explorer-mood-select';
    moodSelect.style.cssText = 'padding: 4px 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 11px; background-color: white; min-width: 100px;';
    
    SUGGESTION_MOODS.forEach(m => {
        const option = document.createElement('
        option.value = m.id;
        option.textContent = m.label;
        if (m.id === currentMood) option.selected = true;
        moodSelect.appendChild(option);
    });
    
    moodSelect.addEventListener('change', () => {
        currentMood = moodSelect.value;
        updateRecommendations();
    });
    
    // Listen for inversion changes from the suggestion modals
    const inversionChangeHandler = (e) => {
        const { inversion } = e.detail;
        if (inversion !== activeInversion && inversion <= maxInversion) {
            activeInversion = inversion;
            // Update button styles
            inversionButtonsContainer.querySelectorAll('button').forEach(btn => {
                const btnInv = parseInt(btn.dataset.inversion);
                btn.style.borderColor = btnInv === inversion ? '#667eea' : '#d1d5db';
                btn.style.backgroundColor = btnInv === inversion ? '#667eea' : 'white';
                btn.style.color = btnInv === inversion ? 'white' : '#374151';
                btn.style.fontWeight = btnInv === inversion ? '600' : '500';
            });
            // Update subtitle
            subtitle.textContent = `Analyzing ALL possible next chords after ${currentRoot}${chordSymbol} (${INVERSION_NAMES[inversion] || inversion})`;
            // Update recommendations
            updateRecommendations();
        }
    };
    document.addEventListener('chord-suggestion-inversion-changed', inversionChangeHandler);
    
    // Clean up event listener when modal is closed
    const originalCloseHandler = closeBtn.onclick;
    closeBtn.onclick = () => {
        document.removeEventListener('chord-suggestion-inversion-changed', inversionChangeHandler);
        if (originalCloseHandler) originalCloseHandler();
    };

    controlsContainer.appendChild(styleLabel);
    controlsContainer.appendChild(styleSelect);
    controlsContainer.appendChild(moodLabel);
    controlsContainer.appendChild(moodSelect);

    tabNav.appendChild(tabButtonsContainer);
    tabNav.appendChild(controlsContainer);

    // Inversion selector row
    const inversionRow = document.createElement('
    inversionRow.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 24px;
        background-color: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
    `;
    
    const inversionLabel = document.createElement('
    inversionLabel.textContent = 'Current Chord Inversion:';
    inversionLabel.style.cssText = 'font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap;';
    inversionRow.appendChild(inversionLabel);
    
    const inversionButtonsContainer = document.createElement('
    inversionButtonsContainer.style.cssText = 'display: flex; gap: 4px; flex-wrap: wrap;';
    
    // Calculate max inversions for this chord type
    const chordDef = CHORD_DEFINITIONS[currentChordType];
    const maxInversion = chordDef ? Math.max(0, chordDef.intervals.length - 1) : 0;
    
    // Create inversion buttons
    for (let inv = 0; inv <= maxInversion; inv++) {
        const invBtn = document.createElement('
        invBtn.textContent = INVERSION_NAMES[inv] || `Inversion ${inv}`;
        invBtn.dataset.inversion = inv;
        invBtn.style.cssText = `
            padding: 6px 12px;
            border: 2px solid ${inv === activeInversion ? '#667eea' : '#d1d5db'};
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
            font-weight: ${inv === activeInversion ? '600' : '500'};
            background-color: ${inv === activeInversion ? '#667eea' : 'white'};
            color: ${inv === activeInversion ? 'white' : '#374151'};
            transition: all 0.2s;
        `;
        let heldNotes = null;
        
        // Helper function to update button highlighting
        const updateButtonHighlighting = () => {
            inversionButtonsContainer.querySelectorAll('button').forEach(btn => {
                const btnInv = parseInt(btn.dataset.inversion);
                btn.style.borderColor = btnInv === inv ? '#667eea' : '#d1d5db';
                btn.style.backgroundColor = btnInv === inv ? '#667eea' : 'white';
                btn.style.color = btnInv === inv ? 'white' : '#374151';
                btn.style.fontWeight = btnInv === inv ? '600' : '500';
            });
        };
        
        // Hold-to-play functionality
        invBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            // Update highlighting immediately when playback starts
            updateButtonHighlighting();
            const res = getInvertedChordNotes(
                currentRoot,
                currentChordType,
                inv,
                key,
                0, // octave shift
                'sharp', // enharmonic preference
                'full' // notation preference
            );
            heldNotes = res.specificNotes || [];
            const instrument = window.getInstrument && window.getInstrument();
            if (instrument && heldNotes.length > 0) {
                const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                const baseTime = Tone.now() + 0.01;
                if (isGuitar) {
                    heldNotes.forEach((n, idx) => instrument.triggerAttack(n, baseTime + idx * 0.0001));
                } else {
                    instrument.triggerAttack(heldNotes, Tone.now());
                }
            }
        });
        
        // Touch events for mobile/tablet
        invBtn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // Update highlighting immediately when playback starts
            updateButtonHighlighting();
            const res = getInvertedChordNotes(
                currentRoot,
                currentChordType,
                inv,
                key,
                0, // octave shift
                'sharp', // enharmonic preference
                'full' // notation preference
            );
            heldNotes = res.specificNotes || [];
            const instrument = window.getInstrument && window.getInstrument();
            if (instrument && heldNotes.length > 0) {
                const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                const baseTime = Tone.now() + 0.01;
                if (isGuitar) {
                    heldNotes.forEach((n, idx) => instrument.triggerAttack(n, baseTime + idx * 0.0001));
                } else {
                    instrument.triggerAttack(heldNotes, Tone.now());
                }
            }
        }, { passive: false });
        
        const stopHeld = (e) => {
            if (e) e.stopPropagation();
            const instrument = window.getInstrument && window.getInstrument();
            if (instrument && heldNotes && heldNotes.length > 0) {
                const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                if (isGuitar) {
                    heldNotes.forEach(n => {
                        try { instrument.triggerRelease(n, Tone.now()); } catch (_) {}
                    });
                } else {
                    instrument.triggerRelease(heldNotes, Tone.now());
                }
                heldNotes = null;
            }
        };
        
        invBtn.addEventListener('mouseup', stopHeld);
        invBtn.addEventListener('touchend', (e) => {
            e.stopPropagation();
            e.preventDefault();
            stopHeld(e);
        }, { passive: false });
        invBtn.addEventListener('touchcancel', (e) => {
            e.stopPropagation();
            e.preventDefault();
            stopHeld(e);
        }, { passive: false });
        invBtn.addEventListener('mouseleave', stopHeld);
        
        invBtn.addEventListener('click', () => {
            activeInversion = inv;
            // Highlighting already updated on mousedown, just update state and re-render
            // Update subtitle
            subtitle.textContent = `Analyzing ALL possible next chords after ${currentRoot}${chordSymbol} (${INVERSION_NAMES[inv] || inv})`;
            // Update recommendations
            updateRecommendations();
            // Dispatch event to sync with suggestion modals
            const event = new CustomEvent('chord-suggestion-inversion-changed', {
                detail: { inversion: inv }
            });
            document.dispatchEvent(event);
        });
        invBtn.addEventListener('mouseenter', () => {
            if (parseInt(invBtn.dataset.inversion) !== activeInversion) {
                invBtn.style.backgroundColor = '#f3f4f6';
            }
        });
        invBtn.addEventListener('mouseleave', (e) => {
            stopHeld(e);
            if (parseInt(invBtn.dataset.inversion) !== activeInversion) {
                invBtn.style.backgroundColor = 'white';
            }
        });
        inversionButtonsContainer.appendChild(invBtn);
    }
    
    inversionRow.appendChild(inversionButtonsContainer);

    // Weight adjustment section (collapsible)
    const weightSection = document.createElement('
    weightSection.style.cssText = `
        background-color: #fefce8;
        border-bottom: 1px solid #e5e7eb;
    `;

    // Current weights (start with saved values)
    let currentWeights = getSavedWeights(false); // Use standard mode weights for now

    // Collapsible header
    const weightHeader = document.createElement('
    weightHeader.style.cssText = `
        padding: 10px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        user-select: none;
        background-color: #fef3c7;
        transition: background-color 0.2s;
    `;

    let isWeightSectionExpanded = false;

    const weightHeaderTitle = document.createElement('
    weightHeaderTitle.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const weightToggleIcon = document.createElement('
    weightToggleIcon.textContent = '▶';
    weightToggleIcon.style.cssText = 'font-size: 10px; color: #78716c; transition: transform 0.2s;';

    const weightTitle = document.createElement('
    weightTitle.textContent = '⚙️ Recommendation Weights';
    weightTitle.style.cssText = 'font-weight: 600; font-size: 13px; color: #78716c;';

    weightHeaderTitle.appendChild(weightToggleIcon);
    weightHeaderTitle.appendChild(weightTitle);

    const weightSubtitle = document.createElement('
    weightSubtitle.textContent = 'Adjust scoring factors';
    weightSubtitle.style.cssText = 'font-size: 11px; color: #a8a29e;';

    weightHeader.appendChild(weightHeaderTitle);
    weightHeader.appendChild(weightSubtitle);

    weightHeader.onmouseenter = () => {
        weightHeader.style.backgroundColor = '#fde68a';
    };
    weightHeader.onmouseleave = () => {
        weightHeader.style.backgroundColor = '#fef3c7';
    };

    // Collapsible content
    const weightContent = document.createElement('
    weightContent.style.cssText = `
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease-in-out;
        padding: 0 24px;
        background-color: #fefce8;
    `;

    // Toggle function
    const toggleWeightSection = () => {
        isWeightSectionExpanded = !isWeightSectionExpanded;
        if (isWeightSectionExpanded) {
            weightToggleIcon.style.transform = 'rotate(90deg)';
            weightContent.style.maxHeight = '400px';
            weightContent.style.paddingTop = '12px';
            weightContent.style.paddingBottom = '12px';
        } else {
            weightToggleIcon.style.transform = 'rotate(0deg)';
            weightContent.style.maxHeight = '0';
            weightContent.style.paddingTop = '0';
            weightContent.style.paddingBottom = '0';
        }
    };

    weightHeader.onclick = toggleWeightSection;

    // Inner content wrapper
    const weightInner = document.createElement('
    weightInner.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

    // Info notice
    const weightNotice = document.createElement('
    weightNotice.style.cssText = `
        background-color: #fffbeb;
        border: 1px solid #fcd34d;
        border-radius: 6px;
        padding: 10px 12px;
        font-size: 11px;
        color: #92400e;
        line-height: 1.5;
    `;
    weightNotice.innerHTML = `
        <strong>💡 Tip:</strong> Weights are automatically normalized to sum to 100%.
        Changes apply to this modal only until you click "Save as Universal".
    `;
    weightInner.appendChild(weightNotice);

    // Preset buttons organized by category
    const presetsContainer = document.createElement('
    presetsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';

    // Store button references for updating active states
    const presetButtons = {};

    // Helper function to update active states
    function updatePresetActiveStates() {
        const activePreset = findMatchingPreset(currentWeights);

        Object.keys(presetButtons).forEach(key => {
            const btn = presetButtons[key];
            const isActive = key === activePreset;

            if (isActive) {
                btn.style.backgroundColor = '#fde68a';
                btn.style.borderColor = '#eab308';
                btn.style.boxShadow = '0 0 0 2px rgba(234, 179, 8, 0.2)';
            } else {
                btn.style.backgroundColor = '#fefce8';
                btn.style.borderColor = '#d4d4d8';
                btn.style.boxShadow = 'none';
            }
        });
    }

    // Helper function to create preset section
    const createPresetSection = (title, presets, description) => {
        const section = document.createElement('
        section.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

        const sectionHeader = document.createElement('
        sectionHeader.style.cssText = 'display: flex; align-items: baseline; gap: 6px;';

        const sectionLabel = document.createElement('
        sectionLabel.textContent = title;
        sectionLabel.style.cssText = 'font-size: 11px; font-weight: 600; color: #78716c;';
        sectionHeader.appendChild(sectionLabel);

        if (description) {
            const sectionDesc = document.createElement('
            sectionDesc.textContent = description;
            sectionDesc.style.cssText = 'font-size: 9px; color: #a8a29e; font-style: italic;';
            sectionHeader.appendChild(sectionDesc);
        }

        section.appendChild(sectionHeader);

        const grid = document.createElement('
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 4px;';

        Object.keys(presets).forEach(key => {
            const preset = presets[key];

            const presetBtn = document.createElement('
            presetBtn.textContent = preset.name;
            presetBtn.title = preset.tooltip;
            presetBtn.style.cssText = `
                padding: 5px 8px;
                background-color: #fefce8;
                border: 1px solid #d4d4d8;
                border-radius: 4px;
                cursor: pointer;
                font-size: 10px;
                font-weight: 600;
                color: #57534e;
                transition: all 0.2s;
                text-align: left;
            `;
            presetBtn.onmouseenter = () => {
                const isActive = findMatchingPreset(currentWeights) === key;
                if (!isActive) {
                    presetBtn.style.backgroundColor = '#fde047';
                    presetBtn.style.borderColor = '#facc15';
                }
            };
            presetBtn.onmouseleave = () => {
                updatePresetActiveStates();
            };
            presetBtn.onclick = () => {
                const weights = applyPreset(key, false);
                if (weights) {
                    currentWeights = weights;
                    updateWeightSliders();
                    updatePresetActiveStates();
                }
            };

            presetButtons[key] = presetBtn;
            grid.appendChild(presetBtn);
        });

        section.appendChild(grid);
        return section;
    };

    // Approaches section
    const approachesSection = createPresetSection(
        '🎯 Approaches',
        APPROACH_PRESETS,
        'What to prioritize'
    );
    presetsContainer.appendChild(approachesSection);

    // Separator
    const separator = document.createElement('
    separator.style.cssText = 'height: 1px; background-color: #e7e5e4; margin: 2px 0;';
    presetsContainer.appendChild(separator);

    // Genre templates section
    const genreSection = createPresetSection(
        '🎸 Genre Templates',
        GENRE_TEMPLATES,
        'Complete genre profiles'
    );
    presetsContainer.appendChild(genreSection);

    weightInner.appendChild(presetsContainer);

    // Set initial active states
    updatePresetActiveStates();

    // Weight sliders
    const slidersContainer = document.createElement('
    slidersContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

    const sliders = {};
    const labels = {
        harmonic: 'Harmonic Function',
        voiceLeading: 'Voice Leading',
        style: 'Style Fit',
        mood: 'Mood Fit'
    };

    const descriptions = {
        harmonic: 'Traditional harmonic progressions (I→IV→V)',
        voiceLeading: 'Smooth note transitions and voice movement',
        style: 'Match selected musical style',
        mood: 'Match desired emotional character'
    };

    function updateWeightSliders() {
        Object.keys(labels).forEach(key => {
            sliders[key].slider.value = Math.round(currentWeights[key] * 100);
            sliders[key].valueLabel.textContent = `${Math.round(currentWeights[key] * 100)}%`;
        });
    }

    function onWeightSliderChange() {
        const newWeights = {};
        Object.keys(labels).forEach(key => {
            newWeights[key] = parseFloat(sliders[key].slider.value) / 100;
        });
        currentWeights = normalizeWeights(newWeights);
        updateWeightSliders();
        updatePresetActiveStates();
    }

    Object.keys(labels).forEach(key => {
        const sliderGroup = document.createElement('
        sliderGroup.style.cssText = 'display: flex; align-items: center; gap: 12px;';

        // Left side: Label and description
        const labelColumn = document.createElement('
        labelColumn.style.cssText = 'flex: 0 0 140px; display: flex; flex-direction: column;';

        const label = document.createElement('
        label.textContent = labels[key];
        label.style.cssText = 'font-size: 11px; font-weight: 600; color: #57534e; margin-bottom: 2px;';

        const desc = document.createElement('
        desc.textContent = descriptions[key];
        desc.style.cssText = 'font-size: 9px; color: #a8a29e; line-height: 1.2;';

        labelColumn.appendChild(label);
        labelColumn.appendChild(desc);

        // Right side: Slider and value
        const sliderColumn = document.createElement('
        sliderColumn.style.cssText = 'flex: 1; display: flex; align-items: center; gap: 8px;';

        const slider = document.createElement('
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.value = Math.round(currentWeights[key] * 100);
        slider.style.cssText = 'flex: 1; cursor: pointer;';
        slider.oninput = onWeightSliderChange;

        const valueLabel = document.createElement('
        valueLabel.textContent = `${Math.round(currentWeights[key] * 100)}%`;
        valueLabel.style.cssText = 'font-size: 11px; font-weight: 600; color: #ca8a04; min-width: 36px; text-align: right;';

        sliderColumn.appendChild(slider);
        sliderColumn.appendChild(valueLabel);

        sliders[key] = { slider, valueLabel };

        sliderGroup.appendChild(labelColumn);
        sliderGroup.appendChild(sliderColumn);
        slidersContainer.appendChild(sliderGroup);
    });

    weightInner.appendChild(slidersContainer);

    // Action buttons
    const buttonRow = document.createElement('
    buttonRow.style.cssText = 'display: flex; gap: 8px; padding-top: 12px; border-top: 1px solid #e7e5e4;';

    const updateBtn = document.createElement('
    updateBtn.textContent = '🔄 Update Now';
    updateBtn.style.cssText = `
        flex: 1;
        padding: 8px 12px;
        background: #eab308;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 600;
        color: white;
        transition: background 0.2s;
    `;
    updateBtn.onmouseenter = () => { updateBtn.style.backgroundColor = '#ca8a04'; };
    updateBtn.onmouseleave = () => { updateBtn.style.backgroundColor = '#eab308'; };
    updateBtn.onclick = () => {
        // Update recommendations with current weights (session only, not saved to universal settings)
        allRecommendations = generateRecommendations(currentWeights);
        renderTabContent();
        // Show feedback
        updateBtn.textContent = '✓ Updated!';
        updateBtn.style.backgroundColor = '#16a34a';
        setTimeout(() => {
            updateBtn.textContent = '🔄 Update Now';
            updateBtn.style.backgroundColor = '#eab308';
        }, 1500);
    };

    const resetBtn = document.createElement('
    resetBtn.textContent = 'Reset';
    resetBtn.style.cssText = `
        padding: 8px 12px;
        background: #e7e5e4;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 600;
        color: #57534e;
        transition: background 0.2s;
    `;
    resetBtn.onmouseenter = () => { resetBtn.style.backgroundColor = '#d6d3d1'; };
    resetBtn.onmouseleave = () => { resetBtn.style.backgroundColor = '#e7e5e4'; };
    resetBtn.onclick = () => {
        currentWeights = resetWeightsToDefault(false);
        updateWeightSliders();
        updatePresetActiveStates();
    };

    const saveUniversalBtn = document.createElement('
    saveUniversalBtn.textContent = '💾 Save as Universal';
    saveUniversalBtn.style.cssText = `
        flex: 1;
        padding: 8px 12px;
        background: #3b82f6;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 600;
        color: white;
        transition: background 0.2s;
    `;
    saveUniversalBtn.onmouseenter = () => { saveUniversalBtn.style.backgroundColor = '#2563eb'; };
    saveUniversalBtn.onmouseleave = () => { saveUniversalBtn.style.backgroundColor = '#3b82f6'; };
    saveUniversalBtn.onclick = () => {
        saveWeights(currentWeights);
        saveUniversalBtn.textContent = '✓ Saved!';
        saveUniversalBtn.style.backgroundColor = '#16a34a';
        setTimeout(() => {
            saveUniversalBtn.textContent = '💾 Save as Universal';
            saveUniversalBtn.style.backgroundColor = '#3b82f6';
        }, 1500);
    };

    buttonRow.appendChild(updateBtn);
    buttonRow.appendChild(resetBtn);
    buttonRow.appendChild(saveUniversalBtn);
    weightInner.appendChild(buttonRow);

    weightContent.appendChild(weightInner);
    weightSection.appendChild(weightHeader);
    weightSection.appendChild(weightContent);

    // Content area
    const contentArea = document.createElement('
    contentArea.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        min-height: 0;
    `;

    // Switch tab function
    function switchTab(tabId) {
        activeTab = tabId;
        // Update button styles
        const buttons = tabNav.querySelectorAll('
        buttons.forEach((btn, idx) => {
            const isActive = tabs[idx].id === tabId;
            btn.style.backgroundColor = isActive ? '#667eea' : 'transparent';
            btn.style.color = isActive ? 'white' : '#6b7280';
        });
        // Render content
        renderTabContent();
    }

    // Render tab content
    function renderTabContent() {
        contentArea.innerHTML = '';
        if (activeTab === 'visualization') {
            renderVisualization(contentArea, allRecommendations);
        } else if (activeTab === 'table') {
            renderDataTable(contentArea, allRecommendations, currentRoot, currentChordType, activeInversion, onAddChord, onPlayChord, onStopChord, currentWeights);
        }
    }

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(inversionRow);
    modal.appendChild(weightSection);
    modal.appendChild(tabNav);
    modal.appendChild(contentArea);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Initial render
    renderTabContent();
}

/**
 * Generate ALL recommendations (not limited to top 10)
 * This directly calls the core recommendation engine without the top-10 limit
 */
function generateAllRecommendations(currentRoot, currentChordType, currentInversion, key, style, mood, tensionDirection, customWeights = null) {
    // Call the comprehensive recommendation engine with limit=0 to get ALL results
    // This returns ALL ~600+ evaluated combinations, not just the top 10
    const recommendations = generateComprehensiveRecommendations(
        currentRoot,
        currentChordType,
        currentInversion,
        key,
        style,
        mood,
        tensionDirection,
        0, // limit=0 means return ALL results
        [], // progressionData
        false, // contextMode
        4, // lookbackDepth

    return recommendations;
}

/**
 * Render 3D visualization tab
 */
function renderVisualization(container, recommendations) {
    const viz = document.createElement('
    viz.style.cssText = 'display: flex; flex-direction: column; gap: 24px;';

    // Info section
    const info = document.createElement('
    info.style.cssText = 'padding: 16px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;';
    info.innerHTML = `
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1e40af;">3D Scoring Matrix</h3>
        <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6;">
            Each block represents a unique (Root, Chord Type, Inversion) combination.
            <strong>Color indicates score</strong>:
            <span style="color: #059669; font-weight: 600;">Dark Green</span> = Excellent (90-100),
            <span style="color: #16a34a; font-weight: 600;">Green</span> = Good (75-89),
            <span style="color: #facc15; font-weight: 600;">Yellow</span> = Fair (50-74),
            <span style="color: #f97316; font-weight: 600;">Orange</span> = Weak (25-49),
            <span style="color: #dc2626; font-weight: 600;">Red</span> = Poor (0-24)
        </p>
    `;
    viz.appendChild(info);

    // Create 3D grid representation
    const grid = create3DGrid(recommendations);
    viz.appendChild(grid);

    container.appendChild(viz);
}

/**
 * Create 3D grid visualization
 */
function create3DGrid(recommendations) {
    const gridContainer = document.createElement('
    gridContainer.style.cssText = `
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 12px;
        max-height: 70vh;
        overflow: auto;
    `;

    // Group by root note
    const byRoot = {};
    recommendations.forEach(rec => {
        if (!byRoot[rec.root]) byRoot[rec.root] = [];
        byRoot[rec.root].push(rec);
    });

    // Create grid for each root
    ALL_NOTES.forEach(root => {
        const recs = byRoot[root] || [];

        // Root label
        const label = document.createElement('
        label.textContent = root;
        label.style.cssText = 'font-weight: 700; font-size: 18px; color: #374151; padding: 12px; text-align: right;';
        gridContainer.appendChild(label);

        // Chord blocks
        const blocks = document.createElement('
        blocks.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px;';

        recs.forEach(rec => {
            const block = document.createElement('
            const color = getScoreColor(rec.score);
            block.style.cssText = `
                width: 32px;
                height: 32px;
                background-color: ${color};
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
            `;
            block.title = `${rec.root} ${rec.type} (${INVERSION_NAMES[rec.inversion] || rec.inversion}) - Score: ${rec.score}`;
            block.onmouseenter = () => {
                block.style.transform = 'scale(1.2)';
                block.style.zIndex = '10';
            };
            block.onmouseleave = () => {
                block.style.transform = 'scale(1)';
                block.style.zIndex = '1';
            };
            blocks.appendChild(block);
        });

        gridContainer.appendChild(blocks);
    });

    return gridContainer;
}

/**
 * Get color based on score
 */
function getScoreColor(score) {
    if (score >= 90) return '#059669'; // Dark green
    if (score >= 75) return '#16a34a'; // Green
    if (score >= 50) return '#facc15'; // Yellow
    if (score >= 25) return '#f97316'; // Orange
    return '#dc2626'; // Red
}

/**
 * Render data table tab with Excel-style filtering
 */
function renderDataTable(container, recommendations, currentRoot, currentChordType, currentInversion, onAddChord, onPlayChord, onStopChord, customWeights = null) {
    // State for active filters
    const activeFilters = {
        root: new Set(),
        type: new Set(),
        inversion: new Set(),
        scoreMin: 0
    };
    
    // State for sorting
    let sortState = {
        column: null,
        direction: 'asc' // 'asc' or 'desc'
    };

    // Table container
    const tableContainer = document.createElement('
    container.appendChild(tableContainer);

    // Function to apply filters and re-render
    function applyFilters() {
        let filtered = recommendations.filter(rec => {
            // Root filter
            if (activeFilters.root.size > 0 && !activeFilters.root.has(rec.root)) {
                return false;
            }
            // Type filter
            if (activeFilters.type.size > 0 && !activeFilters.type.has(rec.type)) {
                return false;
            }
            // Inversion filter
            const invName = INVERSION_NAMES[rec.inversion] || `Inversion ${rec.inversion}`;
            if (activeFilters.inversion.size > 0 && !activeFilters.inversion.has(invName)) {
                return false;
            }
            // Score filter
            if (rec.score < activeFilters.scoreMin) {
                return false;
            }
            return true;
        });

        renderTable(tableContainer, filtered, currentRoot, currentChordType, currentInversion, activeFilters, recommendations, applyFilters, onAddChord, onPlayChord, onStopChord, sortState, (newSortState) => {
            sortState = newSortState;
            applyFilters();
        }, customWeights);
    }

    // Initial render with all data
    applyFilters();
}

/**
 * Create Excel-style filter dropdown for a column
 */
function createColumnFilter(columnName, allValues, activeFilterSet, applyFiltersCallback) {
    const filterBtn = document.createElement('
    filterBtn.innerHTML = activeFilterSet.size > 0 ? '▼ 🔵' : '▼';
    filterBtn.style.cssText = `
        background: none;
        border: none;
        cursor: pointer;
        padding: 2px 4px;
        margin-left: 4px;
        font-size: 10px;
        color: ${activeFilterSet.size > 0 ? '#3b82f6' : '#6b7280'};
    `;
    filterBtn.title = 'Filter';
    
    // Track if this button's menu is open
    let currentMenu = null;

    filterBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();



        // Check if this button's menu is already open - if so, close it
        if (currentMenu && document.body.contains(currentMenu)) {
            currentMenu.remove();
            currentMenu = null;
            return;
        }

        // Remove any existing filter menu
        document.querySelectorAll('.column-filter-menu').forEach(m => m.remove());
        currentMenu = null;

        // Create filter menu
        const menu = document.createElement('
        menu.className = 'column-filter-menu';
        currentMenu = menu; // Track this menu
        menu.style.cssText = `
            position: fixed;
            background: white;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            padding: 8px;
            z-index: 100001;
            min-width: 200px;
            max-height: 300px;
            overflow-y: auto;
        `;

        // Position the menu (use fixed positioning for better behavior in scrollable modal)
        const rect = filterBtn.getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.bottom + 5}px`;



        // Search box for the column
        const searchBox = document.createElement('
        searchBox.type = 'text';
        searchBox.placeholder = `Search ${columnName}...`;
        searchBox.style.cssText = `
            width: 100%;
            padding: 6px 8px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 12px;
            margin-bottom: 8px;
        `;

        // Get unique values
        const uniqueValues = Array.from(new Set(allValues)).sort();

        // Checkbox list container
        const checkboxContainer = document.createElement('
        checkboxContainer.style.cssText = 'max-height: 180px; overflow-y: auto; margin-bottom: 8px;';

        // Select All / Clear All
        const selectAllDiv = document.createElement('
        selectAllDiv.style.cssText = 'padding: 4px; border-bottom: 1px solid #e5e7eb; margin-bottom: 4px;';
        const selectAllLabel = document.createElement('
        selectAllLabel.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; font-weight: 600;';
        const selectAllCheckbox = document.createElement('
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.checked = activeFilterSet.size === 0;
        selectAllCheckbox.onchange = () => {
            const checkboxes = checkboxContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
        };
        selectAllLabel.appendChild(selectAllCheckbox);
        selectAllLabel.appendChild(document.createTextNode('(Select All)'));
        selectAllDiv.appendChild(selectAllLabel);
        checkboxContainer.appendChild(selectAllDiv);

        // Render checkboxes for each unique value
        function renderCheckboxes(valuesToShow) {
            // Clear existing (except select all)
            Array.from(checkboxContainer.children).slice(1).forEach(child => child.remove());

            valuesToShow.forEach(value => {
                const div = document.createElement('
                div.style.cssText = 'padding: 4px;';
                const label = document.createElement('
                label.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px;';
                const checkbox = document.createElement('
                checkbox.type = 'checkbox';
                checkbox.value = value;
                checkbox.checked = activeFilterSet.size === 0 || activeFilterSet.has(value);
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(value));
                div.appendChild(label);
                checkboxContainer.appendChild(div);
            });
        }

        renderCheckboxes(uniqueValues);

        // Search functionality
        searchBox.oninput = () => {
            const search = searchBox.value.toLowerCase();
            const filtered = uniqueValues.filter(v => v.toLowerCase().includes(search));
            renderCheckboxes(filtered);
        };

        // Buttons
        const btnRow = document.createElement('
        btnRow.style.cssText = 'display: flex; gap: 6px; margin-top: 8px;';

        const applyBtn = document.createElement('
        applyBtn.textContent = 'Apply';
        applyBtn.style.cssText = `
            flex: 1;
            padding: 6px 12px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
        `;
        applyBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();


            // Get all checkboxes except the Select All checkbox (which is inside selectAllDiv)
            const allCheckboxDivs = Array.from(checkboxContainer.children).slice(1); // Skip first child (selectAllDiv)
            const checkboxes = allCheckboxDivs.map(div => div.querySelector('input[type="checkbox"]')).filter(cb => cb !== null);



            activeFilterSet.clear();
            let allChecked = true;
            checkboxes.forEach(cb => {

                if (cb.checked) {
                    activeFilterSet.add(cb.value);
                } else {
                    allChecked = false;
                }
            });
            // If all are checked, clear the filter (means "show all")
            if (allChecked) {
                activeFilterSet.clear();
            }

            currentMenu = null;
            menu.remove();
            applyFiltersCallback();
        };

        const clearBtn = document.createElement('
        clearBtn.textContent = 'Clear';
        clearBtn.style.cssText = `
            flex: 1;
            padding: 6px 12px;
            background: #e5e7eb;
            color: #374151;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
        `;
        clearBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            activeFilterSet.clear();
            currentMenu = null;
            menu.remove();
            applyFiltersCallback();
        };

        btnRow.appendChild(applyBtn);
        btnRow.appendChild(clearBtn);

        menu.appendChild(searchBox);
        menu.appendChild(checkboxContainer);
        menu.appendChild(btnRow);

        document.body.appendChild(menu);

        // Close menu when clicking outside
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!menu.contains(e.target) && e.target !== filterBtn) {
                    menu.remove();
                    currentMenu = null;
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 0);
        
        // Also clear currentMenu when menu is removed
        const originalRemove = menu.remove;
        menu.remove = function() {
            currentMenu = null;
            originalRemove.call(this);
        };
    };

    return filterBtn;
}

/**
 * Render the data table with Excel-style column filters and sorting
 */
function renderTable(container, recommendations, currentRoot, currentChordType, currentInversion, activeFilters, allRecommendations, applyFiltersCallback, onAddChord, onPlayChord, onStopChord, sortState, setSortState, customWeights = null) {
    container.innerHTML = '';

    // Info section showing filter status (compact)
    const infoBar = document.createElement('
    infoBar.style.cssText = 'padding: 6px 10px; background: #f0f9ff; border-radius: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;';

    const infoText = document.createElement('
    infoText.style.cssText = 'font-size: 11px; color: #1e40af;';
    infoText.textContent = `Showing ${recommendations.length} of ${allRecommendations.length} chords`;

    const clearAllBtn = document.createElement('
    clearAllBtn.textContent = '🔄 Clear All';
    clearAllBtn.style.cssText = `
        padding: 3px 8px;
        background: #e5e7eb;
        border: 1px solid #d1d5db;
        border-radius: 3px;
        cursor: pointer;
        font-size: 10px;
        font-weight: 600;
        color: #374151;
    `;
    clearAllBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        activeFilters.root.clear();
        activeFilters.type.clear();
        activeFilters.inversion.clear();
        activeFilters.scoreMin = 0;
        applyFiltersCallback();
    };

    infoBar.appendChild(infoText);
    infoBar.appendChild(clearAllBtn);
    container.appendChild(infoBar);

    // Create table
    const table = document.createElement('
    table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 13px;';

    // Prepare data for filters
    const allRoots = allRecommendations.map(r => r.root);
    const allTypes = allRecommendations.map(r => r.type);
    const allInversions = allRecommendations.map(r => INVERSION_NAMES[r.inversion] || `Inversion ${r.inversion}`);

    // Header with filter buttons
    const thead = document.createElement('
    const headerRow = document.createElement('
    headerRow.style.cssText = 'background-color: #f3f4f6; border-bottom: 2px solid #d1d5db;';

    // Check if rhythm awareness is enabled (Phase 5)
    const rhythmAwarenessEnabled = localStorage.getItem('chord-suggestion-rhythm-awareness') !== 'false';

    // Define columns
    const columns = [
        { name: 'Root', align: 'left', hasFilter: true, filterKey: 'root', allValues: allRoots, sortKey: 'root', sortable: true },
        { name: 'Chord Type', align: 'left', hasFilter: true, filterKey: 'type', allValues: allTypes, sortKey: 'type', sortable: true },
        { name: 'Inversion', align: 'left', hasFilter: true, filterKey: 'inversion', allValues: allInversions, sortKey: 'inversion', sortable: true },
        { name: 'Score', align: 'center', hasFilter: false, sortKey: 'score', sortable: true },
        // Duration column (Phase 5) - only show if rhythm awareness is enabled
        ...(rhythmAwarenessEnabled ? [{ name: '⏱ Dur', align: 'center', hasFilter: false, sortKey: 'suggestedDuration', sortable: true }] : []),
        { name: 'Harmonic', align: 'center', hasFilter: false, sortKey: 'functionScore', sortable: true },
        { name: 'Voice Lead', align: 'center', hasFilter: false, sortKey: 'voiceLeadingScore', sortable: true },
        { name: 'Style Fit', align: 'center', hasFilter: false, sortKey: 'styleFit', sortable: true },
        { name: 'Mood Fit', align: 'center', hasFilter: false, sortKey: 'moodFit', sortable: true },
        { name: 'Reason', align: 'left', hasFilter: false, sortable: false },
        { name: 'Actions', align: 'center', hasFilter: false, sortable: false }
    ];

    columns.forEach(col => {
        const th = document.createElement('
        th.style.cssText = `padding: 6px 6px; text-align: ${col.align}; font-weight: 600; position: relative; font-size: 12px;`;
        
        // Make sortable columns clickable
        if (col.sortable) {
            th.style.cursor = 'pointer';
            th.style.userSelect = 'none';
            th.addEventListener('mouseenter', () => {
                th.style.backgroundColor = '#e5e7eb';
            });
            th.addEventListener('mouseleave', () => {
                th.style.backgroundColor = '';
            });
        }

        const headerContent = document.createElement('
        headerContent.style.cssText = 'display: flex; align-items: center; gap: 4px;';

        const text = document.createElement('
        text.textContent = col.name;
        headerContent.appendChild(text);

        // Add sort indicator if this column is sorted
        if (col.sortable && sortState.column === col.sortKey) {
            const sortIndicator = document.createElement('
            sortIndicator.textContent = sortState.direction === 'asc' ? ' ▲' : ' ▼';
            sortIndicator.style.cssText = 'color: #3b82f6; font-size: 10px;';
            headerContent.appendChild(sortIndicator);
        } else if (col.sortable) {
            // Show subtle indicator for sortable columns
            const sortIndicator = document.createElement('
            sortIndicator.textContent = ' ↕';
            sortIndicator.style.cssText = 'color: #9ca3af; font-size: 10px; opacity: 0.5;';
            headerContent.appendChild(sortIndicator);
        }

        if (col.hasFilter) {
            const filterBtn = createColumnFilter(
                col.name,
                col.allValues,
                activeFilters[col.filterKey],
            headerContent.appendChild(filterBtn);
        }

        th.appendChild(headerContent);
        
        // Add click handler for sorting
        if (col.sortable) {
            th.addEventListener('click', (e) => {
                // Don't sort if clicking on filter button or its children
                if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                    return;
                }
                
                if (sortState.column === col.sortKey) {
                    // Toggle direction
                    setSortState({
                        column: col.sortKey,
                        direction: sortState.direction === 'asc' ? 'desc' : 'asc'
                    });
                } else {
                    // New column, default to ascending
                    setSortState({
                        column: col.sortKey,
                        direction: 'asc'
                    });
                }
            });
        }
        
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Sort recommendations if a sort column is specified
    let sortedRecommendations = [...recommendations];
    if (sortState.column) {
        sortedRecommendations.sort((a, b) => {
            let aVal, bVal;
            
            // Get the value to sort by
            switch (sortState.column) {
                case 'root':
                    aVal = a.root;
                    bVal = b.root;
                    break;
                case 'type':
                    aVal = a.type;
                    bVal = b.type;
                    break;
                case 'inversion':
                    aVal = a.inversion;
                    bVal = b.inversion;
                    break;
                case 'score':
                    aVal = a.score || 0;
                    bVal = b.score || 0;
                    break;
                case 'functionScore':
                    aVal = a.functionScore || 0;
                    bVal = b.functionScore || 0;
                    break;
                case 'voiceLeadingScore':
                    aVal = a.voiceLeadingScore || 0;
                    bVal = b.voiceLeadingScore || 0;
                    break;
                case 'styleFit':
                    aVal = a.styleFit || 0;
                    bVal = b.styleFit || 0;
                    break;
                case 'moodFit':
                    aVal = a.moodFit || 0;
                    bVal = b.moodFit || 0;
                    break;
                case 'suggestedDuration':
                    aVal = a.suggestedDuration || 4;
                    bVal = b.suggestedDuration || 4;
                    break;
                default:
                    return 0;
            }
            
            // Compare values
            let comparison = 0;
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                comparison = aVal.localeCompare(bVal);
            } else {
                comparison = aVal - bVal;
            }
            
            // Apply sort direction
            return sortState.direction === 'asc' ? comparison : -comparison;
        });
    }

    // Body
    const tbody = document.createElement('

    // Piano sampler for chord playback (same as used elsewhere on the site)
    let piano = null;
    let currentNotes = null;

    // Helper function to play a chord
    async function playChord(chordType, root, inversion) {
        try {


        // Stop any currently playing notes
            if (piano && currentNotes) {
                piano.releaseAll();
            }

            // Check if Tone is available
            if (typeof Tone === 'undefined') {

                alert('Audio library (Tone.js) is not loaded. Cannot play chord.');
                return;
            }

            // Validate chord type exists in definitions
            if (!CHORD_DEFINITIONS[chordType]) {

                alert(`Cannot play chord: "${chordType}" is not a valid chord type.`);
                return;
            }

            // Initialize piano sampler if needed (same as used elsewhere on the site)
            if (!piano) {
            await Tone.start();
                
                // Create a promise that resolves when the sampler is loaded
                const samplerLoaded = new Promise((resolve, reject) => {
                    piano = new Tone.Sampler({
                        urls: {
                            A0: "A0.mp3",
                            C1: "C1.mp3",
                            "D#1": "Ds1.mp3",
                            "F#1": "Fs1.mp3",
                            A1: "A1.mp3", C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
                            A2: "A2.mp3", C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
                            A3: "A3.mp3", C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
                            A4: "A4.mp3", C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
                            A5: "A5.mp3", C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3",
                            A6: "A6.mp3", C7: "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3",
                            A7: "A7.mp3", C8: "C8.mp3"
                        },
                        release: 1,
                        baseUrl: "https://tonejs.github.io/audio/salamander/",
                        onload: () => {

                            resolve();
                        },
                        onerror: (error) => {

                            reject(error);
                }
            }).toDestination();
                });
                

                // Wait for the sampler's buffers to load
                await samplerLoaded;
            }

            // Get the chord notes (params: root, chordType, inversion, key, octaveShift, enharmonicPreference, notationPreference)
            const notesResult = getInvertedChordNotes(root, chordType, inversion);


            // Extract notes array from the result
            let notesArray;
            if (notesResult && notesResult.specificNotes && Array.isArray(notesResult.specificNotes)) {
                notesArray = notesResult.specificNotes;
            } else if (Array.isArray(notesResult)) {
                notesArray = notesResult;
            } else {

                notesArray = [];
            }



            if (notesArray && notesArray.length > 0) {
                // Ensure the piano sampler is fully loaded before playing
                if (!piano.loaded) {

                    await new Promise((resolve) => {
                        const checkLoaded = setInterval(() => {
                            if (piano.loaded) {
                                clearInterval(checkLoaded);
                                resolve();
                            }
                        }, 100);
                    });
                }

                currentNotes = notesArray;
                piano.triggerAttack(notesArray);

            } else {

                alert(`Cannot generate notes for ${root} ${chordType} (inversion ${inversion}). Check console for details.`);
            }
        } catch (error) {

            // Provide more helpful error message for buffer issues
            if (error.message && error.message.includes('buffer')) {
                alert(`Audio samples are still loading. Please wait a moment and try again.`);
            } else {
                alert(`Error playing chord: ${error.message}`);
            }
        }
    }

    // Helper function to show score breakdown
    function showScoreBreakdown(rec, weights) {
        // Create overlay
        const overlay = document.createElement('
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100001;
        `;
        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.remove();
        };

        // Create modal
        const modal = document.createElement('
        modal.style.cssText = `
            background-color: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        `;
        modal.onclick = (e) => e.stopPropagation();

        // Header
        const header = document.createElement('
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        `;

        const title = document.createElement('h3');
        title.textContent = `Score Breakdown: ${rec.root} ${rec.type}`;
        title.style.cssText = 'margin: 0; font-size: 18px; font-weight: 600; color: #111827;';

        const closeBtn = document.createElement('
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            font-size: 28px;
            color: #6b7280;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            border-radius: 6px;
            transition: background-color 0.2s;
        `;
        closeBtn.onmouseenter = () => { closeBtn.style.backgroundColor = '#f3f4f6'; };
        closeBtn.onmouseleave = () => { closeBtn.style.backgroundColor = 'transparent'; };
        closeBtn.onclick = () => overlay.remove();

        header.appendChild(title);
        header.appendChild(closeBtn);
        modal.appendChild(header);

        // Total score
        const totalScoreDiv = document.createElement('
        totalScoreDiv.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
        `;
        totalScoreDiv.innerHTML = `
            <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">Total Score</div>
            <div style="font-size: 36px; font-weight: 700;">${rec.score}</div>
        `;
        modal.appendChild(totalScoreDiv);

        // Formula explanation
        const formulaDiv = document.createElement('
        formulaDiv.style.cssText = `
            background-color: #f9fafb;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 13px;
            line-height: 1.6;
        `;
        formulaDiv.innerHTML = `
            <div style="font-weight: 600; color: #374151; margin-bottom: 8px;">Calculation Formula:</div>
            <div style="color: #6b7280; font-family: monospace; font-size: 12px;">
                Total = (Harmonic × ${(weights.harmonic * 100).toFixed(0)}%) +
                        (Voice Leading × ${(weights.voiceLeading * 100).toFixed(0)}%) +
                        (Style × ${(weights.style * 100).toFixed(0)}%) +
                        (Mood × ${(weights.mood * 100).toFixed(0)}%)${weights.modalInterchange ? ` +
                        (Modal Interchange × ${(weights.modalInterchange * 100).toFixed(0)}%)` : ''}${weights.context ? ` +
                        (Context × ${(weights.context * 100).toFixed(0)}%)` : ''}
            </div>
        `;
        modal.appendChild(formulaDiv);

        // Component scores
        const components = [
            { label: 'Harmonic Function', score: rec.functionScore || 0, weight: weights.harmonic, color: '#3b82f6', desc: 'How well the chord follows traditional harmonic progressions' },
            { label: 'Voice Leading', score: rec.voiceLeadingScore || 0, weight: weights.voiceLeading, color: '#8b5cf6', desc: 'Smoothness of voice movement between chords' },
            { label: 'Style Fit', score: rec.styleFit || 0, weight: weights.style, color: '#ec4899', desc: 'How well the chord fits the selected musical style' },
            { label: 'Mood Fit', score: rec.moodFit || 0, weight: weights.mood, color: '#f59e0b', desc: 'How well the chord matches the desired mood' }
        ];

        if (rec.modalInterchangeScore !== undefined && weights.modalInterchange) {
            components.push({
                label: 'Modal Interchange',
                score: rec.modalInterchangeScore || 0,
                weight: weights.modalInterchange,
                color: '#10b981',
                desc: rec.borrowedFrom ? `Borrowed from ${rec.borrowedFrom}` : 'Diatonic (not borrowed)'
            });
        }

        if (rec.contextScore !== undefined && weights.context) {
            components.push({
                label: 'Context Awareness',
                score: rec.contextScore || 0,
                weight: weights.context,
                color: '#06b6d4',
                desc: 'Fits progression patterns and cadences'
            });
        }

        const componentsDiv = document.createElement('
        componentsDiv.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

        components.forEach(comp => {
            const contribution = Math.round(comp.score * comp.weight * 100) / 100;

            const row = document.createElement('
            row.style.cssText = `
                background-color: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 12px;
            `;

            row.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-weight: 600; font-size: 14px; color: #374151;">${comp.label}</div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="padding: 2px 8px; background-color: ${comp.color}; color: white; border-radius: 4px; font-size: 12px; font-weight: 600;">${Math.round(comp.score)}</span>
                        <span style="color: #6b7280; font-size: 13px;">× ${(comp.weight * 100).toFixed(0)}%</span>
                        <span style="font-weight: 600; color: #111827; font-size: 14px;">= ${contribution.toFixed(1)}</span>
                    </div>
                </div>
                <div style="font-size: 12px; color: #6b7280; font-style: italic;">${comp.desc}</div>
                <div style="margin-top: 8px; background-color: #f3f4f6; height: 6px; border-radius: 3px; overflow: hidden;">
                    <div style="height: 100%; background-color: ${comp.color}; width: ${comp.score}%; transition: width 0.3s;"></div>
                </div>
            `;

            componentsDiv.appendChild(row);
        });

        modal.appendChild(componentsDiv);

        // Calculation summary
        const total = components.reduce((sum, comp) => sum + (comp.score * comp.weight), 0);
        const summaryDiv = document.createElement('
        summaryDiv.style.cssText = `
            margin-top: 20px;
            padding-top: 16px;
            border-top: 2px solid #e5e7eb;
            font-size: 14px;
        `;
        summaryDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #6b7280;">Weighted Sum:</span>
                <span style="font-weight: 600; color: #111827;">${total.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #6b7280;">Rounded:</span>
                <span style="font-weight: 600; color: #111827;">${Math.round(total)}</span>
            </div>
            ${rec.score !== Math.round(total) ? `
                <div style="display: flex; justify-content: space-between; color: #f59e0b; font-size: 12px; margin-top: 4px;">
                    <span>Note: Score adjusted by penalties/bonuses</span>
                    <span style="font-weight: 600;">${rec.score}</span>
                </div>
            ` : ''}
        `;
        modal.appendChild(summaryDiv);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    // Helper function to stop chord
    function stopChord() {
        try {
            if (piano && currentNotes) {
                piano.triggerRelease(currentNotes);
            currentNotes = null;

            }
        } catch (error) {

        }
    }

    sortedRecommendations.forEach((rec, idx) => {
        const tr = document.createElement('
        tr.style.cssText = `border-bottom: 1px solid #e5e7eb; ${idx % 2 === 0 ? 'background-color: #f9fafb;' : ''}`;

        const invName = INVERSION_NAMES[rec.inversion] || `Inversion ${rec.inversion}`;

        // Create borrowed chord indicator
        const borrowedBadge = rec.borrowedFrom ? `<span style="display: inline-block; margin-left: 6px; padding: 1px 5px; background-color: #8b5cf6; color: white; border-radius: 3px; font-size: 9px; font-weight: 600; vertical-align: middle;" title="Borrowed from ${rec.borrowedFrom}">⭐</span>` : '';

        // Duration cell (Phase 5) - only show if rhythm awareness is enabled
        const durationCell = rhythmAwarenessEnabled
            ? `<td style="padding: 4px 6px; text-align: center; font-size: 11px;"><span style="color: #6366f1; background: #eef2ff; padding: 1px 4px; border-radius: 3px; font-weight: 600;" title="${rec.durationReason || 'Suggested duration'}">${rec.suggestedDuration || 4}b</span></td>`
            : '';

        tr.innerHTML = `
            <td style="padding: 4px 6px; font-weight: 600; font-size: 12px;">${rec.root}</td>
            <td style="padding: 4px 6px; font-size: 12px;">${rec.type}${borrowedBadge}</td>
            <td style="padding: 4px 6px; font-size: 12px;">${invName}</td>
            <td style="padding: 4px 6px; text-align: center;"><span data-action="show-score" data-index="${idx}" class="score-badge" style="padding: 2px 6px; background-color: ${getScoreColor(rec.score)}; color: white; border-radius: 3px; font-weight: 600; font-size: 11px; cursor: pointer; transition: transform 0.1s, box-shadow 0.1s;" title="Click for detailed breakdown">${rec.score}</span></td>
            ${durationCell}
            <td style="padding: 4px 6px; text-align: center; font-size: 12px;">${Math.round(rec.functionScore || 0)}</td>
            <td style="padding: 4px 6px; text-align: center; font-size: 12px;">${Math.round(rec.voiceLeadingScore || 0)}</td>
            <td style="padding: 4px 6px; text-align: center; font-size: 12px;">${Math.round(rec.styleFit || 0)}</td>
            <td style="padding: 4px 6px; text-align: center; font-size: 12px;">${Math.round(rec.moodFit || 0)}</td>
            <td style="padding: 4px 6px; font-size: 11px; color: #6b7280;">${rec.reason}</td>
            <td style="padding: 4px 6px;">
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <div style="display: flex; gap: 2px;">
                        <button data-action="play-current" data-index="${idx}" style="padding: 2px 4px; background: #8b5cf6; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 9px; flex: 1; line-height: 1.2;">▶ Current</button>
                        <button data-action="play-this" data-index="${idx}" style="padding: 2px 4px; background: #3b82f6; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 9px; flex: 1; line-height: 1.2;">▶ This</button>
                    </div>
                    <button data-action="add" data-index="${idx}" style="padding: 2px 4px; background: #10b981; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 9px; font-weight: 600; line-height: 1.2;">➕ Add</button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);

        // Add hover effects to score badge
        const scoreBadge = tr.querySelector('.score-
        if (scoreBadge) {
            scoreBadge.addEventListener('mouseenter', () => {
                scoreBadge.style.transform = 'scale(1.1)';
                scoreBadge.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            });
            scoreBadge.addEventListener('mouseleave', () => {
                scoreBadge.style.transform = 'scale(1)';
                scoreBadge.style.boxShadow = 'none';
            });
        }
    });
    table.appendChild(tbody);

    // Event delegation for clicks (score breakdown, add buttons)
    table.addEventListener('click', async (e) => {
        const target = e.target;

        // Handle score badge clicks
        if (target.dataset && target.dataset.action === 'show-score') {
            const idx = parseInt(target.dataset.index);
            const rec = sortedRecommendations[idx];
            const weights = customWeights || getSavedWeights(false);
            showScoreBreakdown(rec, weights);
            return;
        }

        // Handle button clicks (add chord)
        if (target.tagName === 'BUTTON') {
            const action = target.dataset.action;
            const idx = parseInt(target.dataset.index);
            const rec = sortedRecommendations[idx];

            if (action === 'add') {

                addChordToProgression(rec.root, rec.type, rec.inversion);
                overlay.remove();
            }
        }
    });

    // Event delegation for mousedown (hold-to-play)
    table.addEventListener('mousedown', async (e) => {
        const target = e.target;

        if (target.tagName === 'BUTTON') {
            const action = target.dataset.action;
            const idx = parseInt(target.dataset.index);
            const rec = sortedRecommendations[idx];



            if (action === 'play-current') {

                e.preventDefault();
                e.stopPropagation();
                // Play the current chord
                await playChord(currentChordType, currentRoot, currentInversion);
            } else if (action === 'play-this') {

                e.preventDefault();
                e.stopPropagation();
                // Play the suggested chord (from the recommendation)
                await playChord(rec.type, rec.root, rec.inversion);
            }
        }
    });

    // Event delegation for mouseup (stop playing)
    const stopPlayingHandler = (e) => {
        const target = e.target;

        if (target.tagName === 'BUTTON') {
            const action = target.dataset.action;

            if (action === 'play-current' || action === 'play-this') {

                e.preventDefault();
                e.stopPropagation();
                stopChord();
            }
        }
    };

    table.addEventListener('mouseup', stopPlayingHandler);
    table.addEventListener('mouseleave', stopPlayingHandler);

    // Event delegation for clicks (add button)
    table.onclick = (e) => {
        const target = e.target;

        if (target.tagName === 'BUTTON') {
            const action = target.dataset.action;

            if (action === 'add') {
                e.preventDefault();
                e.stopPropagation();
                const idx = parseInt(target.dataset.index);
                const rec = recommendations[idx];


                if (onAddChord) {
                onAddChord(rec.type, rec.root, rec.inversion);
                } else {

                }
            }
        }
    };

    container.appendChild(table);
}
