/**
 * Transform Intent for Unified Recommendation Modal
 *
 * Handles applying transformations to the progression with selection awareness.
 * Includes mood changes, extensions, substitutions, borrowed chords, etc.
 * Enhanced with smart harmonic awareness and per-chord customization.
 *
 * NOTE: This is marked as @deprecated - use AlternativesIntent instead.
 * Kept for reference and legacy support.
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { CHORD_DEFINITIONS, ALL_NOTES } from '../../../../../data/music-data.js';
import { getInvertedChordNotes, getChordNotes, getEnharmonicPreferenceForKey } from '../../../../utils/noteUtils.js';

import {
    getCurrentKey,
    getProgressionData,
    setProgressionData
} from '../../../../state/trainerState.js';

import { modalState } from '../ModalState.js';
import { setupHoldToPlay } from '../AudioPlayback.js';
import { updatePersistentProgressionBar } from '../StructureBuilders.js';

// ============================================================================
// TRANSFORM INTENT RENDERER
// ============================================================================

/**
 * Transform Intent: Apply transformations to progression with selection awareness
 * Enhanced with smart harmonic awareness and per-chord customization
 * @deprecated Use renderAlternativesIntent instead
 */
export function renderTransformIntent(container) {
    // Clear container first to prevent duplicate content
    container.innerHTML = '';

    const progressionData = getProgressionData() || [];
    const key = getCurrentKey() || 'C';

    if (progressionData.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #6b7280;">
                <div style="font-size: 48px; margin-bottom: 16px;">🎭</div>
                <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #374151;">No Progression to Transform</h3>
                <p style="margin: 0; font-size: 14px;">Add some chords first, then transform them with these quick presets.</p>
            </div>
        `;
        return;
    }

    // ========== SELECTION AWARENESS ==========
    const hasMultiSelect = modalState.selectedProgressionStart >= 0 &&
        modalState.selectedProgressionEnd >= 0 &&
        modalState.selectedProgressionStart !== modalState.selectedProgressionEnd;

    let selectedIndices = [];
    if (hasMultiSelect) {
        const start = Math.min(modalState.selectedProgressionStart, modalState.selectedProgressionEnd);
        const end = Math.max(modalState.selectedProgressionStart, modalState.selectedProgressionEnd);
        for (let i = start; i <= end; i++) {
            selectedIndices.push(i);
        }
    } else if (modalState.selectedProgressionIndex >= 0) {
        selectedIndices = [modalState.selectedProgressionIndex];
    }

    const hasSelection = selectedIndices.length > 0 && selectedIndices.length < progressionData.length;
    const workingChords = hasSelection
        ? selectedIndices.map(i => ({ ...progressionData[i], originalIndex: i }))
        : progressionData.map((c, i) => ({ ...c, originalIndex: i }));

    // Helper to format chord for display
    const formatChord = (chord) => {
        const def = CHORD_DEFINITIONS[chord.type];
        return `${chord.root}${def?.symbol || ''}`;
    };

    // Helper to format progression for display
    const formatProgression = (prog) => prog.map(formatChord).join(' → ');

    // ========== HARMONIC ANALYSIS HELPERS ==========
    const keyRoot = key.replace('m', '');
    const isMinorKey = key.includes('m');
    const keyIndex = ALL_NOTES.indexOf(keyRoot);

    const getChordDegree = (chordRoot) => {
        const chordIndex = ALL_NOTES.indexOf(chordRoot);
        const interval = (chordIndex - keyIndex + 12) % 12;
        const degreeMap = { 0: 1, 2: 2, 4: 3, 5: 4, 7: 5, 9: 6, 11: 7 };
        return degreeMap[interval] || 0;
    };

    // Calculate borrowed chord roots
    const bVIIRoot = ALL_NOTES[(keyIndex + 10) % 12];
    const bVIRoot = ALL_NOTES[(keyIndex + 8) % 12];
    const bIIIRoot = ALL_NOTES[(keyIndex + 3) % 12];

    // Analyze working chords
    const majorChords = workingChords.filter(c => c.type === 'Major');
    const minorChords = workingChords.filter(c => c.type === 'Minor' || c.type === 'Minor 7th');
    const extendedChords = workingChords.filter(c =>
        c.type.includes('7') || c.type.includes('9') || c.type.includes('11') || c.type.includes('13')
    );
    const simpleChords = workingChords.filter(c =>
        c.type === 'Major' || c.type === 'Minor'
    );

    // ========== HEADER ==========
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom: 16px;';

    if (hasSelection) {
        const selectedNames = selectedIndices.map(i => formatChord(progressionData[i])).join(', ');
        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <h3 style="margin: 0; font-size: 16px; color: #374151;">Transform Selected Chords</h3>
                <span style="
                    background: #eef2ff;
                    color: #4338ca;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                ">${selectedIndices.length} selected</span>
            </div>
            <div style="
                background: linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%);
                padding: 10px 14px;
                border-radius: 8px;
                font-size: 13px;
                color: #92400e;
                border: 1px solid #fcd34d;
                margin-bottom: 8px;
            ">
                <strong>Selected:</strong> ${selectedNames}
                <br><span style="font-size: 11px; color: #a16207;">Transformations will apply only to these chords. Other chords remain unchanged.</span>
            </div>
        `;
    } else {
        header.innerHTML = `
            <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #374151;">Transform Your Progression</h3>
            <div style="
                background: #f9fafb;
                padding: 12px 16px;
                border-radius: 8px;
                font-family: monospace;
                font-size: 14px;
                color: #374151;
                border: 1px solid #e5e7eb;
            ">${formatProgression(progressionData)}</div>
            <p style="font-size: 11px; color: #9ca3af; margin: 6px 0 0 0;">
                💡 Tip: Select specific chords above (shift+click for range) to transform only those chords
            </p>
        `;
    }
    container.appendChild(header);

    // ========== BUILD TRANSFORMATIONS ==========
    const transformations = [];

    // Helper to apply transformation only to selected indices
    const createSelectiveTransform = (transformFn) => {
        return (prog) => {
            if (!hasSelection) {
                return transformFn(prog, prog.map((_, i) => i));
            }
            return prog.map((chord, i) => {
                if (selectedIndices.includes(i)) {
                    const result = transformFn([chord], [0]);
                    return result[0];
                }
                return chord;
            });
        };
    };

    // ========== MOOD TRANSFORMATIONS ==========
    if (majorChords.length > 0) {
        const majorNames = majorChords.slice(0, 3).map(c => c.root).join(', ');
        transformations.push({
            id: 'makeItSad',
            label: 'Make it Sad',
            icon: '😢',
            category: 'mood',
            description: hasSelection
                ? `Change ${majorNames} to minor`
                : `Change major chords to minor for melancholy`,
            insight: `Minor chords add emotional weight and introspection`,
            transform: createSelectiveTransform((prog) => prog.map(chord =>
                chord.type === 'Major' ? { ...chord, type: 'Minor' } : chord
            )),
            affectedIndices: majorChords.map(c => c.originalIndex)
        });
    }

    if (minorChords.length > 0) {
        const minorNames = minorChords.slice(0, 3).map(c => c.root).join(', ');
        transformations.push({
            id: 'brighten',
            label: 'Brighten',
            icon: '☀️',
            category: 'mood',
            description: hasSelection
                ? `Change ${minorNames} to major`
                : `Change minor chords to major for uplift`,
            insight: `Major chords create optimism and resolution`,
            transform: createSelectiveTransform((prog) => prog.map(chord => {
                if (chord.type === 'Minor' || chord.type === 'Minor 7th') {
                    return { ...chord, type: chord.type.replace('Minor', 'Major') };
                }
                return chord;
            })),
            affectedIndices: minorChords.map(c => c.originalIndex)
        });
    }

    // ========== JAZZ COLOR (HARMONICALLY AWARE) ==========
    if (simpleChords.length > 0) {
        const smartJazzTransform = (prog) => {
            return prog.map(chord => {
                if (chord.type !== 'Major' && chord.type !== 'Minor') return chord;

                const degree = getChordDegree(chord.root);

                if (chord.type === 'Major') {
                    if (degree === 5) {
                        return { ...chord, type: 'Dominant 7th' };
                    }
                    return { ...chord, type: 'Major 7th' };
                }
                if (chord.type === 'Minor') {
                    return { ...chord, type: 'Minor 7th' };
                }
                return chord;
            });
        };

        const jazzInsightParts = [];
        simpleChords.slice(0, 4).forEach(c => {
            const degree = getChordDegree(c.root);
            if (c.type === 'Major' && degree === 5) {
                jazzInsightParts.push(`${c.root}→${c.root}7 (dominant pull)`);
            } else if (c.type === 'Major') {
                jazzInsightParts.push(`${c.root}→${c.root}maj7`);
            } else {
                jazzInsightParts.push(`${c.root}m→${c.root}m7`);
            }
        });

        transformations.push({
            id: 'addJazzColor',
            label: 'Add Jazz Color',
            icon: '🎷',
            category: 'extensions',
            description: `Smart 7th extensions respecting harmonic function`,
            insight: jazzInsightParts.join(', ') + (simpleChords.length > 4 ? '...' : ''),
            transform: createSelectiveTransform(smartJazzTransform),
            affectedIndices: simpleChords.map(c => c.originalIndex)
        });
    }

    // Simplify
    if (extendedChords.length > 0) {
        transformations.push({
            id: 'simplify',
            label: 'Simplify',
            icon: '✨',
            category: 'extensions',
            description: `Strip extensions from ${extendedChords.length} chord${extendedChords.length > 1 ? 's' : ''}`,
            insight: `Back to basic triads for a cleaner, more direct sound`,
            transform: createSelectiveTransform((prog) => prog.map(chord => {
                if (chord.type.includes('7') || chord.type.includes('9') || chord.type.includes('11') || chord.type.includes('13')) {
                    if (chord.type.includes('Minor') || chord.type.includes('m')) {
                        return { ...chord, type: 'Minor' };
                    }
                    if (chord.type.includes('Dominant')) {
                        return { ...chord, type: 'Major' };
                    }
                    return { ...chord, type: 'Major' };
                }
                return chord;
            })),
            affectedIndices: extendedChords.map(c => c.originalIndex)
        });
    }

    // ========== SUBSTITUTIONS ==========
    const dominantChords = workingChords.filter(c =>
        c.type === 'Dominant 7th' || (c.type === 'Major' && getChordDegree(c.root) === 5)
    );
    if (dominantChords.length > 0) {
        const tritoneTransform = (prog) => prog.map(chord => {
            const degree = getChordDegree(chord.root);
            if (chord.type === 'Dominant 7th' || (chord.type === 'Major' && degree === 5)) {
                const chordIdx = ALL_NOTES.indexOf(chord.root);
                const tritoneRoot = ALL_NOTES[(chordIdx + 6) % 12];
                return { ...chord, root: tritoneRoot, type: 'Dominant 7th' };
            }
            return chord;
        });

        const exampleChord = dominantChords[0];
        const tritoneRoot = ALL_NOTES[(ALL_NOTES.indexOf(exampleChord.root) + 6) % 12];

        transformations.push({
            id: 'tritoneSub',
            label: 'Tritone Sub',
            icon: '🔄',
            category: 'substitution',
            description: `Replace ${formatChord(exampleChord)} with ${tritoneRoot}7`,
            insight: `Tritone substitution creates chromatic bass movement — classic jazz move`,
            transform: createSelectiveTransform(tritoneTransform),
            affectedIndices: dominantChords.map(c => c.originalIndex)
        });
    }

    // Secondary Dominant / V7 Approach
    if (progressionData.length >= 2) {
        const v7CandidateIndices = [];
        const chordsToCheck = hasSelection ? selectedIndices : progressionData.map((_, i) => i);

        for (const i of chordsToCheck) {
            if (i >= progressionData.length - 1) continue;
            const currentChord = progressionData[i];
            const nextChord = progressionData[i + 1];

            const nextIdx = ALL_NOTES.indexOf(nextChord.root);
            const v7Root = ALL_NOTES[(nextIdx + 7) % 12];

            if (currentChord.root === v7Root && currentChord.type !== 'Dominant 7th') {
                v7CandidateIndices.push(i);
            }
        }

        if (v7CandidateIndices.length > 0) {
            const v7Transform = (prog) => prog.map((chord, i) => {
                if (v7CandidateIndices.includes(i)) {
                    let baseOctave = 4;
                    if (chord.notes && chord.notes.length > 0) {
                        const firstNote = chord.notes[0];
                        const octaveMatch = firstNote.match(/(\d+)$/);
                        if (octaveMatch) {
                            baseOctave = parseInt(octaveMatch[1], 10);
                        }
                    }

                    const enharmonicPref = getEnharmonicPreferenceForKey(key);
                    const { specificNotes } = getChordNotes(chord.root, 'Dominant 7th', key, baseOctave, enharmonicPref);

                    return {
                        ...chord,
                        type: 'Dominant 7th',
                        notes: specificNotes.length > 0 ? specificNotes : chord.notes
                    };
                }
                return chord;
            });

            const exampleIdx = v7CandidateIndices[0];
            const exampleChord = progressionData[exampleIdx];
            const nextChord = progressionData[exampleIdx + 1];

            transformations.push({
                id: 'v7Approaches',
                label: 'Add V7 Approaches',
                icon: '➡️',
                category: 'substitution',
                description: `Upgrade ${formatChord(exampleChord)} → ${exampleChord.root}7 (V7 of ${formatChord(nextChord)})`,
                insight: `Dominant 7ths create strong pull to the next chord — classic voice leading`,
                transform: v7Transform,
                affectedIndices: v7CandidateIndices
            });
        }
    }

    // Relative Major/Minor swap
    if (workingChords.length > 0) {
        const relativeTransform = (prog) => prog.map(chord => {
            const chordIdx = ALL_NOTES.indexOf(chord.root);
            if (chord.type === 'Major') {
                const relMinorRoot = ALL_NOTES[(chordIdx + 9) % 12];
                return { ...chord, root: relMinorRoot, type: 'Minor' };
            }
            if (chord.type === 'Minor') {
                const relMajorRoot = ALL_NOTES[(chordIdx + 3) % 12];
                return { ...chord, root: relMajorRoot, type: 'Major' };
            }
            return chord;
        });

        const exampleChord = workingChords.find(c => c.type === 'Major' || c.type === 'Minor');
        if (exampleChord) {
            const exampleIdx = ALL_NOTES.indexOf(exampleChord.root);
            const relRoot = exampleChord.type === 'Major'
                ? ALL_NOTES[(exampleIdx + 9) % 12]
                : ALL_NOTES[(exampleIdx + 3) % 12];
            const relType = exampleChord.type === 'Major' ? 'm' : '';

            transformations.push({
                id: 'relativeSub',
                label: 'Relative Swap',
                icon: '🔀',
                category: 'substitution',
                description: `Swap major↔minor with relative (${exampleChord.root}→${relRoot}${relType})`,
                insight: `Same notes, different root — subtle but effective color change`,
                transform: createSelectiveTransform(relativeTransform),
                affectedIndices: workingChords.filter(c => c.type === 'Major' || c.type === 'Minor').map(c => c.originalIndex)
            });
        }
    }

    // ========== BORROWED CHORDS ==========
    if (!isMinorKey && progressionData.length >= 2 && !hasSelection) {
        const insertIndex = Math.max(0, progressionData.length - 2);
        const originalChord = progressionData[insertIndex];

        transformations.push({
            id: 'borrowedChords',
            label: 'Borrowed Chord',
            icon: '🎭',
            category: 'substitution',
            description: `Replace ${formatChord(originalChord)} with ${bVIRoot} (from ${key}m)`,
            insight: `The ${bVIRoot} is "borrowed" from parallel minor — unexpected emotional shift`,
            transform: (prog) => prog.map((chord, i) => {
                if (i === insertIndex) {
                    return { ...chord, root: bVIRoot, type: 'Major' };
                }
                return chord;
            }),
            affectedIndices: [insertIndex]
        });
    }

    // ========== SUSPENSIONS ==========
    if (simpleChords.length > 0 && progressionData.length > 1) {
        const lastChord = progressionData[progressionData.length - 1];

        transformations.push({
            id: 'addSuspense',
            label: 'Suspensions',
            icon: '😰',
            category: 'texture',
            description: `Convert to sus4 chords, resolving to ${formatChord(lastChord)}`,
            insight: `Suspensions remove the 3rd, creating tension that wants to resolve`,
            transform: createSelectiveTransform((prog, indices) => prog.map((chord, i) => {
                const isLast = hasSelection ? false : (i === prog.length - 1);
                if (!isLast && (chord.type === 'Major' || chord.type === 'Minor')) {
                    return { ...chord, type: 'Sus4' };
                }
                return chord;
            })),
            affectedIndices: simpleChords.filter(c => c.originalIndex !== progressionData.length - 1).map(c => c.originalIndex)
        });
    }

    // ========== PASSING CHORDS ==========
    if (progressionData.length >= 2 && !hasSelection) {
        const passingOpportunities = [];

        for (let i = 0; i < progressionData.length - 1; i++) {
            const current = progressionData[i];
            const next = progressionData[i + 1];
            const currentIdx = ALL_NOTES.indexOf(current.root);
            const nextIdx = ALL_NOTES.indexOf(next.root);

            if (currentIdx === -1 || nextIdx === -1) continue;

            const interval = (nextIdx - currentIdx + 12) % 12;

            if (interval >= 2 && interval <= 7 && interval !== 5) {
                passingOpportunities.push({
                    afterIndex: i,
                    from: current,
                    to: next,
                    interval
                });
            }
        }

        if (passingOpportunities.length > 0) {
            const snapToQuarter = (val) => Math.max(0.25, Math.round(val * 4) / 4);

            const passingTransform = (prog) => {
                const result = [];
                for (let i = 0; i < prog.length; i++) {
                    result.push({ ...prog[i] });

                    const opp = passingOpportunities.find(o => o.afterIndex === i);
                    if (opp) {
                        const currentIdx = ALL_NOTES.indexOf(prog[i].root);
                        const nextIdx = ALL_NOTES.indexOf(prog[i + 1]?.root);
                        if (currentIdx !== -1 && nextIdx !== -1) {
                            const interval = (nextIdx - currentIdx + 12) % 12;
                            let passingRoot, passingType;

                            if (interval === 2) {
                                passingRoot = ALL_NOTES[(currentIdx + 1) % 12];
                                passingType = 'Diminished';
                            } else if (interval === 3 || interval === 4) {
                                passingRoot = ALL_NOTES[(nextIdx + 7) % 12];
                                passingType = 'Dominant 7th';
                            } else if (interval === 6) {
                                passingRoot = ALL_NOTES[(nextIdx + 1) % 12];
                                passingType = 'Diminished';
                            } else if (interval === 7) {
                                passingRoot = ALL_NOTES[(nextIdx + 10) % 12];
                                passingType = 'Dominant 7th';
                            } else {
                                passingRoot = ALL_NOTES[(nextIdx + 11) % 12];
                                passingType = 'Diminished';
                            }

                            const originalBeats = prog[i].beats || 4;
                            let passingBeats, shortenedOriginalBeats;

                            if (originalBeats >= 2) {
                                passingBeats = 1;
                                shortenedOriginalBeats = snapToQuarter(originalBeats - 1);
                            } else if (originalBeats >= 1) {
                                passingBeats = 0.5;
                                shortenedOriginalBeats = snapToQuarter(originalBeats - 0.5);
                            } else {
                                passingBeats = snapToQuarter(originalBeats / 2);
                                shortenedOriginalBeats = snapToQuarter(originalBeats / 2);
                            }

                            result.push({
                                root: passingRoot,
                                type: passingType,
                                beats: passingBeats
                            });
                            result[result.length - 2] = {
                                ...result[result.length - 2],
                                beats: shortenedOriginalBeats
                            };
                        }
                    }
                }
                return result;
            };

            const exampleOpp = passingOpportunities[0];
            const exampleToIdx = ALL_NOTES.indexOf(exampleOpp.to.root);
            let examplePassing;
            if (exampleOpp.interval === 3 || exampleOpp.interval === 4) {
                examplePassing = ALL_NOTES[(exampleToIdx + 7) % 12] + '7';
            } else {
                examplePassing = ALL_NOTES[(exampleToIdx + 11) % 12] + 'dim';
            }

            transformations.push({
                id: 'passingChords',
                label: 'Add Passing Chords',
                icon: '🌉',
                category: 'substitution',
                description: `Smooth ${passingOpportunities.length} transition${passingOpportunities.length > 1 ? 's' : ''} with passing chords`,
                insight: `${formatChord(exampleOpp.from)} → ${examplePassing} → ${formatChord(exampleOpp.to)} creates smoother voice leading`,
                transform: passingTransform,
                affectedIndices: passingOpportunities.map(o => o.afterIndex)
            });
        }
    }

    // ========== DRAMA / CADENCE ==========
    if (progressionData.length >= 2 && !hasSelection) {
        const lastChord = progressionData[progressionData.length - 1];
        const lastChordIndex = ALL_NOTES.indexOf(lastChord.root);
        const dominantRoot = ALL_NOTES[(lastChordIndex + 7) % 12];
        const iiRoot = ALL_NOTES[(lastChordIndex + 2) % 12];

        const snapToQuarterCadence = (val) => Math.max(0.25, Math.round(val * 4) / 4);

        transformations.push({
            id: 'moreDramatic',
            label: 'ii-V-I Cadence',
            icon: '🎬',
            category: 'cadence',
            description: `Build ${iiRoot}m7 → ${dominantRoot}7 → ${lastChord.root} cadence`,
            insight: `The ii-V-I is the strongest cadence in jazz and pop — creates powerful resolution`,
            transform: (prog) => {
                const last = prog[prog.length - 1];
                const lastIdx = ALL_NOTES.indexOf(last.root);
                const domRoot = ALL_NOTES[(lastIdx + 7) % 12];
                const iiRt = ALL_NOTES[(lastIdx + 2) % 12];

                if (prog.length === 2) {
                    const totalBeats = (prog[0].beats || 4) + (prog[1].beats || 4);
                    const iiBeats = snapToQuarterCadence(totalBeats / 4);
                    const vBeats = snapToQuarterCadence(totalBeats / 4);
                    const iBeats = snapToQuarterCadence(totalBeats / 2);

                    return [
                        { ...prog[0], root: iiRt, type: 'Minor 7th', beats: iiBeats },
                        { ...prog[0], root: domRoot, type: 'Dominant 7th', beats: vBeats },
                        { ...last, beats: iBeats }
                    ];
                } else {
                    const result = [...prog];
                    const secondToLast = prog[prog.length - 2];
                    const secondToLastBeats = secondToLast.beats || 4;

                    const iiBeats = snapToQuarterCadence(secondToLastBeats / 2);
                    const vBeats = snapToQuarterCadence(secondToLastBeats / 2);

                    result[prog.length - 2] = { ...secondToLast, root: iiRt, type: 'Minor 7th', beats: iiBeats };
                    result.splice(prog.length - 1, 0, { ...last, root: domRoot, type: 'Dominant 7th', beats: vBeats });
                    return result;
                }
            },
            affectedIndices: [progressionData.length - 2, progressionData.length - 1]
        });
    }

    // ========== TEXTURE ==========
    transformations.push({
        id: 'powerChords',
        label: 'Power Chords',
        icon: '🎸',
        category: 'texture',
        description: hasSelection
            ? `Convert ${selectedIndices.length} chord${selectedIndices.length > 1 ? 's' : ''} to power chords`
            : `Convert all chords to power chords`,
        insight: `Root + 5th only — removes major/minor color for raw rock energy`,
        transform: createSelectiveTransform((prog) => prog.map(chord => ({ ...chord, type: 'Power Chord' }))),
        affectedIndices: workingChords.map(c => c.originalIndex)
    });

    // ========== RENDER TRANSFORMATIONS ==========
    if (transformations.length === 0) {
        container.innerHTML += `
            <div style="text-align: center; padding: 40px 20px; color: #6b7280;">
                <div style="font-size: 32px; margin-bottom: 12px;">🤔</div>
                <p style="margin: 0; font-size: 14px;">No transformations available for this selection.</p>
            </div>
        `;
        return;
    }

    // Group transformations by category
    const categories = {
        mood: { label: 'Mood', icon: '🎭' },
        extensions: { label: 'Extensions', icon: '🎹' },
        substitution: { label: 'Substitutions', icon: '🔄' },
        texture: { label: 'Texture', icon: '🎸' },
        cadence: { label: 'Cadences', icon: '🎬' }
    };

    const groupedTransforms = {};
    transformations.forEach(tf => {
        const cat = tf.category || 'other';
        if (!groupedTransforms[cat]) groupedTransforms[cat] = [];
        groupedTransforms[cat].push(tf);
    });

    // Render each category
    Object.entries(groupedTransforms).forEach(([catKey, transforms]) => {
        const catInfo = categories[catKey] || { label: 'Other', icon: '✨' };

        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom: 20px;';

        section.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px;">
                <span style="font-size: 14px;">${catInfo.icon}</span>
                <span style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;">${catInfo.label}</span>
            </div>
        `;

        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px;';

        transforms.forEach(tf => {
            const card = document.createElement('div');
            card.style.cssText = `
                background: white;
                border: 2px solid #e5e7eb;
                border-radius: 10px;
                padding: 12px;
                cursor: pointer;
                transition: all 0.2s;
            `;
            card.addEventListener('mouseenter', () => {
                card.style.borderColor = '#667eea';
                card.style.transform = 'translateY(-2px)';
                card.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.15)';
            });
            card.addEventListener('mouseleave', () => {
                card.style.borderColor = '#e5e7eb';
                card.style.transform = '';
                card.style.boxShadow = '';
            });

            const affectedBadge = tf.affectedIndices && tf.affectedIndices.length > 0 && tf.affectedIndices.length < progressionData.length
                ? `<span style="
                    background: #fef3c7;
                    color: #92400e;
                    padding: 1px 6px;
                    border-radius: 8px;
                    font-size: 9px;
                    font-weight: 600;
                    margin-left: 6px;
                ">affects ${tf.affectedIndices.length}</span>`
                : '';

            card.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 10px;">
                    <span style="font-size: 24px; line-height: 1;">${tf.icon}</span>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; flex-wrap: wrap;">
                            <span style="font-weight: 600; color: #374151; font-size: 13px;">${tf.label}</span>
                            ${affectedBadge}
                        </div>
                        <div style="font-size: 11px; color: #6b7280; line-height: 1.3; margin-top: 2px;">${tf.description}</div>
                        <div style="
                            font-size: 10px;
                            color: #059669;
                            line-height: 1.3;
                            margin-top: 6px;
                            padding-left: 6px;
                            border-left: 2px solid #10b981;
                        ">💡 ${tf.insight}</div>
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                const transformed = tf.transform([...progressionData]);
                showTransformPreview(container, progressionData, transformed, tf, key, selectedIndices);
            });

            grid.appendChild(card);
        });

        section.appendChild(grid);
        container.appendChild(section);
    });
}

// ============================================================================
// VOICE LEADING OPTIMIZER
// ============================================================================

/**
 * Calculate optimal inversions for voice leading
 * Minimizes total voice movement between consecutive chords
 * Updates both inversion property AND notes array for correct playback
 */
export function optimizeVoiceLeading(progression) {
    if (!progression || progression.length < 2) return progression;

    const key = getCurrentKey() || 'C';

    const getNotesAtInversion = (chord, inversion, baseOctave = 4) => {
        const chordDef = CHORD_DEFINITIONS[chord.type];
        if (!chordDef) return { midiValues: [], noteNames: [] };

        const rootIndex = ALL_NOTES.indexOf(chord.root);
        if (rootIndex === -1) return { midiValues: [], noteNames: [] };

        const intervals = chordDef.intervals;
        let midiValues = intervals.map(interval => {
            return rootIndex + interval + (baseOctave + 1) * 12;
        });

        for (let i = 0; i < inversion && i < midiValues.length - 1; i++) {
            midiValues[i] += 12;
        }
        midiValues.sort((a, b) => a - b);

        const noteNames = midiValues.map((midi, idx) => {
            const pitchClass = midi % 12;
            const octave = Math.floor(midi / 12) - 1;
            const originalInterval = intervals[(idx + inversion) % intervals.length];
            const noteIndex = (rootIndex + originalInterval) % 12;
            return ALL_NOTES[noteIndex] + octave;
        });

        return { midiValues, noteNames };
    };

    const calculateVoiceMovement = (midi1, midi2) => {
        if (midi1.length === 0 || midi2.length === 0) return Infinity;
        const len = Math.min(midi1.length, midi2.length);
        let total = 0;
        for (let i = 0; i < len; i++) {
            total += Math.abs(midi1[i] - midi2[i]);
        }
        return total;
    };

    const result = progression.map(chord => ({ ...chord }));

    let baseOctave = 4;
    if (result[0].notes && result[0].notes.length > 0) {
        const firstNote = result[0].notes[0];
        const match = firstNote.match(/(\d+)$/);
        if (match) baseOctave = parseInt(match[1], 10);
    }

    const calculateTotalMovementForProgression = (startInversion) => {
        const firstChordDef = CHORD_DEFINITIONS[result[0].type];
        if (!firstChordDef) return { totalMovement: Infinity, inversions: [], noteResults: [] };

        const inversions = [startInversion];
        const noteResults = [getNotesAtInversion(result[0], startInversion, baseOctave)];
        let prevMidi = noteResults[0].midiValues;
        let totalMovement = 0;

        for (let i = 1; i < result.length; i++) {
            const currChord = result[i];
            const chordDef = CHORD_DEFINITIONS[currChord.type];
            const maxInv = chordDef ? Math.min(chordDef.intervals.length - 1, 2) : 0;

            let bestInv = 0;
            let bestMov = Infinity;
            let bestRes = null;

            for (let inv = 0; inv <= maxInv; inv++) {
                const res = getNotesAtInversion(currChord, inv, baseOctave);
                const mov = calculateVoiceMovement(prevMidi, res.midiValues);
                if (mov < bestMov) {
                    bestMov = mov;
                    bestInv = inv;
                    bestRes = res;
                }
            }

            inversions.push(bestInv);
            noteResults.push(bestRes);
            totalMovement += bestMov;
            prevMidi = bestRes ? bestRes.midiValues : prevMidi;
        }

        return { totalMovement, inversions, noteResults };
    };

    const firstChordDef = CHORD_DEFINITIONS[result[0].type];
    const maxFirstInversion = firstChordDef ? Math.min(firstChordDef.intervals.length - 1, 2) : 0;

    let bestOverall = { totalMovement: Infinity, inversions: [], noteResults: [] };

    for (let firstInv = 0; firstInv <= maxFirstInversion; firstInv++) {
        const candidate = calculateTotalMovementForProgression(firstInv);
        if (candidate.totalMovement < bestOverall.totalMovement) {
            bestOverall = candidate;
        }
    }

    for (let i = 0; i < result.length; i++) {
        result[i].inversion = bestOverall.inversions[i];
        if (bestOverall.noteResults[i] && bestOverall.noteResults[i].noteNames.length > 0) {
            result[i].notes = bestOverall.noteResults[i].noteNames;
        }
    }

    return result;
}

// ============================================================================
// TRANSFORM PREVIEW
// ============================================================================

/**
 * Show preview of transformation before applying
 * Enhanced with per-chord toggles for selective application
 */
export function showTransformPreview(container, original, transformed, transformation, key, selectedIndices = []) {
    container.innerHTML = '';

    let useVoiceLeading = false;

    const chordToggles = new Map();
    transformed.forEach((chord, i) => {
        const origChord = original[i];
        const isChanged = !origChord || chord.type !== origChord.type || chord.root !== origChord.root;
        if (isChanged) {
            chordToggles.set(i, true);
        }
    });

    const buildFinalProgression = () => {
        let result = transformed.map((chord, i) => {
            if (chordToggles.has(i) && !chordToggles.get(i)) {
                return { ...(original[i] || chord) };
            }
            return { ...chord };
        });

        const currentKey = getCurrentKey() || 'C';
        result = result.map((chord, i) => {
            const origChord = original[i];
            const rootChanged = !origChord || chord.root !== origChord.root;
            const typeChanged = !origChord || chord.type !== origChord.type;

            if (rootChanged || typeChanged) {
                const inversion = chord.inversion || 0;
                const res = getInvertedChordNotes(chord.root, chord.type, inversion, currentKey, 0, null, 'full');
                if (res && res.specificNotes) {
                    return { ...chord, notes: res.specificNotes };
                }
            }
            return chord;
        });

        if (useVoiceLeading) {
            result = optimizeVoiceLeading(result);
        }

        return result;
    };

    // Back button
    const backBtn = document.createElement('button');
    backBtn.innerHTML = '← Back to Transformations';
    backBtn.style.cssText = `
        padding: 8px 16px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background: white;
        cursor: pointer;
        font-size: 13px;
        margin-bottom: 20px;
    `;
    backBtn.addEventListener('click', () => renderTransformIntent(container));
    container.appendChild(backBtn);

    // Preview header
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%);
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 20px;
    `;
    header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: ${transformation.insight ? '12px' : '0'};">
            <span style="font-size: 32px;">${transformation.icon}</span>
            <div>
                <div style="font-weight: 600; font-size: 16px; color: #374151;">${transformation.label}</div>
                <div style="font-size: 13px; color: #6b7280;">${transformation.description}</div>
            </div>
        </div>
        ${transformation.insight ? `
        <div style="
            font-size: 13px;
            color: #059669;
            line-height: 1.4;
            padding: 10px 12px;
            background: rgba(16, 185, 129, 0.1);
            border-radius: 6px;
            border-left: 3px solid #10b981;
        ">💡 ${transformation.insight}</div>
        ` : ''}
    `;
    container.appendChild(header);

    // Per-chord changes section
    if (chordToggles.size > 0) {
        const changesSection = document.createElement('div');
        changesSection.style.cssText = `
            background: #fefce8;
            border: 1px solid #fde047;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 16px;
        `;

        const changesHeader = document.createElement('div');
        changesHeader.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;';
        changesHeader.innerHTML = `
            <span style="font-weight: 600; font-size: 13px; color: #854d0e;">
                Customize Changes (${chordToggles.size} chord${chordToggles.size > 1 ? 's' : ''} affected)
            </span>
        `;

        const toggleAllBtns = document.createElement('div');
        toggleAllBtns.style.cssText = 'display: flex; gap: 8px;';
        toggleAllBtns.innerHTML = `
            <button id="select-all-changes" style="
                padding: 2px 8px;
                font-size: 10px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                background: white;
                cursor: pointer;
            ">All</button>
            <button id="select-none-changes" style="
                padding: 2px 8px;
                font-size: 10px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                background: white;
                cursor: pointer;
            ">None</button>
        `;
        changesHeader.appendChild(toggleAllBtns);
        changesSection.appendChild(changesHeader);

        const changesGrid = document.createElement('div');
        changesGrid.id = 'chord-changes-grid';
        changesGrid.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px;';

        chordToggles.forEach((enabled, i) => {
            const origChord = original[i];
            const newChord = transformed[i];
            const origDef = CHORD_DEFINITIONS[origChord?.type];
            const newDef = CHORD_DEFINITIONS[newChord?.type];
            const origSymbol = origDef?.symbol || '';
            const newSymbol = newDef?.symbol || '';

            const changeItem = document.createElement('label');
            changeItem.style.cssText = `
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 10px;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.15s;
            `;
            changeItem.innerHTML = `
                <input type="checkbox" data-index="${i}" ${enabled ? 'checked' : ''} style="cursor: pointer;">
                <span style="color: #6b7280;">${origChord?.root || '?'}${origSymbol}</span>
                <span style="color: #9ca3af;">→</span>
                <span style="color: #4338ca; font-weight: 600;">${newChord.root}${newSymbol}</span>
            `;

            const checkbox = changeItem.querySelector('input');
            checkbox.addEventListener('change', () => {
                chordToggles.set(i, checkbox.checked);
                updatePreviewDisplay();
            });

            changesGrid.appendChild(changeItem);
        });

        changesSection.appendChild(changesGrid);
        container.appendChild(changesSection);

        setTimeout(() => {
            document.getElementById('select-all-changes')?.addEventListener('click', () => {
                chordToggles.forEach((_, i) => chordToggles.set(i, true));
                changesGrid.querySelectorAll('input').forEach(cb => cb.checked = true);
                updatePreviewDisplay();
            });
            document.getElementById('select-none-changes')?.addEventListener('click', () => {
                chordToggles.forEach((_, i) => chordToggles.set(i, false));
                changesGrid.querySelectorAll('input').forEach(cb => cb.checked = false);
                updatePreviewDisplay();
            });
        }, 0);
    }

    // Before/After comparison
    const comparison = document.createElement('div');
    comparison.id = 'transform-comparison';
    comparison.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;';

    let beforeChipElements = [];
    let afterChipElements = [];
    let stopBeforePlayback = null;
    let stopAfterPlayback = null;

    const formatChordFull = (chord) => {
        const chordDef = CHORD_DEFINITIONS[chord.type];
        const symbol = chordDef?.symbol ?? '';
        return `${chord.root}${symbol}`;
    };

    const MAX_PLAYBACK_CHORDS = 8;

    const updatePreviewDisplay = () => {
        const comparisonEl = document.getElementById('transform-comparison');
        if (!comparisonEl) return;

        if (stopBeforePlayback) stopBeforePlayback();
        if (stopAfterPlayback) stopAfterPlayback();

        comparisonEl.innerHTML = '';
        beforeChipElements = [];
        afterChipElements = [];

        const finalProgression = buildFinalProgression();
        const beforeToPlay = original.slice(0, MAX_PLAYBACK_CHORDS);
        const afterToPlay = finalProgression.slice(0, MAX_PLAYBACK_CHORDS);

        // Before column
        const beforeCol = document.createElement('div');
        const beforeHeader = document.createElement('div');
        beforeHeader.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
        beforeHeader.innerHTML = `<span style="font-weight: 600; color: #6b7280; font-size: 12px;">BEFORE</span>`;

        const playBeforeBtn = document.createElement('button');
        playBeforeBtn.className = 'play-before-btn';
        playBeforeBtn.innerHTML = original.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
        playBeforeBtn.style.cssText = `
            padding: 4px 10px;
            border: 1px solid #9ca3af;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            font-size: 11px;
            color: #6b7280;
        `;
        playBeforeBtn.addEventListener('click', () => {
            if (stopAfterPlayback) stopAfterPlayback();
            if (stopBeforePlayback) {
                stopBeforePlayback();
                stopBeforePlayback = null;
                playBeforeBtn.innerHTML = original.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
                playBeforeBtn.style.background = 'white';
                return;
            }
            playBeforeBtn.innerHTML = '◼ Stop';
            playBeforeBtn.style.background = '#fee2e2';
            stopBeforePlayback = playChordSequence(beforeToPlay, beforeChipElements.slice(0, MAX_PLAYBACK_CHORDS), 300);
            setTimeout(() => {
                playBeforeBtn.innerHTML = original.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
                playBeforeBtn.style.background = 'white';
                stopBeforePlayback = null;
            }, beforeToPlay.length * 1100 + 500);
        });
        beforeHeader.appendChild(playBeforeBtn);
        beforeCol.appendChild(beforeHeader);

        const beforeChips = document.createElement('div');
        beforeChips.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';
        const affectedIndices = transformation.affectedIndices || [];
        original.forEach((chord, i) => {
            const isAffected = affectedIndices.includes(i) || chordToggles.has(i);
            const chip = document.createElement('span');
            chip.textContent = formatChordFull(chord);
            chip.style.cssText = `
                padding: 6px 10px;
                background: ${isAffected ? '#fef3c7' : '#f3f4f6'};
                border: ${isAffected ? '2px solid #f59e0b' : '1px solid #e5e7eb'};
                border-radius: 6px;
                font-size: 13px;
                color: ${isAffected ? '#92400e' : '#374151'};
                cursor: pointer;
            `;
            setupHoldToPlay(chip, chord);
            beforeChips.appendChild(chip);
            beforeChipElements.push(chip);
        });
        beforeCol.appendChild(beforeChips);
        comparisonEl.appendChild(beforeCol);

        // After column
        const afterCol = document.createElement('div');
        const afterHeader = document.createElement('div');
        afterHeader.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;';
        afterHeader.innerHTML = `<span style="font-weight: 600; color: #667eea; font-size: 12px;">AFTER</span>`;

        const playAfterBtn = document.createElement('button');
        playAfterBtn.className = 'play-after-btn';
        playAfterBtn.innerHTML = finalProgression.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
        playAfterBtn.style.cssText = `
            padding: 4px 10px;
            border: 1px solid #667eea;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            font-size: 11px;
            color: #667eea;
        `;
        playAfterBtn.addEventListener('click', () => {
            if (stopBeforePlayback) stopBeforePlayback();
            if (stopAfterPlayback) {
                stopAfterPlayback();
                stopAfterPlayback = null;
                playAfterBtn.innerHTML = finalProgression.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
                playAfterBtn.style.background = 'white';
                return;
            }
            playAfterBtn.innerHTML = '◼ Stop';
            playAfterBtn.style.background = '#fef3c7';
            const currentAfterChords = buildFinalProgression().slice(0, MAX_PLAYBACK_CHORDS);
            stopAfterPlayback = playChordSequence(currentAfterChords, afterChipElements.slice(0, MAX_PLAYBACK_CHORDS), 300);
            setTimeout(() => {
                playAfterBtn.innerHTML = finalProgression.length > MAX_PLAYBACK_CHORDS ? `▶ Play first ${MAX_PLAYBACK_CHORDS}` : '▶ Play';
                playAfterBtn.style.background = 'white';
                stopAfterPlayback = null;
            }, currentAfterChords.length * 1100 + 500);
        });
        afterHeader.appendChild(playAfterBtn);

        const voiceLeadingToggle = document.createElement('label');
        voiceLeadingToggle.style.cssText = `
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            color: #6b7280;
            cursor: pointer;
            margin-left: auto;
        `;
        voiceLeadingToggle.innerHTML = `
            <input type="checkbox" id="voice-leading-toggle" style="cursor: pointer;" ${useVoiceLeading ? 'checked' : ''}>
            <span>Voice Leading</span>
        `;
        const vlCheckbox = voiceLeadingToggle.querySelector('input');
        vlCheckbox.addEventListener('change', () => {
            useVoiceLeading = vlCheckbox.checked;
            updatePreviewDisplay();
        });
        afterHeader.appendChild(voiceLeadingToggle);
        afterCol.appendChild(afterHeader);

        const afterChips = document.createElement('div');
        afterChips.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';
        const inversionNames = ['Root', '1st', '2nd', '3rd'];
        finalProgression.forEach((chord, i) => {
            const origChord = original[i];
            const isChanged = !origChord || chord.type !== origChord.type || chord.root !== origChord.root;
            const hasInversion = useVoiceLeading && chord.inversion > 0;
            const chip = document.createElement('span');
            const invLabel = hasInversion ? ` (${inversionNames[chord.inversion] || chord.inversion})` : '';
            chip.textContent = formatChordFull(chord) + invLabel;
            chip.style.cssText = `
                padding: 6px 10px;
                background: ${isChanged ? '#eef2ff' : (hasInversion ? '#f0fdf4' : '#f3f4f6')};
                border: ${isChanged ? '2px solid #667eea' : (hasInversion ? '2px solid #22c55e' : '1px solid #e5e7eb')};
                border-radius: 6px;
                font-size: 13px;
                font-weight: ${isChanged || hasInversion ? '600' : '400'};
                color: ${isChanged ? '#667eea' : (hasInversion ? '#16a34a' : '#374151')};
                cursor: pointer;
            `;
            setupHoldToPlay(chip, chord);
            afterChips.appendChild(chip);
            afterChipElements.push(chip);
        });
        afterCol.appendChild(afterChips);
        comparisonEl.appendChild(afterCol);

        const enabledChanges = Array.from(chordToggles.values()).filter(v => v).length;
        const applyBtnEl = document.getElementById('apply-transform-btn');
        if (applyBtnEl) {
            if (enabledChanges === 0) {
                applyBtnEl.textContent = 'No Changes Selected';
                applyBtnEl.disabled = true;
                applyBtnEl.style.opacity = '0.5';
                applyBtnEl.style.cursor = 'not-allowed';
            } else {
                applyBtnEl.textContent = `Apply ${enabledChanges} Change${enabledChanges > 1 ? 's' : ''}`;
                applyBtnEl.disabled = false;
                applyBtnEl.style.opacity = '1';
                applyBtnEl.style.cursor = 'pointer';
            }
        }
    };

    // Initial render
    updatePreviewDisplay();
    container.appendChild(comparison);

    // Action buttons
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 12px; justify-content: center;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
        padding: 12px 24px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        font-size: 14px;
    `;
    cancelBtn.addEventListener('click', () => renderTransformIntent(container));
    actions.appendChild(cancelBtn);

    const enabledCount = Array.from(chordToggles.values()).filter(v => v).length;
    const applyBtn = document.createElement('button');
    applyBtn.id = 'apply-transform-btn';
    applyBtn.textContent = chordToggles.size > 0 ? `Apply ${enabledCount} Change${enabledCount > 1 ? 's' : ''}` : 'Apply Transformation';
    applyBtn.style.cssText = `
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
    `;
    applyBtn.addEventListener('click', () => {
        if (window.saveStateBeforeChange) window.saveStateBeforeChange();
        setProgressionData(buildFinalProgression());

        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('melody-progression-visualization', true);
        }

        window.dispatchEvent(new CustomEvent('progressionUpdated'));
        window.dispatchEvent(new CustomEvent('progression-changed'));
        updatePersistentProgressionBar();

        if (window.syncProgressionToMelodyComposer) {
            window.syncProgressionToMelodyComposer();
        }
        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
        }

        const changeCount = Array.from(chordToggles.values()).filter(v => v).length;
        if (window.showToast) {
            window.showToast(`Applied ${changeCount} transformation${changeCount !== 1 ? 's' : ''}`, { type: 'success' });
        }

        renderTransformIntent(container);
    });
    actions.appendChild(applyBtn);

    container.appendChild(actions);
}

// ============================================================================
// PLAYBACK HELPER
// ============================================================================

/**
 * Play a chord sequence with highlighting
 * Returns a stop function
 */
function playChordSequence(chords, chipElements, delayMs = 300) {
    let stopped = false;
    let timeouts = [];

    const play = async () => {
        try {
            const piano = window.getPiano ? window.getPiano() : (window.getInstrument ? window.getInstrument() : null);
            if (!piano || typeof Tone === 'undefined') return;

            if (Tone.context.state !== 'running') {
                await Tone.start();
            }

            const now = Tone.now();
            const chordDuration = 0.8;

            chords.forEach((chord, i) => {
                if (stopped) return;

                const timeOffset = i * (chordDuration + delayMs / 1000);

                timeouts.push(setTimeout(() => {
                    if (stopped) return;

                    // Highlight chip
                    if (chipElements[i]) {
                        chipElements[i].style.transform = 'scale(1.1)';
                        chipElements[i].style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                    }

                    // Get notes and play
                    let notes = [];
                    if (chord.notes && chord.notes.length > 0) {
                        notes = [...chord.notes];
                    } else {
                        try {
                            const result = getInvertedChordNotes(chord.root, chord.type, chord.inversion || 0, getCurrentKey() || 'C', 0);
                            notes = result?.specificNotes || [];
                        } catch (e) {
                            console.warn('[Transform] Could not get notes for', chord.root, chord.type);
                        }
                    }

                    if (notes.length > 0) {
                        piano.triggerAttackRelease(notes, chordDuration * 0.9, now + timeOffset);
                    }

                    // Remove highlight after duration
                    timeouts.push(setTimeout(() => {
                        if (chipElements[i]) {
                            chipElements[i].style.transform = '';
                            chipElements[i].style.boxShadow = '';
                        }
                    }, chordDuration * 1000));
                }, timeOffset * 1000));
            });
        } catch (err) {
            console.error('[Transform] Error playing sequence:', err);
        }
    };

    play();

    return () => {
        stopped = true;
        timeouts.forEach(t => clearTimeout(t));
        chipElements.forEach(chip => {
            if (chip) {
                chip.style.transform = '';
                chip.style.boxShadow = '';
            }
        });
    };
}
