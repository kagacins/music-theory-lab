/**
 * Compare Intent for Unified Recommendation Modal
 *
 * Handles comparing the selected chord with alternatives.
 * Shows a grid of alternative chords that could replace the selected chord,
 * with playback, scoring, and "Why This Works" explanations.
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { CHORD_DEFINITIONS } from '../../../../../data/music-data.js';
import { getInvertedChordNotes, spellNoteInKey } from '../../../../utils/noteUtils.js';
import { noteToRomanNumeral } from '../../../../utils/romanNumerals.js';

import { generateComprehensiveRecommendations } from '../../../../features/comprehensiveChordRecommendations.js';

import { getCompositionState } from '../../../../state/compositionState.js';
import {
    getCurrentKey,
    getProgressionData,
    setProgressionData
} from '../../../../state/trainerState.js';
import {
    INTENT_MODES,
    CONTINUE_SUBMODES
} from '../../../../state/sectionIntentState.js';

import { getSavedWeights } from '../../../../config/weightPresets.js';

import { modalState } from '../ModalState.js';
import {
    getScoreColor,
    hexToRgba,
    hideAllScoreTooltips
} from '../MusicUtils.js';
import { updatePersistentProgressionBar } from '../StructureBuilders.js';

// ============================================================================
// COMPARE INTENT RENDERER
// ============================================================================

/**
 * Compare Intent: Compare the selected chord with alternatives
 * Integrates functionality from chordComparisonModal.js
 */
export function renderCompareIntent(container, renderChordTabFn) {
    // Clear container first to prevent duplicate content
    container.innerHTML = '';

    const progressionData = getProgressionData() || [];
    const key = getCurrentKey() || 'C';

    // Need a chord selected to compare
    if (progressionData.length === 0) {
        container.innerHTML = `
            <div class="rm-empty">
                <div class="rm-empty-icon">⚖️</div>
                <h3 class="rm-empty-title">No Chords to Compare</h3>
                <p class="rm-empty-text">Add some chords to your progression first, then select one to compare alternatives.</p>
            </div>
        `;
        return;
    }

    if (modalState.selectedProgressionIndex === -1) {
        container.innerHTML = `
            <div class="rm-empty">
                <div class="rm-empty-icon">⚖️</div>
                <h3 class="rm-empty-title">Select a Chord to Compare</h3>
                <p class="rm-empty-text">Click on a chord in the progression bar above to compare it with alternatives.</p>
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
                <p class="rm-empty-text">You have ${rangeCount} chords selected. Please click on a single chord from the <strong>Progression</strong> bar above to compare it with alternatives.</p>
                <p class="rm-empty-text" style="font-size: 12px; color: #9ca3af; margin-top: 8px;">Tip: Multi-chord selection is useful in the Melody tab for generating phrases over multiple chords.</p>
            </div>
        `;
        return;
    }

    const chordIndex = modalState.selectedProgressionIndex;
    const currentChord = progressionData[chordIndex];
    const prevChord = chordIndex > 0 ? progressionData[chordIndex - 1] : null;
    // FORWARD-LOOKING CONTEXT: Get the next chord if it exists
    const nextChord = chordIndex < progressionData.length - 1 ? progressionData[chordIndex + 1] : null;
    const chordDef = CHORD_DEFINITIONS[currentChord.type];
    const symbol = chordDef?.symbol || '';
    const spelledRoot = spellNoteInKey(currentChord.root, key);
    const currentInversion = currentChord.inversion || 0;

    // Build inversion indicator for current chord (superscript)
    let currentInversionText = '';
    if (currentInversion === 1) currentInversionText = '¹';
    else if (currentInversion === 2) currentInversionText = '²';
    else if (currentInversion === 3) currentInversionText = '³';
    else if (currentInversion > 3) currentInversionText = `⁴`;

    // Build display names for play buttons (includes inversion)
    const currentDisplay = `${spelledRoot}${symbol}${currentInversionText}`;
    const prevDisplay = prevChord ? `${spellNoteInKey(prevChord.root, key)}${CHORD_DEFINITIONS[prevChord.type]?.symbol || ''}` : null;

    // Explanation banner
    const banner = document.createElement('div');
    banner.style.cssText = `
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 16px;
        font-size: 13px;
        color: #1e40af;
    `;
    banner.innerHTML = `
        <strong>Compare alternatives for position #${chordIndex + 1}</strong><br>
        <span style="color: #3b82f6;">These chords would replace <strong>${currentDisplay}</strong> in your progression.</span>
    `;
    container.appendChild(banner);

    // Header showing current chord with play button
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        border: 2px solid #86efac;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
    `;

    const headerLeft = document.createElement('div');
    headerLeft.style.cssText = 'display: flex; align-items: center; gap: 16px;';
    headerLeft.innerHTML = `
        <div style="
            width: 60px;
            height: 60px;
            border-radius: 12px;
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
            font-weight: bold;
        ">${spelledRoot}${symbol}</div>
        <div>
            <div style="font-size: 18px; font-weight: 700; color: #0369a1;">Current: ${spelledRoot} ${currentChord.type}</div>
            <div style="font-size: 13px; color: #0284c7;">Position #${chordIndex + 1} - Your current choice</div>
        </div>
    `;
    header.appendChild(headerLeft);

    // Play current button with explicit label
    const playCurrentBtn = document.createElement('button');
    const playLabel = prevDisplay ? `▶ Hear: ${prevDisplay} → ${currentDisplay}` : `▶ Hear: ${currentDisplay}`;
    playCurrentBtn.innerHTML = playLabel;
    playCurrentBtn.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 16px;
        background: #0ea5e9;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        font-size: 12px;
        white-space: nowrap;
    `;
    playCurrentBtn.addEventListener('click', async () => {
        await playCompareChordSequence(prevChord, currentChord);
    });
    header.appendChild(playCurrentBtn);

    container.appendChild(header);

    // Divider
    const divider = document.createElement('div');
    divider.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-bottom: 16px;';
    divider.innerHTML = `
        <div style="flex: 1; height: 1px; background: #e5e7eb;"></div>
        <span style="color: #6b7280; font-size: 13px; font-weight: 500;">Replace with one of these alternatives</span>
        <div style="flex: 1; height: 1px; background: #e5e7eb;"></div>
    `;
    container.appendChild(divider);

    // Determine tensionDirection based on chord position in progression/section
    let compareTensionDirection = 'maintain';

    const compositionState = getCompositionState();
    const sections = compositionState?.getSections?.() || [];
    let compareTargetSection = null;

    // Find section containing this chord
    for (const section of sections) {
        if (section.chordIndices && section.chordIndices.includes(chordIndex)) {
            compareTargetSection = section;
            break;
        }
    }

    // Determine tension direction based on position
    if (compareTargetSection) {
        const sectionIndices = compareTargetSection.chordIndices;
        const posInSection = sectionIndices.indexOf(chordIndex);
        const sectionLength = sectionIndices.length;
        const isLastInSection = posInSection === sectionLength - 1;
        const isNearEnd = posInSection >= sectionLength - 2;

        if (isLastInSection) {
            const resolvingSections = ['chorus', 'outro', 'intro'];
            compareTensionDirection = resolvingSections.includes(compareTargetSection.type) ? 'resolve' : 'maintain';
        } else if (isNearEnd) {
            compareTensionDirection = 'resolve';
        } else if (posInSection === 0) {
            compareTensionDirection = 'build';
        }
    } else {
        const isLast = chordIndex === progressionData.length - 1;
        const isNearEnd = chordIndex >= progressionData.length - 2;
        if (isLast) {
            compareTensionDirection = 'resolve';
        } else if (isNearEnd) {
            compareTensionDirection = 'resolve';
        } else if (chordIndex === 0) {
            compareTensionDirection = 'build';
        }
    }

    // Build sectionInfo for scoring
    const compareSectionInfo = {
        mode: INTENT_MODES.CONTINUE,
        subMode: compareTensionDirection === 'resolve' ? CONTINUE_SUBMODES.CONCLUDING : CONTINUE_SUBMODES.BUILDING,
        targetSection: compareTargetSection,
        sections: sections,
        currentChordIndex: chordIndex
    };

    const recommendations = generateComprehensiveRecommendations(
        currentChord.root,
        currentChord.type,
        modalState.activeInversion,
        key,
        modalState.style,
        modalState.mood,
        compareTensionDirection,
        10,
        progressionData,
        true,
        modalState.lookbackDepth,
        getSavedWeights(true),
        true,
        compareSectionInfo,
        null,
        null,
        nextChord ? {
            enabled: true,
            nextChord: nextChord,
            weight: 0.15
        } : null
    );

    // Filter to get alternatives (different from current chord)
    const alternatives = recommendations
        .filter(rec => rec.root !== currentChord.root || rec.type !== currentChord.type)
        .slice(0, 6);

    if (alternatives.length === 0) {
        const noAlts = document.createElement('div');
        noAlts.style.cssText = 'text-align: center; padding: 20px; color: #6b7280;';
        noAlts.textContent = 'No significant alternatives found for this position.';
        container.appendChild(noAlts);
        return;
    }

    // Alternatives grid - 3 column layout with compact cards
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;';

    alternatives.forEach((alt) => {
        const altType = alt.type;
        const altChordDef = CHORD_DEFINITIONS[altType];
        const altSymbol = altChordDef?.symbol || '';
        const altSpelled = spellNoteInKey(alt.root, key);
        const altInversion = alt.inversion || 0;

        // Build display with inversion indicator
        let inversionText = '';
        if (altInversion === 1) inversionText = '¹';
        else if (altInversion === 2) inversionText = '²';
        else if (altInversion === 3) inversionText = '³';
        else if (altInversion > 3) inversionText = `<sup>${altInversion}</sup>`;

        const altDisplay = `${altSpelled}${altSymbol}${inversionText}`;
        const score = Math.round(alt.score || alt.totalScore || 70);

        const card = document.createElement('div');
        card.style.cssText = `
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 10px;
            transition: all 0.2s;
        `;
        card.addEventListener('mouseenter', () => {
            card.style.borderColor = '#667eea';
            card.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.15)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.borderColor = '#e5e7eb';
            card.style.boxShadow = 'none';
        });

        const altRoman = noteToRomanNumeral(alt.root, key, altType) || '';
        const inversionLabel = altInversion > 0 ? ` · inv ${altInversion}` : '';
        const altDisplayWithInv = `${altSpelled}${altSymbol}${inversionText}`;
        const altPlayLabel = prevDisplay ? `▶ ${prevDisplay}→${altDisplayWithInv}` : `▶ ${altDisplayWithInv}`;
        const replaceLabel = `${currentDisplay}→${altDisplayWithInv}`;

        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <div style="
                    width: 36px;
                    height: 36px;
                    border-radius: 6px;
                    background: ${hexToRgba(getScoreColor(score), 0.15)};
                    border: 2px solid ${getScoreColor(score)};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: ${getScoreColor(score)};
                    font-weight: bold;
                    font-size: 11px;
                    position: relative;
                ">${altSpelled}${altSymbol}${altInversion > 0 ? `<span style="position: absolute; top: 2px; right: 2px; font-size: 8px; color: #ef4444;">${inversionText}</span>` : ''}</div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; color: #374151; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${altSpelled} ${altType}${inversionLabel}</div>
                    <div style="font-size: 10px; color: #6b7280;">${altRoman} · ${score}%</div>
                </div>
                <button class="compare-why-btn" style="
                    width: 20px;
                    height: 20px;
                    background: #f3f4f6;
                    color: #6b7280;
                    border: 1px solid #d1d5db;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 10px;
                    font-weight: 600;
                    flex-shrink: 0;
                " title="Why this chord works">?</button>
            </div>
            <div style="display: flex; gap: 4px;">
                <button class="compare-play-btn" style="
                    flex: 1;
                    padding: 4px 8px;
                    height: 26px;
                    border: 1px solid #bfdbfe;
                    border-radius: 4px;
                    background: #dbeafe;
                    color: #1d4ed8;
                    cursor: pointer;
                    font-size: 10px;
                    font-weight: 600;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                " title="Play ${prevDisplay ? prevDisplay + ' → ' + altDisplayWithInv : altDisplayWithInv}">${altPlayLabel}</button>
                <button class="compare-apply-btn" style="
                    flex: 1;
                    padding: 4px 8px;
                    height: 26px;
                    border: 1px solid #a5f3fc;
                    border-radius: 4px;
                    background: #cffafe;
                    color: #0e7490;
                    cursor: pointer;
                    font-size: 10px;
                    font-weight: 600;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                " title="Replace ${currentDisplay} with ${altDisplayWithInv}">Replace ${replaceLabel}</button>
            </div>
        `;

        // Why button - opens Why This Works modal
        const whyBtn = card.querySelector('.compare-why-btn');
        whyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hideAllScoreTooltips();
            if (typeof window.showWhyThisWorks === 'function') {
                window.showWhyThisWorks({
                    romanNumeral: altRoman,
                    chord: altSpelled,
                    type: altType,
                    reason: alt.reason || alt.explanation,
                    key: key,
                    root: altSpelled,
                    inversion: alt.inversion || 0,
                    notes: alt.notes,
                    prevChord: currentChord ? noteToRomanNumeral(currentChord.root, key, currentChord.type) : null,
                    prevChordData: currentChord ? {
                        root: spellNoteInKey(currentChord.root, key),
                        type: currentChord.type,
                        inversion: currentChord.inversion || 0,
                        notes: currentChord.notes
                    } : null,
                    nextChord: nextChord ? noteToRomanNumeral(nextChord.root, key, nextChord.type) : null,
                    nextChordData: nextChord ? {
                        root: spellNoteInKey(nextChord.root, key),
                        type: nextChord.type,
                        inversion: nextChord.inversion || 0,
                        notes: nextChord.notes
                    } : null
                });
            }
        });

        // Play button
        const playBtn = card.querySelector('.compare-play-btn');
        playBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await playCompareChordSequence(prevChord, { root: alt.root, type: altType, inversion: alt.inversion || 0 });
        });

        // Apply button
        const applyBtn = card.querySelector('.compare-apply-btn');
        applyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            applyCompareReplacement(chordIndex, currentChord, alt.root, altType, alt.inversion || 0, container, renderChordTabFn);
        });

        grid.appendChild(card);
    });

    container.appendChild(grid);
}

// ============================================================================
// COMPARE UTILITIES
// ============================================================================

/**
 * Apply a chord replacement from Compare intent
 */
export function applyCompareReplacement(chordIndex, currentChord, newRoot, newType, newInversion, container, renderChordTabFn) {
    const progressionData = getProgressionData() || [];
    if (chordIndex < 0 || chordIndex >= progressionData.length) return;

    const key = getCurrentKey() || 'C';
    const newRoman = noteToRomanNumeral(newRoot, key, newType) || newRoot;

    const newChord = {
        ...currentChord,
        root: newRoot,
        type: newType,
        inversion: newInversion,
        roman: newRoman,
        simpleName: `${newRoot}${CHORD_DEFINITIONS[newType]?.symbol || ''}`,
        notes: []
    };

    try {
        const notesResult = getInvertedChordNotes(newRoot, newType, newInversion, key, 0);
        newChord.notes = notesResult?.specificNotes || [];
    } catch (e) {
        console.warn('[Compare] Could not compute notes for new chord');
    }

    if (window.saveStateBeforeChange) {
        window.saveStateBeforeChange();
    }

    const newProgression = [...progressionData];
    newProgression[chordIndex] = newChord;
    setProgressionData(newProgression);

    window.dispatchEvent(new CustomEvent('progressionUpdated'));
    document.dispatchEvent(new CustomEvent('progression-changed', {
        detail: { action: 'replace', index: chordIndex, chord: newChord }
    }));

    if (window.showToast) {
        window.showToast(`Replaced with ${newRoot} ${newType}`, { type: 'success' });
    }

    requestAnimationFrame(() => {
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay();
        }

        updatePersistentProgressionBar();

        modalState.currentRoot = newRoot;
        modalState.currentChordType = newType;
        modalState.activeInversion = newInversion;

        // Re-render compare intent with updated data
        if (renderChordTabFn) {
            renderCompareIntent(container, renderChordTabFn);
        }
    });
}

/**
 * Play a chord sequence for A/B comparison (previous chord -> target chord)
 */
export async function playCompareChordSequence(prevChord, targetChord) {
    try {
        const piano = window.getPiano ? window.getPiano() : (window.getInstrument ? window.getInstrument() : null);
        if (!piano || typeof Tone === 'undefined') {
            console.warn('[Compare] Piano or Tone.js not available');
            return;
        }

        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        const chordDuration = 0.9;
        const now = Tone.now();
        let timeOffset = 0;

        if (prevChord) {
            const prevNotes = getChordNotesForPlayback(prevChord.root, prevChord.type, prevChord.inversion || 0);
            if (prevNotes.length > 0) {
                piano.triggerAttackRelease(prevNotes, chordDuration * 0.9, now + timeOffset);
                timeOffset += chordDuration;
            }
        }

        const targetNotes = getChordNotesForPlayback(targetChord.root, targetChord.type, targetChord.inversion || 0);
        if (targetNotes.length > 0) {
            piano.triggerAttackRelease(targetNotes, chordDuration * 0.9, now + timeOffset);
        }
    } catch (err) {
        console.error('[Compare] Error playing sequence:', err);
    }
}

/**
 * Get chord notes for playback
 */
export function getChordNotesForPlayback(root, type, inversion) {
    try {
        const result = getInvertedChordNotes(root, type, inversion, getCurrentKey() || 'C', 0);
        return result?.specificNotes || [];
    } catch (e) {
        console.warn('[Compare] Could not get notes for', root, type);
        return [];
    }
}
