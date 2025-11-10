// --- STATE VARIABLES ---

// Builder Tab State
let builderRootIndex = 0; 
let builderChordType = 'Major';
let builderInversion = 0; 
let builderOctaveShift = 0;
let builderChordNotes = [];
let builderSelectionMode = 'chord'; // 'chord' or 'interval'
let builderIntervalType = 'Major 3rd';
let builderOmittedNotes = []; // NEW: For voicing editor
let builderLHOmittedNotes = [];

let g_arpeggioSequence = null; // NEW: For arpeggio playback
const ARPEGGIO_SPEEDS = {
    'Slowest': '4n',
    'Slow': '8n',
    'Medium': '12n',
    'Fast': '16n',
    'Fastest': '24n'
};
let arpeggioSpeed = 'Slow';
let currentTab = 'builder';
let enharmonicPreference = 'sharp'; 
let notationPreference = 'full';
let isSuggestionEngineOn = false; // Default to off
let isRomanNumeralEngineOn = false; // Default to off
let isStaffNotationOn = false; // Default to off
let isCompactModeOn = false;
let g_NumOctaves = 4;

let piano = null;
let audioIsLoading = false;
let audioIsReady = false;
let g_KeyboardKeys = [];
let cameraShutter = null;

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
    trainerChordNotes: [],
    isRecording: false,
    recordedProgression: []
};

// Scale Tab State
let scaleRootIndex = 0;
let scaleType = 'Major (Ionian)';
let scaleOctaveShift = 0;
let scaleSpeed = 'Medium';
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
    showModal("Loading piano samples...", !audioIsReady);
    
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

    cameraShutter = new Tone.Player({
        url: "public/camera-shutter.mp3",
        autostart: false,
    }).toDestination();
}

// NEW: Centralized function to stop all scheduled playback
function forceStopAllPlayback(andClearHighlights = false) {
    stopArpeggio();
    stopBuilderChord();
    if (scalePlaySequence) {
        scalePlaySequence.stop().dispose();
        scalePlaySequence = null;
        Tone.Transport.stop();
        Tone.Transport.cancel();
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

    if (enharmonicPreference === 'sharp') {
        noteNoOctave = SHARP_NOTES[noteIndex];
    } else { // 'flat'
        // In flat mode, we need to decide whether to show a sharp or a flat.
        // The rule is: if the note is part of the key's major scale, use the key's natural spelling.
        // Otherwise, prefer the flat name.
        const keyRootName = ENHARMONIC_MAP[key] || key;
        const keyRootIndex = ALL_NOTES.indexOf(keyRootName);
        
        if (keyRootIndex !== -1) {
            const scaleNoteIndices = MAJOR_SCALE_STEPS.map(step => (keyRootIndex + step) % 12);
            
            // If the note's sharp name is in the scale, use the sharp name.
            // This handles cases like G in Ab major.
            if (scaleNoteIndices.includes(noteIndex)) {
                 noteNoOctave = SHARP_NOTES[noteIndex];
            } else {
                // Otherwise, it's a chromatic note, prefer the flat name.
                // This handles cases like the minor 3rd of Ab (Cb).
                noteNoOctave = FLAT_NOTES[noteIndex];
            }
        } else {
            // Fallback for keys not in our map (shouldn't happen with builder)
            noteNoOctave = FLAT_NOTES[noteIndex];
        }
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
        key.classList.remove('active-scale', 'active-progression', 'active-builder', 'active-scale-explorer', 'active-scale-playback', 'active-builder-playback');
    });
}

function releaseActiveKey() {
    if (activeKeyNoteName && piano && audioIsReady) {
        piano.triggerRelease(activeKeyNoteName, Tone.now());
        const keyId = getNoteKeyId(activeKeyNoteName);
        const keyEl = document.getElementById(keyId);
        if (keyEl) {
            keyEl.classList.remove('active-builder-playback');
        }
        activeKeyNoteName = null;
    }
}

function pressKey(noteName, keyElement) {
    // This function is a placeholder for the logic inside pressThisKey, adapted for touchmove
}

function updateKeySignatureDisplay(key) {
    const textDisplay = document.getElementById('key-signature-text');
    const trebleImg = document.getElementById('treble-clef-img');
    const enharmonicLabel = document.getElementById('enharmonic-key-label');
    const relativeMinorDisplay = document.getElementById('relative-minor-display');

    const text = KEY_SIGNATURE_TEXT[key] || "Unknown Key";
    textDisplay.textContent = `Key: ${key} Major (${text})`;

    // Handle image display with enharmonic fallback
    let enharmonicKeyUsed = null;
    let imageInfo = KEY_SIGNATURE_IMAGES[key];
    // If no direct image, check for an enharmonic equivalent
    if (!imageInfo) {
        const enharmonicKey = ENHARMONIC_MAP[key];
        if (enharmonicKey) {
            imageInfo = KEY_SIGNATURE_IMAGES[enharmonicKey];
            enharmonicKeyUsed = enharmonicKey;
        }
    }

    if (imageInfo && trebleImg) {
        trebleImg.src = `public/key_signatures/${imageInfo.treble}`;
    }

    // Show the enharmonic label if an equivalent key was used for the image
    enharmonicLabel.textContent = enharmonicKeyUsed;
    enharmonicLabel.classList.toggle('hidden', !enharmonicKeyUsed);

    // Handle relative minor display
    const relativeMinor = RELATIVE_MINOR_MAP[key];
    if (relativeMinor && relativeMinorDisplay) {
        relativeMinorDisplay.textContent = relativeMinor;
        relativeMinorDisplay.title = `Relative minor of ${key} Major`;
    }
}

// --- CORE LOGIC (Shared by Builder and Trainer) ---

function getChordNotes(rootNoteName, chordType, key, octave = 4) {
    const chordDef = CHORD_DEFINITIONS[chordType];
    if (!chordDef) { return { baseNotes: [], specificNotes: [] }; }
    
    const rootMidi = noteToMidi(`${rootNoteName}${octave}`);
    const noteNameArray = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES);

    const specificNotes = chordDef.intervals.map(interval => {
    const noteMidi = rootMidi + interval;
    const rawNote = Tone.Midi(noteMidi).toNote();
    let [noteName, noteOctave] = [rawNote.slice(0, -1), parseInt(rawNote.slice(-1))];

    // Fix enharmonic spellings (Cb, Fb, B#, E#)
    if (noteName === "Cb") {
        noteName = "Cb";
        noteOctave += 1;
    } else if (noteName === "Fb") {
        noteName = "Fb";
        noteOctave += 1;
    } else if (noteName === "B#") {
        noteName = "B#";
        noteOctave -= 1;
    } else if (noteName === "E#") {
        noteName = "E#";
        noteOctave -= 1;
    }

    // Final return — this single string is what’s used for both playback and highlighting
    return `${noteName}${noteOctave}`;

    });

    const baseNotes = specificNotes.map(n => n.slice(0, -1));
    return { baseNotes, specificNotes };
}

function getInvertedChordNotes(rootNote, chordType, inversion, key, octaveShift = 0) {
    // Determine if chordType is a string (e.g., "Major") or a temporary definition object.
    const isStringLookup = typeof chordType === 'string';
    const chordDef = isStringLookup ? CHORD_DEFINITIONS[chordType] : chordType;

    const baseOctave = 4 + octaveShift;
    // Pass the correct definition to getChordNotes
    const baseChord = getChordNotes(rootNote, isStringLookup ? chordType : chordDef, key, baseOctave);
    
    if (!chordDef || baseChord.specificNotes.length === 0) return { name: "N/A", simpleName: "N/A", specificNotes: [] };

    let invertedNotes = [...baseChord.specificNotes];
    const numNotes = invertedNotes.length;

    if (inversion >= numNotes) inversion = 0;
    
    for (let i = 0; i < inversion; i++) {
        const noteToShift = invertedNotes.shift(); 
        const shiftedMidi = noteToMidi(noteToShift) + 12; 
        // Convert the new MIDI value back to a note name. Tone.js handles the octave correctly.
        const rawShiftedNote = Tone.Midi(shiftedMidi).toNote();
        // Now, resolve its enharmonic spelling based on the key and user preference.
        invertedNotes.push(resolveEnharmonic(rawShiftedNote, key)); 
    }
    
    const simpleName = rootNote + (chordDef.symbol || '');

    let finalChordName;
    if (notationPreference === 'symbol') {
        finalChordName = simpleName;
    } else {
        // Only show chordType name if it was a string lookup
        finalChordName = `${rootNote} ${isStringLookup ? chordType : ''} (${INVERSION_NAMES[inversion]})`;
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

function getLHNotes(rootNote, lhType, lhInversion = 0, key, lhOctaveShift, rhChordType = builderChordType) {
    if (lhType === 'off') {
        return [];
    }

    const baseOctave = 4; // A consistent starting point for calculation.
    const rootMidi = noteToMidi(`${rootNote}${baseOctave}`) + lhOctaveShift;

    let intervals = [];
    
    if (lhType === 'rootOnly') {
        intervals = [0];
    } else if (lhType === 'rootAnd5th') {
        intervals = [0, 7];
    } else if (lhType === 'powerChord') {
        intervals = [0, 7, 12];
    } else if (lhType === 'Major') {
        intervals = [...CHORD_DEFINITIONS['Major'].intervals]; // Create a copy
    } else if (lhType === 'Minor') {
        intervals = [...CHORD_DEFINITIONS['Minor'].intervals]; // Create a copy
    } else if (lhType === 'shell_maj7') {
        intervals = [0, 4, 11]; // Root, Major 3rd, Major 7th
    } else if (lhType === 'shell_min7') {
        intervals = [0, 3, 10]; // Root, Minor 3rd, Minor 7th
    } else if (lhType === 'shell_dom7') {
        intervals = [0, 4, 10]; // Root, Major 3rd, Minor 7th
    } else if (lhType === 'Dominant 7th') {
        intervals = [...CHORD_DEFINITIONS['Dominant 7th'].intervals]; // Create a copy
    } else if (lhType === 'spread') {
        // Determine if the RH chord is major or minor to select the correct 10th
        const isMinor = rhChordType.includes('Minor') || rhChordType.includes('Diminished');
        const tenth = isMinor ? 3 + 12 : 4 + 12; // Minor 10th (m3 + octave) or Major 10th (M3 + octave)
        intervals = [0, 7, tenth]; // R-5-10
    } else if (lhType === 'quartal') {
        intervals = [0, 5, 10]; // R-4-b7
    } else if (lhType === 'spread_maj') {
        intervals = [0, 7, 16]; // R-5-10 (Major)
    }

    // Apply inversion to the intervals array before calculating notes
    for (let i = 0; i < lhInversion; i++) {
        if (intervals.length > 0) {
            const firstInterval = intervals.shift();
            intervals.push(firstInterval + 12);
        }
    }

    // Calculate final note names from the intervals
    const notes = intervals.map(interval => {
        const noteMidi = rootMidi + interval;
        return resolveEnharmonic(Tone.Midi(noteMidi).toNote(), key);
    });

    return notes;
}

// --- CHORD BUILDER LOGIC (Tab 1) ---

function startBuilderChord() {
    initAudio(); 
    if (!audioIsReady) return; 

    const rootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[builderRootIndex];
    const baseOctave = 4 + builderOctaveShift;

    if (builderSelectionMode === 'chord') {
        const chordResult = getInvertedChordNotes(rootNote, builderChordType, builderInversion, rootNote, builderOctaveShift);
        const lhType = document.getElementById('builder-lh-type-select').value;
        const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
        const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
        const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, builderChordType);
        const lhNotes = allLhNotes.filter(note => !builderLHOmittedNotes.includes(note));

        // Filter out omitted notes
        const voicedNotes = chordResult.specificNotes.filter(note => !builderOmittedNotes.includes(note));

        builderChordNotes = voicedNotes;
        if (builderChordNotes.length > 0) {
            piano.triggerAttack(builderChordNotes, Tone.now());
        }
        // Add playback highlight
        document.querySelectorAll('.active-builder').forEach(key => {
            key.classList.add('active-builder-playback');
        });

        // Play LH as a block chord and add to the notes to be released
        if (lhNotes.length > 0) {
            piano.triggerAttack(lhNotes, Tone.now());
            builderChordNotes = builderChordNotes.concat(lhNotes);
        }
    } else { // 'interval'
        const intervalResult = getIntervalNotes(rootNote, builderIntervalType, builderOctaveShift);
        const voicedNotes = intervalResult.specificNotes.filter(note => !builderOmittedNotes.includes(note));

        builderChordNotes = voicedNotes;
        if (builderChordNotes.length > 0) {
            piano.triggerAttack(builderChordNotes, Tone.now());
        }
        // Add playback highlight
        document.querySelectorAll('.active-builder').forEach(key => {
            key.classList.add('active-builder-playback');
        });

        // Also play LH notes for intervals
        const lhType = document.getElementById('builder-lh-type-select').value;
        const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
        const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
        const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, builderChordType);
        const lhNotes = allLhNotes.filter(note => !builderLHOmittedNotes.includes(note));

        if (lhNotes.length > 0) {
            piano.triggerAttack(lhNotes, Tone.now());
            builderChordNotes = builderChordNotes.concat(lhNotes);
        }
    }
}

function stopBuilderChord() {
    if (piano && audioIsReady && builderChordNotes.length > 0) {
        piano.triggerRelease(builderChordNotes, Tone.now());
        builderChordNotes = []; 
        // Remove playback highlight
        document.querySelectorAll('.active-builder-playback').forEach(key => {
            key.classList.remove('active-builder-playback');
        });
    }
}

function playArpeggio(selectionType, type, direction) {
    initAudio();
    if (!audioIsReady) return;

    stopArpeggio(); // Stop any existing arpeggio

    // NEW: Update the display and highlighting when an arpeggio is played
    // Only reset voicings if the type is different from the current selection.
    const isNewSelection = (selectionType === 'chord' && type !== builderChordType) || (selectionType === 'interval' && type !== builderIntervalType);

    if (selectionType === 'chord') {
        selectBuilderChordType(type, false, isNewSelection);
    } else {
        selectBuilderInterval(type, false, isNewSelection);
    }

    const rootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[builderRootIndex];
    let result;
    if (selectionType === 'chord') {
        result = getInvertedChordNotes(rootNote, type, 0, rootNote, builderOctaveShift);
    } else {
        result = getIntervalNotes(rootNote, type, builderOctaveShift);
    }

    // NEW: Filter out any notes that are omitted in the voicing editor.
    let notesToPlay = result.specificNotes.filter(note => !builderOmittedNotes.includes(note));

    if (direction === 'down') {
        notesToPlay.reverse();
    }

    const speedValue = ARPEGGIO_SPEEDS[arpeggioSpeed];
    const noteDurationSeconds = Tone.Time(speedValue).toSeconds();

    g_arpeggioSequence = new Tone.Sequence((time, note) => {
        piano.triggerAttackRelease(note, speedValue, time);
        // NEW: Schedule visual highlighting for each note in the arpeggio
        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(getNoteKeyId(note));
            if (keyEl) keyEl.classList.add('active-builder-playback');
        }, time);
        // Schedule the removal of the highlight
        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(getNoteKeyId(note));
            if (keyEl) keyEl.classList.remove('active-builder-playback');
        }, time + noteDurationSeconds * 0.9);
    }, notesToPlay, speedValue).start(0);

    g_arpeggioSequence.loop = false; // Play only once per click
    Tone.Transport.start();

    // Schedule cleanup after the sequence finishes
    const totalDuration = notesToPlay.length * noteDurationSeconds;
    Tone.Transport.scheduleOnce((time) => {
        Tone.Draw.schedule(() => {
            stopArpeggio();
        }, time);
    }, totalDuration);
}

function stopArpeggio() {
    if (g_arpeggioSequence) {
        g_arpeggioSequence.stop().dispose();
        g_arpeggioSequence = null;
        Tone.Transport.stop();
        // NEW: Clean up any lingering playback highlights when stopping
        document.querySelectorAll('.active-builder-playback').forEach(key => {
            key.classList.remove('active-builder-playback');
        });
    }
}

function changeArpeggioSpeed(direction) {
    const speedLabels = Object.keys(ARPEGGIO_SPEEDS);
    let currentIndex = speedLabels.indexOf(arpeggioSpeed);

    if (direction === 'faster') {
        currentIndex = Math.min(speedLabels.length - 1, currentIndex + 1);
    } else {
        currentIndex = Math.max(0, currentIndex - 1);
    }
    arpeggioSpeed = speedLabels[currentIndex];
    updateArpeggioSpeedUI();
}

function updateArpeggioSpeedUI() {
    const display = document.getElementById('arp-speed-display');
    const speedLabels = Object.keys(ARPEGGIO_SPEEDS);
    const currentIndex = speedLabels.indexOf(arpeggioSpeed);

    display.textContent = arpeggioSpeed;
    document.getElementById('arp-speed-down').disabled = currentIndex === 0;
    document.getElementById('arp-speed-up').disabled = currentIndex === speedLabels.length - 1;
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
    
    const rootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[builderRootIndex];
    const lhType = document.getElementById('builder-lh-type-select').value;
    const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
    const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
    
    // Filter out any omitted notes from the right-hand part before highlighting
    allNotes = allNotes.filter(note => !builderOmittedNotes.includes(note));
    
    if (builderSelectionMode === 'chord' || builderSelectionMode === 'interval') {
        const allLhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift);
        const voicedLhNotes = allLhNotes.filter(note => !builderLHOmittedNotes.includes(note));
        allNotes = allNotes.concat(voicedLhNotes);
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
        document.getElementById('builder-lh-type-select').disabled = false;
        document.getElementById('builder-lh-inversion-select').disabled = false;
        document.getElementById('builder-lh-octave-select').disabled = false;
    } else { // 'interval'
        result = getIntervalNotes(rootNote, builderIntervalType, builderOctaveShift);
        notesForHighlight = result.specificNotes;
        document.getElementById('builder-inversion-selector').style.opacity = 0.3;
        document.getElementById('builder-lh-type-select').disabled = false;
        document.getElementById('builder-lh-inversion-select').disabled = false;
        document.getElementById('builder-lh-octave-select').disabled = false;
    }
    
    document.getElementById('builder-chord-name').textContent = result.name;
    document.getElementById('builder-chord-notes').textContent = result.specificNotes.join(' - ');
    
    highlightBuilderNotes(notesForHighlight); 
    updateInversionSelector();
    updateLHInversionSelector();
    updateKeySignatureDisplay(rootNote);
    renderVoicingEditor(notesForHighlight, 'voicing-editor', 'voicing-editor-container', builderOmittedNotes, (note, isOmitted) => {
        builderOmittedNotes = isOmitted ? [...builderOmittedNotes, note] : builderOmittedNotes.filter(n => n !== note);
        updateBuilderDisplay();
    });
    const allLhNotes = getLHNotes(rootNote, document.getElementById('builder-lh-type-select').value, parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0, rootNote, parseInt(document.getElementById('builder-lh-octave-select').value, 10), builderChordType);
    renderVoicingEditor(allLhNotes, 'lh-voicing-editor', 'lh-voicing-editor-container', builderLHOmittedNotes, (note, isOmitted) => {
        builderLHOmittedNotes = isOmitted ? [...builderLHOmittedNotes, note] : builderLHOmittedNotes.filter(n => n !== note);
        updateBuilderDisplay();
    });
}

function renderVoicingEditor(notes, editorId, containerId, omittedNotes, onToggle) {
    const editor = document.getElementById(editorId);
    const editorContainer = document.getElementById(containerId);
    editor.innerHTML = '';

    if (!notes || notes.length === 0) {
        editorContainer.classList.add('hidden');
        return;
    }
    editorContainer.classList.remove('hidden');

    notes.forEach(note => {
        const wrapper = document.createElement('label'); // Use label for better accessibility
        wrapper.className = 'flex items-center gap-2 cursor-pointer text-gray-700';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = note;
        checkbox.checked = !omittedNotes.includes(note);
        checkbox.className = 'w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500';

        checkbox.onchange = () => {
            onToggle(note, !checkbox.checked);
        };

        wrapper.appendChild(checkbox);
        wrapper.append(note);
        editor.appendChild(wrapper);
    });
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
    updateChordSuggestions();
    // The visual state of the toggle is handled by CSS and the checkbox's checked state.
}

function toggleRecording() {
    trainerState.isRecording = !trainerState.isRecording;
    const recordBtn = document.getElementById('record-progression-btn');
    const recordText = document.getElementById('record-text');
    const recordIcon = document.getElementById('record-icon');
    const saveBtn = document.getElementById('save-recording-btn');

    if (trainerState.isRecording) {
        // Start recording
        trainerState.recordedProgression = [];
        trainerState.progressionData = [];
        trainerState.progressionRomans = [];
        renderProgressionDisplay();
        
        recordText.textContent = 'Stop';
        recordBtn.classList.add('animate-pulse');
        recordIcon.innerHTML = '<rect x="7" y="7" width="6" height="6"></rect>'; // Square icon
        saveBtn.disabled = true;

        showModal("Recording started. Play chords on the keyboard.", true);
    } else {
        // Stop recording
        recordText.textContent = 'Record';
        recordBtn.classList.remove('animate-pulse');
        recordIcon.innerHTML = '<circle cx="10" cy="10" r="7"></circle>'; // Circle icon
        saveBtn.disabled = trainerState.recordedProgression.length === 0;

        if (trainerState.recordedProgression.length > 0) {
            showModal("Recording stopped. Press 'Save' to keep the progression.", true);
        }
    }
}

function capturePlayedChord(notes, type = 'Major', inversion = 0) {
    // Basic chord detection from played notes
    const rootNote = notes[0].slice(0, -1);
    const chordType = type;

    const romanNumeral = rootNote; // Use note name for recorded chords

    const newChordData = getProgressionChordNotes(trainerState.currentKey, romanNumeral, chordType, inversion, trainerState.octaveShift);
    if (newChordData) {
        newChordData.lhSetting = 'off';
        newChordData.lhOctaveShift = -12;
        trainerState.recordedProgression.push(newChordData);
        
        // Live update the display as you record
        trainerState.progressionData.push(newChordData);
        renderProgressionDisplay();
    }
}

function saveRecording() {
    document.getElementById('save-recording-btn').disabled = true;
    showModal("Progression saved!", true);
    // The progression is already in trainerState.progressionData, so we just need to finalize it.
}

function addChordToProgression(switchToTrainer = false) {
    const rootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[builderRootIndex];
    if (audioIsReady && cameraShutter) cameraShutter.start(); // Play sound effect only if audio is ready
    
    const lhType = document.getElementById('builder-lh-type-select').value;
    const lhInversion = parseInt(document.getElementById('builder-lh-inversion-select').value, 10) || 0;
    const lhOctaveShift = parseInt(document.getElementById('builder-lh-octave-select').value, 10);
    const omittedNotes = [...builderOmittedNotes]; // Capture current voicing
    const lhOmittedNotes = [...builderLHOmittedNotes]; // Capture LH voicing
    const octaveShift = builderOctaveShift; // Capture current octave shift

    let newChordData;

    if (builderSelectionMode === 'interval') {
        const intervalType = builderIntervalType;
        const result = getIntervalNotes(rootNote, intervalType, octaveShift);
        newChordData = {
            roman: rootNote, // Use root note as the "numeral"
            name: result.name,
            simpleName: INTERVAL_DEFINITIONS[intervalType].symbol || intervalType,
            notes: result.specificNotes,
            root: rootNote,
            type: intervalType,
            inversion: 0, // Not applicable
            selectionMode: 'interval', // NEW: Flag this as an interval
            omittedNotes: omittedNotes, // NEW: Save voicing
            octaveShift: octaveShift, // NEW: Save octave shift
            lhOmittedNotes: lhOmittedNotes
        };
    } else { // It's a chord
        const chordType = builderChordType;
        const inversion = builderInversion;
        const result = getInvertedChordNotes(rootNote, chordType, inversion, trainerState.currentKey, octaveShift);
        newChordData = { 
            name: result.name,
            simpleName: result.simpleName,
            notes: result.specificNotes, // Correctly map specificNotes to notes
            root: rootNote, 
            type: chordType, 
            inversion: inversion, 
            selectionMode: 'chord',
            omittedNotes: omittedNotes, 
            octaveShift: octaveShift };
    }

    const trainerKeyRootIndex = ALL_NOTES.indexOf(trainerState.currentKey);
    // Resolve the root note to its sharp equivalent to find the correct index in ALL_NOTES, which is the canonical list.
    let addedChordRootIndex = ALL_NOTES.indexOf(rootNote);
    if (addedChordRootIndex === -1) addedChordRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[rootNote]);
    if (addedChordRootIndex === -1) return; // Should not happen, but a good safeguard.

    const interval = (addedChordRootIndex - trainerKeyRootIndex + 12) % 12;

    const scaleDegreeIndex = MAJOR_SCALE_STEPS.indexOf(interval);
    
    let romanNumeral = '?';
    if (scaleDegreeIndex !== -1) {
        if (newChordData.selectionMode === 'chord') {
            const romanKeys = Object.keys(ROMAN_MAP_BASE);
            const foundKey = romanKeys.find(key => ROMAN_MAP_BASE[key].index === scaleDegreeIndex && ROMAN_MAP_BASE[key].quality === newChordData.type);
            const fallbackKey = romanKeys.find(key => ROMAN_MAP_BASE[key].index === scaleDegreeIndex);
            romanNumeral = foundKey || fallbackKey || '?';
        } else {
            romanNumeral = rootNote; // Just use the note name for intervals
        }
    } else {
        romanNumeral = rootNote;
    }
    newChordData.roman = romanNumeral;
    newChordData.lhType = lhType;
    newChordData.lhInversion = lhInversion;
    newChordData.lhOmittedNotes = lhOmittedNotes;
    newChordData.rhythmPattern = 'block'; // Default rhythm pattern
    newChordData.isVoicingExpanded = true; // Default to expanded when adding
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
    if (playAudio) builderOmittedNotes = []; // Reset omissions on root change
    if (playAudio) builderLHOmittedNotes = [];
    updateButtonSelection('#builder-note-selector', 'index', index.toString(), 'bg-amber-600', 'text-white');
    updateBuilderDisplay();
    updateKeyboardLabels();
    updateChordTypeButtonCaptions(); 
    updateIntervalButtonCaptions();
    if (playAudio) startBuilderChord(); 
}

function selectBuilderChordType(chordType, playAudio = true, resetVoicing = true, keepVoicingExpanded = false) {
    builderSelectionMode = 'chord';
    builderChordType = chordType;
    if (resetVoicing) builderOmittedNotes = []; // Reset omissions on type change
    if (resetVoicing) builderLHOmittedNotes = [];
    updateButtonSelection('#builder-interval-selector', 'intervalType', null, 'bg-amber-500');
    updateButtonSelection('#builder-chord-type-selector', 'chordType', chordType, 'bg-amber-500', 'text-white');
    updateBuilderDisplay();
    updateChordSuggestions();
    updateChordTypeButtonCaptions(); // Redraw captions after selection
    if (playAudio) startBuilderChord(); 
}

function selectBuilderInterval(intervalType, playAudio = true, resetVoicing = true, keepVoicingExpanded = false) {
    builderSelectionMode = 'interval';
    builderIntervalType = intervalType;
    if (resetVoicing) builderOmittedNotes = []; // Reset omissions on type change
    if (resetVoicing) builderLHOmittedNotes = [];
    updateButtonSelection('#builder-chord-type-selector', 'chordType', null, 'bg-amber-500');
    updateButtonSelection('#builder-interval-selector', 'intervalType', intervalType, 'bg-amber-500', 'text-white');
    updateBuilderDisplay();
    updateIntervalButtonCaptions(); // Redraw captions after selection
    if (playAudio) startBuilderChord();
}

function selectBuilderInversion(inversion, playAudio = true, resetVoicing = true) {
    builderInversion = inversion;
    if (resetVoicing) builderOmittedNotes = []; // Reset omissions on inversion change
    if (resetVoicing) builderLHOmittedNotes = [];
    updateButtonSelection('#builder-inversion-selector', 'inversion', inversion.toString(), 'bg-amber-500', 'text-white');
    updateBuilderDisplay();
    if (playAudio) startBuilderChord(); 
}

function updateButtonSelection(selector, dataAttribute, value, activeClass, activeTextColor = 'text-white') {
    document.querySelectorAll(`${selector} button`).forEach(btn => {
        const isSelected = btn.dataset[dataAttribute] === value;
        if (isSelected) {
            btn.classList.add(activeClass, activeTextColor, 'shadow-md');
            btn.classList.remove('bg-gray-200', 'text-gray-800', 'hover:bg-amber-100');
        } else {
            // Explicitly remove all possible active classes
            btn.classList.remove(activeClass, 'text-white', 'text-gray-900', 'shadow-md', 'bg-amber-600', 'bg-amber-500');
            // Add back the default classes
            btn.classList.add('bg-gray-200', 'text-gray-800', 'hover:bg-amber-100');
        }
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

function updateLHInversionSelector() {
    const lhType = document.getElementById('builder-lh-type-select').value;
    const invSelector = document.getElementById('builder-lh-inversion-select');
    const currentVal = invSelector.value;
    invSelector.innerHTML = '';

    let intervals;
    if (lhType === 'Major' || lhType === 'Minor') {
        intervals = CHORD_DEFINITIONS[lhType].intervals;
    } else if (lhType === 'shell_maj7' || lhType === 'shell_min7') {
        intervals = [0, 4, 11]; // A 3-note chord
    } else if (lhType === 'shell_dom7') {
        intervals = [0, 4, 10]; // A 3-note chord
    } else if (lhType === 'Dominant 7th') {
        intervals = CHORD_DEFINITIONS['Dominant 7th'].intervals;
    } else if (lhType === 'spread') {
        intervals = [0, 7, 16]; // A 3-note chord (R-5-10)
    } else if (lhType === 'quartal') {
        intervals = [0, 5, 10]; // A 3-note chord
    }  else {
        intervals = [0]; // For single notes or simple intervals
    }
    
    const maxInversion = Math.max(0, intervals.length - 1);
    
    INVERSION_NAMES.forEach((name, index) => {
        if (index <= maxInversion) {
            const option = new Option(name, index);
            invSelector.add(option);
        }
    });

    if (currentVal <= maxInversion) {
        invSelector.value = currentVal;
    } else {
        invSelector.value = '0';
    }
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
    
    document.querySelectorAll('#builder-chord-type-selector .key-button-wrapper').forEach(container => {
        const mainButton = container.querySelector('button');
        if (!mainButton) return;

        const chordType = mainButton.dataset.chordType;
        const chordDef = CHORD_DEFINITIONS[chordType] || {};
        const symbolNotation = rootNoteName + (chordDef.symbol || '');
        const primaryText = notationPreference === 'symbol' ? symbolNotation : chordType;
        const secondaryText = notationPreference === 'symbol' ? chordType : symbolNotation;
        
        // Determine secondary text color based on selection
        const isSelected = mainButton.classList.contains('bg-amber-500');
        const secondaryTextColor = isSelected ? 'text-amber-200' : 'text-gray-500';

        mainButton.innerHTML = `<span class="block text-xs font-bold leading-tight pointer-events-none">${primaryText}</span><span class="block ${secondaryTextColor} pointer-events-none" style="font-size: 0.65rem; line-height: 0.9;">${secondaryText}</span>`;
    });
}

function updateIntervalButtonCaptions() {
    document.querySelectorAll('#builder-interval-selector .key-button-wrapper').forEach(container => {
        const mainButton = container.querySelector('button');
        if (!mainButton) return;

        const intervalType = mainButton.dataset.intervalType;
        const intervalDef = INTERVAL_DEFINITIONS[intervalType] || {};
        const symbolNotation = intervalDef.symbol || '';
        const isSelected = mainButton.classList.contains('bg-amber-500');
        const secondaryTextColor = isSelected ? 'text-amber-200' : 'text-gray-500';
        mainButton.innerHTML = `<span class="block text-sm pointer-events-none">${intervalType}</span><span class="block ${secondaryTextColor} text-xs pointer-events-none">${symbolNotation}</span>`;
    });
}

function renderBuilderSelectors() {
    const rootSelector = document.getElementById('builder-note-selector');
    const typeSelector = document.getElementById('builder-chord-type-selector');
    const invSelector = document.getElementById('builder-inversion-selector');
    const intervalSelector = document.getElementById('builder-interval-selector');
    
    const currentNotes = enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    // Always re-render the root note selector to reflect enharmonic preference
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
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'key-button-wrapper flex items-stretch rounded-lg shadow-sm overflow-hidden bg-gray-200 transition duration-150 transform hover:scale-105';

                    // Main button for block chord
                    const mainButton = document.createElement('button');
                    mainButton.className = 'flex-grow px-2 py-2 text-center font-medium text-gray-800 hover:bg-amber-100';
                    mainButton.dataset.chordType = chordType; // For selection highlighting
                    mainButton.title = CHORD_DEFINITIONS[chordType].description || '';
                    mainButton.onmousedown = () => selectBuilderChordType(chordType, true);
                    mainButton.onmouseup = () => stopBuilderChord();
                    mainButton.onmouseleave = () => stopBuilderChord();
                    buttonContainer.appendChild(mainButton);

                    // Container for arpeggio buttons
                    const arpContainer = document.createElement('div');
                    arpContainer.className = 'flex flex-col w-10 border-l border-gray-300';

                    // Arp Up button
                    const arpUp = document.createElement('button');
                    arpUp.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800 border-b border-gray-300';
                    arpUp.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path></svg>';
                    arpUp.title = 'Play Ascending Arpeggio';
                    arpUp.onmousedown = (e) => { e.stopPropagation(); playArpeggio('chord', chordType, 'up'); };
                    arpUp.onmouseup = stopArpeggio;
                    arpUp.onmouseleave = stopArpeggio;
                    arpContainer.appendChild(arpUp);

                    // Arp Down button
                    const arpDown = document.createElement('button');
                    arpDown.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800';
                    arpDown.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
                    arpDown.title = 'Play Descending Arpeggio';
                    arpDown.onmousedown = (e) => { e.stopPropagation(); playArpeggio('chord', chordType, 'down'); };
                    arpDown.onmouseup = stopArpeggio;
                    arpDown.onmouseleave = stopArpeggio;
                    arpContainer.appendChild(arpDown);

                    buttonContainer.appendChild(arpContainer);
                    buttonGrid.appendChild(buttonContainer);
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
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'key-button-wrapper flex items-stretch rounded-lg shadow-sm overflow-hidden bg-gray-200 transition duration-150 transform hover:scale-105';

                    // Main button for block interval
                    const mainButton = document.createElement('button');
                    mainButton.className = 'flex-grow px-2 py-2 text-center font-medium text-gray-800 hover:bg-amber-100';
                    mainButton.dataset.intervalType = intervalType;
                    mainButton.title = INTERVAL_DEFINITIONS[intervalType].description || '';
                    mainButton.onmousedown = () => selectBuilderInterval(intervalType, true);
                    mainButton.onmouseup = () => stopBuilderChord();
                    mainButton.onmouseleave = () => stopBuilderChord();
                    buttonContainer.appendChild(mainButton);

                    // Container for arpeggio buttons
                    const arpContainer = document.createElement('div');
                    arpContainer.className = 'flex flex-col w-10 border-l border-gray-300';

                    // Arp Up button
                    const arpUp = document.createElement('button');
                    arpUp.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800 border-b border-gray-300';
                    arpUp.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path></svg>';
                    arpUp.title = 'Play Ascending Arpeggio';
                    arpUp.onmousedown = (e) => { e.stopPropagation(); playArpeggio('interval', intervalType, 'up'); };
                    arpUp.onmouseup = stopArpeggio;
                    arpUp.onmouseleave = stopArpeggio;
                    arpContainer.appendChild(arpUp);

                    // Arp Down button
                    const arpDown = document.createElement('button');
                    arpDown.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800';
                    arpDown.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
                    arpDown.title = 'Play Descending Arpeggio';
                    arpDown.onmousedown = (e) => { e.stopPropagation(); playArpeggio('interval', intervalType, 'down'); };
                    arpDown.onmouseup = stopArpeggio;
                    arpDown.onmouseleave = stopArpeggio;
                    arpContainer.appendChild(arpDown);

                    buttonContainer.appendChild(arpContainer);
                    buttonGrid.appendChild(buttonContainer);
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
    updateLHInversionSelector();
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
    let mapEntry = ROMAN_MAP_BASE[romanNumeral];
    let chordRootNote = '';

    // If the roman numeral isn't standard (e.g., it's a note name like 'Db'),
    // we handle it as a non-diatonic chord.
    if (!mapEntry) {
        chordRootNote = romanNumeral; // The 'romanNumeral' is actually the root note.
    } else {
        let scaleRootIndex = ALL_NOTES.indexOf(key);
        if (scaleRootIndex === -1) scaleRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[key]);
        
        const scaleStep = MAJOR_SCALE_STEPS[mapEntry.index];
        const chordRootIndex = (scaleRootIndex + scaleStep) % 12;
        chordRootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[chordRootIndex];
    }

    if (!chordRootNote) {
        return null; // Could not determine root note
    }

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
        romanEl.className = 'font-mono font-bold text-lg text-indigo-700 leading-none';
        romanEl.textContent = chordData.roman;
        nameContainer.appendChild(romanEl);

        const simpleNameEl = document.createElement('span');
        simpleNameEl.className = 'px-2 font-sans text-xs text-gray-500 leading-none';
        simpleNameEl.textContent = chordData.simpleName || ''; 
        nameContainer.appendChild(simpleNameEl);

        header.appendChild(nameContainer); 
        
        // Container for right-side controls (Play and Delete)
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'flex items-center gap-2';

        const playBtn = document.createElement('button');
        playBtn.innerHTML = '<svg class="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z"></path></svg>Play';
        playBtn.className = 'px-2 py-1 text-xs font-semibold bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 active:bg-indigo-300 transition';
        playBtn.onmousedown = (e) => { e.stopPropagation(); playProgressionChord(index, false); };
        playBtn.onmouseup = () => stopTrainerChord();
        playBtn.onmouseleave = () => stopTrainerChord();
        controlsContainer.appendChild(playBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
        deleteBtn.className = 'p-1 text-gray-400 rounded-full hover:bg-gray-200 hover:text-gray-600 transition';
        deleteBtn.title = 'Remove Chord';
        // Stop propagation on mousedown to prevent the card's play function from firing.
        deleteBtn.onmousedown = (e) => {
            e.stopPropagation();
        };
        deleteBtn.onclick = () => removeChordFromProgression(index);

        controlsContainer.appendChild(deleteBtn);
        header.appendChild(controlsContainer);

        // The card itself is no longer clickable for playback, only for dragging
        card.title = `Drag to reorder ${chordData.simpleName}`;
        card.style.cursor = 'grab';

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

        // NEW: Voicing editor for each chord card
        const editor = document.createElement('div');
        editor.className = 'flex flex-wrap gap-x-3 gap-y-1 items-center p-2 mt-2 rounded-lg bg-gray-50 border';

        const voicingLabel = document.createElement('h4');
        voicingLabel.className = 'w-full text-xs font-semibold text-indigo-600 mb-1';
        voicingLabel.textContent = 'Voicing';
        editor.appendChild(voicingLabel);

        // Create a dedicated container for the checkboxes to ensure proper wrapping
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'w-full flex flex-wrap gap-x-3 gap-y-1 mb-2';

        // Use the 'notes' property from chordData for creating checkboxes
        const notesForVoicing = chordData.notes || [];
        notesForVoicing.forEach(note => {
            const wrapper = document.createElement('label');
            wrapper.className = 'flex items-center gap-1 cursor-pointer text-gray-700 text-xs';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = note;
            checkbox.checked = !(chordData.omittedNotes || []).includes(note);
            checkbox.className = 'w-3 h-3 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500';
            checkbox.onchange = () => toggleProgressionNote(index, note);
            wrapper.appendChild(checkbox);
            wrapper.append(note);
            checkboxContainer.appendChild(wrapper);
        });
        editor.appendChild(checkboxContainer);

        const invSelect = document.createElement('select');
        invSelect.className = 'w-full p-1 text-xs border border-gray-300 rounded mt-2';
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
        
        const invLabel = document.createElement('label');
        invLabel.className = 'block text-xs font-medium text-gray-600 mt-2';
        invLabel.textContent = 'Inversion:';
        editor.appendChild(invLabel);
        editor.appendChild(invSelect);
        
        const octLabel = document.createElement('label');
        octLabel.className = 'block text-xs font-medium text-gray-600 mt-2';
        octLabel.textContent = 'Octave Shift:';
        editor.appendChild(octLabel);

        const octSelect = document.createElement('select');
        octSelect.className = 'w-full p-1 text-xs border border-gray-300 rounded';
        for (let i = -3; i <= 3; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i > 0 ? '+' : ''}${i}`;
            if (i === (chordData.octaveShift || 0)) option.selected = true;
            octSelect.appendChild(option);
        }
        octSelect.onchange = (e) => updateProgressionChord(index, 'octaveShift', parseInt(e.target.value));
        octSelect.onmousedown = (e) => e.stopPropagation();
        octSelect.style.cursor = 'default';
        editor.appendChild(octSelect);

        card.appendChild(editor);

        // NEW: Add a label for the LH controls to improve clarity
        const lhLabel = document.createElement('div');
        lhLabel.className = 'text-xs text-gray-500 font-medium mt-2';
        lhLabel.textContent = 'LH Accomp.';
        card.appendChild(lhLabel);

        const lhContainer = document.createElement('div');
        lhContainer.className = 'p-2 mt-1 rounded-lg bg-gray-50 border';

        const lhControlGrid = document.createElement('div');
        lhControlGrid.className = 'grid grid-cols-2 gap-x-2 gap-y-1 items-end';

        // LH Type Dropdown
        const lhTypeWrapper = document.createElement('div');
        lhTypeWrapper.className = 'col-span-2'; // Make it span full width
        const lhTypeLabel = document.createElement('label');
        lhTypeLabel.className = 'block text-xs font-medium text-gray-600';
        lhTypeLabel.textContent = 'LH Type';
        const lhTypeSelect = document.createElement('select');
        lhTypeSelect.className = 'w-full p-1 text-xs border border-gray-300 rounded';
        lhTypeSelect.innerHTML = document.getElementById('builder-lh-type-select').innerHTML;
        lhTypeSelect.value = chordData.lhType || 'off';
        lhTypeSelect.onchange = (e) => updateProgressionChordLH(index, 'lhType', e.target.value);
        lhTypeSelect.onmousedown = (e) => e.stopPropagation();
        lhTypeWrapper.appendChild(lhTypeLabel);
        lhTypeWrapper.appendChild(lhTypeSelect);
        lhControlGrid.appendChild(lhTypeWrapper);

        // LH Inversion Dropdown
        const lhInvWrapper = document.createElement('div');
        lhInvWrapper.className = 'col-span-2'; // Make it span full width
        const lhInvLabel = document.createElement('label');
        lhInvLabel.className = 'block text-xs font-medium text-gray-600';
        lhInvLabel.textContent = 'LH Inversion';
        const lhInversionSelect = document.createElement('select');
        lhInversionSelect.className = 'w-full p-1 text-xs border border-gray-300 rounded';
        const maxInversion = getMaxInversionForLhType(chordData.lhType);
        for (let i = 0; i <= maxInversion; i++) {
            lhInversionSelect.add(new Option(INVERSION_NAMES[i], i));
        }
        lhInversionSelect.value = chordData.lhInversion || 0;
        lhInversionSelect.onchange = (e) => updateProgressionChordLH(index, 'lhInversion', e.target.value);
        lhInversionSelect.onmousedown = (e) => e.stopPropagation();
        lhInvWrapper.appendChild(lhInvLabel);
        lhInvWrapper.appendChild(lhInversionSelect);
        lhControlGrid.appendChild(lhInvWrapper);

        // LH Octave Dropdown
        const lhOctWrapper = document.createElement('div');
        lhOctWrapper.className = 'col-span-2'; // Make it span full width
        const lhOctLabel = document.createElement('label');
        lhOctLabel.className = 'block text-xs font-medium text-gray-600';
        lhOctLabel.textContent = 'LH Octave';
        const lhOctaveSelect = document.createElement('select');
        lhOctaveSelect.className = 'w-full p-1 text-xs border border-gray-300 rounded';
        lhOctaveSelect.innerHTML = document.getElementById('builder-lh-octave-select').innerHTML;
        lhOctaveSelect.value = chordData.lhOctaveShift || '-12';
        lhOctaveSelect.onchange = (e) => updateProgressionChordLH(index, 'lhOctaveShift', parseInt(e.target.value, 10));
        lhOctaveSelect.onmousedown = (e) => e.stopPropagation();
        lhOctWrapper.appendChild(lhOctLabel);
        lhOctWrapper.appendChild(lhOctaveSelect);
        lhControlGrid.appendChild(lhOctWrapper);

        lhContainer.appendChild(lhControlGrid);

        // Add LH Voicing Editor to the card
        const lhVoicingEditor = document.createElement('div');
        lhVoicingEditor.className = 'flex flex-wrap gap-x-3 gap-y-1 items-center p-2 mt-2 rounded-lg bg-gray-100 border-t';
        const allLhNotes = getLHNotes(chordData.root, chordData.lhType, chordData.lhInversion, trainerState.currentKey, chordData.lhOctaveShift);
        
        if (allLhNotes.length > 0) {
            allLhNotes.forEach(note => {
                const wrapper = document.createElement('label');
                wrapper.className = 'flex items-center gap-1 cursor-pointer text-gray-700 text-xs';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = note;
                checkbox.checked = !(chordData.lhOmittedNotes || []).includes(note);
                checkbox.className = 'w-3 h-3 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500';
                checkbox.onchange = () => toggleProgressionLHNote(index, note);
                wrapper.appendChild(checkbox);
                wrapper.append(note);
                lhVoicingEditor.appendChild(wrapper);
            });
            lhContainer.appendChild(lhVoicingEditor);
        }

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

function toggleProgressionNote(chordIndex, note) {
    const chordData = trainerState.progressionData[chordIndex];
    if (!chordData) return;

    // Ensure omittedNotes array exists
    if (!chordData.omittedNotes) {
        chordData.omittedNotes = [];
    }

    const noteOmitIndex = chordData.omittedNotes.indexOf(note);
    if (noteOmitIndex > -1) {
        chordData.omittedNotes.splice(noteOmitIndex, 1); // Note was omitted, so un-omit it
    } else {
        chordData.omittedNotes.push(note); // Note was played, so omit it
    }
}

function toggleProgressionLHNote(chordIndex, note) {
    const chordData = trainerState.progressionData[chordIndex];
    if (!chordData) return;

    if (!chordData.lhOmittedNotes) {
        chordData.lhOmittedNotes = [];
    }

    const noteOmitIndex = chordData.lhOmittedNotes.indexOf(note);
    if (noteOmitIndex > -1) {
        chordData.lhOmittedNotes.splice(noteOmitIndex, 1);
    } else {
        chordData.lhOmittedNotes.push(note);
    }
}

function getMaxInversionForLhType(lhType) {
    let intervals;
    if (lhType === 'Major' || lhType === 'Minor' || lhType === 'Dominant 7th') {
        intervals = CHORD_DEFINITIONS[lhType].intervals;
    } else if (lhType === 'shell_maj7' || lhType === 'shell_min7' || lhType === 'shell_dom7') {
        intervals = [0, 4, 11]; // All shells are 3-note chords
    } else {
        intervals = [0]; // For single notes or simple intervals
    }
    return Math.max(0, (intervals || [0]).length - 1);
}

function updateProgressionChordLH(index, property, value) {
    if (!trainerState.progressionData[index]) return;
    trainerState.progressionData[index][property] = property.includes('Inversion') || property.includes('Octave') ? parseInt(value, 10) : value;

    // If the LH type is changed, reset the inversion to Root.
    if (property === 'lhType') {
        trainerState.progressionData[index].lhInversion = 0;
    }

    const chord = trainerState.progressionData[index];
    const lhNotes = getLHNotes(chord.root, chord.lhType, chord.lhInversion, trainerState.currentKey, chord.lhOctaveShift);
    playTrainerChordOnce(chord.notes.concat(lhNotes));
    renderProgressionDisplay(); // Re-render to update inversion dropdown if needed
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
    } else if (property === 'octaveShift') {
        chordState.octaveShift = value;
    } else if (property === 'rhythmPattern') {
        chordState.rhythmPattern = value;
    }
    
    const newData = getProgressionChordNotes(
        trainerState.currentKey, chordState.roman, chordState.type, 
        chordState.inversion, chordState.octaveShift 
    );
    
    if (newData) {
        // Preserve properties that aren't recalculated
        newData.isVoicingExpanded = chordState.isVoicingExpanded;
        newData.lhType = chordState.lhType;
        newData.lhInversion = chordState.lhInversion;
        newData.lhOctaveShift = chordState.lhOctaveShift;
        newData.omittedNotes = chordState.omittedNotes; // Preserve custom voicing
        newData.octaveShift = chordState.octaveShift; // Preserve octave shift
        newData.rhythmPattern = chordState.rhythmPattern; // Preserve rhythm
        trainerState.progressionData[index] = newData;
        renderProgressionDisplay();
    }
    
    const lhNotes = getLHNotes(newData.root, newData.lhType, newData.lhInversion, trainerState.currentKey, newData.lhOctaveShift);
    
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
    // DESTRUCTURE ALL SAVED PROPERTIES
    const { lhType, lhInversion, lhOctaveShift, omittedNotes = [], lhOmittedNotes = [], octaveShift = 0 } = chord;
    
    // USE THE CHORD'S SAVED OCTAVE SHIFT, NOT THE GLOBAL TRAINER ONE
    const allLhNotes = getLHNotes(chord.root, lhType, lhInversion, trainerState.currentKey, lhOctaveShift);

    // Highlight the current card
    document.querySelectorAll('#progression-visualization > div').forEach((card, cardIndex) => {
        card.classList.toggle('active-progression-card', cardIndex === index);
    });
    
    
    // NEW: Apply saved voicing from the chord data
    const voicedNotes = chord.notes.filter(note => !omittedNotes.includes(note));
    const lhNotes = allLhNotes.filter(note => !lhOmittedNotes.includes(note));
    const allNotes = voicedNotes.concat(lhNotes);
    
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
    
    // Clear any existing card highlights
    document.querySelectorAll('.active-progression-card').forEach(card => card.classList.remove('active-progression-card'));

    trainerState.scaleNotes = calculateScaleNotes(trainerState.currentKey, 4, trainerState.octaveShift);
    
    // Always regenerate the progression data when loading a new one from the dropdown.
    trainerState.progressionData = trainerState.progressionRomans.map(roman => {
        const baseInfo = ROMAN_MAP_BASE[roman];
        const chordType = baseInfo ? baseInfo.quality : 'Major';
        const chordData = getProgressionChordNotes(trainerState.currentKey, roman, chordType, 0, trainerState.octaveShift);
        if (chordData) {
            // Set default LH settings for newly loaded progressions
            chordData.lhType = 'off';
            chordData.lhInversion = 0;
            chordData.lhOctaveShift = -12;
            chordData.lhOmittedNotes = [];
            chordData.rhythmPattern = 'block';
            
            chordData.selectionMode = 'chord';
            chordData.omittedNotes = [];
            chordData.octaveShift = 0;
        }
        return chordData;
    }).filter(Boolean); // Remove any nulls if getProgressionChordNotes fails
    
    updateProgressionControlsUI();
    renderProgressionDisplay();
    highlightTrainer(trainerState.scaleNotes, null);
    updateKeyboardLabels();
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
        Tone.Transport.cancel(); // Clear all scheduled events
        if(scalePlaySequence) scalePlaySequence.stop();
        trainerState.isPlaying = false;
        trainerState.currentIndex = 0;
        document.getElementById('progression-chord-notes-display').textContent = 'Playback Stopped (Reset)';
        highlightTrainer(trainerState.scaleNotes, null);
        // Clear card highlights on stop
        document.querySelectorAll('.active-progression-card').forEach(card => card.classList.remove('active-progression-card'));
        updateProgressionControlsUI();
        return;
    }

    // NEW: Always start playback from the first chord.
    trainerState.currentIndex = 0;

    if (trainerState.currentIndex >= trainerState.progressionData.length) {
        trainerState.currentIndex = 0;
    }
    
    trainerState.isPlaying = true;
    updateProgressionControlsUI();

    // Stop any previous parts and clear the transport
    if (trainerState.transportId) {
        trainerState.transportId.stop(0).dispose();
    }
    Tone.Transport.cancel();

    const speedValue = document.getElementById('trainer-speed-select').value;
    const measureDuration = `${speedValue}m`;

    let allEvents = [];
    trainerState.progressionData.forEach((chord, index) => {
        const measure = index;
        const allLhNotes = getLHNotes(chord.root, chord.lhType, chord.lhInversion, trainerState.currentKey, chord.lhOctaveShift || -12);
        const lhNotes = allLhNotes.filter(note => !(chord.lhOmittedNotes || []).includes(note));
        const rhNotes = chord.notes.filter(note => !(chord.omittedNotes || []).includes(note));

        allEvents.push(...generateRhythmicEvents(rhNotes, lhNotes, measure, chord.rhythmPattern || 'block'));

        // Schedule visual updates per measure
        Tone.Transport.scheduleOnce(time => {
            Tone.Draw.schedule(() => {
                document.querySelectorAll('#progression-visualization > div').forEach((card, cardIndex) => {
                    card.classList.toggle('active-progression-card', cardIndex === index);
                });
                document.getElementById('progression-chord-notes-display').textContent = `${chord.roman} (${chord.name})`;
                highlightTrainer(trainerState.scaleNotes, rhNotes.concat(lhNotes));
            }, time);
        }, `${measure}m`);
    });

    trainerState.transportId = new Tone.Part((time, event) => {
        const notes = Array.isArray(event.note) ? event.note : [event.note];
        piano.triggerAttackRelease(notes, event.duration, time, event.velocity);

        // Schedule visual flash for rhythmic events
        Tone.Draw.schedule(() => {
            notes.forEach(note => {
                const keyEl = document.getElementById(getNoteKeyId(note));
                if (keyEl) keyEl.classList.add('active-progression');
            });
        }, time);
        Tone.Draw.schedule(() => {
            notes.forEach(note => {
                const keyEl = document.getElementById(getNoteKeyId(note));
                if (keyEl) keyEl.classList.remove('active-progression');
            });
        }, time + Tone.Time(event.duration).toSeconds() * 0.9);
    }, allEvents).start(0);

    // Schedule the cleanup at the end of the entire sequence
    const totalDuration = trainerState.progressionData.length * Tone.Time(measureDuration).toSeconds();
    Tone.Transport.scheduleOnce(() => {
        trainerState.isPlaying = false;
        trainerState.currentIndex = 0;
        if (trainerState.transportId) {
            trainerState.transportId.stop(0).dispose();
            trainerState.transportId = null;
        }
        updateProgressionControlsUI();
        document.querySelectorAll('.active-progression-card').forEach(card => card.classList.remove('active-progression-card'));
        document.getElementById('progression-chord-notes-display').textContent = 'Progression Finished';
        highlightTrainer(trainerState.scaleNotes, null); // Clear highlights at the end
        Tone.Transport.stop();
        Tone.Transport.cancel();
    }, totalDuration);

    Tone.Transport.start();
}

function generateRhythmicEvents(rhNotes, lhNotes, measure, pattern) {
    const events = [];
    const time = (beats) => `${measure}:${beats}`;

    switch (pattern) {
        case 'arpeggioUp':
            rhNotes.forEach((note, i) => events.push({ time: time(i), note, duration: '8n', velocity: 0.9 }));
            if (lhNotes.length > 0) events.push({ time: time(0), note: lhNotes, duration: '2n', velocity: 0.6 });
            break;
        case 'arpeggioDown':
            [...rhNotes].reverse().forEach((note, i) => events.push({ time: time(i), note, duration: '8n', velocity: 0.9 }));
            if (lhNotes.length > 0) events.push({ time: time(0), note: lhNotes, duration: '2n', velocity: 0.6 });
            break;
        case 'albertiBass':
            if (lhNotes.length >= 3) {
                const sortedLh = [...lhNotes].sort((a, b) => noteToMidi(a) - noteToMidi(b));
                const [low, mid, high] = sortedLh;
                const albertiPattern = [low, high, mid, high];
                albertiPattern.forEach((note, i) => events.push({ time: time(i), note, duration: '8n', velocity: 0.7 }));
            } else if (lhNotes.length > 0) { // Fallback for 1-2 note chords
                events.push({ time: time(0), note: lhNotes, duration: '2n', velocity: 0.6 });
            }
            if (rhNotes.length > 0) events.push({ time: time(0), note: rhNotes, duration: '2n', velocity: 0.9 });
            break;
        case 'block':
        default:
            if (rhNotes.length > 0) events.push({ time: time(0), note: rhNotes, duration: '1m', velocity: 0.9 });
            if (lhNotes.length > 0) events.push({ time: time(0), note: lhNotes, duration: '1m', velocity: 0.7 });
            break;
    }
    return events;
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

function changeScaleSpeed(direction) {
    const speedLabels = Object.keys(ARPEGGIO_SPEEDS);
    let currentIndex = speedLabels.indexOf(scaleSpeed);

    if (direction === 'faster') {
        currentIndex = Math.min(speedLabels.length - 1, currentIndex + 1);
    } else {
        currentIndex = Math.max(0, currentIndex - 1);
    }
    scaleSpeed = speedLabels[currentIndex];
    updateScaleSpeedUI();
}

function updateScaleSpeedUI() {
    const display = document.getElementById('scale-speed-display');
    const speedLabels = Object.keys(ARPEGGIO_SPEEDS);
    const currentIndex = speedLabels.indexOf(scaleSpeed);

    display.textContent = scaleSpeed;
    document.getElementById('scale-speed-down').disabled = currentIndex === 0;
    document.getElementById('scale-speed-up').disabled = currentIndex === speedLabels.length - 1;
}

function playScale(direction = 'asc') {
    initAudio();
    if (!audioIsReady) return;
    
    forceStopAllPlayback();
    
    const rootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[scaleRootIndex];
    const scaleNotes = getScaleNotes(rootNote, scaleType, scaleOctaveShift);
    
    if (direction === 'desc') {
        scaleNotes.reverse();
    }

    highlightScaleNotes(scaleNotes);

    const speedValue = ARPEGGIO_SPEEDS[scaleSpeed];
    const noteDurationSeconds = Tone.Time(speedValue).toSeconds();
    
    scalePlaySequence = new Tone.Sequence((time, note) => {
        piano.triggerAttackRelease(note, speedValue, time);
        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(getNoteKeyId(note));
            if (keyEl) keyEl.classList.add('active-scale-playback');
        }, time);
        Tone.Draw.schedule(() => {
            const keyEl = document.getElementById(getNoteKeyId(note));
            if (keyEl) keyEl.classList.remove('active-scale-playback');
        }, time + noteDurationSeconds * 0.9);
    }, scaleNotes, speedValue).start(0);

    Tone.Transport.start();

    Tone.Transport.scheduleOnce(time => {
        scalePlaySequence.stop().dispose();
        scalePlaySequence = null;
        Tone.Transport.stop();
        Tone.Draw.schedule(() => {
            highlightScaleNotes(scaleNotes);
        }, time);
    }, scaleNotes.length * noteDurationSeconds);
}

function renderScaleSelectors() {
    const rootSelector = document.getElementById('scale-note-selector');
    const typeSelector = document.getElementById('scale-type-selector');
    
    const currentNotes = enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    // Always re-render the root note selector to reflect enharmonic preference
    rootSelector.innerHTML = '';
    currentNotes.forEach((note, index) => {
        const button = document.createElement('button');
        button.textContent = note;
        button.dataset.index = index; 
        button.onclick = () => selectScaleRootNote(index); 
        button.className = `key-button px-1 py-2 font-semibold rounded-lg transition duration-150 transform hover:scale-105 text-xs bg-gray-200 text-gray-800 hover:bg-lime-100`;
        rootSelector.appendChild(button);
    });

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
    enharmonicPreference = toggle.checked ? 'flat' : 'sharp'; // REVERSED: checked = flat, unchecked = sharp
    
    // Update indicator colors
    const sharpIndicator = document.getElementById('sharp-indicator');
    const flatIndicator = document.getElementById('flat-indicator');
    
    if (enharmonicPreference === 'sharp') {
        sharpIndicator.classList.remove('text-gray-500');
        sharpIndicator.classList.add('text-indigo-300');
        flatIndicator.classList.remove('text-indigo-300');
        flatIndicator.classList.add('text-gray-500');
    } else {
        flatIndicator.classList.remove('text-gray-500');
        flatIndicator.classList.add('text-indigo-300');
        sharpIndicator.classList.remove('text-indigo-300');
        sharpIndicator.classList.add('text-gray-500');
    }
    
    refreshAllTabs();
}

function toggleNotationStyle() {
    const toggle = document.getElementById('notation-toggle');
    notationPreference = toggle.checked ? 'symbol' : 'full';

    updateBuilderDisplay();
    updateChordTypeButtonCaptions();
    if (trainerState.isReady) {
        loadProgression();
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
}

function switchTab(tabId) {
    const tabs = ['builder', 'trainer', 'scales'];
    tabs.forEach(id => {
        document.getElementById(`tab-${id}`).classList.toggle('hidden', id !== tabId);
        document.getElementById(`sidebar-btn-${id}`).classList.toggle('bg-indigo-500', id === tabId);
        document.getElementById(`sidebar-btn-${id}`).classList.toggle('hover:bg-gray-700', id !== tabId);
        document.getElementById(`header-tab-btn-${id}`).classList.toggle('bg-indigo-500', id === tabId);
        document.getElementById(`header-tab-btn-${id}`).classList.toggle('text-white', id === tabId);
        document.getElementById(`header-tab-btn-${id}`).classList.toggle('text-gray-500', id !== tabId);
        document.getElementById(`header-tab-btn-${id}`).classList.toggle('hover:bg-gray-200', id !== tabId);
        
        if (id === tabId) {
            currentTab = id;
        }
    });
    
    clearHighlights();
    forceStopAllPlayback();
    
    // Restore visibility logic for the correct display panel
    document.getElementById('builder-info-display').classList.toggle('hidden', tabId !== 'builder');
    document.getElementById('progression-chord-display').classList.toggle('hidden', tabId !== 'trainer');
    document.getElementById('scale-info-display').classList.toggle('hidden', tabId !== 'scales');

    // NEW: Manage visibility of floating controls
    document.getElementById('floating-builder-controls').classList.toggle('hidden', tabId !== 'builder');
    document.getElementById('floating-trainer-controls').classList.toggle('hidden', tabId !== 'trainer');
    document.getElementById('floating-scale-controls').classList.toggle('hidden', tabId !== 'scales');

    // NEW: Show/hide the correct action button containers
    const builderActions = document.getElementById('builder-actions-container');
    const trainerActions = document.getElementById('trainer-main-actions'); // The container inside the trainer tab
    const builderCentral = document.getElementById('builder-central-actions');
    const scaleCentral = document.getElementById('scale-central-actions');
    const builderOctave = document.getElementById('builder-octave-controls-container');
    const trainerOctave = document.getElementById('trainer-octave-controls-container');
    const scaleOctave = document.getElementById('scale-octave-controls-container');
    
    if (tabId === 'builder') {
        updateBuilderDisplay();
        updateKeyboardLabels();
    } else if (tabId === 'trainer') {
        updateKeyboardLabels();
        if (trainerState.scaleNotes && trainerState.scaleNotes.length > 0) {
            highlightTrainer(trainerState.scaleNotes, null);
            updateKeySignatureText(trainerState.currentKey);
        } else {
            loadProgression();
        }
    } else if (tabId === 'scales') {
        updateKeyboardLabels(); // Clear labels
        updateScaleDisplay();
    }

    // Update the main page title
    const mainTitle = document.getElementById('main-title');
    const baseTitle = "Interactive Music Theory Lab";
    let tabTitle = "";
    if (tabId === 'builder') {
        tabTitle = "Chord Builder";
    } else if (tabId === 'trainer') {
        tabTitle = "Progression Builder";
    } else if (tabId === 'scales') {
        tabTitle = "Scale Explorer";
    }
    mainTitle.innerHTML = `${baseTitle}:<br><span class="text-xl sm:text-2xl font-extrabold text-indigo-700">${tabTitle}</span>`;

    // Close sidebar after selection
    if (document.getElementById('sidebar').classList.contains('-translate-x-full') === false) toggleSidebar();
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
            const noteNameLabel = document.createElement('span');
            noteNameLabel.className = 'key-label-note text-gray-500 text-xs absolute bottom-1';
            if (keyData.name.includes('C')) {
                 noteNameLabel.textContent = keyData.name;
            }
            keyEl.appendChild(noteNameLabel);
        } else {
            keyEl.className = 'key black-key';
            keyEl.style.width = `${blackKeyWidth}%`;
        }

        const romanLabel = document.createElement('span');
        romanLabel.className = 'key-label-roman text-indigo-700 text-xs font-bold absolute top-1 left-1/2 -translate-x-1/2 pointer-events-none';
        keyEl.appendChild(romanLabel);
        
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
            keyEl.classList.add('active-builder-playback');

            // If recording on the trainer tab, treat single note as a simple chord root
            if (trainerState.isRecording && currentTab === 'trainer') {
                // We can capture single notes as the root of a default chord
                capturePlayedChord([keyData.name]);
            }
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

function updateKeyboardLabels() {
    const diatonicNumerals = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

    // Clear all existing labels first
    document.querySelectorAll('.key-label-roman').forEach(label => {
        label.textContent = '';
        label.classList.remove('text-white', 'text-indigo-700');
    });

    if (!isRomanNumeralEngineOn) {
        return; // Exit if the feature is turned off
    }

    let rootNoteName;
    if (currentTab === 'trainer' && trainerState.isReady) {
        rootNoteName = trainerState.currentKey;
    } else if (currentTab === 'builder') {
        rootNoteName = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[builderRootIndex];
    } else {
        return; // Don't show labels on other tabs
    }

    const keyRootIndex = ALL_NOTES.indexOf(rootNoteName);
    if (keyRootIndex === -1) return;

    g_KeyboardKeys.forEach(keyData => {
        const keyEl = document.getElementById(getNoteKeyId(keyData.name));
        if (!keyEl) return;

        const noteIndex = ALL_NOTES.indexOf(keyData.baseName);
        if (noteIndex === -1) return;

        const interval = (noteIndex - keyRootIndex + 12) % 12;
        const scaleDegreeIndex = MAJOR_SCALE_STEPS.indexOf(interval);

        if (scaleDegreeIndex !== -1) {
            const label = keyEl.querySelector('.key-label-roman');
            if (label) {
                label.textContent = diatonicNumerals[scaleDegreeIndex];
                if (keyData.type === 'black') {
                    label.classList.add('text-white');
                } else {
                    label.classList.add('text-indigo-700');
                }
            }
        }
    });
}

function toggleRomanNumeralEngine() {
    const toggle = document.getElementById('roman-numeral-toggle');
    isRomanNumeralEngineOn = toggle.checked;
    updateKeyboardLabels();
}

function toggleCompactControls() {
    isCompactModeOn = document.getElementById('compact-controls-toggle').checked;
    document.body.classList.toggle('compact-mode', isCompactModeOn);

    // Force a re-render of the current tab's floating controls to apply new sizing/visibility
    switchTab(currentTab); 

    localStorage.setItem('isCompactModeOn', isCompactModeOn);
}

function toggleFloatingControls() {
    const builderControls = document.getElementById('floating-builder-controls');
    const trainerControls = document.getElementById('floating-trainer-controls');
    const scaleControls = document.getElementById('floating-scale-controls');
    const expandButton = document.getElementById('expand-controls-btn');

    isFloatingControlsVisible = !isFloatingControlsVisible;

    builderControls.classList.toggle('hidden', !isFloatingControlsVisible);
    trainerControls.classList.toggle('hidden', !isFloatingControlsVisible);
    scaleControls.classList.toggle('hidden', !isFloatingControlsVisible);

    expandButton.classList.toggle('rotate-45', isFloatingControlsVisible);
    expandButton.title = isFloatingControlsVisible ? 'Hide Floating Controls' : 'Show Floating Controls';

    localStorage.setItem('isFloatingControlsVisible', isFloatingControlsVisible);
}

function resumeAudioContext() {
    if (Tone && Tone.context.state !== 'running') {
        Tone.context.resume();
    }
}

function startAudioAndLoad() {
    Tone.start().then(() => {
        initAudio();
    }).catch(e => {
        console.error("Could not start audio context:", e);
        showModal("Audio could not be started. Please interact with the page and try again.", true);
    });
}
// Initialization
window.onload = () => {
    renderKeyboard();
    renderProgressionControls();
    renderBuilderSelectors();
    renderScaleSelectors();
    
    document.getElementById('enharmonic-toggle').checked = false;
    document.getElementById('notation-toggle').checked = false;
    document.getElementById('suggestion-toggle').checked = false;
    document.getElementById('roman-numeral-toggle').checked = false;
    document.getElementById('compact-controls-toggle').checked = false;
    
    loadProgression(); // Initialize trainer state on page load
    switchTab('builder');
    updateKeyboardLabels();
    updateLHInversionSelector(); // Initialize LH inversion dropdown

    updateBuilderOctaveUI();
    updateScaleOctaveUI();
    updateScaleSpeedUI();
    updateArpeggioSpeedUI();

    // Load saved state for floating controls visibility
    const savedVisibility = localStorage.getItem('isFloatingControlsVisible');
    if (savedVisibility === 'false') toggleFloatingControls();

    startAudioAndLoad();

    const progressionContainer = document.getElementById('progression-visualization');
    if (progressionContainer) {
        new Sortable(progressionContainer, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            // Dragging is now silent because the card's onmousedown is removed.
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
