/**
 * REFACTORED: Simplified Chord Sequence with Inline Expansion
 * Complete replacement for renderSimplifiedChordSequence() and related functions
 */

// Track which chords are expanded
const expandedChords = new Set();

/**
 * PHASE 3.3: Render simplified chord sequence view
 * Compact cards that can expand inline to show detailed controls
 * @param {HTMLElement} container - Container to insert the view into
 * @param {Array} progressionData - Array of chord objects
 * @param {string} key - Current key
 */
function renderSimplifiedChordSequence(container, progressionData, key) {
    if (!progressionData || progressionData.length === 0) return;

    // Create simplified sequence container
    const sequenceContainer = document.createElement('div');
    sequenceContainer.id = 'simplified-chord-sequence';
    sequenceContainer.className = 'mb-4 px-4';

    const sequenceWrapper = document.createElement('div');
    sequenceWrapper.className = 'bg-gray-800 rounded-lg p-3 border border-gray-700';

    const sequenceInner = document.createElement('div');
    sequenceInner.id = 'simplified-sequence-inner';
    sequenceInner.className = 'flex items-start gap-3 overflow-x-auto pb-2';
    sequenceInner.style.scrollBehavior = 'smooth';

    // Create card wrappers for each chord
    progressionData.forEach((chord, index) => {
        const wrapper = createChordCardWrapper(chord, index, key);
        sequenceInner.appendChild(wrapper);
    });

    sequenceWrapper.appendChild(sequenceInner);
    sequenceContainer.appendChild(sequenceWrapper);
    container.insertBefore(sequenceContainer, container.firstChild);

    // Make simplified sequence sortable
    initializeSimplifiedSortable(sequenceInner);
}

/**
 * Create a chord card wrapper (holds either simplified or detailed view)
 * @param {Object} chord - Chord data
 * @param {number} index - Chord index
 * @param {string} key - Current key
 * @returns {HTMLElement} Wrapper element
 */
function createChordCardWrapper(chord, index, key) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chord-card-wrapper flex-shrink-0 transition-all duration-300';
    wrapper.setAttribute('data-chord-index', index);
    wrapper.style.width = expandedChords.has(index) ? '200px' : '100px';

    // Render simplified or detailed based on state
    if (expandedChords.has(index)) {
        wrapper.innerHTML = createDetailedCardHTML(chord, index, key);
    } else {
        wrapper.innerHTML = createSimplifiedCardHTML(chord, index, key);
    }

    // Attach event listeners after rendering
    attachCardEventListeners(wrapper, index);

    return wrapper;
}

/**
 * Create simplified card HTML
 */
function createSimplifiedCardHTML(chord, index, key) {
    const roman = chord.roman || harmonyAnalyzer.getRomanNumeral(chord, key);
    const colors = getFunctionColors(roman);
    const chordSymbol = chord.simpleName || chord.name || `${chord.root}${chord.type}`;

    // Subscript inversion indicator
    let inversionText = '';
    if (chord.inversion === 1) inversionText = '₁';
    else if (chord.inversion === 2) inversionText = '₂';
    else if (chord.inversion === 3) inversionText = '₃';

    return `
        <div class="simplified-card bg-gray-900 border-2 border-gray-600 rounded-lg overflow-hidden hover:border-blue-500 transition-all">
            <!-- Drag Handle -->
            <div class="drag-handle bg-gray-800 py-1 cursor-move text-center">
                <svg class="w-4 h-4 mx-auto text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
                </svg>
            </div>

            <!-- Chord Info -->
            <div class="p-3 text-center">
                <div class="text-sm font-bold text-white mb-1">${chordSymbol}${inversionText}</div>
                <div class="text-xs ${colors.romanColor} font-bold mb-1">${roman}</div>

                <!-- Position Label -->
                <div class="text-[10px] text-gray-400 mb-2">Pos: ${index + 1}</div>

                <!-- Action Buttons -->
                <div class="flex flex-col gap-1">
                    <button class="expand-btn w-full px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition flex items-center justify-center gap-1" title="Expand to detailed view">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                        <span>Details</span>
                    </button>
                    <button class="play-btn w-full px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition" title="Play chord">
                        <svg class="w-3 h-3 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                        </svg>
                    </button>
                    <button class="delete-btn w-full px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition" title="Delete chord">
                        <svg class="w-3 h-3 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Create detailed card HTML (expanded view)
 */
function createDetailedCardHTML(chord, index, key) {
    const roman = chord.roman || harmonyAnalyzer.getRomanNumeral(chord, key);
    const colors = getFunctionColors(roman);
    const chordSymbol = chord.simpleName || chord.name || `${chord.root}${chord.type}`;

    return `
        <div class="detailed-card bg-indigo-50 border-2 border-blue-500 rounded-lg overflow-hidden shadow-lg">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-2">
                <div class="text-sm font-bold text-center">${chordSymbol}</div>
                <div class="text-xs text-center ${colors.romanColor}" style="color: rgba(255,255,255,0.9);">${roman}</div>
            </div>

            <!-- Controls -->
            <div class="p-3 space-y-2">
                <!-- Chord Type -->
                <div>
                    <label class="text-xs text-gray-600 font-semibold block mb-1">Type</label>
                    <select class="type-select w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs">
                        ${getChordTypeOptions(chord.type)}
                    </select>
                </div>

                <!-- Inversion -->
                <div>
                    <label class="text-xs text-gray-600 font-semibold block mb-1">Inversion</label>
                    <select class="inversion-select w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs">
                        ${getInversionOptions(chord.inversion)}
                    </select>
                </div>

                <!-- Voicing -->
                <div>
                    <label class="text-xs text-gray-600 font-semibold block mb-1">Voicing</label>
                    <select class="voicing-select w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs">
                        ${getVoicingOptions(chord.voicing)}
                    </select>
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-1 pt-2">
                    <button class="collapse-btn flex-1 px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded transition">
                        Collapse
                    </button>
                    <button class="play-btn flex-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition">
                        Play
                    </button>
                    <button class="delete-btn flex-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Attach event listeners to card buttons
 */
function attachCardEventListeners(wrapper, index) {
    const expandBtn = wrapper.querySelector('.expand-btn');
    const collapseBtn = wrapper.querySelector('.collapse-btn');
    const playBtn = wrapper.querySelector('.play-btn');
    const deleteBtn = wrapper.querySelector('.delete-btn');
    const typeSelect = wrapper.querySelector('.type-select');
    const inversionSelect = wrapper.querySelector('.inversion-select');
    const voicingSelect = wrapper.querySelector('.voicing-select');

    // Expand button
    if (expandBtn) {
        expandBtn.addEventListener('click', () => expandChordCard(index));
    }

    // Collapse button
    if (collapseBtn) {
        collapseBtn.addEventListener('click', () => collapseChordCard(index));
    }

    // Play button
    if (playBtn) {
        playBtn.addEventListener('mousedown', () => {
            if (window.startProgressionChord) {
                window.startProgressionChord(index);
                // Highlight corresponding tension curve point and chord card
                if (window.highlightTensionPoint) {
                    window.highlightTensionPoint(index);
                }
                if (window.highlightChordCard) {
                    window.highlightChordCard(index);
                }
            }
        });
        playBtn.addEventListener('mouseup', () => {
            if (window.stopTrainerChord) window.stopTrainerChord();
            // Remove highlighting
            if (window.unhighlightAllTensionPoints) {
                window.unhighlightAllTensionPoints();
            }
            if (window.unhighlightAllChordCards) {
                window.unhighlightAllChordCards();
            }
        });
        playBtn.addEventListener('mouseleave', () => {
            if (window.stopTrainerChord) window.stopTrainerChord();
            // Remove highlighting
            if (window.unhighlightAllTensionPoints) {
                window.unhighlightAllTensionPoints();
            }
            if (window.unhighlightAllChordCards) {
                window.unhighlightAllChordCards();
            }
        });
    }

    // Delete button
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (window.removeChordFromProgression) window.removeChordFromProgression(index);
        });
    }

    // Dropdowns
    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => updateChordType(index, e.target.value));
    }
    if (inversionSelect) {
        inversionSelect.addEventListener('change', (e) => updateChordInversion(index, parseInt(e.target.value)));
    }
    if (voicingSelect) {
        voicingSelect.addEventListener('change', (e) => updateChordVoicing(index, e.target.value));
    }
}

/**
 * Expand a chord card to detailed view
 */
function expandChordCard(index) {
    expandedChords.add(index);
    const wrapper = document.querySelector(`.chord-card-wrapper[data-chord-index="${index}"]`);
    if (wrapper) {
        const trainerState = getTrainerState();
        const chord = trainerState.progressionData[index];
        const key = trainerState.currentKey || 'C';

        // Animate width expansion
        wrapper.style.width = '200px';

        // Replace content with detailed view after short delay
        setTimeout(() => {
            wrapper.innerHTML = createDetailedCardHTML(chord, index, key);
            attachCardEventListeners(wrapper, index);
        }, 150);
    }
}

/**
 * Collapse a chord card back to simplified view
 */
function collapseChordCard(index) {
    expandedChords.delete(index);
    const wrapper = document.querySelector(`.chord-card-wrapper[data-chord-index="${index}"]`);
    if (wrapper) {
        const trainerState = getTrainerState();
        const chord = trainerState.progressionData[index];
        const key = trainerState.currentKey || 'C';

        // Replace content with simplified view
        wrapper.innerHTML = createSimplifiedCardHTML(chord, index, key);
        attachCardEventListeners(wrapper, index);

        // Animate width collapse
        setTimeout(() => {
            wrapper.style.width = '100px';
        }, 50);
    }
}

/**
 * Helper: Get chord type options HTML
 */
function getChordTypeOptions(currentType) {
    const types = [
        'Major', 'Minor', 'Diminished', 'Augmented',
        'Dominant 7th', 'Major 7th', 'Minor 7th', 'Diminished 7th', 'Half-Diminished 7th',
        'Suspended 4th', 'Suspended 2nd', 'Add9'
    ];
    return types.map(type =>
        `<option value="${type}" ${type === currentType ? 'selected' : ''}>${type}</option>`
    ).join('');
}

/**
 * Helper: Get inversion options HTML
 */
function getInversionOptions(currentInversion) {
    const labels = ['Root Position', '1st Inversion', '2nd Inversion', '3rd Inversion'];
    return [0, 1, 2, 3].map(inv =>
        `<option value="${inv}" ${inv === currentInversion ? 'selected' : ''}>${labels[inv]}</option>`
    ).join('');
}

/**
 * Helper: Get voicing options HTML
 */
function getVoicingOptions(currentVoicing) {
    const voicings = [
        { value: 'close', label: 'Close' },
        { value: 'open', label: 'Open' },
        { value: 'drop-2', label: 'Drop-2' },
        { value: 'drop-3', label: 'Drop-3' }
    ];
    return voicings.map(v =>
        `<option value="${v.value}" ${v.value === currentVoicing ? 'selected' : ''}>${v.label}</option>`
    ).join('');
}

/**
 * Update chord type from simplified view
 */
function updateChordType(index, newType) {
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];
    chord.type = newType;

    // Regenerate chord notes with new type
    const chordInfo = getProgressionChordNotes(
        chord.key || trainerState.currentKey,
        chord.roman,
        newType,
        chord.inversion
    );

    if (chordInfo) {
        chord.notes = chordInfo.notes;
        chord.lhNotes = chordInfo.lhNotes;
        chord.name = chordInfo.name;
        chord.simpleName = chordInfo.simpleName;
    }

    // Save state and re-render
    saveState({ type: 'chord-update', data: { index, property: 'type', value: newType } });
    renderProgressionDisplay();
}

/**
 * Update chord inversion from simplified view
 */
function updateChordInversion(index, newInversion) {
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];
    chord.inversion = newInversion;

    // Regenerate chord notes with new inversion
    const chordInfo = getProgressionChordNotes(
        chord.key || trainerState.currentKey,
        chord.roman,
        chord.type,
        newInversion
    );

    if (chordInfo) {
        chord.notes = chordInfo.notes;
        chord.lhNotes = chordInfo.lhNotes;
    }

    // Save state and re-render
    saveState({ type: 'chord-update', data: { index, property: 'inversion', value: newInversion } });
    renderProgressionDisplay();
}

/**
 * Update chord voicing from simplified view
 */
function updateChordVoicing(index, newVoicing) {
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];
    chord.voicing = newVoicing;

    // Save state and re-render
    saveState({ type: 'chord-update', data: { index, property: 'voicing', value: newVoicing } });
    renderProgressionDisplay();
}
