// --- STATE VARIABLES ---

// Builder Tab State
let builderRootIndex = 0; 
let builderChordType = 'Major';
let builderInversion = 0; 
let builderOctaveShift = 0;
let builderChordNotes = [];
let builderSelectionMode = 'chord'; // 'chord' or 'interval'
let builderIntervalType = 'Major 3rd';

let currentTab = 'builder';
let enharmonicPreference = 'sharp'; 
let notationPreference = 'full';
let isSuggestionEngineOn = false; // Default to off
let g_NumOctaves = 6;

let piano = null;
let audioIsLoading = false;
let audioIsReady = false;
let g_KeyboardKeys = [];

// Trainer Tab State
let trainerState = {
    progressionData: [], 
    currentIndex: 0,
    isPlaying: false,
    isReady: false,
    currentKey: 'C',
    progressionRomans: [],
    playbackDuration: 800, // ms for auto-play
    transportId: null,
    scaleNotes: [],
    octaveShift: 0,
    trainerChordNotes: [] 
};

// Scale Tab State
let scaleRootIndex = 0;
let scaleType = 'Major (Ionian)';
let scaleOctaveShift = 0;
let scalePlaySequence = null;

// Keyboard slide-to-play state
let isPointerDown = false;
let activeKeyNoteName = null;
let lastTouchTime = 0;


// --- AUDIO / TONE.JS SETUP ---
function showModal(text, showButton = false) {
    const modal = document.getElementById('message-modal');
    const modalText = document.getElementById('modal-text');
    const modalButton = document.getElementById('modal-close-btn');
    
    modalText.textContent = text;
    
    if (showButton) {
        modalButton.style.display = 'inline-block';
    } else {
        modalButton.style.display = 'none';
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex'); 
}

function hideModal() {
    const modal = document.getElementById('message-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}


function initAudio() {
    if (piano || audioIsLoading) return;
    
    audioIsLoading = true;
    Tone.context.resume();
    showModal("Loading piano samples...", false);
    
    piano = new Tone.Sampler({
        urls: {
            A0: "A0.mp3", C1: "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3", 
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
            hideModal();
            audioIsReady = true;
            audioIsLoading = false;
            console.log("Piano samples loaded.");
        },
        onerror: (e) => {
            console.error("Error loading piano samples:", e);
            audioIsLoading = false;
            showModal("Error loading audio. Please refresh.", true);
        }
    }).toDestination();
}

// NEW: Centralized function to stop all scheduled playback
function forceStopAllPlayback(andClearHighlights = false) {
    if (scalePlaySequence) {
        clearTimeout(scalePlaySequence);
        scalePlaySequence = null;
    }
    if (trainerState.isPlaying) handleAutoPlayback(); // This will stop it
}

// --- UTILITIES ---

function noteToMidi(note) { return Tone.Midi(note).toMidi(); }

function resolveEnharmonic(noteWithOctave, key) {
    let noteNoOctave = noteWithOctave.slice(0, -1);
    const octave = noteWithOctave.slice(-1);
    
    let noteIndex = ALL_NOTES.indexOf(noteNoOctave);
    if (noteIndex === -1) {
        const sharpName = ENHARMONIC_MAP[noteNoOctave];
        noteIndex = ALL_NOTES.indexOf(sharpName);
    }
    if (noteIndex === -1) return noteWithOctave; 

    if (enharmonicPreference === 'flat') {
        noteNoOctave = FLAT_NOTES[noteIndex];
    } else {
        noteNoOctave = SHARP_NOTES[noteIndex];
    }
    
    return noteNoOctave + octave;
}

function getNoteKeyId(note) {
    let noteName = note.slice(0, -1); 
    const octave = note.slice(-1); 
    if (noteName.includes('b')) {
        noteName = ENHARMONIC_MAP[noteName] || noteName;
    }
    return `key-${noteName.replace('#', 's')}${octave}`;
}

function clearHighlights() {
    document.querySelectorAll('.key').forEach(key => {
        key.classList.remove('active-scale', 'active-progression', 'active-builder', 'active-scale-explorer', 'active-scale-playback');
    });
}

function releaseActiveKey() {
    if (activeKeyNoteName && piano && audioIsReady) {
        piano.triggerRelease(activeKeyNoteName, Tone.now());
        const keyId = getNoteKeyId(activeKeyNoteName);
        const keyEl = document.getElementById(keyId);
        if (keyEl) {
            keyEl.style.backgroundColor = ''; // Reset to CSS default
        }
        activeKeyNoteName = null;
    }
}

function pressKey(noteName, keyElement) {
    // This function is a placeholder for the logic inside pressThisKey, adapted for touchmove
}

function updateKeySignatureText(key) {
    const display = document.getElementById('shared-key-signature-display');
    const text = KEY_SIGNATURE_TEXT[key] || "Unknown Key";
    display.textContent = `Key: ${key} Major (${text})`;
}

// --- CORE LOGIC (Shared by Builder and Trainer) ---

function getChordNotes(rootNoteName, chordType, key, octave = 4) {
    const chordDef = CHORD_DEFINITIONS[chordType];
    if (!chordDef) { return { baseNotes: [], specificNotes: [] }; }
    
    let rootIndex = ALL_NOTES.indexOf(rootNoteName);
    if (rootIndex === -1) rootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[rootNoteName]);
    
    const rootAbsoluteSemitone = rootIndex + ((octave - 4) * 12);

    const rawSpecificNotes = chordDef.intervals.map(semitones => {
        const absoluteSemitone = rootAbsoluteSemitone + semitones;
        const noteIndex = ((absoluteSemitone % 12) + 12) % 12;
        const noteOctave = 4 + Math.floor(absoluteSemitone / 12);
        return `${ALL_NOTES[noteIndex]}${noteOctave}`;
    });
    
    const resolutionKey = key || rootNoteName;
    const specificNotes = rawSpecificNotes.map(n => resolveEnharmonic(n, resolutionKey));
    const baseNotes = specificNotes.map(n => n.slice(0, -1));

    return { baseNotes, specificNotes };
}

function getInvertedChordNotes(rootNote, chordType, inversion, key, octaveShift = 0) {
    const baseOctave = 4 + octaveShift;
    const baseChord = getChordNotes(rootNote, chordType, key, baseOctave);
    
    if (baseChord.specificNotes.length === 0) return { name: "N/A", simpleName: "N/A", specificNotes: [] };

    let invertedNotes = [...baseChord.specificNotes];
    const numNotes = invertedNotes.length;

    if (inversion >= numNotes) inversion = 0;
    
    for (let i = 0; i < inversion; i++) {
        const noteToShift = invertedNotes.shift(); 
        const shiftedMidi = noteToMidi(noteToShift) + 12; 
        const rawShiftedNote = Tone.Midi(shiftedMidi).toNote();
        invertedNotes.push(resolveEnharmonic(rawShiftedNote, key)); 
    }
    
    const chordDef = CHORD_DEFINITIONS[chordType];
    const simpleName = rootNote + (chordDef ? chordDef.symbol : '');

    let finalChordName;
    if (notationPreference === 'symbol') {
        finalChordName = simpleName;
    } else {
        finalChordName = `${rootNote} ${chordType} (${INVERSION_NAMES[inversion]})`;
    }

    return { name: finalChordName, simpleName: simpleName, specificNotes: invertedNotes };
}

function getIntervalNotes(rootNote, intervalType, octaveShift = 0) {
    const definition = INTERVAL_DEFINITIONS[intervalType];
    if (!definition) return { name: "N/A", specificNotes: [] };

    const baseOctave = 4 + octaveShift;
    const rootMidi = noteToMidi(`${rootNote}${baseOctave}`);
    
    const specificNotes = definition.intervals.map(interval => {
        const noteMidi = rootMidi + interval;
        const rawNote = Tone.Midi(noteMidi).toNote();
        return resolveEnharmonic(rawNote, rootNote);
    });

    return { name: `${rootNote} ${intervalType}`, specificNotes: specificNotes };
}

function getLHNotes(rootNote, lhSetting, baseOctave, key, chordType, lhOctaveShift) {
    if (lhSetting === 'off') return [];

    let rootIndex = ALL_NOTES.indexOf(rootNote);
    if (rootIndex === -1) rootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[rootNote]);

    let lhRootMidi = noteToMidi(`${rootNote}${baseOctave}`) + lhOctaveShift;
    
    while (lhRootMidi < 21) lhRootMidi += 12;
    
    const lhRootNote = resolveEnharmonic(Tone.Midi(lhRootMidi).toNote(), key);
    let notes = [lhRootNote];
    
    let lhFifthMidi = lhRootMidi + 7;
    if (chordType.includes('Diminished')) lhFifthMidi = lhRootMidi + 6;
    if (chordType.includes('Augmented')) lhFifthMidi = lhRootMidi + 8;
    while (lhFifthMidi < 21) lhFifthMidi += 12;
    const lhFifthNote = resolveEnharmonic(Tone.Midi(lhFifthMidi).toNote(), key);
    
    let lhOctaveMidi = lhRootMidi + 12;
    while (lhOctaveMidi < 21) lhOctaveMidi += 12;
    const lhOctaveNote = resolveEnharmonic(Tone.Midi(lhOctaveMidi).toNote(), key);

    let thirdInterval = 4; // Major
    if (chordType.includes('Minor') || chordType.includes('Diminished')) thirdInterval = 3;
    let lhThirdMidi = lhRootMidi + thirdInterval;
    while (lhThirdMidi < 21) lhThirdMidi += 12;
    const lhThirdNote = resolveEnharmonic(Tone.Midi(lhThirdMidi).toNote(), key);

    let seventhInterval = 10; // Minor 7th
    if (chordType.includes('Major 7th')) seventhInterval = 11;
    if (chordType.includes('Diminished')) seventhInterval = 9;
    let lhSeventhMidi = lhRootMidi + seventhInterval;
    while (lhSeventhMidi < 21) lhSeventhMidi += 12;
    const lhSeventhNote = resolveEnharmonic(Tone.Midi(lhSeventhMidi).toNote(), key);

    if (lhSetting === 'root') return notes;
    if (lhSetting === 'octave') return notes.concat(lhOctaveNote);
    if (lhSetting === 'root5th') return notes.concat(lhFifthNote);
    if (lhSetting === 'power') return notes.concat(lhFifthNote, lhOctaveNote);
    if (lhSetting === 'triad') return notes.concat(lhThirdNote, lhFifthNote);
    if (lhSetting === 'triadOctave') return notes.concat(lhThirdNote, lhFifthNote, lhOctaveNote);
    if (lhSetting === 'root7th') return notes.concat(lhSeventhNote);
    if (lhSetting === 'root3rd7th') return notes.concat(lhThirdNote, lhSeventhNote);
    
    return [];
}

// --- CHORD BUILDER LOGIC (Tab 1) ---

function startBuilderChord() {
    initAudio(); 
    if (!audioIsReady) return; 

    const rootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[builderRootIndex];
    const baseOctave = 4 + builderOctaveShift;

    if (builderSelectionMode === 'chord') {
        const chordResult = getInvertedChordNotes(rootNote, builderChordType, builderInversion, rootNote, builderOctaveShift);
        const lhSetting = document.getElementById('builder-lh-select').value;
        const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
        const lhNotes = getLHNotes(rootNote, lhSetting, baseOctave, rootNote, builderChordType, lhOctaveShift);

        builderChordNotes = chordResult.specificNotes;
        if (builderChordNotes.length > 0) {
            piano.triggerAttack(builderChordNotes, Tone.now());
        }

        // Play LH as a block chord and add to the notes to be released
        if (lhNotes.length > 0) {
            piano.triggerAttack(lhNotes, Tone.now());
            builderChordNotes = builderChordNotes.concat(lhNotes);
        }
    } else { // 'interval'
        const intervalResult = getIntervalNotes(rootNote, builderIntervalType, builderOctaveShift);
        builderChordNotes = intervalResult.specificNotes;
        if (builderChordNotes.length > 0) {
            piano.triggerAttack(builderChordNotes, Tone.now());
        }
    }
}

function stopBuilderChord() {
    if (piano && audioIsReady && builderChordNotes.length > 0) {
        piano.triggerRelease(builderChordNotes, Tone.now());
        builderChordNotes = []; 
    }
}

function stopTrainerChord() {
    if (piano && audioIsReady && trainerState.trainerChordNotes.length > 0) {
        piano.triggerRelease(trainerState.trainerChordNotes, Tone.now());
        trainerState.trainerChordNotes = []; 
    }
    if (currentTab === 'trainer' && trainerState.scaleNotes.length > 0 && !trainerState.isPlaying) {
         highlightTrainer(trainerState.scaleNotes, null);
    }
}

function highlightBuilderNotes(specificNotes) {
    clearHighlights();
    if (!specificNotes || currentTab !== 'builder') return;
    
    let allNotes = [...specificNotes];
    
    if (builderSelectionMode === 'chord') {
        const rootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[builderRootIndex];
        const lhSetting = document.getElementById('builder-lh-select').value;
        const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
        const baseOctave = 4 + builderOctaveShift;
        const lhNotes = getLHNotes(rootNote, lhSetting, baseOctave, rootNote, builderChordType, lhOctaveShift);
        allNotes = allNotes.concat(lhNotes);
    }
    
    allNotes.forEach(note => {
        const keyId = getNoteKeyId(note); 
        const keyElement = document.getElementById(keyId);
        if (keyElement) keyElement.classList.add('active-builder');
    });
}

function updateBuilderDisplay() {
    const rootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[builderRootIndex];
    let result;
    let notesForHighlight;

    if (builderSelectionMode === 'chord') {
        result = getInvertedChordNotes(rootNote, builderChordType, builderInversion, rootNote, builderOctaveShift);
        notesForHighlight = result.specificNotes;
        document.getElementById('builder-inversion-selector').style.opacity = 1;
        document.getElementById('builder-lh-select').disabled = false;
        document.getElementById('builder-lh-octave-select').disabled = false;
    } else { // 'interval'
        result = getIntervalNotes(rootNote, builderIntervalType, builderOctaveShift);
        notesForHighlight = result.specificNotes;
        document.getElementById('builder-inversion-selector').style.opacity = 0.3;
        document.getElementById('builder-lh-select').disabled = true;
        document.getElementById('builder-lh-octave-select').disabled = true;
    }
    
    document.getElementById('builder-chord-name').textContent = result.name;
    document.getElementById('builder-chord-notes').textContent = result.specificNotes.join(' - ');
    
    highlightBuilderNotes(notesForHighlight); 
    updateInversionSelector();
    updateKeySignatureText(rootNote);
}

function updateChordSuggestions() {
    document.querySelectorAll('.suggestion-highlight').forEach(el => {
        el.classList.remove('suggestion-highlight');
    });

    if (builderSelectionMode !== 'chord' || !isSuggestionEngineOn) return;

    const currentRootIndex = builderRootIndex;
    const currentChordType = builderChordType;

    let suggestions = [];

    if (currentChordType === 'Major') {
        suggestions = [
            { step: 5, quality: 'Major', inversion: '2nd' },
            { step: 7, quality: 'Dominant 7th', inversion: '1st' },
            { step: 9, quality: 'Minor', inversion: '1st' }
        ];
    } else if (currentChordType === 'Minor') {
        suggestions = [
            { step: 5, quality: 'Minor', inversion: '2nd' },
            { step: 7, quality: 'Dominant 7th', inversion: '1st' }
        ];
    }

    suggestions.forEach(suggestion => {
        const targetRootIndex = (currentRootIndex + suggestion.step) % 12;
        const targetQuality = suggestion.quality;

        const rootButton = document.querySelector(`#builder-note-selector button[data-index="${targetRootIndex}"]`);
        if (rootButton) {
            rootButton.classList.add('suggestion-highlight');
        }

        const chordButton = document.querySelector(`#builder-chord-type-selector button[data-chord-type="${targetQuality}"]`);
        if (chordButton) {
            chordButton.classList.add('suggestion-highlight');
            const originalTitle = CHORD_DEFINITIONS[targetQuality]?.description || '';
            chordButton.title = `SUGGESTION: Try this chord next, using the ${suggestion.inversion} inversion for smooth voice leading.\n\n${originalTitle}`;
        }
    });
}

function toggleSuggestionEngine() {
    const toggle = document.getElementById('suggestion-toggle');
    isSuggestionEngineOn = toggle.checked;

    const onLabel = document.getElementById('toggle-label-suggestion-on');
    const offLabel = document.getElementById('toggle-label-suggestion-off');

    onLabel.classList.toggle('text-indigo-600', isSuggestionEngineOn);
    onLabel.classList.toggle('text-gray-400', !isSuggestionEngineOn);
    offLabel.classList.toggle('text-gray-400', isSuggestionEngineOn);
    offLabel.classList.toggle('text-indigo-600', !isSuggestionEngineOn);

    updateChordSuggestions();
}

function addChordToProgression(switchToTrainer = false) {
    if (builderSelectionMode !== 'chord') {
        showModal("Please select a chord (not an interval) to add.", true);
        return;
    }

    const rootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[builderRootIndex];
    const chordType = builderChordType;
    const inversion = builderInversion;
    const lhSetting = document.getElementById('builder-lh-select').value;
    const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);

    const trainerKeyRootIndex = ALL_NOTES.indexOf(trainerState.currentKey);
    const addedChordRootIndex = ALL_NOTES.indexOf(rootNote);
    const interval = (addedChordRootIndex - trainerKeyRootIndex + 12) % 12;

    const scaleDegreeIndex = MAJOR_SCALE_STEPS.indexOf(interval);
    
    let romanNumeral = '?';
    if (scaleDegreeIndex !== -1) {
        const romanKeys = Object.keys(ROMAN_MAP_BASE);
        const foundKey = romanKeys.find(key => ROMAN_MAP_BASE[key].index === scaleDegreeIndex && ROMAN_MAP_BASE[key].quality === chordType);
        const fallbackKey = romanKeys.find(key => ROMAN_MAP_BASE[key].index === scaleDegreeIndex);
        romanNumeral = foundKey || fallbackKey || '?';
    } else {
        romanNumeral = rootNote;
    }

    const newChordData = getProgressionChordNotes(trainerState.currentKey, romanNumeral, chordType, inversion, trainerState.octaveShift);
    newChordData.lhSetting = lhSetting;
    newChordData.lhOctaveShift = lhOctaveShift;
    
    trainerState.progressionData.push(newChordData);
    trainerState.progressionRomans.push(romanNumeral);
    if (switchToTrainer) {
        switchTab('trainer');
    }
    renderProgressionDisplay();
}

function selectBuilderRootNote(index, playAudio = true) {
    builderRootIndex = index;
    updateButtonSelection('#builder-note-selector', 'index', index.toString(), 'bg-amber-600');
    updateBuilderDisplay();
    updateChordTypeButtonCaptions(); 
    updateIntervalButtonCaptions();
    if (playAudio) startBuilderChord(); 
}

function selectBuilderChordType(chordType, playAudio = true) {
    builderSelectionMode = 'chord';
    builderChordType = chordType;
    updateButtonSelection('#builder-interval-selector', 'intervalType', null, 'bg-amber-500');
    updateButtonSelection('#builder-chord-type-selector', 'chordType', chordType, 'bg-amber-500');
    updateBuilderDisplay();
    updateChordSuggestions();
    if (playAudio) startBuilderChord(); 
}

function selectBuilderInterval(intervalType, playAudio = true) {
    builderSelectionMode = 'interval';
    builderIntervalType = intervalType;
    updateButtonSelection('#builder-chord-type-selector', 'chordType', null, 'bg-amber-500');
    updateButtonSelection('#builder-interval-selector', 'intervalType', intervalType, 'bg-amber-500');
    updateBuilderDisplay();
    if (playAudio) startBuilderChord();
}

function selectBuilderInversion(inversion, playAudio = true) {
    builderInversion = inversion;
    updateButtonSelection('#builder-inversion-selector', 'inversion', inversion.toString(), 'bg-amber-500');
    updateBuilderDisplay();
    if (playAudio) startBuilderChord(); 
}

function updateButtonSelection(selector, dataAttribute, value, activeClass) {
    document.querySelectorAll(`${selector} button`).forEach(btn => {
        const isSelected = btn.dataset[dataAttribute] === value;
        btn.classList.toggle(activeClass, isSelected);
        btn.classList.toggle('text-white', isSelected);
        btn.classList.toggle('shadow-md', isSelected);
        btn.classList.toggle('bg-gray-200', !isSelected);
        btn.classList.toggle('text-gray-800', !isSelected);
        btn.classList.toggle('hover:bg-amber-100', !isSelected);
    });
}

function updateInversionSelector() {
    const isChordMode = builderSelectionMode === 'chord';
    const def = isChordMode ? CHORD_DEFINITIONS[builderChordType] : null;
    const maxInversion = def ? def.intervals.length - 1 : 0;
    
    document.querySelectorAll('#builder-inversion-selector button').forEach(btn => {
        const inv = parseInt(btn.dataset.inversion);
        const isDisabled = !isChordMode || inv > maxInversion;
        btn.disabled = isDisabled;
        btn.classList.toggle('opacity-50', isDisabled);
        btn.classList.toggle('cursor-not-allowed', isDisabled);
        btn.title = isDisabled ? 'Unavailable for this selection' : '';
        
        if (isChordMode && builderInversion > maxInversion) {
            selectBuilderInversion(0, false); 
        }
    });
}

function updateBuilderOctaveUI() {
    const display = document.getElementById('builder-octave-display');
    display.textContent = `Oct: ${builderOctaveShift > 0 ? '+' : ''}${builderOctaveShift}`;
    document.getElementById('builder-octave-down').disabled = builderOctaveShift <= -3;
    document.getElementById('builder-octave-up').disabled = builderOctaveShift >= 3;
}

function changeBuilderOctave(amount) {
    let newShift = builderOctaveShift + amount;
    if (newShift < -3 || newShift > 3) return; 
    builderOctaveShift = newShift;
    updateBuilderOctaveUI();
    updateBuilderDisplay();
    startBuilderChord(); 
}

function updateChordTypeButtonCaptions() {
    const currentNotes = enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
    const rootNoteName = currentNotes[builderRootIndex];
    
    document.querySelectorAll('#builder-chord-type-selector button').forEach(btn => {
        const chordType = btn.dataset.chordType;
        const chordDef = CHORD_DEFINITIONS[chordType] || {};
        const symbolNotation = rootNoteName + (chordDef.symbol || '');
        let primaryText = notationPreference === 'symbol' ? symbolNotation : chordType;
        let secondaryText = notationPreference === 'symbol' ? chordType : symbolNotation;
        btn.innerHTML = `<span class="block text-xs font-bold leading-tight">${primaryText}</span><span class="block text-gray-500" style="font-size: 0.65rem; line-height: 0.9;">${secondaryText}</span>`;
    });
}

function updateIntervalButtonCaptions() {
    document.querySelectorAll('#builder-interval-selector button').forEach(btn => {
        const intervalType = btn.dataset.intervalType;
        const intervalDef = INTERVAL_DEFINITIONS[intervalType] || {};
        const symbolNotation = intervalDef.symbol || '';
        btn.innerHTML = `<span class="block text-sm">${intervalType}</span><span class="block text-gray-500 text-xs">${symbolNotation}</span>`;
    });
}

function renderBuilderSelectors() {
    const rootSelector = document.getElementById('builder-note-selector');
    const typeSelector = document.getElementById('builder-chord-type-selector');
    const invSelector = document.getElementById('builder-inversion-selector');
    const intervalSelector = document.getElementById('builder-interval-selector');
    
    const currentNotes = enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    if (rootSelector.children.length === 0) {
        rootSelector.innerHTML = '';
        currentNotes.forEach((note, index) => {
            const button = document.createElement('button');
            button.textContent = note;
            button.dataset.index = index; 
            button.onmousedown = () => selectBuilderRootNote(index, true); 
            button.onmouseup = () => stopBuilderChord();
            button.onmouseleave = () => stopBuilderChord();
            button.className = `key-button px-1 py-2 font-semibold rounded-lg transition duration-150 transform hover:scale-105 text-xs bg-gray-200 text-gray-800 hover:bg-amber-100`;
            rootSelector.appendChild(button);
        });
    }

    if (typeSelector.children.length === 0) {
        typeSelector.innerHTML = '';
        CHORD_GROUPS.forEach(group => {
            const groupContainer = document.createElement('div');
            groupContainer.className = 'border border-gray-200 rounded-lg p-3 flex flex-col';
            const title = document.createElement('h4');
            title.className = 'text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 text-center';
            title.textContent = group.title;
            groupContainer.appendChild(title);
            
            const buttonGrid = document.createElement('div');
            buttonGrid.className = 'grid grid-cols-1 gap-2';
            group.types.forEach(chordType => {
                if (CHORD_DEFINITIONS[chordType]) {
                    const button = document.createElement('button');
                    button.dataset.chordType = chordType;
                    button.onmousedown = () => selectBuilderChordType(chordType, true);
                    button.onmouseup = () => stopBuilderChord();
                    button.onmouseleave = () => stopBuilderChord();
                    button.title = CHORD_DEFINITIONS[chordType].description || '';
                    button.className = 'key-button h-full px-2 py-2 text-center font-medium rounded-lg transition duration-150 transform hover:scale-105 bg-gray-200 text-gray-800 hover:bg-amber-100';
                    buttonGrid.appendChild(button);
                }
            });
            groupContainer.appendChild(buttonGrid);
            typeSelector.appendChild(groupContainer);
        });
    }

    if(invSelector.children.length === 0) { 
        invSelector.innerHTML = '';
        INVERSION_NAMES.forEach((name, index) => {
            const button = document.createElement('button');
            button.textContent = name;
            button.dataset.inversion = index;
            button.onmousedown = () => selectBuilderInversion(index, true); 
            button.onmouseup = () => stopBuilderChord();
            button.onmouseleave = () => stopBuilderChord();
            button.className = 'key-button px-3 py-1 font-medium rounded-lg text-sm transition duration-150 transform hover:scale-105 bg-gray-200 text-gray-800 hover:bg-amber-100'; 
            invSelector.appendChild(button);
        });
    }

    if (intervalSelector.children.length === 0) {
        intervalSelector.innerHTML = '';
        INTERVAL_GROUPS.forEach(group => {
            const groupContainer = document.createElement('div');
            groupContainer.className = 'border border-gray-200 rounded-lg p-3 flex flex-col';
            const title = document.createElement('h4');
            title.className = 'text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 text-center';
            title.textContent = group.title;
            groupContainer.appendChild(title);

            const buttonGrid = document.createElement('div');
            buttonGrid.className = 'grid grid-cols-1 gap-2';
            group.types.forEach(intervalType => {
                if (INTERVAL_DEFINITIONS[intervalType]) {
                    const button = document.createElement('button');
                    button.dataset.intervalType = intervalType;
                    button.onmousedown = () => selectBuilderInterval(intervalType, true);
                    button.onmouseup = () => stopBuilderChord();
                    button.onmouseleave = () => stopBuilderChord();
                    button.title = INTERVAL_DEFINITIONS[intervalType].description || '';
                    button.className = 'key-button h-full px-2 py-2 text-center font-medium rounded-lg transition duration-150 transform hover:scale-105 bg-gray-200 text-gray-800 hover:bg-amber-100';
                    buttonGrid.appendChild(button);
                }
            });
            groupContainer.appendChild(buttonGrid);
            intervalSelector.appendChild(groupContainer);
        });
    }

    selectBuilderRootNote(builderRootIndex, false);
    selectBuilderChordType(builderChordType, false);
    selectBuilderInversion(builderInversion, false);
    updateChordTypeButtonCaptions();
    updateIntervalButtonCaptions();
}
// --- END CHORD BUILDER LOGIC ---


// --- PROGRESSION TRAINER LOGIC (Tab 2) ---

function calculateScaleNotes(key, octave = 4, octaveShift = 0) {
    const baseOctave = octave + octaveShift;
    let scaleRootIndex = ALL_NOTES.indexOf(key);
    if (scaleRootIndex === -1) scaleRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[key]);
    
    const scaleRootMidi = noteToMidi(ALL_NOTES[scaleRootIndex] + baseOctave);
    const scaleMidiNotes = MAJOR_SCALE_STEPS.map(step => scaleRootMidi + step);
    const rawNoteNames = scaleMidiNotes.map(midi => Tone.Midi(midi).toNote());
    const resolvedNoteNames = rawNoteNames.map(note => resolveEnharmonic(note, key));
    
    return resolvedNoteNames;
}

function getProgressionChordNotes(key, romanNumeral, selectedType, selectedInversion, octaveShift = 0) {
    const mapEntry = ROMAN_MAP_BASE[romanNumeral];
    if (!mapEntry) return null;

    let scaleRootIndex = ALL_NOTES.indexOf(key);
     if (scaleRootIndex === -1) scaleRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[key]);
    
    const scaleStep = MAJOR_SCALE_STEPS[mapEntry.index];
    const chordRootIndex = (scaleRootIndex + scaleStep) % 12;
    const chordRootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[chordRootIndex];
    
    const chordResult = getInvertedChordNotes(chordRootNote, selectedType, selectedInversion, key, octaveShift);
    
    return {
        roman: romanNumeral, name: chordResult.name, simpleName: chordResult.simpleName, 
        notes: chordResult.specificNotes, root: chordRootNote, type: selectedType, inversion: selectedInversion
    };
}

function highlightTrainer(scaleNotes, chordNotes) {
    clearHighlights();
    if (currentTab !== 'trainer' || !scaleNotes) return;
    
    scaleNotes.forEach(note => {
        const keyId = getNoteKeyId(note);
        const keyElement = document.getElementById(keyId);
        if (keyElement) keyElement.classList.add('active-scale');
    });

    if (chordNotes) {
         chordNotes.forEach(note => {
            const keyId = getNoteKeyId(note);
            const keyElement = document.getElementById(keyId);
            if (keyElement) keyElement.classList.add('active-progression');
        });
    }
}

function renderProgressionDisplay() {
    const container = document.getElementById('progression-visualization');
    container.innerHTML = '';

    trainerState.progressionData.forEach((chordData, index) => {
        const card = document.createElement('div');
        card.className = 'p-2 bg-indigo-50 rounded-lg shadow border border-indigo-200 flex flex-col gap-2';
        
        const header = document.createElement('div');
        header.className = 'flex justify-between items-start'; 
        
        const nameContainer = document.createElement('div');
        nameContainer.className = 'flex flex-col text-left';
        
        const romanEl = document.createElement('span');
        romanEl.className = 'px-2 font-mono font-bold text-lg text-indigo-700 leading-none';
        romanEl.textContent = chordData.roman;
        nameContainer.appendChild(romanEl);

        const simpleNameEl = document.createElement('span');
        simpleNameEl.className = 'px-2 font-sans text-xs text-gray-500 leading-none';
        simpleNameEl.textContent = chordData.simpleName || ''; 
        nameContainer.appendChild(simpleNameEl);

        header.appendChild(nameContainer); 
        
        const playBtn = document.createElement('button');
        playBtn.innerHTML = '<svg class="w-5 h-5 pointer-events-none" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"></path></svg>';
        playBtn.className = 'text-indigo-400 hover:text-indigo-600 active:text-indigo-800 transition pt-1'; 
        playBtn.setAttribute('aria-hidden', 'true');
        playBtn.tabIndex = -1;
        header.appendChild(playBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
        deleteBtn.className = 'absolute top-1 right-1 text-gray-400 delete-chord-btn';
        deleteBtn.title = 'Remove Chord';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            removeChordFromProgression(index);
        };
        card.appendChild(deleteBtn);
        card.classList.add('relative');

        card.onmousedown = () => playProgressionChord(index, false);
        card.onmouseup = () => stopTrainerChord();
        card.onmouseleave = () => stopTrainerChord();
        card.title = `Play ${chordData.name} (Hold)`;
        card.style.cursor = 'pointer';

        card.appendChild(header);

        const typeSelect = document.createElement('select');
        typeSelect.className = 'w-full p-1 text-xs border border-gray-300 rounded';
        Object.keys(CHORD_DEFINITIONS).forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = notationPreference === 'symbol' ? (CHORD_DEFINITIONS[type].symbol || type) : type;
            if (type === chordData.type) option.selected = true;
            typeSelect.appendChild(option);
        });
        typeSelect.onchange = (e) => updateProgressionChord(index, 'type', e.target.value);
        typeSelect.onmousedown = (e) => e.stopPropagation();
        typeSelect.style.cursor = 'default';
        card.appendChild(typeSelect);

        const invSelect = document.createElement('select');
        invSelect.className = 'w-full p-1 text-xs border border-gray-300 rounded';
        INVERSION_NAMES.forEach((name, invIndex) => {
            const def = CHORD_DEFINITIONS[chordData.type];
            const maxInversion = def ? def.intervals.length - 1 : 0;
            if (invIndex <= maxInversion) {
                const option = document.createElement('option');
                option.value = invIndex;
                option.textContent = name;
                if (invIndex === chordData.inversion) option.selected = true;
                invSelect.appendChild(option);
            }
        });
        invSelect.onchange = (e) => updateProgressionChord(index, 'inversion', parseInt(e.target.value));
        invSelect.onmousedown = (e) => e.stopPropagation();
        invSelect.style.cursor = 'default';
        card.appendChild(invSelect);

        const lhContainer = document.createElement('div');
        lhContainer.className = 'grid grid-cols-2 gap-1 mt-1';

        const lhTypeSelect = document.createElement('select');
        lhTypeSelect.className = 'w-full p-1 text-xs border border-gray-300 rounded';
        lhTypeSelect.innerHTML = document.getElementById('builder-lh-select').innerHTML;
        lhTypeSelect.value = chordData.lhSetting || 'off';
        lhTypeSelect.onchange = (e) => updateProgressionChordLH(index, 'lhSetting', e.target.value);
        lhTypeSelect.onmousedown = (e) => e.stopPropagation();
        lhTypeSelect.style.cursor = 'default';
        lhContainer.appendChild(lhTypeSelect);

        const lhOctaveSelect = document.createElement('select');
        lhOctaveSelect.className = 'w-full p-1 text-xs border border-gray-300 rounded';
        lhOctaveSelect.innerHTML = document.getElementById('builder-lh-octave-select').innerHTML;
        lhOctaveSelect.value = chordData.lhOctaveShift || '-12';
        lhOctaveSelect.onchange = (e) => updateProgressionChordLH(index, 'lhOctaveShift', parseInt(e.target.value, 10));
        lhOctaveSelect.onmousedown = (e) => e.stopPropagation();
        lhOctaveSelect.style.cursor = 'default';
        lhContainer.appendChild(lhOctaveSelect);

        card.appendChild(lhContainer);
        
        container.appendChild(card);
    });
}

function removeChordFromProgression(index) {
    if (trainerState.isPlaying) handleAutoPlayback();

    trainerState.progressionData.splice(index, 1);
    trainerState.progressionRomans.splice(index, 1);
    renderProgressionDisplay();
}

function updateProgressionChordLH(index, property, value) {
    if (!trainerState.progressionData[index]) return;

    trainerState.progressionData[index][property] = value;

    const chord = trainerState.progressionData[index];
    const lhNotes = getLHNotes(chord.root, chord.lhSetting, 4 + trainerState.octaveShift, trainerState.currentKey, chord.type, chord.lhOctaveShift);
    playTrainerChordOnce(chord.notes.concat(lhNotes));
}

function playTrainerChordOnce(notes) {
    initAudio(); 
    if (!audioIsReady) return;

    stopTrainerChord(); 
    stopBuilderChord(); 

    piano.triggerAttackRelease(notes, '0.5s');
    
    highlightTrainer(trainerState.scaleNotes, notes);
    Tone.Draw.schedule(() => {
        highlightTrainer(trainerState.scaleNotes, null);
    }, Tone.now() + 0.5);
}

function updateProgressionChord(index, property, value) {
    if (!trainerState.progressionData[index]) return;
    
    let chordState = { ...trainerState.progressionData[index] };
    if (property === 'type') {
        chordState.type = value;
        chordState.inversion = 0;
    } else if (property === 'inversion') {
        chordState.inversion = value;
    }
    
    const newData = getProgressionChordNotes(
        trainerState.currentKey, chordState.roman, chordState.type, 
        chordState.inversion, trainerState.octaveShift 
    );
    
    if (newData) {
        trainerState.progressionData[index] = newData;
        renderProgressionDisplay();
    }
    
    const baseOctave = 4 + trainerState.octaveShift;
    const lhNotes = getLHNotes(newData.root, newData.lhSetting, baseOctave, trainerState.currentKey, newData.type, newData.lhOctaveShift);
    
    playTrainerChordOnce(newData.notes.concat(lhNotes));
    document.getElementById('progression-chord-notes-display').textContent = `Changed: ${newData.roman} (${newData.name})`;
}

function playProgressionChord(index, advance = true) { 
     initAudio(); 
     if (!audioIsReady) {
         if (!audioIsLoading) showModal("Loading piano samples...", false);
         return;
     }
     
    if (trainerState.isPlaying) handleAutoPlayback(); 
    stopTrainerChord();

    const chord = trainerState.progressionData[index];
    if (!chord) return; 
    
    document.getElementById('progression-chord-notes-display').textContent = `${chord.roman} (${chord.name})`;
    const { lhSetting, lhOctaveShift } = chord;    const baseOctave = 4 + trainerState.octaveShift;
    const lhNotes = getLHNotes(chord.root, lhSetting, baseOctave, trainerState.currentKey, chord.type, lhOctaveShift);
    
    const allNotes = chord.notes.concat(lhNotes);
    
    highlightTrainer(trainerState.scaleNotes, allNotes);
    
    trainerState.trainerChordNotes = allNotes; 
    if (trainerState.trainerChordNotes.length > 0) {
        piano.triggerAttack(trainerState.trainerChordNotes, Tone.now()); 
    }

    if (advance) {
        trainerState.currentIndex = (index + 1) % trainerState.progressionData.length;
        updateProgressionControlsUI();
    }
}

function loadProgression() {
    const keySelect = document.getElementById('trainer-key-select');
    const progressionSelect = document.getElementById('trainer-progression-select');
    
    if (trainerState.isPlaying) handleAutoPlayback(); 

    trainerState.currentKey = keySelect.value;
    trainerState.progressionRomans = progressionSelect.value.split(',');
    trainerState.currentIndex = 0;
    trainerState.isReady = true;
    trainerState.isPlaying = false;
    
    trainerState.scaleNotes = calculateScaleNotes(trainerState.currentKey, 4, trainerState.octaveShift);
    
    trainerState.progressionData = trainerState.progressionRomans.map(roman => {
        const baseInfo = ROMAN_MAP_BASE[roman];
        const chordType = baseInfo ? baseInfo.quality : 'Major';
        const chordData = getProgressionChordNotes(trainerState.currentKey, roman, chordType, 0, trainerState.octaveShift);
        chordData.lhSetting = 'off';
        chordData.lhOctaveShift = -12;
        return chordData;
    });
    
    updateProgressionControlsUI();
    renderProgressionDisplay();
    highlightTrainer(trainerState.scaleNotes, null);
    document.getElementById('progression-chord-notes-display').textContent = 'Ready: ' + trainerState.currentKey + ' Major';
    updateKeySignatureText(trainerState.currentKey);
}

function updateProgressionControlsUI() {
    const playBtn = document.getElementById('play-progression-btn');
    const stepBtn = document.getElementById('step-chord-btn');
    
    stepBtn.disabled = !trainerState.isReady || trainerState.isPlaying;

    if (trainerState.isPlaying) {
        document.getElementById('play-text').textContent = 'Stop';
        playBtn.classList.remove('bg-teal-600', 'hover:bg-teal-700');
        playBtn.classList.add('bg-red-600', 'hover:bg-red-700');
    } else {
        document.getElementById('play-text').textContent = 'Auto Play';
        playBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        playBtn.classList.add('bg-teal-600', 'hover:bg-teal-700');
    }
}

function updateTrainerOctaveUI() {
    const display = document.getElementById('trainer-octave-display');
    display.textContent = `Oct: ${trainerState.octaveShift > 0 ? '+' : ''}${trainerState.octaveShift}`;
    document.getElementById('trainer-octave-down').disabled = trainerState.octaveShift <= -3;
    document.getElementById('trainer-octave-up').disabled = trainerState.octaveShift >= 3;
}

function changeTrainerOctave(amount) {
    let newShift = trainerState.octaveShift + amount;
    if (newShift < -3 || newShift > 3) return; 
    trainerState.octaveShift = newShift;
    updateTrainerOctaveUI();
    loadProgression(); 
}

function handleAutoPlayback() {
    initAudio(); 
    if (!audioIsReady) {
         if (!audioIsLoading) showModal("Loading piano samples...", false);
         return;
    }

    if (!trainerState.isReady) loadProgression();
    
    if (trainerState.isPlaying) {
        Tone.Transport.stop();
        Tone.Transport.cancel();
        if(scalePlaySequence) scalePlaySequence.stop();
        trainerState.isPlaying = false;
        trainerState.currentIndex = 0;
        document.getElementById('progression-chord-notes-display').textContent = 'Playback Stopped (Reset)';
        highlightTrainer(trainerState.scaleNotes, null);
        updateProgressionControlsUI();
        return;
    }

    if (trainerState.currentIndex >= trainerState.progressionData.length) {
        trainerState.currentIndex = 0;
    }
    
    trainerState.isPlaying = true;
    updateProgressionControlsUI();

    const duration = trainerState.playbackDuration;
    const rest = 0.2;
    let timeOffset = 0; 
    
    Tone.Transport.cancel();

    for(let i = trainerState.currentIndex; i < trainerState.progressionData.length; i++) {
        const chord = trainerState.progressionData[i];
        
        Tone.Transport.schedule(t => {
            if (chord && chord.notes) {
                const baseOctave = 4 + trainerState.octaveShift;
                const lhNotes = getLHNotes(chord.root, chord.lhSetting, baseOctave, trainerState.currentKey, chord.type, chord.lhOctaveShift || -12);
                const allNotes = chord.notes.concat(lhNotes);

                document.getElementById('progression-chord-notes-display').textContent = `${chord.roman} (${chord.name})`;
                highlightTrainer(trainerState.scaleNotes, allNotes);
                piano.triggerAttackRelease(allNotes, duration, t);

                trainerState.currentIndex = (i + 1) % trainerState.progressionData.length;
                
                Tone.Draw.schedule(() => {
                    highlightTrainer(trainerState.scaleNotes, null);
                }, t + duration);
            }
        }, timeOffset);
        
        timeOffset += duration + rest;
    }

    Tone.Transport.schedule(t => {
        trainerState.isPlaying = false;
        trainerState.currentIndex = 0;
        updateProgressionControlsUI();
        document.getElementById('progression-chord-notes-display').textContent = 'Progression Finished';
    }, timeOffset);

    Tone.Transport.start();
}

function stepChord() {
     initAudio(); 
     if (!audioIsReady) {
         if (!audioIsLoading) showModal("Loading piano samples...", false);
         return;
     }

    if (!trainerState.isReady) loadProgression();
    
    if (trainerState.isPlaying) {
        handleAutoPlayback();
        return;
    }
    
    const totalChords = trainerState.progressionData.length;

    if (trainerState.currentIndex >= totalChords) {
        trainerState.currentIndex = 0;
    }
    
    if (trainerState.currentIndex < totalChords) {
        playProgressionChord(trainerState.currentIndex, true); 
        if (trainerState.currentIndex === 0) { 
            document.getElementById('progression-chord-notes-display').textContent += ' (Progression Complete)';
        }
    }
}
// --- END PROGRESSION TRAINER LOGIC ---


// --- SCALE EXPLORER LOGIC (Tab 3) ---

function getScaleNotes(rootNote, scaleType, octaveShift = 0) {
    const scaleDef = SCALE_DEFINITIONS[scaleType];
    if (!scaleDef) return [];
    
    const baseOctave = 4 + octaveShift;
    let rootIndex = ALL_NOTES.indexOf(rootNote);
    if (rootIndex === -1) rootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[rootNote]);
    
    const rootAbsoluteSemitone = rootIndex + ((baseOctave - 4) * 12);

    let notes = [];
    for (const step of scaleDef.intervals) {
        const absoluteSemitone = rootAbsoluteSemitone + step;
        const noteIndex = ((absoluteSemitone % 12) + 12) % 12;
        const noteOctave = 4 + Math.floor(absoluteSemitone / 12);
        let noteName = ALL_NOTES[noteIndex] + noteOctave;
        notes.push(resolveEnharmonic(noteName, rootNote));
    }
    
    const octaveRootSemitone = rootAbsoluteSemitone + 12;
    const octaveRootIndex = ((octaveRootSemitone % 12) + 12) % 12;
    const octaveRootOctave = 4 + Math.floor(octaveRootSemitone / 12);
    let octaveRootNote = ALL_NOTES[octaveRootIndex] + octaveRootOctave;
    notes.push(resolveEnharmonic(octaveRootNote, rootNote));
    
    return notes;
}

function highlightScaleNotes(specificNotes) {
    clearHighlights();
    if (!specificNotes || currentTab !== 'scales') return;
    
    specificNotes.forEach(note => {
        const keyId = getNoteKeyId(note); 
        const keyElement = document.getElementById(keyId);
        if (keyElement) keyElement.classList.add('active-scale-explorer');
    });
}

function updateScaleDisplay() {
    const rootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[scaleRootIndex];
    const scaleNotes = getScaleNotes(rootNote, scaleType, scaleOctaveShift);
    
    document.getElementById('scale-name').textContent = `${rootNote} ${scaleType}`;
    document.getElementById('scale-notes-display').textContent = scaleNotes.join(' - ');
    
    highlightScaleNotes(scaleNotes);
    updateKeySignatureText(rootNote);
}

function selectScaleRootNote(index) {
    scaleRootIndex = index;
    document.querySelectorAll('#scale-note-selector button').forEach((btn, i) => {
        const isSelected = parseInt(btn.dataset.index) === index;
        btn.classList.toggle('bg-lime-600', isSelected);
        btn.classList.toggle('text-white', isSelected);
        btn.classList.toggle('bg-gray-200', !isSelected);
        btn.classList.toggle('text-gray-800', !isSelected);
    });
    updateScaleDisplay();
}

function selectScaleType(type) {
    scaleType = type;
    document.querySelectorAll('#scale-type-selector button').forEach(btn => {
        const isSelected = btn.dataset.scaleType === type;
        btn.classList.toggle('bg-lime-500', isSelected);
        btn.classList.toggle('text-white', isSelected);
        btn.classList.toggle('shadow-md', isSelected);
        btn.classList.toggle('bg-gray-200', !isSelected);
        btn.classList.toggle('text-gray-800', !isSelected);
        btn.classList.toggle('hover:bg-lime-100', !isSelected);
    });
    updateScaleDisplay();
}

function updateScaleOctaveUI() {
    const display = document.getElementById('scale-octave-display');
    display.textContent = `Oct: ${scaleOctaveShift > 0 ? '+' : ''}${scaleOctaveShift}`;
    document.getElementById('scale-octave-down').disabled = scaleOctaveShift <= -3;
    document.getElementById('scale-octave-up').disabled = scaleOctaveShift >= 3;
}

function changeScaleOctave(amount) {
    let newShift = scaleOctaveShift + amount;
    if (newShift < -3 || newShift > 3) return; 
    scaleOctaveShift = newShift;
    updateScaleOctaveUI();
    updateScaleDisplay();
}

function playScale() {
    initAudio();
    if (!audioIsReady) return;
    
    if(scalePlaySequence) {
        scalePlaySequence.stop().dispose();
        scalePlaySequence = null;
    }
    if(trainerState.isPlaying) handleAutoPlayback();
    stopBuilderChord();
    
    const rootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[scaleRootIndex];
    const scaleNotes = getScaleNotes(rootNote, scaleType, scaleOctaveShift);
    
    highlightScaleNotes(scaleNotes);

    const noteDurationSeconds = 0.4;
    
    scalePlaySequence = new Tone.Sequence((time, note) => {
        piano.triggerAttackRelease(note, '8n', time);
        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(getNoteKeyId(note));
            if (keyEl) keyEl.classList.add('active-scale-playback');
        }, time);
        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(getNoteKeyId(note));
            if (keyEl) keyEl.classList.remove('active-scale-playback');
        }, time + noteDurationSeconds * 0.9);
    }, scaleNotes, '4n').start(0);

    Tone.Transport.start();

    Tone.Transport.scheduleOnce(time => {
        scalePlaySequence.stop().dispose();
        scalePlaySequence = null;
        Tone.Transport.stop();
        Tone.Draw.schedule(() => {
            highlightScaleNotes(scaleNotes);
        }, time);
    }, scaleNotes.length * Tone.Time('4n').toSeconds());
}

function renderScaleSelectors() {
    const rootSelector = document.getElementById('scale-note-selector');
    const typeSelector = document.getElementById('scale-type-selector');
    
    const currentNotes = enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    if (rootSelector.children.length === 0) {
        rootSelector.innerHTML = '';
        currentNotes.forEach((note, index) => {
            const button = document.createElement('button');
            button.textContent = note;
            button.dataset.index = index; 
            button.onclick = () => selectScaleRootNote(index); 
            button.className = `key-button px-1 py-2 font-semibold rounded-lg transition duration-150 transform hover:scale-105 text-xs bg-gray-200 text-gray-800 hover:bg-lime-100`;
            rootSelector.appendChild(button);
        });
    }

    if(typeSelector.children.length === 0) { 
        Object.keys(SCALE_DEFINITIONS).forEach(type => {
            const button = document.createElement('button');
            button.textContent = type;
            button.dataset.scaleType = type;
            button.onclick = () => selectScaleType(type); 
            button.className = 'key-button px-2 py-1 font-medium rounded-lg text-xs transition duration-150 transform hover:scale-105 bg-gray-200 text-gray-800 hover:bg-lime-100'; 
            typeSelector.appendChild(button);
        });
    }
    selectScaleRootNote(scaleRootIndex);
    selectScaleType(scaleType);
}
// --- END SCALE EXPLORER LOGIC ---


// --- UI RENDERING & SWITCHING ---

function refreshAllTabs() {
    renderBuilderSelectors();
    renderProgressionControls();
    renderScaleSelectors(); 
    updateBuilderDisplay();
    if (trainerState.isReady) {
        loadProgression();
    }
    updateScaleDisplay(); 
    updateChordTypeButtonCaptions(); 
    updateIntervalButtonCaptions();
}

function toggleEnharmonic() {
    const toggle = document.getElementById('enharmonic-toggle');
    const sharpLabel = document.getElementById('toggle-label-sharp');
    const flatLabel = document.getElementById('toggle-label-flat');
    
    enharmonicPreference = toggle.checked ? 'sharp' : 'flat';
    sharpLabel.classList.toggle('text-indigo-600', toggle.checked);
    sharpLabel.classList.toggle('text-gray-400', !toggle.checked);
    flatLabel.classList.toggle('text-gray-400', toggle.checked);
    flatLabel.classList.toggle('text-indigo-600', !toggle.checked);
    
    refreshAllTabs();
}

function toggleNotationStyle() {
    const toggle = document.getElementById('notation-toggle');
    const fullLabel = document.getElementById('toggle-label-full');
    const symbolLabel = document.getElementById('toggle-label-symbol');

    notationPreference = toggle.checked ? 'symbol' : 'full';
    symbolLabel.classList.toggle('text-indigo-600', toggle.checked);
    symbolLabel.classList.toggle('text-gray-400', !toggle.checked);
    fullLabel.classList.toggle('text-gray-400', toggle.checked);
    fullLabel.classList.toggle('text-indigo-600', !toggle.checked);

    updateBuilderDisplay();
    updateChordTypeButtonCaptions();
    if (trainerState.isReady) {
        loadProgression();
    }
}

function switchTab(tabId) {
    const tabs = ['builder', 'trainer', 'scales'];
    tabs.forEach(id => {
        const content = document.getElementById(`tab-${id}`);
        const button = document.getElementById(`tab-btn-${id}`);
        
        if (id === tabId) {
            content.classList.remove('hidden');
            button.classList.add('border-indigo-600', 'text-indigo-600');
            button.classList.remove('border-transparent', 'text-gray-500', 'hover:border-indigo-300');
            currentTab = id;
        } else {
            content.classList.add('hidden');
            button.classList.remove('border-indigo-600', 'text-indigo-600');
            button.classList.add('border-transparent', 'text-gray-500', 'hover:border-indigo-300');
        }
    });
    
    clearHighlights();
    forceStopAllPlayback(); // This single call correctly stops all playback.
    // The redundant calls to stop the trainer and scale player were removed for clarity.
    
    document.getElementById('builder-info-display').classList.add('hidden');
    document.getElementById('progression-chord-display').classList.add('hidden');
    document.getElementById('scale-info-display').classList.add('hidden');
    
    if (tabId === 'builder') {
        document.getElementById('builder-info-display').classList.remove('hidden');
        updateBuilderDisplay();
    } else if (tabId === 'trainer') {
        document.getElementById('progression-chord-display').classList.remove('hidden');
        if (trainerState.scaleNotes && trainerState.scaleNotes.length > 0) {
            highlightTrainer(trainerState.scaleNotes, null);
            updateKeySignatureText(trainerState.currentKey);
        } else {
            loadProgression();
        }
    } else if (tabId === 'scales') {
        document.getElementById('scale-info-display').classList.remove('hidden');
        updateScaleDisplay();
    }
}

function renderProgressionControls() {
    const keySelect = document.getElementById('trainer-key-select');
    const progressionSelect = document.getElementById('trainer-progression-select');
    
    const currentKeys = enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
    const oldKey = keySelect.value;
    keySelect.innerHTML = ''; 
    
    currentKeys.forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = `${key} Major`;
        keySelect.appendChild(option);
    });
    
    let keyIndex = currentKeys.indexOf(oldKey);
    if(keyIndex === -1) {
        const enharmonic = ENHARMONIC_MAP[oldKey];
        keyIndex = currentKeys.indexOf(enharmonic);
        if(keyIndex === -1) keyIndex = 0; 
    }
    keySelect.value = currentKeys[keyIndex];
    trainerState.currentKey = currentKeys[keyIndex];

    if (progressionSelect.children.length === 0) {
        Object.keys(COMMON_PROGRESSIONS).forEach(name => {
            const option = document.createElement('option');
            option.value = COMMON_PROGRESSIONS[name].join(',');
            option.textContent = name;
            progressionSelect.appendChild(option);
        });
    }
    
    keySelect.onchange = loadProgression;
    progressionSelect.onchange = loadProgression;
}

function handleOctaveRangeChange(value) {
    g_NumOctaves = parseInt(value, 10);
    if (g_NumOctaves > 8) g_NumOctaves = 8;
    if (g_NumOctaves < 1) g_NumOctaves = 1;
    
    renderKeyboard();
    
    if (currentTab === 'builder') updateBuilderDisplay();
    else if (currentTab === 'trainer') highlightTrainer(trainerState.scaleNotes, null);
    else if (currentTab === 'scales') updateScaleDisplay();
}

function renderKeyboard() {
    const numOctaves = g_NumOctaves;
    const keyboardEl = document.getElementById('piano-keyboard');
    keyboardEl.innerHTML = '';
    g_KeyboardKeys = [];
    
    const centerMidi = 60; // C4
    const totalKeys = numOctaves * 12 + 1;
    const halfRange = Math.floor(totalKeys / 2);

    let idealStartMidi = centerMidi - halfRange;
    let idealEndMidi = centerMidi + (totalKeys - halfRange - 1);
    
    const actualStartMidi = Math.max(21, idealStartMidi);
    const actualEndMidi = Math.min(108, idealEndMidi);
    
    for (let midi = actualStartMidi; midi <= actualEndMidi; midi++) {
        const noteName = Tone.Midi(midi).toNote();
        const baseName = noteName.replace(/[0-9]/g, '');
        g_KeyboardKeys.push({
            name: noteName,
            type: baseName.includes('#') ? 'black' : 'white',
            baseName: baseName
        });
    }
    
    let keysMap = {};
    const totalWhiteKeys = g_KeyboardKeys.filter(k => k.type === 'white').length;
    if (totalWhiteKeys === 0) return; 
    
    const whiteKeyWidth = 100 / totalWhiteKeys;
    const blackKeyWidth = whiteKeyWidth * 0.5;

    g_KeyboardKeys.forEach(keyData => {
        const keyEl = document.createElement('div');
        keyEl.id = getNoteKeyId(keyData.name);
        
        if (keyData.type === 'white') {
            keyEl.className = 'key white-key';
            keyEl.style.width = `${whiteKeyWidth}%`; 
            if (keyData.name.includes('C')) {
                 const label = document.createElement('span');
                 label.className = 'text-gray-500 text-xs absolute bottom-1';
                 label.textContent = keyData.name;
                 keyEl.appendChild(label);
            }
        } else {
            keyEl.className = 'key black-key';
            keyEl.style.width = `${blackKeyWidth}%`;
        }
        
        const pressThisKey = (e) => {
            e.preventDefault(); 
            e.stopPropagation(); 
            forceStopAllPlayback();
            if (keyData.name === activeKeyNoteName) return;
            releaseActiveKey();
            initAudio();
            if (!audioIsReady) return;
            piano.triggerAttack(keyData.name, Tone.now());
            activeKeyNoteName = keyData.name;
            keyEl.style.backgroundColor = keyData.type === 'white' ? '#fcd34d' : '#d97706';
        };

        keyEl.addEventListener('mousedown', (e) => {
            if (Date.now() - lastTouchTime < 500) { e.preventDefault(); return; }
            isPointerDown = true;
            pressThisKey(e);
        });
        keyEl.addEventListener('touchstart', (e) => {
            lastTouchTime = Date.now();
            isPointerDown = true;
            pressThisKey(e);
        }, { passive: false });
        
        keyEl.addEventListener('mouseenter', (e) => {
            if (isPointerDown) pressThisKey(e);
        });

        keysMap[keyData.name] = keyEl;
    });
    
    document.addEventListener('mouseup', (e) => {
        if (Date.now() - lastTouchTime < 500) { e.preventDefault(); return; }
        isPointerDown = false;
        releaseActiveKey();
    });
    
    keyboardEl.addEventListener('touchend', (e) => {
        e.preventDefault();
        isPointerDown = false;
        releaseActiveKey();
    });
    keyboardEl.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        isPointerDown = false;
        releaseActiveKey();
    });

    let currentWhiteKeyIndex = 0;
    g_KeyboardKeys.forEach(keyData => {
        const keyEl = keysMap[keyData.name];
        if (keyData.type === 'white') {
            keyboardEl.appendChild(keyEl);
            currentWhiteKeyIndex++;
        } else {
            let whiteKeyStart = whiteKeyWidth * currentWhiteKeyIndex;
            keyEl.style.left = `${whiteKeyStart - (blackKeyWidth / 2)}%`;
            keyboardEl.appendChild(keyEl);
        }
    });
    
    keyboardEl.addEventListener('touchmove', (e) => {
        if (!isPointerDown) return;
        e.preventDefault();
        const touch = e.touches[0];
        const newKeyElement = document.elementFromPoint(touch.clientX, touch.clientY);
        if (newKeyElement && newKeyElement.classList.contains('key')) {
            const newNoteName = g_KeyboardKeys.find(k => getNoteKeyId(k.name) === newKeyElement.id)?.name;
            if (newNoteName && newNoteName !== activeKeyNoteName) {
                newKeyElement.dispatchEvent(new MouseEvent('mousedown'));
            }
        }
    }, { passive: false });

    keyboardEl.addEventListener('mouseleave', () => {
         if(isPointerDown) {
            releaseActiveKey();
            isPointerDown = false;
         }
    });
}

function resumeAudioContext() {
    if (Tone && Tone.context.state !== 'running') {
        Tone.context.resume();
    }
}

// Initialization
window.onload = () => {
    renderKeyboard();
    renderProgressionControls();
    renderBuilderSelectors();
    renderScaleSelectors();
    
    document.getElementById('enharmonic-toggle').checked = true;
    document.getElementById('notation-toggle').checked = false;
    document.getElementById('suggestion-toggle').checked = false;
    refreshAllTabs();
    
    switchTab('builder');

    updateBuilderOctaveUI();
    updateTrainerOctaveUI();
    updateScaleOctaveUI();

    const progressionContainer = document.getElementById('progression-visualization');
    if (progressionContainer) {
        new Sortable(progressionContainer, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function (evt) {
                const movedItem = trainerState.progressionData.splice(evt.oldIndex, 1)[0];
                trainerState.progressionData.splice(evt.newIndex, 0, movedItem);
                const movedRoman = trainerState.progressionRomans.splice(evt.oldIndex, 1)[0];
                trainerState.progressionRomans.splice(evt.newIndex, 0, movedRoman);
            }
        });
    }

    document.addEventListener('mousedown', resumeAudioContext);
    document.addEventListener('touchstart', resumeAudioContext, { passive: true });
};
