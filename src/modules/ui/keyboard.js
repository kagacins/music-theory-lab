/**
 * Keyboard UI Module
 * Handles piano keyboard rendering, highlighting, and interaction
 *
 * State Dependencies:
 * - Requires global state: piano, audioIsReady, g_KeyboardKeys, isPointerDown,
 *   activeKeyNoteName, lastTouchTime, currentTab, trainerState, enharmonicPreference,
 *   builderRootIndex, isRomanNumeralEngineOn
 * - Depends on: initAudio, forceStopAllPlayback, releaseActiveKey, capturePlayedChord,
 *   getNoteKeyId from noteUtils
 */

import { getNoteKeyId } from '../utils/noteUtils.js';

// NOTE: This module accesses and modifies global state variables that should be
// refactored into proper state management modules in the future.

/**
 * Global keyboard state - should be moved to a state module
 */
export let g_KeyboardKeys = [];
export let isPointerDown = false;
export let activeKeyNoteName = null; // Kept for backward compatibility with mouse events
export let activeKeyNoteNames = new Set(); // Multitouch support: Set of currently pressed keys
export let activeTouches = new Map(); // Map of touchId -> noteName for multitouch tracking
export let lastTouchTime = 0;

/**
 * Clear all highlight classes from keyboard keys
 */
export function clearHighlights() {
    document.querySelectorAll('.key').forEach(key => {
        key.classList.remove('active-scale', 'active-progression', 'active-builder', 'active-scale-explorer', 'active-scale-playback', 'active-builder-playback', 'active-melody-playback', 'active-lesson-playback', 'active-lesson-lh', 'active-lesson-rh');
    });
}

/**
 * Highlight notes for lesson playback (Theory Academy)
 * @param {Array<string>} notes - Array of note names to highlight (e.g., ['C4', 'E4', 'G4'])
 */
export function highlightLessonNotes(notes) {
    // Clear previous lesson highlights only (don't clear other highlights)
    document.querySelectorAll('.active-lesson-playback').forEach(el => {
        el.classList.remove('active-lesson-playback');
    });

    if (!notes || notes.length === 0) return;

    notes.forEach(note => {
        const keyId = getNoteKeyId(note);
        const keyElement = document.getElementById(keyId);
        if (keyElement) {
            keyElement.classList.add('active-lesson-playback');
        }
    });
}

/**
 * Clear only lesson playback highlights (including LH/RH highlights)
 */
export function clearLessonHighlights() {
    document.querySelectorAll('.active-lesson-playback, .active-lesson-lh, .active-lesson-rh').forEach(el => {
        el.classList.remove('active-lesson-playback', 'active-lesson-lh', 'active-lesson-rh');
    });
}

/**
 * Release a specific key or all keys (stop sound and remove visual feedback)
 * @param {string|null} noteName - The note name to release, or null to release all keys
 * Depends on: global piano, audioIsReady, activeKeyNoteNames
 */
export function releaseActiveKey(noteName = null) {
    // Access global variables - should be passed as parameters in refactored version
    const instrument = window.getInstrument ? window.getInstrument() : (window.getPiano ? window.getPiano() : null);
    const audioIsReady = window.getAudioIsReady ? window.getAudioIsReady() : false;

    if (!instrument || !audioIsReady) return;

    if (noteName) {
        // Release a specific key
        try {
            instrument.triggerRelease(noteName, Tone.now());
            const keyId = getNoteKeyId(noteName);
            const keyEl = document.getElementById(keyId);
            if (keyEl) {
                // Remove all playback highlighting classes
                keyEl.classList.remove('active-builder-playback', 'active-scale-playback', 'active-progression', 'active-melody-playback', 'active-lesson-playback');
            }
            activeKeyNoteNames.delete(noteName);
            if (activeKeyNoteName === noteName) {
                activeKeyNoteName = null;
            }
        } catch (e) {
            // Ignore errors for individual note release
        }
    } else {
        // Release all active keys (for mouse/backward compatibility)
        activeKeyNoteNames.forEach(note => {
            try {
                instrument.triggerRelease(note, Tone.now());
                const keyId = getNoteKeyId(note);
                const keyEl = document.getElementById(keyId);
                if (keyEl) {
                    keyEl.classList.remove('active-builder-playback', 'active-scale-playback', 'active-progression', 'active-melody-playback', 'active-lesson-playback');
                }
            } catch (e) {
                // Ignore errors for individual note release
            }
        });
        activeKeyNoteNames.clear();
        activeKeyNoteName = null;
    }
}

/**
 * Press a key (placeholder for touchmove logic)
 * @param {string} noteName - The note name to press
 * @param {HTMLElement} keyElement - The key element
 */
export function pressKey(noteName, keyElement) {
    // This function is a placeholder for the logic inside pressThisKey, adapted for touchmove
}

/**
 * Highlight builder notes on the keyboard
 * @param {Array<string>} specificNotes - Array of note names to highlight
 * Depends on: global currentTab, builderRootIndex, enharmonicPreference, builderOmittedNotes, builderLHOmittedNotes
 */
export function highlightBuilderNotes(specificNotes) {
    // Access global variables
    const currentTab = window.currentTab;
    const builderRootIndex = window.builderRootIndex;
    const enharmonicPreference = window.enharmonicPreference;
    const builderOmittedNotes = window.builderOmittedNotes;
    const builderLHOmittedNotes = window.builderLHOmittedNotes;
    const builderSelectionMode = window.builderSelectionMode;
    const SHARP_NOTES = window.SHARP_NOTES;
    const FLAT_NOTES = window.FLAT_NOTES;
    const getLHNotes = window.getLHNotes;

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

/**
 * Highlight trainer scale and chord notes
 * @param {Array<string>} scaleNotes - Scale notes to highlight
 * @param {Array<string>} chordNotes - Chord notes to highlight (optional)
 * Depends on: global currentTab
 */
export function highlightTrainer(scaleNotes, chordNotes) {
    const currentTab = window.currentTab;

    clearHighlights();

    // Check if keyboard is visible (exists in DOM)
    const keyboardEl = document.getElementById('piano-keyboard');
    if (!keyboardEl) return;

    // Highlight scale notes if on trainer tab and scaleNotes provided
    if (currentTab === 'trainer' && scaleNotes) {
        scaleNotes.forEach(note => {
            const keyId = getNoteKeyId(note);
            const keyElement = document.getElementById(keyId);
            if (keyElement) keyElement.classList.add('active-scale');
        });
    }

    // Always highlight chord notes when playing (regardless of tab)
    if (chordNotes) {
         chordNotes.forEach(note => {
            const keyId = getNoteKeyId(note);
            const keyElement = document.getElementById(keyId);
            if (keyElement) keyElement.classList.add('active-progression');
        });
    }
}

/**
 * Render the piano keyboard
 * Depends on: global g_NumOctaves, piano, audioIsReady, currentTab, trainerState
 */
export function renderKeyboard() {
    // Access global variables
    const g_NumOctaves = window.g_NumOctaves;
    const initAudio = window.initAudio;
    const forceStopAllPlayback = window.forceStopAllPlayback;
    const capturePlayedChord = window.capturePlayedChord;
    const trainerState = window.trainerState;
    const currentTab = window.currentTab;

    const numOctaves = g_NumOctaves;
    const keyboardEl = document.getElementById('piano-keyboard');
    keyboardEl.innerHTML = '';
    g_KeyboardKeys = [];

    // Clear multitouch state when re-rendering keyboard
    activeKeyNoteNames.clear();
    activeTouches.clear();
    activeKeyNoteName = null;
    isPointerDown = false;

    // CRITICAL: Set touch-action on container to prevent browser gesture handling
    // This ensures simultaneous touches are not interpreted as pinch-zoom
    keyboardEl.style.touchAction = 'none';

    // Apply modern keyboard class by default (unless classic is enabled)
    const isClassicKeyboardOn = window.isClassicKeyboardOn || false;
    if (!isClassicKeyboardOn) {
        // Classic keyboard is OFF - show modern style (default)
        keyboardEl.classList.add('modern-keyboard');
    } else {
        // Classic keyboard is ON - show classic style
        keyboardEl.classList.remove('modern-keyboard');
    }

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

    // Helper function to press a key (supports both mouse and multitouch)
    const pressKeyByName = (noteName, touchId = null) => {
        const keyEl = document.getElementById(getNoteKeyId(noteName));
        if (!keyEl) return;
        
        // Get current tab fresh each time
        const currentTab = window.currentTab || 'builder';
        
        // For mouse events (touchId === null), maintain single-key behavior for backward compatibility
        // For touch events (touchId !== null), allow multitouch
        const isMouseEvent = touchId === null;
        
        if (isMouseEvent && forceStopAllPlayback) {
            forceStopAllPlayback();
        }
        
        // For mouse: if clicking the same key that's already active, toggle it
        if (isMouseEvent && noteName === activeKeyNoteName) {
            releaseActiveKey(noteName);
            // Small delay to ensure release completes, then press again
            setTimeout(() => {
                if (initAudio) initAudio();
                const instrument = window.getInstrument ? window.getInstrument() : (window.getPiano ? window.getPiano() : null);
                const audioIsReady = window.getAudioIsReady ? window.getAudioIsReady() : false;
                if (!audioIsReady || !instrument) return;
                instrument.triggerAttack(noteName, Tone.now());
                activeKeyNoteName = noteName;
                activeKeyNoteNames.add(noteName);
                
                // Get current tab fresh
                const currentTabNow = window.currentTab || 'builder';
                
                // Add consistent playback highlighting based on current tab
                keyEl.classList.remove('active-builder-playback', 'active-scale-playback', 'active-progression', 'active-melody-playback', 'active-lesson-playback');
                if (currentTabNow === 'builder' || currentTabNow === 'chordlab-new') {
                    keyEl.classList.add('active-builder-playback');
                } else if (currentTabNow === 'scales' || currentTabNow === 'scaleexplorer-new') {
                    keyEl.classList.add('active-scale-playback');
                } else if (currentTabNow === 'trainer') {
                    keyEl.classList.add('active-progression');
                } else if (currentTabNow === 'melody' || currentTabNow === 'studio-new') {
                    keyEl.classList.add('active-melody-playback');
                } else if (currentTabNow === 'learn') {
                    keyEl.classList.add('active-lesson-playback');
                }

                // If recording melody on the melody tab, add note to interactive melody
                if (currentTabNow === 'melody' && window.isInteractiveMode && window.addNoteToInteractiveMelody) {
                    window.addNoteToInteractiveMelody(noteName, true); // true = skip playback
                }
            }, 10);
            return;
        }
        
        // For mouse: release previous key if different (single-key mode)
        if (isMouseEvent && activeKeyNoteName && activeKeyNoteName !== noteName) {
            releaseActiveKey(activeKeyNoteName);
        }
        
        // For touch: if this key is already being played by this touch, don't press again
        if (!isMouseEvent && activeTouches.has(touchId) && activeTouches.get(touchId) === noteName) {
            return;
        }
        
        // For touch: if this touch was on a different key, release that key first
        if (!isMouseEvent && activeTouches.has(touchId)) {
            const previousNote = activeTouches.get(touchId);
            if (previousNote !== noteName) {
                releaseActiveKey(previousNote);
                activeTouches.delete(touchId);
            }
        }
        
        // Don't press if the key is already active (for multitouch, allow same key from different touches)
        if (activeKeyNoteNames.has(noteName) && isMouseEvent) {
            return;
        }
        
        if (initAudio) initAudio();

        // Ensure audio context is running (might have been suspended)
        if (typeof Tone !== 'undefined' && Tone.context && Tone.context.state !== 'running') {
            Tone.context.resume();
        }

        const instrument = window.getInstrument ? window.getInstrument() : (window.getPiano ? window.getPiano() : null);
        const audioIsReady = window.getAudioIsReady ? window.getAudioIsReady() : false;

        if (!audioIsReady || !instrument) {
            return;
        }

        try {
            instrument.triggerAttack(noteName, Tone.now());
            
            // Track the active key
            if (isMouseEvent) {
                activeKeyNoteName = noteName;
            }
            activeKeyNoteNames.add(noteName);
            if (!isMouseEvent && touchId !== null) {
                activeTouches.set(touchId, noteName);
            }
            
            // Add consistent playback highlighting based on current tab
            keyEl.classList.remove('active-builder-playback', 'active-scale-playback', 'active-progression', 'active-melody-playback', 'active-lesson-playback');
            if (currentTab === 'builder' || currentTab === 'chordlab-new') {
                keyEl.classList.add('active-builder-playback');
            } else if (currentTab === 'scales' || currentTab === 'scaleexplorer-new') {
                keyEl.classList.add('active-scale-playback');
            } else if (currentTab === 'trainer') {
                keyEl.classList.add('active-progression');
            } else if (currentTab === 'melody' || currentTab === 'studio-new') {
                keyEl.classList.add('active-melody-playback');
            } else if (currentTab === 'learn') {
                keyEl.classList.add('active-lesson-playback');
            }

            // If recording on the trainer tab, capture chord (all active keys)
            const trainerStateNow = window.trainerState;
            if (trainerStateNow && trainerStateNow.isRecording && currentTab === 'trainer' && capturePlayedChord) {
                // For multitouch, capture all currently active keys as a chord
                if (activeKeyNoteNames.size > 0) {
                    capturePlayedChord(Array.from(activeKeyNoteNames));
                } else {
                    capturePlayedChord([noteName]);
                }
            }

            // If recording melody on the melody tab, add note to interactive melody
            if (currentTab === 'melody' && window.isInteractiveMode && window.addNoteToInteractiveMelody) {
                window.addNoteToInteractiveMelody(noteName, true); // true = skip playback
            }
        } catch (e) {
            // Ignore errors (e.g., if audio context is not ready)
            console.warn('Error triggering attack:', e);
        }
    };

    g_KeyboardKeys.forEach(keyData => {
        const keyEl = document.createElement('div');
        keyEl.id = getNoteKeyId(keyData.name);

        // CRITICAL: Set touch-action to none to prevent browser from treating
        // simultaneous touches as gestures (pinch-zoom, etc.)
        // This ensures touchstart events fire even for simultaneous multi-touch
        keyEl.style.touchAction = 'none';

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

        const keyNameLabel = document.createElement('span');
        keyNameLabel.className = 'key-label-keyname text-gray-600 text-xs font-medium absolute bottom-1 left-1/2 -translate-x-1/2 pointer-events-none';
        keyEl.appendChild(keyNameLabel);

        const pressThisKey = (e) => {
            e.preventDefault();
            e.stopPropagation();
            pressKeyByName(keyData.name, null); // null = mouse event
        };

        keyEl.addEventListener('mousedown', (e) => {
            if (Date.now() - lastTouchTime < 500) { e.preventDefault(); return; }
            isPointerDown = true;
            pressThisKey(e);
        });

        // Pointer Events for multi-touch support - fires separately per finger
        // Note: Truly simultaneous touches (exact same moment) may not fire events due to browser/hardware limitations
        keyEl.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch') return;

            e.preventDefault();
            e.stopPropagation();
            lastTouchTime = Date.now();

            // Resume audio context if needed
            if (typeof Tone !== 'undefined' && Tone.context && Tone.context.state !== 'running') {
                Tone.context.resume();
            }

            pressKeyByName(keyData.name, e.pointerId);
        }, { passive: false });

        keyEl.addEventListener('pointerup', (e) => {
            if (e.pointerType !== 'touch') return;

            const noteName = activeTouches.get(e.pointerId);
            if (noteName) {
                releaseActiveKey(noteName);
                activeTouches.delete(e.pointerId);
            }
        }, { passive: false });

        keyEl.addEventListener('pointercancel', (e) => {
            if (e.pointerType !== 'touch') return;

            const noteName = activeTouches.get(e.pointerId);
            if (noteName) {
                releaseActiveKey(noteName);
                activeTouches.delete(e.pointerId);
            }
        }, { passive: false });

        // Release pointer capture so other keys can receive events
        keyEl.addEventListener('gotpointercapture', (e) => {
            keyEl.releasePointerCapture(e.pointerId);
        });

        keyEl.addEventListener('mouseenter', (e) => {
            if (isPointerDown) {
                e.preventDefault();
                e.stopPropagation();
                pressKeyByName(keyData.name, null); // null = mouse event
            }
        });

        keysMap[keyData.name] = keyEl;
    });

    document.addEventListener('mouseup', (e) => {
        if (Date.now() - lastTouchTime < 500) { e.preventDefault(); return; }
        isPointerDown = false;
        releaseActiveKey(); // Release all keys for mouse (backward compatibility)
    });

    // Touch events as fallback - handles multi-touch when pointer events don't fire
    keyboardEl.addEventListener('touchstart', (e) => {
        lastTouchTime = Date.now();
        e.preventDefault();

        // Resume audio context if needed
        if (typeof Tone !== 'undefined' && Tone.context && Tone.context.state !== 'running') {
            Tone.context.resume();
        }

        // Collect and press all touched keys
        Array.from(e.changedTouches).forEach(touch => {
            const touchId = touch.identifier;
            let keyElement = document.elementFromPoint(touch.clientX, touch.clientY);
            if (keyElement && !keyElement.classList.contains('key')) {
                keyElement = keyElement.closest('.key');
            }

            if (keyElement && keyElement.classList.contains('key')) {
                const noteName = g_KeyboardKeys.find(k => getNoteKeyId(k.name) === keyElement.id)?.name;
                if (noteName) {
                    pressKeyByName(noteName, touchId);
                }
            }
        });
    }, { passive: false });

    keyboardEl.addEventListener('touchend', (e) => {
        e.preventDefault();

        // Release keys for all ended touches
        Array.from(e.changedTouches).forEach(touch => {
            const touchId = touch.identifier;
            const noteName = activeTouches.get(touchId);
            if (noteName) {
                releaseActiveKey(noteName);
                activeTouches.delete(touchId);
            }
        });

        if (activeTouches.size === 0) {
            isPointerDown = false;
        }
    }, { passive: false });
    
    keyboardEl.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        
        // Release keys for all cancelled touches
        Array.from(e.changedTouches).forEach(touch => {
            const touchId = touch.identifier;
            const noteName = activeTouches.get(touchId);
            if (noteName) {
                releaseActiveKey(noteName);
                activeTouches.delete(touchId);
            }
        });
        
        // Update isPointerDown flag
        if (activeTouches.size === 0) {
            isPointerDown = false;
        }
    }, { passive: false });

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
        e.preventDefault();

        // Handle all active touches
        Array.from(e.touches).forEach(touch => {
            const touchId = touch.identifier;
            const touchX = touch.clientX;
            const touchY = touch.clientY;

            // Find the key element at this touch point
            // Use closest('.key') to handle touches on child elements (labels)
            let keyElement = document.elementFromPoint(touchX, touchY);
            if (keyElement && !keyElement.classList.contains('key')) {
                keyElement = keyElement.closest('.key');
            }

            if (keyElement && keyElement.classList.contains('key')) {
                const newNoteName = g_KeyboardKeys.find(k => getNoteKeyId(k.name) === keyElement.id)?.name;
                if (newNoteName) {
                    const currentNoteForTouch = activeTouches.get(touchId);
                    // If touch moved to a different key, release old key and press new one
                    if (currentNoteForTouch !== newNoteName) {
                        if (currentNoteForTouch) {
                            releaseActiveKey(currentNoteForTouch);
                            activeTouches.delete(touchId);
                        }
                        // Press the new key
                        pressKeyByName(newNoteName, touchId);
                    }
                }
            } else {
                // Touch moved off keyboard, release the key for this touch
                const currentNoteForTouch = activeTouches.get(touchId);
                if (currentNoteForTouch) {
                    releaseActiveKey(currentNoteForTouch);
                    activeTouches.delete(touchId);
                }
            }
        });
    }, { passive: false });

    keyboardEl.addEventListener('mouseleave', () => {
         if(isPointerDown) {
            releaseActiveKey();
            isPointerDown = false;
         }
    });
}

/**
 * Update keyboard labels with Roman numerals
 * Depends on: global isRomanNumeralEngineOn, currentTab, trainerState, builderRootIndex, enharmonicPreference
 */
/**
 * Convert Roman numeral to minor case (for minor keys)
 * @param {string} roman - Roman numeral (e.g., "I", "ii", "V")
 * @returns {string} Roman numeral in minor case (e.g., "i", "ii°", "v")
 */
function convertRomanToMinor(roman) {
    // Map major Roman numerals to minor equivalents
    const minorMap = {
        'I': 'i',
        'ii': 'ii°',
        'iii': 'III',
        'IV': 'iv',
        'V': 'v',
        'vi': 'VI',
        'vii°': 'VII'
    };
    return minorMap[roman] || roman;
}

export function updateKeyboardLabels() {
    // Access global variables
    const isRomanNumeralEngineOn = window.isRomanNumeralEngineOn || false;
    const currentTab = window.currentTab || 'builder';
    
    // Import trainerState getter if window.trainerState is not available
    let trainerState;
    if (window.trainerState) {
        trainerState = window.trainerState;
    } else if (window.getTrainerState) {
        trainerState = window.getTrainerState();
    } else {
        trainerState = { isReady: false, currentKey: 'C' };
    }
    
    // Don't read builderRootIndex here - read it fresh in each tab branch when needed
    const enharmonicPreference = window.enharmonicPreference || 'sharp';
    const SHARP_NOTES = window.SHARP_NOTES;
    const FLAT_NOTES = window.FLAT_NOTES;
    const ALL_NOTES = window.ALL_NOTES;
    const MAJOR_SCALE_STEPS = window.MAJOR_SCALE_STEPS;

    // Access key names state
    const isKeyNamesOn = window.isKeyNamesOn || false;

    // Clear all existing labels first - force clear all
    document.querySelectorAll('.key-label-roman').forEach(label => {
        label.textContent = '';
        label.classList.remove('text-white', 'text-indigo-700');
        label.style.display = '';
    });

    // Clear key name labels
    document.querySelectorAll('.key-label-keyname').forEach(label => {
        label.textContent = '';
        label.style.display = '';
    });

    // Update key names if enabled
    if (isKeyNamesOn) {
        updateKeyNames();
    }

    if (!isRomanNumeralEngineOn) {
        return; // Exit if the feature is turned off
    }


    // Get root note name based on current tab
    let rootNoteName;
    let isMinorKey = false;
    if (currentTab === 'trainer') {
        // For trainer tab, always try to get the current key
        // Even if isReady is false, we should still show Roman numerals if a key is selected
        if (trainerState && trainerState.currentKey) {
            rootNoteName = trainerState.currentKey;
        } else {
            // Try to get it from the selector directly
            const keySelect = document.getElementById('trainer-key-select');
            if (keySelect && keySelect.value) {
                rootNoteName = keySelect.value;
            } else {
                rootNoteName = 'C'; // Default fallback
            }
        }
        // Check if key is minor (ends with 'm')
        isMinorKey = rootNoteName.endsWith('m');
        // Remove 'm' suffix for root note calculation
        if (isMinorKey) {
            rootNoteName = rootNoteName.replace(/m$/, '');
        }
    } else if (currentTab === 'builder' || currentTab === 'chordlab-new') {
        // Always read builderRootIndex fresh from window
        // chordlab-new uses the same builderRootIndex as the classic Chord Lab
        const currentBuilderRootIndex = window.builderRootIndex !== undefined ? window.builderRootIndex : 0;
        if (!SHARP_NOTES || !FLAT_NOTES || currentBuilderRootIndex < 0 || currentBuilderRootIndex >= (enharmonicPreference === 'sharp' ? SHARP_NOTES.length : FLAT_NOTES.length)) {
            return; // Invalid state
        }
        rootNoteName = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[currentBuilderRootIndex];
    } else if (currentTab === 'scales' || currentTab === 'scaleexplorer-new') {
        // Get scale root index from window or state module
        // scaleexplorer-new uses the same scaleRootIndex as the classic Scale Explorer
        const scaleRootIndex = window.scaleRootIndex !== undefined ? window.scaleRootIndex :
            (window.getScaleRootIndex ? window.getScaleRootIndex() : 0);
        if (!SHARP_NOTES || !FLAT_NOTES || scaleRootIndex < 0 || scaleRootIndex >= (enharmonicPreference === 'sharp' ? SHARP_NOTES.length : FLAT_NOTES.length)) {
            return; // Invalid state
        }
        rootNoteName = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[scaleRootIndex];
    } else if (currentTab === 'melody' || currentTab === 'learn') {
        // Composition Studio or Learn tab - get key from compositionState
        const compositionState = window.getCompositionState ? window.getCompositionState() : null;
        if (compositionState && compositionState.getSettings) {
            const settings = compositionState.getSettings();
            rootNoteName = settings.key || 'C';
            // Check if key is minor (ends with 'm')
            isMinorKey = rootNoteName.endsWith('m');
            if (isMinorKey) {
                rootNoteName = rootNoteName.replace(/m$/, '');
            }
        } else {
            rootNoteName = 'C'; // Default fallback
        }
    } else {
        return; // Don't show labels on other tabs
    }

    if (!rootNoteName || !ALL_NOTES || !MAJOR_SCALE_STEPS) {
        return; // Required data not available
    }

    // Find the root note in ALL_NOTES (normalize enharmonics)
    // Handle both sharp and flat notation
    let keyRootIndex = ALL_NOTES.indexOf(rootNoteName);
    if (keyRootIndex === -1) {
        // Try to find enharmonic equivalent
        // For example, if rootNoteName is "Db", try "C#"
        const enharmonicMap = {
            'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B'
        };
        const equivalent = enharmonicMap[rootNoteName] || rootNoteName;
        keyRootIndex = ALL_NOTES.indexOf(equivalent);
        if (keyRootIndex === -1) {
            console.warn(`Could not find root note ${rootNoteName} in ALL_NOTES`);
            return;
        }
    }

    // Use g_KeyboardKeys from the module scope - it should always be available after renderKeyboard()
    // If not available, try window fallback
    let keyboardKeys = g_KeyboardKeys;
    if (!keyboardKeys || keyboardKeys.length === 0) {
        keyboardKeys = window.g_KeyboardKeys || [];
    }
    
    if (!keyboardKeys || keyboardKeys.length === 0) {
        // Keyboard might not be rendered yet, try again after a short delay
        setTimeout(() => {
            updateKeyboardLabels();
        }, 100);
        return;
    }

    // Update Roman numeral labels for each key
    keyboardKeys.forEach(keyData => {
        const keyEl = document.getElementById(getNoteKeyId(keyData.name));
        if (!keyEl) return;

        // Find the note index in ALL_NOTES
        // Handle both sharp and flat notation for baseName
        let noteIndex = ALL_NOTES.indexOf(keyData.baseName);
        if (noteIndex === -1) {
            // Try enharmonic equivalent
            const enharmonicMap = {
                'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B'
            };
            const equivalent = enharmonicMap[keyData.baseName] || keyData.baseName;
            noteIndex = ALL_NOTES.indexOf(equivalent);
            if (noteIndex === -1) return;
        }

        // Calculate interval from root note
        // Use modulo 12 to handle octave wrapping
        const interval = (noteIndex - keyRootIndex + 12) % 12;
        const scaleDegreeIndex = MAJOR_SCALE_STEPS.indexOf(interval);

        // Get the label element once
        const label = keyEl.querySelector('.key-label-roman');
        if (!label) return;

        // Update label if this note is part of the scale
        if (scaleDegreeIndex !== -1) {
            // Use major Roman numerals for major keys, minor for minor keys
            const majorDiatonicNumerals = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
            let romanNumeral = majorDiatonicNumerals[scaleDegreeIndex];
            
            // Convert to minor case if key is minor
            if (isMinorKey && romanNumeral) {
                romanNumeral = convertRomanToMinor(romanNumeral);
            }
            
            if (romanNumeral && scaleDegreeIndex < majorDiatonicNumerals.length) {
                label.textContent = romanNumeral;
                if (keyData.type === 'black') {
                    label.classList.add('text-white');
                    label.classList.remove('text-indigo-700');
                } else {
                    label.classList.add('text-indigo-700');
                    label.classList.remove('text-white');
                }
            }
        } else {
            // Clear label if note is not in the scale
            label.textContent = '';
        }
    });
}

/**
 * Update keyboard labels with key names
 */
export function updateKeyNames() {
    const enharmonicPreference = window.enharmonicPreference || 'sharp';
    
    // Use g_KeyboardKeys from the module scope
    let keyboardKeys = g_KeyboardKeys;
    if (!keyboardKeys || keyboardKeys.length === 0) {
        keyboardKeys = window.g_KeyboardKeys || [];
    }
    
    if (!keyboardKeys || keyboardKeys.length === 0) {
        // Keyboard might not be rendered yet, try again after a short delay
        setTimeout(() => {
            updateKeyNames();
        }, 100);
        return;
    }

    // Update key name labels for each key
    keyboardKeys.forEach(keyData => {
        const keyEl = document.getElementById(getNoteKeyId(keyData.name));
        if (!keyEl) return;

        const keyNameLabel = keyEl.querySelector('.key-label-keyname');
        if (!keyNameLabel) return;

        // Skip C keys as they already have octave labels (C4, C5, etc.)
        if (keyData.baseName === 'C') {
            keyNameLabel.textContent = '';
            keyNameLabel.style.display = 'none';
            return;
        }

        // Get the note name based on enharmonic preference
        const baseName = keyData.baseName;
        let displayName = baseName;
        
        // If enharmonic preference is flat, convert sharps to flats where applicable
        if (enharmonicPreference === 'flat') {
            const sharpToFlatMap = {
                'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb'
            };
            if (sharpToFlatMap[baseName]) {
                displayName = sharpToFlatMap[baseName];
            }
        } else {
            // If enharmonic preference is sharp, convert flats to sharps where applicable
            const flatToSharpMap = {
                'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
            };
            if (flatToSharpMap[baseName]) {
                displayName = flatToSharpMap[baseName];
            }
        }

        // Display the note name
        keyNameLabel.textContent = displayName;
        keyNameLabel.style.display = 'block';
        
        // Style based on key type
        if (keyData.type === 'black') {
            keyNameLabel.classList.remove('text-gray-600');
            keyNameLabel.classList.add('text-white');
        } else {
            keyNameLabel.classList.remove('text-white');
            keyNameLabel.classList.add('text-gray-600');
        }
    });
}

