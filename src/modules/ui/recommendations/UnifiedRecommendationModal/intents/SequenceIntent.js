/**
 * Sequence Intent Module for Unified Recommendation Modal
 *
 * Handles chord sequence generation and display:
 * - Sequence view with length/tension controls
 * - Sequence cards with playback
 * - Expanded alternatives for sequences
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { CHORD_DEFINITIONS, INVERSION_NAMES } from '../../../../../data/music-data.js';
import { spellNoteInKey } from '../../../../utils/noteUtils.js';
import { noteToRomanNumeral } from '../../../../utils/romanNumerals.js';

import {
    generateChordSequences,
    generateSequencesWithRoot,
    describeSequence,
    TENSION_ARC_SHAPES,
    generateTensionArcSequences,
    verifyMelodyCompatibility
} from '../../../../features/chordSequences.js';

import { getCompositionState } from '../../../../state/compositionState.js';
import { getCurrentKey, getProgressionData, getContextAwareMode } from '../../../../state/trainerState.js';
import {
    getSectionIntent,
    INTENT_MODES,
    CONTINUE_SUBMODES,
    getEffectiveSectionContext
} from '../../../../state/sectionIntentState.js';

import { modalState } from '../ModalState.js';
import {
    getScoreColor,
    getScoreQualityLabel,
    getInversionLabel,
    hideAllScoreTooltips,
    showSequenceScoreTooltip,
    hideSequenceScoreTooltip
} from '../MusicUtils.js';
import { setupHoldToPlay, playChordSequence } from '../AudioPlayback.js';
import { showLoadingSplash } from '../UIHelpers.js';

// ============================================================================
// SEQUENCE INTENT RENDERER
// ============================================================================

/**
 * Main entry point for the Sequence Intent
 */
export function renderSequenceIntent(container, addChordToProgressionFn) {
    renderSequencesView(container, addChordToProgressionFn);
}

/**
 * Render the sequences view with controls and sequence cards
 */
function renderSequencesView(container, addChordToProgressionFn) {
    // Clear container first (removes loading indicator and previous content)
    container.innerHTML = '';

    const key = getCurrentKey() || 'C';
    const progressionData = getProgressionData() || [];
    const intent = getSectionIntent();

    // Get effective section context from intent state
    const effectiveContext = getEffectiveSectionContext();

    // Build section info with intentContext for scoring
    const compositionState = getCompositionState();
    const sections = compositionState?.getSections?.() || [];
    const sectionInfo = {
        mode: intent.mode,
        subMode: intent.subMode,
        newSectionType: intent.newSectionType,
        isTransition: intent.mode === INTENT_MODES.NEW_SECTION,
        sections: sections,
        currentChordIndex: modalState.selectedProgressionIndex >= 0
            ? modalState.selectedProgressionIndex
            : (progressionData.length - 1),
        intentContext: effectiveContext
    };

    // Current chord info for display - sync from Progression picker selection if available
    let currentChord;
    if (modalState.selectedProgressionIndex >= 0 && progressionData[modalState.selectedProgressionIndex]) {
        // Use the selected chord from progression picker
        const selectedChord = progressionData[modalState.selectedProgressionIndex];
        currentChord = {
            root: selectedChord.root,
            type: selectedChord.type,
            inversion: selectedChord.inversion || 0
        };
        // Also sync modalState for consistency
        modalState.currentRoot = selectedChord.root;
        modalState.currentChordType = selectedChord.type;
    } else {
        // Fallback to modalState values (for "Add" mode)
        currentChord = {
            root: modalState.currentRoot,
            type: modalState.currentChordType,
            inversion: modalState.activeInversion
        };
    }
    const currentChordDef = CHORD_DEFINITIONS[currentChord.type];
    const currentSymbol = currentChordDef?.symbol || '';
    const currentInvLabel = getInversionLabel(currentChord.inversion);

    // Note: Progression selection uses the Progression picker at the top of the modal

    // Info and sequence length controls row
    const controlsRow = document.createElement('div');
    controlsRow.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        flex-wrap: wrap;
        gap: 8px;
    `;

    // Info text (more compact)
    const info = document.createElement('div');
    info.style.cssText = `
        padding: 6px 10px;
        background: #fef3c7;
        border-radius: 6px;
        color: #92400e;
        font-size: 12px;
    `;
    const spelledCurrentRoot = spellNoteInKey(currentChord.root, key);
    info.innerHTML = `Sequences starting from <strong>${spelledCurrentRoot}${currentSymbol}${currentInvLabel}</strong>`;
    controlsRow.appendChild(info);

    // Sequence length selector
    const lengthControl = document.createElement('div');
    lengthControl.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const lengthLabel = document.createElement('span');
    lengthLabel.textContent = 'Chords:';
    lengthLabel.style.cssText = 'font-size: 12px; color: #6b7280;';
    lengthControl.appendChild(lengthLabel);

    const lengthSelect = document.createElement('select');
    lengthSelect.style.cssText = `
        padding: 4px 8px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 12px;
        background: white;
    `;
    [2, 4, 8].forEach(len => {
        const opt = document.createElement('option');
        opt.value = len;
        opt.textContent = `${len} chords`;
        if (len === modalState.sequenceLength) opt.selected = true;
        lengthSelect.appendChild(opt);
    });
    lengthSelect.addEventListener('change', () => {
        modalState.sequenceLength = parseInt(lengthSelect.value, 10);
        localStorage.setItem('chord-suggestion-sequence-length', lengthSelect.value);
        // Show loading and re-render
        showLoadingSplash(container);
        setTimeout(() => renderSequencesView(container, addChordToProgressionFn), 50);
    });
    lengthControl.appendChild(lengthSelect);
    controlsRow.appendChild(lengthControl);

    container.appendChild(controlsRow);

    // Second row: Tension arc and melody awareness controls
    const advancedControlsRow = document.createElement('div');
    advancedControlsRow.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        flex-wrap: wrap;
        gap: 8px;
        padding: 8px 10px;
        background: #f3f4f6;
        border-radius: 6px;
    `;

    // Tension Arc selector (Enhancement H)
    const tensionArcControl = document.createElement('div');
    tensionArcControl.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const tensionLabel = document.createElement('span');
    tensionLabel.textContent = 'Tension Arc:';
    tensionLabel.style.cssText = 'font-size: 12px; color: #6b7280;';
    tensionArcControl.appendChild(tensionLabel);

    const tensionSelect = document.createElement('select');
    tensionSelect.style.cssText = `
        padding: 4px 8px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 12px;
        background: white;
    `;

    // Tension arc options
    const tensionOptions = [
        { value: 'auto', label: 'Auto (from section)' },
        { value: 'flat', label: 'Flat (steady)' },
        { value: 'ascending', label: 'Ascending (build)' },
        { value: 'descending', label: 'Descending (release)' },
        { value: 'arch', label: 'Arch (build & resolve)' },
        { value: 'wave', label: 'Wave (varied)' },
        { value: 'dramatic', label: 'Dramatic (peaks)' }
    ];

    tensionOptions.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === modalState.tensionArcShape) option.selected = true;
        tensionSelect.appendChild(option);
    });

    tensionSelect.addEventListener('change', () => {
        modalState.tensionArcShape = tensionSelect.value;
        localStorage.setItem('chord-suggestion-tension-arc', tensionSelect.value);
        showLoadingSplash(container);
        setTimeout(() => renderSequencesView(container, addChordToProgressionFn), 50);
    });
    tensionArcControl.appendChild(tensionSelect);
    advancedControlsRow.appendChild(tensionArcControl);

    // Melody Awareness toggle (Enhancement B)
    const melodyAwarenessControl = document.createElement('div');
    melodyAwarenessControl.style.cssText = 'display: flex; align-items: center; gap: 6px;';

    const melodyCheckbox = document.createElement('input');
    melodyCheckbox.type = 'checkbox';
    melodyCheckbox.id = 'melody-awareness-checkbox';
    melodyCheckbox.checked = modalState.melodyAwarenessEnabled;
    melodyCheckbox.style.cssText = 'cursor: pointer;';

    const melodyLabel = document.createElement('label');
    melodyLabel.htmlFor = 'melody-awareness-checkbox';
    melodyLabel.style.cssText = 'font-size: 12px; color: #6b7280; cursor: pointer;';

    // Check if there's melody to be aware of
    const hasMelody = compositionState?.getAllMelodyNotes?.()?.length > 0;
    melodyLabel.textContent = hasMelody ? 'Match Melody' : 'Match Melody (no melody)';
    melodyCheckbox.disabled = !hasMelody;
    if (!hasMelody) {
        melodyLabel.style.color = '#9ca3af';
    }

    melodyCheckbox.addEventListener('change', () => {
        modalState.melodyAwarenessEnabled = melodyCheckbox.checked;
        localStorage.setItem('chord-suggestion-melody-awareness', melodyCheckbox.checked ? 'true' : 'false');
        showLoadingSplash(container);
        setTimeout(() => renderSequencesView(container, addChordToProgressionFn), 50);
    });

    melodyAwarenessControl.appendChild(melodyCheckbox);
    melodyAwarenessControl.appendChild(melodyLabel);
    advancedControlsRow.appendChild(melodyAwarenessControl);

    container.appendChild(advancedControlsRow);

    // Create a container for the sequence cards (will be populated async)
    const sequencesContainer = document.createElement('div');
    sequencesContainer.id = 'sequences-results-container';
    container.appendChild(sequencesContainer);

    // Show loading indicator immediately
    sequencesContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; color: #6b7280;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <span style="font-size: 24px; animation: pulse 1.5s ease-in-out infinite;">🎵</span>
                <span style="font-size: 24px; animation: pulse 1.5s ease-in-out infinite 0.2s;">🎶</span>
                <span style="font-size: 24px; animation: pulse 1.5s ease-in-out infinite 0.4s;">🎵</span>
            </div>
            <div style="font-size: 14px; font-weight: 500;">Loading Recommendations...</div>
            <div style="font-size: 12px; margin-top: 4px;">Please wait</div>
        </div>
        <style>
            @keyframes pulse {
                0%, 100% { opacity: 0.4; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.1); }
            }
        </style>
    `;

    // Generate sequences asynchronously to not block UI
    setTimeout(() => {
        // Determine tension direction from mood AND section intent
        let tensionDirection = 'maintain';
        if (modalState.mood === 'bright' || modalState.mood === 'calm') {
            tensionDirection = 'resolve';
        } else if (modalState.mood === 'tense' || modalState.mood === 'energetic') {
            tensionDirection = 'build';
        }

        // Get section type for context-aware tension direction
        const seqEffectiveContext = getEffectiveSectionContext();
        const seqSectionType = seqEffectiveContext?.currentSectionType || 'custom';

        // Override tension direction based on section intent subMode
        // CRITICAL: Each subMode must produce a DIFFERENT tensionDirection value
        if (intent.mode === INTENT_MODES.CONTINUE) {
            if (intent.subMode === CONTINUE_SUBMODES.FINAL) {
                tensionDirection = 'final'; // Distinct from 'resolve'
            } else if (intent.subMode === CONTINUE_SUBMODES.CONCLUDING) {
                tensionDirection = 'resolve';
            } else if (intent.subMode === CONTINUE_SUBMODES.BUILDING) {
                tensionDirection = 'build';
            }
        }

        // Enhancement B: Build melody options if melody awareness is enabled
        let melodyOptions = null;
        const hasMelodyNotes = compositionState?.getAllMelodyNotes?.()?.length > 0;
        if (modalState.melodyAwarenessEnabled && hasMelodyNotes) {
            const allMelodyNotes = compositionState.getAllMelodyNotes();
            // Calculate the starting measure for the sequence (where the new chords will go)
            const startMeasure = progressionData.length;
            melodyOptions = {
                melodyData: allMelodyNotes,
                startMeasure: startMeasure
            };
        }

        // Enhancement H: Use tension arc sequences if a specific arc is selected
        // Note: currentChord is captured from the outer scope and reflects Progression picker selection
        let sequences;
        if (modalState.tensionArcShape !== 'auto' && TENSION_ARC_SHAPES[modalState.tensionArcShape]) {
            // Generate target tension arc based on selected shape
            const targetArc = TENSION_ARC_SHAPES[modalState.tensionArcShape](modalState.sequenceLength);

            sequences = generateTensionArcSequences(
                currentChord.root,
                currentChord.type,
                currentChord.inversion,
                progressionData,
                key,
                targetArc,
                {
                    style: modalState.style,
                    mood: modalState.mood,
                    topN: 10,
                    sectionInfo: sectionInfo,
                    contextMode: getContextAwareMode(),
                    melodyOptions: melodyOptions,
                    tensionArcShape: modalState.tensionArcShape,
                    tensionDirection: tensionDirection // Pass user's Build/Resolve/Final selection
                }
            );
        } else {
            // Use standard generation (auto mode uses section-suggested arc internally)
            sequences = generateChordSequences(
                currentChord.root,
                currentChord.type,
                currentChord.inversion,
                progressionData,
                key,
                modalState.style,
                modalState.mood,
                tensionDirection,
                modalState.lookbackDepth,
                modalState.sequenceLength,
                10,             // limit - show 10 sequences
                sectionInfo,    // pass section intent for scoring
                getContextAwareMode(),  // pass context mode for weight calculation
                melodyOptions   // Enhancement B: pass melody options
            );
        }

        // Clear loading indicator
        sequencesContainer.innerHTML = '';

        if (!sequences || sequences.length === 0) {
            sequencesContainer.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 24px;">No sequence recommendations available. Try adjusting style or mood.</div>';
            return;
        }

        // Enhancement F: Calculate melody compatibility for each sequence if we have melody
        if (hasMelodyNotes) {
            const allMelodyNotes = compositionState.getAllMelodyNotes();
            const startMeasure = progressionData.length;
            sequences.forEach(seq => {
                const compatibility = verifyMelodyCompatibility(seq.chords, allMelodyNotes, startMeasure, key);
                seq.melodyCompatibility = compatibility;
            });
        }

        // Render sequence cards
        renderSequenceCards(
            sequencesContainer,
            sequences,
            currentChord,
            currentSymbol,
            key,
            progressionData,
            tensionDirection,
            sectionInfo,
            hasMelodyNotes,
            addChordToProgressionFn
        );
    }, 50);
}

/**
 * Render sequence cards into the container
 */
function renderSequenceCards(container, sequences, currentChord, currentSymbol, key, progressionData, tensionDirection, sectionInfo, hasMelody, addChordToProgressionFn) {
    sequences.forEach((seq, idx) => {
        const seqCard = document.createElement('div');
        seqCard.style.cssText = `
            padding: 8px 10px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            margin-bottom: 6px;
        `;

        // Single row: sequence number, chords, and score all together
        const mainRow = document.createElement('div');
        mainRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        `;

        // Sequence number badge
        const titleSpan = document.createElement('span');
        titleSpan.style.cssText = 'font-size: 10px; font-weight: 600; color: #9ca3af; background: #f3f4f6; padding: 2px 5px; border-radius: 3px; flex-shrink: 0;';
        titleSpan.textContent = `${idx + 1}`;
        mainRow.appendChild(titleSpan);

        // Collect all chip elements for highlighting during sequence playback
        const allChips = [];

        // Add current chord at start - compact
        const currentChip = document.createElement('button');
        currentChip.style.cssText = `
            padding: 3px 6px;
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #fcd34d;
            border-radius: 3px;
            font-weight: 600;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.15s;
        `;
        const currentInvLabel = getInversionLabel(currentChord.inversion);
        const spelledCurrRoot = spellNoteInKey(currentChord.root, key);
        currentChip.textContent = `${spelledCurrRoot}${currentSymbol}${currentInvLabel}`;
        currentChip.title = currentChord.inversion ? `Hold to play ${spelledCurrRoot} ${currentChord.type} (${INVERSION_NAMES[currentChord.inversion]} inversion)` : 'Hold to play current chord';
        setupHoldToPlay(currentChip, currentChord);
        mainRow.appendChild(currentChip);
        allChips.push(currentChip);

        // Arrow after current chord
        const firstArrow = document.createElement('span');
        firstArrow.textContent = '→';
        firstArrow.style.cssText = 'color: #d1d5db; font-size: 10px;';
        mainRow.appendChild(firstArrow);

        // Sequence chords - first chord gets special "next chord" highlighting
        const firstChordInSeq = seq.chords[0];
        const firstChordDef = CHORD_DEFINITIONS[firstChordInSeq?.type];
        const firstChordSymbol = firstChordDef?.symbol || '';
        const firstChordSpelled = spellNoteInKey(firstChordInSeq?.root, key);
        const firstChordDisplay = `${firstChordSpelled}${firstChordSymbol}`;

        // Get prev chord for context (the chord before this sequence position)
        const prevChordForSeq = currentChord;

        seq.chords.forEach((chord, chordIdx) => {
            const chordDef = CHORD_DEFINITIONS[chord.type];
            const symbol = chordDef?.symbol || '';
            const isFirstChord = chordIdx === 0;

            // Create a wrapper for the chip + why button
            const chipWrapper = document.createElement('div');
            chipWrapper.style.cssText = 'position: relative; display: inline-block;';

            const chip = document.createElement('button');

            // First chord (the "next" chord) gets a distinct teal/cyan highlight
            chip.style.cssText = isFirstChord ? `
                padding: 3px 6px;
                background: #ccfbf1;
                color: #0f766e;
                border: 1px solid #5eead4;
                border-radius: 3px;
                font-weight: 600;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.15s;
            ` : `
                padding: 3px 6px;
                background: #eef2ff;
                color: #4338ca;
                border: 1px solid #c7d2fe;
                border-radius: 3px;
                font-weight: 500;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.15s;
            `;
            const invLabel = getInversionLabel(chord.inversion);
            const spelledChordRoot = spellNoteInKey(chord.root, key);
            chip.textContent = `${spelledChordRoot}${symbol}${invLabel}`;
            chip.title = chord.inversion ? `Hold to play ${spelledChordRoot} ${chord.type} (${INVERSION_NAMES[chord.inversion]} inversion)` : 'Hold to play chord';
            setupHoldToPlay(chip, chord);

            // Create the "?" button that appears on hover
            const whyBtn = document.createElement('button');
            whyBtn.textContent = '?';
            whyBtn.style.cssText = `
                position: absolute;
                top: -6px;
                right: -6px;
                width: 14px;
                height: 14px;
                background: #6b7280;
                color: white;
                border: 1px solid white;
                border-radius: 50%;
                cursor: pointer;
                font-size: 9px;
                font-weight: 600;
                padding: 0;
                line-height: 12px;
                opacity: 0;
                transition: opacity 0.15s;
                z-index: 10;
            `;
            whyBtn.title = 'Why this chord works';

            // Get context for Why This Works
            const prevChordInSeq = chordIdx === 0 ? prevChordForSeq : seq.chords[chordIdx - 1];
            const nextChordInSeq = chordIdx < seq.chords.length - 1 ? seq.chords[chordIdx + 1] : null;
            const chordRoman = noteToRomanNumeral(chord.root, key, chord.type) || '';

            whyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                // Hide any open score tooltips before opening Why This Works modal
                hideAllScoreTooltips();
                if (typeof window.showWhyThisWorks === 'function') {
                    // IMPORTANT: Include inversion/notes and use spelled roots for enharmonic consistency
                    window.showWhyThisWorks({
                        romanNumeral: chordRoman,
                        chord: spelledChordRoot,
                        type: chord.type,
                        key: key,
                        root: spelledChordRoot,  // Use spelled version for enharmonic consistency
                        inversion: chord.inversion || 0,
                        notes: chord.notes,
                        prevChord: prevChordInSeq ? noteToRomanNumeral(prevChordInSeq.root, key, prevChordInSeq.type) : null,
                        prevChordData: prevChordInSeq ? {
                            root: spellNoteInKey(prevChordInSeq.root, key),
                            type: prevChordInSeq.type,
                            inversion: prevChordInSeq.inversion || 0,
                            notes: prevChordInSeq.notes
                        } : null,
                        nextChord: nextChordInSeq ? noteToRomanNumeral(nextChordInSeq.root, key, nextChordInSeq.type) : null,
                        nextChordData: nextChordInSeq ? {
                            root: spellNoteInKey(nextChordInSeq.root, key),
                            type: nextChordInSeq.type,
                            inversion: nextChordInSeq.inversion || 0,
                            notes: nextChordInSeq.notes
                        } : null
                    });
                }
            });

            // Show/hide why button on wrapper hover
            chipWrapper.addEventListener('mouseenter', () => {
                if (!chip.dataset.playing) chip.style.background = isFirstChord ? '#99f6e4' : '#c7d2fe';
                whyBtn.style.opacity = '1';
            });
            chipWrapper.addEventListener('mouseleave', () => {
                if (!chip.dataset.playing) chip.style.background = isFirstChord ? '#ccfbf1' : '#eef2ff';
                whyBtn.style.opacity = '0';
            });

            chipWrapper.appendChild(chip);
            chipWrapper.appendChild(whyBtn);
            mainRow.appendChild(chipWrapper);
            allChips.push(chip);

            // Arrow between chords (but not after the last one)
            if (chordIdx < seq.chords.length - 1) {
                const arrow = document.createElement('span');
                arrow.textContent = '→';
                arrow.style.cssText = 'color: #d1d5db; font-size: 10px;';
                mainRow.appendChild(arrow);
            }
        });

        // Spacer to push score to the right
        const spacer = document.createElement('div');
        spacer.style.cssText = 'flex: 1; min-width: 8px;';
        mainRow.appendChild(spacer);

        // Melody compatibility indicator (if applicable)
        if (hasMelody && seq.melodyCompatibility) {
            const compat = seq.melodyCompatibility;
            const compatScore = Math.round(compat.score || 0);
            let badgeColor = compatScore >= 80 ? '#10b981' : compatScore >= 60 ? '#f59e0b' : compatScore >= 40 ? '#f97316' : '#ef4444';

            const melodyBadge = document.createElement('span');
            melodyBadge.style.cssText = `
                padding: 2px 5px;
                background: ${badgeColor}20;
                color: ${badgeColor};
                border-radius: 3px;
                font-size: 9px;
                font-weight: 500;
                flex-shrink: 0;
            `;
            melodyBadge.textContent = `🎵${compatScore}%`;
            melodyBadge.title = `Melody compatibility: ${compatScore}%`;
            mainRow.appendChild(melodyBadge);
        }

        // Score badge
        const scoreBadge = document.createElement('span');
        const scoreValue = Math.min(100, Math.round(seq.totalScore || 70));
        const quality = getScoreQualityLabel(scoreValue);
        scoreBadge.className = 'score-badge-interactive';
        scoreBadge.style.cssText = `
            padding: 2px 6px;
            background: ${getScoreColor(scoreValue)};
            color: white;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 600;
            cursor: help;
            flex-shrink: 0;
        `;
        scoreBadge.textContent = `${scoreValue}%`;
        scoreBadge.dataset.score = scoreValue;
        scoreBadge.dataset.quality = quality.label;
        scoreBadge.dataset.type = 'sequence';
        if (seq.breakdown) {
            scoreBadge.dataset.breakdown = JSON.stringify(seq.breakdown);
        }
        scoreBadge.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
            showSequenceScoreTooltip(e, scoreBadge);
        });
        scoreBadge.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
            hideSequenceScoreTooltip();
        });
        mainRow.appendChild(scoreBadge);

        seqCard.appendChild(mainRow);

        // Second row: reason text and action buttons
        const actionsRow = document.createElement('div');
        actionsRow.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 6px;
            flex-wrap: wrap;
        `;

        // Reason text - compact
        const reason = document.createElement('span');
        reason.style.cssText = 'font-size: 10px; color: #9ca3af; flex: 1; min-width: 100px;';
        reason.textContent = seq.reason || describeSequence(seq.chords, key) || 'Smooth harmonic progression';
        actionsRow.appendChild(reason);

        // Play sequence button - with text
        const playBtn = document.createElement('button');
        playBtn.innerHTML = '▶ Play';
        playBtn.title = 'Play sequence';
        playBtn.style.cssText = `
            padding: 4px 10px;
            background: #dbeafe;
            color: #1d4ed8;
            border: 1px solid #bfdbfe;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
        `;
        let stopPlayback = null;
        playBtn.addEventListener('click', () => {
            if (stopPlayback) {
                stopPlayback();
                stopPlayback = null;
                playBtn.innerHTML = '▶ Play';
                playBtn.style.background = '#dbeafe';
                playBtn.style.color = '#1d4ed8';
                playBtn.style.borderColor = '#bfdbfe';
                return;
            }
            const fullSequence = [currentChord, ...seq.chords];
            stopPlayback = playChordSequence(fullSequence, allChips);
            playBtn.innerHTML = '⏹ Stop';
            playBtn.style.background = '#fee2e2';
            playBtn.style.color = '#b91c1c';
            playBtn.style.borderColor = '#fecaca';
            setTimeout(() => {
                stopPlayback = null;
                playBtn.innerHTML = '▶ Play';
                playBtn.style.background = '#dbeafe';
                playBtn.style.color = '#1d4ed8';
                playBtn.style.borderColor = '#bfdbfe';
            }, fullSequence.length * 1300 + 500);
        });
        actionsRow.appendChild(playBtn);

        // Add all button - compact
        const addAllBtn = document.createElement('button');
        addAllBtn.innerHTML = '+Add';
        addAllBtn.title = 'Add all chords to progression';
        addAllBtn.style.cssText = `
            padding: 4px 8px;
            background: #e0e7ff;
            color: #4338ca;
            border: 1px solid #c7d2fe;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
        `;
        addAllBtn.addEventListener('click', () => {
            const totalChords = seq.chords.length;
            seq.chords.forEach((chord, chordIdx) => {
                const isLast = chordIdx === totalChords - 1;
                addChordToProgressionFn(chord, null, {
                    isFirstOfNewSection: chordIdx === 0,
                    skipRender: !isLast
                });
            });
        });
        actionsRow.appendChild(addAllBtn);

        // Expand button - shows more options with the first chord (e.g., "More F7 Options")
        const expandBtn = document.createElement('button');
        expandBtn.innerHTML = `More ${firstChordDisplay}`;
        expandBtn.title = `Show more sequences starting with ${firstChordDisplay}`;
        expandBtn.style.cssText = `
            padding: 4px 10px;
            background: #f0fdfa;
            color: #0f766e;
            border: 1px solid #5eead4;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 500;
            cursor: pointer;
        `;

        // Container for expanded alternatives - indented with teal left border
        const expandedContainer = document.createElement('div');
        expandedContainer.style.cssText = `
            display: none;
            margin-top: 8px;
            margin-left: 12px;
            padding-left: 12px;
            border-left: 3px solid #5eead4;
        `;

        let isExpanded = false;
        expandBtn.addEventListener('click', () => {
            isExpanded = !isExpanded;

            if (isExpanded) {
                expandBtn.innerHTML = `Hide ${firstChordDisplay}`;
                expandBtn.style.background = '#ccfbf1';
                expandBtn.style.color = '#0f766e';
                expandedContainer.style.display = 'block';

                // Generate alternatives if not already generated
                if (!expandedContainer.dataset.loaded) {
                    expandedContainer.innerHTML = '<div style="color: #6b7280; font-size: 11px; padding: 6px;">Loading...</div>';

                    // Get the starting root from this sequence's first chord
                    const startingRoot = seq.chords[0]?.root;

                    // Generate alternatives with the same starting root
                    // Pass the primary sequence to exclude it from alternatives
                    setTimeout(() => {
                        const alternatives = generateSequencesWithRoot(
                            startingRoot,
                            modalState.currentRoot,
                            modalState.currentChordType,
                            modalState.activeInversion,
                            progressionData,
                            key,
                            modalState.style,
                            modalState.mood,
                            tensionDirection,
                            modalState.lookbackDepth,
                            modalState.sequenceLength,
                            5,  // Generate 5 alternatives
                            sectionInfo,
                            getContextAwareMode(),
                            null,  // melodyOptions
                            seq.chords  // excludeSequence - filter out the primary
                        );

                        renderExpandedAlternatives(expandedContainer, alternatives, currentChord, key, sectionInfo, addChordToProgressionFn);
                        expandedContainer.dataset.loaded = 'true';
                    }, 50);
                }
            } else {
                expandBtn.innerHTML = `More ${firstChordDisplay}`;
                expandBtn.style.background = '#f0fdfa';
                expandBtn.style.color = '#0f766e';
                expandedContainer.style.display = 'none';
            }
        });
        actionsRow.appendChild(expandBtn);

        seqCard.appendChild(actionsRow);
        seqCard.appendChild(expandedContainer);
        container.appendChild(seqCard);
    });
}

/**
 * Render expanded alternatives for a sequence
 */
function renderExpandedAlternatives(container, alternatives, currentChord, key, sectionInfo, addChordToProgressionFn) {
    container.innerHTML = '';

    if (!alternatives || alternatives.length === 0) {
        container.innerHTML = '<div style="color: #6b7280; font-size: 13px; padding: 8px;">No additional alternatives found.</div>';
        return;
    }

    const header = document.createElement('div');
    header.style.cssText = 'font-size: 11px; color: #0f766e; margin-bottom: 6px; font-weight: 500;';
    header.textContent = `${alternatives.length} alternative${alternatives.length > 1 ? 's' : ''} starting with same chord:`;
    container.appendChild(header);

    const currentSymbol = CHORD_DEFINITIONS[currentChord.type]?.symbol || '';

    alternatives.forEach((alt, altIdx) => {
        // Single row layout matching primary sequence cards
        const altRow = document.createElement('div');
        altRow.style.cssText = `
            padding: 6px 10px;
            background: #f0fdfa;
            border: 1px solid #99f6e4;
            border-radius: 5px;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        `;

        const altChips = [];

        // Current chord chip (yellow - context) - with hold-to-play
        const currChip = document.createElement('span');
        const currInvLabel = getInversionLabel(currentChord.inversion);
        const spelledCurrRoot = spellNoteInKey(currentChord.root, key);
        currChip.style.cssText = `
            padding: 3px 6px;
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #f59e0b;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
        `;
        currChip.textContent = `${spelledCurrRoot}${currentSymbol}${currInvLabel}`;
        currChip.title = currentChord.inversion ? `Hold to play ${spelledCurrRoot} ${currentChord.type} (${INVERSION_NAMES[currentChord.inversion]} inversion)` : 'Hold to play current chord';
        setupHoldToPlay(currChip, currentChord);
        currChip.addEventListener('mouseenter', () => {
            if (!currChip.dataset.playing) currChip.style.background = '#fde68a';
        });
        currChip.addEventListener('mouseleave', () => {
            if (!currChip.dataset.playing) currChip.style.background = '#fef3c7';
        });
        altRow.appendChild(currChip);
        altChips.push(currChip);

        // Arrow
        const arrow1 = document.createElement('span');
        arrow1.textContent = '→';
        arrow1.style.cssText = 'color: #9ca3af; font-size: 11px;';
        altRow.appendChild(arrow1);

        // Sequence chords - first one gets teal highlight (matches the "next chord" under analysis)
        alt.chords.forEach((chord, chordIdx) => {
            const chordDef = CHORD_DEFINITIONS[chord.type];
            const symbol = chordDef?.symbol || '';
            const invLabel = getInversionLabel(chord.inversion);
            const spelledRoot = spellNoteInKey(chord.root, key);
            const isFirstChord = chordIdx === 0;

            const chip = document.createElement('span');
            // First chord highlighted in teal (same as primary rows)
            chip.style.cssText = isFirstChord ? `
                padding: 3px 6px;
                background: #ccfbf1;
                color: #0f766e;
                border: 1px solid #5eead4;
                border-radius: 3px;
                font-weight: 600;
                font-size: 11px;
                cursor: pointer;
                transition: all 0.15s;
            ` : `
                padding: 3px 6px;
                background: #eef2ff;
                color: #4338ca;
                border: 1px solid #c7d2fe;
                border-radius: 3px;
                font-size: 11px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s ease;
            `;
            chip.textContent = `${spelledRoot}${symbol}${invLabel}`;
            chip.title = chord.inversion ? `Hold to play ${spelledRoot} ${chord.type} (${INVERSION_NAMES[chord.inversion]} inversion)` : 'Hold to play chord';
            setupHoldToPlay(chip, chord);

            // Hover effects
            const hoverBg = isFirstChord ? '#99f6e4' : '#c7d2fe';
            const normalBg = isFirstChord ? '#ccfbf1' : '#eef2ff';
            chip.addEventListener('mouseenter', () => {
                if (!chip.dataset.playing) chip.style.background = hoverBg;
            });
            chip.addEventListener('mouseleave', () => {
                if (!chip.dataset.playing) chip.style.background = normalBg;
            });
            altRow.appendChild(chip);
            altChips.push(chip);

            if (chordIdx < alt.chords.length - 1) {
                const arrow = document.createElement('span');
                arrow.textContent = '→';
                arrow.style.cssText = 'color: #9ca3af; font-size: 11px;';
                altRow.appendChild(arrow);
            }
        });

        // Score badge
        const scoreValue = Math.min(100, Math.round(alt.totalScore || alt.score || 70));
        const scoreBadge = document.createElement('span');
        scoreBadge.style.cssText = `
            padding: 2px 6px;
            background: ${getScoreColor(scoreValue)};
            color: white;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 600;
            margin-left: auto;
            cursor: help;
        `;
        scoreBadge.textContent = `${scoreValue}%`;
        const tooltipText = alt.reason || 'Score based on harmonic analysis';
        scoreBadge.title = `Score: ${scoreValue}%\n${tooltipText}`;
        altRow.appendChild(scoreBadge);

        // Play button - soft blue style matching primary rows
        const playAltBtn = document.createElement('button');
        playAltBtn.innerHTML = '▶ Play';
        playAltBtn.title = 'Play this sequence';
        playAltBtn.style.cssText = `
            padding: 3px 8px;
            background: #dbeafe;
            color: #1d4ed8;
            border: 1px solid #93c5fd;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s;
        `;
        playAltBtn.addEventListener('mouseenter', () => {
            playAltBtn.style.background = '#bfdbfe';
        });
        playAltBtn.addEventListener('mouseleave', () => {
            playAltBtn.style.background = '#dbeafe';
        });
        let stopAltPlayback = null;
        playAltBtn.addEventListener('click', () => {
            if (stopAltPlayback) {
                stopAltPlayback();
                stopAltPlayback = null;
                playAltBtn.innerHTML = '▶ Play';
                return;
            }
            const fullSeq = [currentChord, ...alt.chords];
            stopAltPlayback = playChordSequence(fullSeq, altChips);
            playAltBtn.innerHTML = '⏹ Stop';
            setTimeout(() => {
                stopAltPlayback = null;
                playAltBtn.innerHTML = '▶ Play';
            }, fullSeq.length * 1300 + 500);
        });
        altRow.appendChild(playAltBtn);

        // Add All button - soft indigo style matching primary rows
        const addAltBtn = document.createElement('button');
        addAltBtn.innerHTML = '+ Add';
        addAltBtn.title = 'Add all chords to progression';
        addAltBtn.style.cssText = `
            padding: 3px 8px;
            background: #e0e7ff;
            color: #4338ca;
            border: 1px solid #a5b4fc;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s;
        `;
        addAltBtn.addEventListener('mouseenter', () => {
            addAltBtn.style.background = '#c7d2fe';
        });
        addAltBtn.addEventListener('mouseleave', () => {
            addAltBtn.style.background = '#e0e7ff';
        });
        addAltBtn.addEventListener('click', () => {
            const totalChords = alt.chords.length;
            alt.chords.forEach((chord, chordIdx) => {
                const isLast = chordIdx === totalChords - 1;
                addChordToProgressionFn(chord, null, {
                    isFirstOfNewSection: chordIdx === 0,
                    skipRender: !isLast
                });
            });
        });
        altRow.appendChild(addAltBtn);

        container.appendChild(altRow);
    });
}
