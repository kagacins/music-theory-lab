/**
 * floatingActionButton.js
 *
 * Floating Action Button (FAB) functionality
 * Manages the mobile FAB menu system with category buttons and action handlers
 *
 * Extracted from main.js during Phase 3 refactoring
 */

import { dispatchBuilderEvent } from './lessonGuidedMode.js';
import { toggleMetronome } from '../audio/audioEngine.js';
import { showPromptModal } from './modals.js';

// Guard to prevent double initialization (stored globally to persist across module reloads)
let fabInitialized = window.__fabInitialized || false;

/**
 * Initialize the Mobile Floating Action Button (FAB)
 * 2-tier Speed Dial for comprehensive quick access on touch devices
 */
export function initMobileFab() {
    if (fabInitialized) {
        console.warn('FAB already initialized, skipping duplicate initialization');
        return;
    }

    const fabMain = document.getElementById('mobile-fab-main');
    const fabMenu = document.getElementById('mobile-fab-menu');
    const fabCategories = document.querySelectorAll('.fab-category');

    if (!fabMain || !fabMenu) {
        console.error('FAB initialization failed: fabMain or fabMenu not found', { fabMain, fabMenu });
        return;
    }

    fabInitialized = true;
    window.__fabInitialized = true;

    let isOpen = false;
    let activeSubmenu = null;
    let isHandlingAction = false; // Flag to prevent closing during action handling

    // Quick buttons containers for each tab
    const fabBuilderQuickButtons = document.getElementById('fab-builder-quick-buttons');
    const fabMelodyQuickButtons = document.getElementById('fab-melody-quick-buttons');
    // Individual button references for event handlers
    const fabAddChordQuick = document.getElementById('fab-add-chord-quick');
    const fabPlayChordQuick = document.getElementById('fab-play-chord-quick');

    // Toggle main FAB menu (first tier)
    fabMain.addEventListener('click', (e) => {
        e.stopPropagation();
        isOpen = !isOpen;
        fabMenu.classList.toggle('hidden', !isOpen);
        fabMain.querySelector('.fab-icon').style.transform = isOpen ? 'rotate(45deg)' : 'rotate(0deg)';

        // Dispatch event for guided mode tutorials when FAB is opened
        if (isOpen) {
            dispatchBuilderEvent('fabOpened', { tab: window.currentTab || 'builder' });
        }

        // Hide/show quick buttons based on FAB state and current tab
        if (fabBuilderQuickButtons && window.currentTab === 'builder') {
            fabBuilderQuickButtons.classList.toggle('hidden', isOpen);
        }
        if (fabMelodyQuickButtons && window.currentTab === 'melody') {
            fabMelodyQuickButtons.classList.toggle('hidden', isOpen);
        }

        // Close any open submenu when closing main menu
        if (!isOpen) {
            closeAllSubmenus();
            // Dispatch event for guided mode tutorials when FAB is closed
            dispatchBuilderEvent('fabClosed', {});
        }

        // Show labels on hover
        if (isOpen) {
            showCategoryLabels();

            // Update context-aware labels based on current tab
            const currentTab = window.currentTab || 'builder';
            const suggestionsCategory = document.querySelector('[data-category="suggestions"]');
            if (suggestionsCategory) {
                const label = suggestionsCategory.querySelector('.fab-label');
                const btn = suggestionsCategory.querySelector('.fab-category-btn');
                if (currentTab === 'builder') {
                    if (label) label.textContent = 'Add';
                    // Change icon to plus-circle (distinct from FAB expand button)
                    if (btn) btn.innerHTML = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/></svg>';
                } else {
                    if (label) label.textContent = 'Suggestions';
                    // Change icon to lightbulb
                    if (btn) btn.innerHTML = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/></svg>';
                }
            }
        }
    });

    // Category buttons toggle submenus (second tier)
    fabCategories.forEach(category => {
        const categoryBtn = category.querySelector('.fab-category-btn');
        const categoryType = category.dataset.category;

        categoryBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            // Close other categories' submenus
            fabCategories.forEach(other => {
                if (other !== category) {
                    other.querySelectorAll('.fab-submenu').forEach(sub => sub.classList.add('hidden'));
                }
            });

            // For playback category, show the correct submenu based on current tab
            if (categoryType === 'playback') {
                const currentTab = window.currentTab || 'builder';
                const builderSubmenu = document.getElementById('fab-playback-builder');
                const melodySubmenu = document.getElementById('fab-playback-melody');
                const defaultSubmenu = document.getElementById('fab-playback-default');

                // Determine target submenu
                let targetSubmenu;
                if (currentTab === 'builder') {
                    targetSubmenu = builderSubmenu;
                } else if (currentTab === 'melody') {
                    targetSubmenu = melodySubmenu;
                } else {
                    targetSubmenu = defaultSubmenu;
                }

                // Check if currently open BEFORE hiding
                const isCurrentlyOpen = targetSubmenu && !targetSubmenu.classList.contains('hidden');

                // Hide all playback submenus
                [builderSubmenu, melodySubmenu, defaultSubmenu].forEach(sub => {
                    if (sub) sub.classList.add('hidden');
                });

                // Toggle: if was open, leave closed; if was closed, show it
                if (targetSubmenu && !isCurrentlyOpen) {
                    targetSubmenu.classList.remove('hidden');
                    activeSubmenu = targetSubmenu;
                } else {
                    activeSubmenu = null;
                }
            } else if (categoryType === 'suggestions') {
                // For suggestions category, show Add (builder) or Suggestions (melody)
                const currentTab = window.currentTab || 'builder';
                const addSubmenu = document.getElementById('fab-add-builder');
                const suggestionsSubmenu = document.getElementById('fab-suggestions-melody');

                // Determine target submenu
                let targetSubmenu;
                if (currentTab === 'builder') {
                    targetSubmenu = addSubmenu;
                } else if (currentTab === 'melody') {
                    targetSubmenu = suggestionsSubmenu;
                }

                // Check if currently open BEFORE hiding
                const isCurrentlyOpen = targetSubmenu && !targetSubmenu.classList.contains('hidden');

                // Hide both submenus
                [addSubmenu, suggestionsSubmenu].forEach(sub => {
                    if (sub) sub.classList.add('hidden');
                });

                // Toggle: if was open, leave closed; if was closed, show it
                if (targetSubmenu && !isCurrentlyOpen) {
                    targetSubmenu.classList.remove('hidden');
                    activeSubmenu = targetSubmenu;
                } else {
                    activeSubmenu = null;
                }
            } else if (categoryType === 'settings') {
                // For settings category, toggle submenu and dispatch event for tutorial
                const submenu = category.querySelector('.fab-submenu');
                if (submenu) {
                    const isSubmenuOpen = !submenu.classList.contains('hidden');
                    submenu.classList.toggle('hidden', isSubmenuOpen);
                    activeSubmenu = isSubmenuOpen ? null : submenu;

                    // Dispatch event for tutorial tracking
                    if (!isSubmenuOpen) {
                        dispatchBuilderEvent('settingsSectionClicked', {});
                    }
                }
            } else {
                // For other categories, toggle their single submenu
                const submenu = category.querySelector('.fab-submenu');
                if (submenu) {
                    const isSubmenuOpen = !submenu.classList.contains('hidden');
                    submenu.classList.toggle('hidden', isSubmenuOpen);
                    activeSubmenu = isSubmenuOpen ? null : submenu;
                }
            }
        });

        // Handle submenu action buttons (both circular .fab-action buttons and dropdown menu buttons)
        const actionBtns = category.querySelectorAll('.fab-action, .fab-submenu button[data-action]');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                // Set flag to prevent document click handler from closing FAB
                isHandlingAction = true;
                handleFabAction(action);

                // Keep dropdown open - only close when clicking category button or outside FAB
                // (removed auto-close behavior per user request)

                // Reset flag after a short delay to allow any triggered clicks to complete
                setTimeout(() => {
                    isHandlingAction = false;
                }, 100);
            });
        });
    });

    // Wire up FAB settings panel controls
    initFabSettingsPanel();

    // Close FAB when clicking outside (but not when clicking on FAB elements or during action handling)
    document.addEventListener('click', (e) => {
        // Check both local flag and global flag (for settings panel controls)
        if (isOpen && !isHandlingAction && !window._fabIsHandlingAction && !e.target.closest('#mobile-fab')) {
            closeFab();
        }
    });

    function closeAllSubmenus() {
        // Close ALL submenus in ALL categories (some categories have multiple submenus)
        fabCategories.forEach(category => {
            category.querySelectorAll('.fab-submenu').forEach(submenu => {
                submenu.classList.add('hidden');
            });
        });
        // Also close any standalone submenus by ID
        ['fab-playback-builder', 'fab-playback-melody', 'fab-playback-default',
         'fab-add-builder', 'fab-suggestions-melody', 'fab-file-dropdown',
         'fab-edit-dropdown', 'fab-help-dropdown'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        activeSubmenu = null;
    }

    function showCategoryLabels() {
        // Briefly show labels then fade them
        const labels = document.querySelectorAll('.fab-label');
        labels.forEach(label => {
            label.style.opacity = '1';
            setTimeout(() => {
                label.style.opacity = '0';
            }, 1500);
        });
    }

    function closeFab() {
        isOpen = false;
        fabMenu.classList.add('hidden');
        fabMain.querySelector('.fab-icon').style.transform = 'rotate(0deg)';
        closeAllSubmenus();
        // Show quick buttons when closing FAB based on current tab
        if (fabBuilderQuickButtons && window.currentTab === 'builder') {
            fabBuilderQuickButtons.classList.remove('hidden');
        }
        if (fabMelodyQuickButtons && window.currentTab === 'melody') {
            fabMelodyQuickButtons.classList.remove('hidden');
        }
        // Dispatch event for guided mode tutorials
        dispatchBuilderEvent('fabClosed', {});
    }

    // Expose closeFab globally so it can be called on tab change
    window.closeFab = closeFab;

    // Expose closeAllSubmenus globally so actions can close dropdowns without closing the entire FAB
    window.closeFabSubmenus = closeAllSubmenus;

    // Quick Play Chord button - press-and-hold pattern for Chord Lab
    if (fabPlayChordQuick) {
        // Mouse events
        fabPlayChordQuick.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (window.startBuilderChord) window.startBuilderChord();
        });
        fabPlayChordQuick.addEventListener('mouseup', () => {
            if (window.stopBuilderChord) window.stopBuilderChord();
        });
        fabPlayChordQuick.addEventListener('mouseleave', () => {
            if (window.stopBuilderChord) window.stopBuilderChord();
        });

        // Touch events
        fabPlayChordQuick.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (window.startBuilderChord) window.startBuilderChord();
        });
        fabPlayChordQuick.addEventListener('touchend', () => {
            if (window.stopBuilderChord) window.stopBuilderChord();
        });
        fabPlayChordQuick.addEventListener('touchcancel', () => {
            if (window.stopBuilderChord) window.stopBuilderChord();
        });
    }

    // Quick Add Chord button - click to open add chord menu
    if (fabAddChordQuick) {
        fabAddChordQuick.addEventListener('click', () => {
            const addChordBtn = document.getElementById('action-add-chord');
            if (addChordBtn) addChordBtn.click();
        });
    }

    // Melody quick buttons - Play All, Stop, Suggestions
    const fabPlayAllQuick = document.getElementById('fab-play-all-quick');
    const fabStopQuick = document.getElementById('fab-stop-quick');
    const fabSuggestionsQuick = document.getElementById('fab-suggestions-quick');

    if (fabPlayAllQuick) {
        fabPlayAllQuick.addEventListener('click', () => {
            // Context-aware play button
            const currentTab = document.querySelector('.tab-pane.active')?.id?.replace('tab-', '') || 'melody';

            if (currentTab === 'melody') {
                // Composition Studio: use playAllMelody for seamless chord playback
                if (window.playAllMelody) {
                    window.playAllMelody();
                }
            } else if (currentTab === 'builder' || currentTab === 'trainer') {
                // Chord Lab or Trainer: use handleAutoPlayback
                if (window.handleAutoPlayback) {
                    window.handleAutoPlayback();
                }
            } else {
                // Other tabs: click the play-all button
                const playAllBtn = document.getElementById('action-play-all');
                if (playAllBtn) playAllBtn.click();
            }
        });
    }

    if (fabStopQuick) {
        fabStopQuick.addEventListener('click', () => {
            const stopBtn = document.getElementById('action-stop-btn');
            if (stopBtn) stopBtn.click();
        });
    }

    if (fabSuggestionsQuick) {
        fabSuggestionsQuick.addEventListener('click', () => {
            if (window.showUnifiedRecommendationModal) {
                window.showUnifiedRecommendationModal({ initialTab: 'chord' });
            }
        });
    }

    function handleFabAction(action) {
        switch (action) {
            // Playback actions
            case 'play-all':
                const playBtn = document.getElementById('action-play-btn');
                if (playBtn) playBtn.click();
                break;
            case 'stop':
                const stopBtn = document.getElementById('action-stop-btn');
                if (stopBtn) stopBtn.click();
                break;
            case 'play-measure':
                // Play just the selected/current measure
                if (window.composerIntegration && window.composerIntegration.playCurrentMeasure) {
                    window.composerIntegration.playCurrentMeasure();
                }
                break;

            // Chord Lab (builder) playback actions
            case 'play-current-chord':
                // Directly call playBuilderChordWithDuration instead of clicking hidden dropdown button
                if (window.playBuilderChordWithDuration) {
                    window.playBuilderChordWithDuration();
                }
                break;
            case 'play-builder-progression':
                // Directly call handleAutoPlayback instead of clicking hidden dropdown button
                if (window.handleAutoPlayback) {
                    window.handleAutoPlayback();
                }
                break;

            // Composition Studio (melody) playback actions
            case 'play-all-melody':
                const playAllBtn = document.getElementById('action-play-all');
                if (playAllBtn) playAllBtn.click();
                break;
            case 'play-progression-only':
                const playProgOnlyBtn = document.getElementById('action-play-progression');
                if (playProgOnlyBtn) playProgOnlyBtn.click();
                break;
            case 'play-from-cursor':
                const playFromCursorBtn = document.getElementById('action-play-from-cursor');
                if (playFromCursorBtn) playFromCursorBtn.click();
                break;
            case 'play-measure-melody':
                const playMeasureBtn = document.getElementById('action-play-measure');
                if (playMeasureBtn) playMeasureBtn.click();
                break;

            case 'toggle-metronome':
                const newState = toggleMetronome();
                // Update FAB status display
                const statusEl = document.getElementById('fab-metronome-status');
                if (statusEl) {
                    statusEl.textContent = newState ? 'ON' : 'OFF';
                    statusEl.classList.toggle('text-green-600', newState);
                    statusEl.classList.toggle('text-gray-400', !newState);
                }
                break;

            // Chord Lab (builder) add actions
            case 'add-chord':
                const addChordBtn = document.getElementById('action-add-chord');
                if (addChordBtn) addChordBtn.click();
                break;
            case 'add-go':
                const addGoBtn = document.getElementById('action-add-go');
                if (addGoBtn) addGoBtn.click();
                break;

            // Composition Studio (melody) suggestions actions
            case 'suggest-chords':
                if (window.showUnifiedRecommendationModal) {
                    window.showUnifiedRecommendationModal({ initialTab: 'chord' });
                }
                break;
            case 'suggest-melody':
                if (window.showUnifiedRecommendationModal) {
                    window.showUnifiedRecommendationModal({ initialTab: 'melody' });
                }
                break;
            case 'suggest-section':
                if (window.showUnifiedRecommendationModal) {
                    window.showUnifiedRecommendationModal({ initialTab: 'section' });
                }
                break;
            case 'suggest-harmonize':
                if (window.showUnifiedRecommendationModal) {
                    window.showUnifiedRecommendationModal({ initialTab: 'harmonize' });
                }
                break;
            case 'suggest-texture':
                if (window.showUnifiedRecommendationModal) {
                    window.showUnifiedRecommendationModal({ initialTab: 'polyphony' });
                }
                break;

            // Edit actions
            case 'undo':
                const undoBtn = document.getElementById('action-undo');
                if (undoBtn) undoBtn.click();
                break;
            case 'redo':
                const redoBtn = document.getElementById('action-redo');
                if (redoBtn) redoBtn.click();
                break;
            case 'clear-treble':
                const clearTrebleBtn = document.getElementById('action-clear-treble');
                if (clearTrebleBtn) clearTrebleBtn.click();
                break;
            case 'clear-progression':
                const clearProgBtn = document.getElementById('action-clear-progression');
                if (clearProgBtn) clearProgBtn.click();
                break;

            // File actions
            case 'save':
                const saveBtn = document.getElementById('action-save');
                if (saveBtn) saveBtn.click();
                break;
            case 'load':
                const loadBtn = document.getElementById('action-load');
                if (loadBtn) loadBtn.click();
                break;
            case 'export-midi':
                if (window.showMIDIExportDialog) {
                    window.showMIDIExportDialog();
                }
                break;
            case 'export-pdf':
                if (window.showPDFExportDialog) {
                    window.showPDFExportDialog();
                }
                break;
            case 'share-link':
                if (window.showShareLinkDialog) {
                    window.showShareLinkDialog();
                } else {
                    const shareBtn = document.getElementById('action-copy-link');
                    if (shareBtn) shareBtn.click();
                }
                break;
            case 'new-song':
                if (window.showSongBuilderModal) {
                    window.showSongBuilderModal();
                }
                break;
            case 'version-history':
                if (window.showVersionHistoryPanel) {
                    window.showVersionHistoryPanel();
                }
                break;
            case 'create-checkpoint':
                // Prompt for checkpoint name before creating
                promptAndCreateCheckpoint();
                break;
            case 'import-midi':
                if (window.showMIDIImportDialog) {
                    window.showMIDIImportDialog();
                }
                break;
            case 'export-audio':
                if (window.showAudioExportDialog) {
                    window.showAudioExportDialog();
                }
                break;
            case 'export-musicxml':
                if (window.showMusicXMLExportDialog) {
                    window.showMusicXMLExportDialog();
                }
                break;
            case 'import-musicxml':
                if (window.showMusicXMLImportDialog) {
                    window.showMusicXMLImportDialog();
                }
                break;

            // Help actions
            case 'start-here':
                window.location.href = 'start-here.html';
                break;
            case 'keyboard-shortcuts':
                if (window.showNotationShortcuts) {
                    window.showNotationShortcuts();
                }
                break;

            default:
                console.warn('Unknown FAB action:', action);
        }
    }

    // Initialize the FAB settings panel
    initFabSettingsPanel();
}

/**
 * Initialize FAB Settings Panel controls
 * Syncs with the main settings controls in the action bar
 */
function initFabSettingsPanel() {
    // BPM Slider (FAB is the single source of truth for BPM)
    const fabBpmSlider = document.getElementById('fab-bpm-slider');
    const fabBpmValue = document.getElementById('fab-bpm-value');

    if (fabBpmSlider && fabBpmValue) {
        // Initialize from interactiveMelody.tempo or default
        const interactiveMelody = window.getInteractiveMelody?.() || {};
        const initialTempo = interactiveMelody.tempo || window.g_Tempo || 120;
        fabBpmSlider.value = initialTempo;
        fabBpmValue.textContent = initialTempo;

        fabBpmSlider.addEventListener('input', (e) => {
            const bpm = parseInt(e.target.value);
            fabBpmValue.textContent = bpm;
            // Apply BPM change globally
            window.g_Tempo = bpm;
            if (window.setPlaybackBPM) window.setPlaybackBPM(bpm);
            // Update interactiveMelody.tempo for Play All
            if (window.setMelodyTempo) window.setMelodyTempo(bpm);
            // Update compositionState settings
            const compositionState = window.getCompositionState?.();
            if (compositionState?.setSettings) {
                const currentSettings = compositionState.getSettings?.() || {};
                compositionState.setSettings({ ...currentSettings, tempo: bpm });
            }
            // Dispatch event for guided mode tutorials
            dispatchBuilderEvent('bpmChanged', { bpm });
        });
    }

    // Arpeggio Speed
    const fabArpSlower = document.getElementById('fab-arp-slower');
    const fabArpFaster = document.getElementById('fab-arp-faster');
    const fabArpSpeed = document.getElementById('fab-arp-speed');
    const actionArpSpeed = document.getElementById('action-arp-speed');

    const arpSpeeds = ['Slow', 'Medium', 'Fast'];
    let currentArpIndex = 1; // Default to Medium

    // Sync initial value
    if (actionArpSpeed && fabArpSpeed) {
        fabArpSpeed.textContent = actionArpSpeed.textContent;
        currentArpIndex = arpSpeeds.indexOf(actionArpSpeed.textContent);
        if (currentArpIndex === -1) currentArpIndex = 1;
    }

    // Reference to isHandlingAction flag from outer scope
    const getIsHandlingAction = () => window._fabIsHandlingAction;
    const setIsHandlingAction = (val) => { window._fabIsHandlingAction = val; };

    if (fabArpSlower) {
        fabArpSlower.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsHandlingAction(true);
            if (currentArpIndex > 0) {
                currentArpIndex--;
                const speed = arpSpeeds[currentArpIndex];
                if (fabArpSpeed) fabArpSpeed.textContent = speed;
                if (actionArpSpeed) actionArpSpeed.textContent = speed;
                // Call arpeggio speed function directly (works without action bar)
                if (window.changeArpeggioSpeed) {
                    window.changeArpeggioSpeed('slower');
                }
            }
            setTimeout(() => setIsHandlingAction(false), 100);
        });
    }

    if (fabArpFaster) {
        fabArpFaster.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsHandlingAction(true);
            if (currentArpIndex < arpSpeeds.length - 1) {
                currentArpIndex++;
                const speed = arpSpeeds[currentArpIndex];
                if (fabArpSpeed) fabArpSpeed.textContent = speed;
                if (actionArpSpeed) actionArpSpeed.textContent = speed;
                // Call arpeggio speed function directly (works without action bar)
                if (window.changeArpeggioSpeed) {
                    window.changeArpeggioSpeed('faster');
                }
            }
            setTimeout(() => setIsHandlingAction(false), 100);
        });
    }

    // RH Octave controls (Chord Lab only)
    const fabRhOctaveDown = document.getElementById('fab-rh-octave-down');
    const fabRhOctaveUp = document.getElementById('fab-rh-octave-up');
    const fabRhOctave = document.getElementById('fab-rh-octave');
    const builderOctaveDisplay = document.getElementById('builder-octave-display');

    // Sync initial value from builder display
    if (fabRhOctave && builderOctaveDisplay) {
        // Extract just the number from "Oct: 0" format
        const match = builderOctaveDisplay.textContent.match(/-?\d+/);
        if (match) {
            fabRhOctave.textContent = match[0];
        }
    }

    // Guard to prevent double-firing octave changes
    let octaveChangeInProgress = false;

    if (fabRhOctaveDown && !fabRhOctaveDown.dataset.listenerAttached) {
        fabRhOctaveDown.dataset.listenerAttached = 'true';
        fabRhOctaveDown.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();

            // Prevent rapid double-clicks
            if (octaveChangeInProgress) {
                return;
            }

            octaveChangeInProgress = true;
            setIsHandlingAction(true);

            if (window.changeBuilderOctave) {
                window.changeBuilderOctave(-1);
                // Stop the chord after a brief preview (500ms)
                setTimeout(() => {
                    if (window.stopBuilderChord) window.stopBuilderChord();
                }, 500);
                // Sync display
                setTimeout(() => {
                    if (fabRhOctave && builderOctaveDisplay) {
                        const match = builderOctaveDisplay.textContent.match(/-?\d+/);
                        if (match) fabRhOctave.textContent = match[0];
                    }
                }, 50);
            }

            setTimeout(() => {
                setIsHandlingAction(false);
                octaveChangeInProgress = false;
            }, 150);
        });
    }

    if (fabRhOctaveUp && !fabRhOctaveUp.dataset.listenerAttached) {
        fabRhOctaveUp.dataset.listenerAttached = 'true';
        fabRhOctaveUp.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();

            // Prevent rapid double-clicks
            if (octaveChangeInProgress) {
                return;
            }

            octaveChangeInProgress = true;
            setIsHandlingAction(true);

            if (window.changeBuilderOctave) {
                window.changeBuilderOctave(1);
                // Stop the chord after a brief preview (500ms)
                setTimeout(() => {
                    if (window.stopBuilderChord) window.stopBuilderChord();
                }, 500);
                // Sync display
                setTimeout(() => {
                    if (fabRhOctave && builderOctaveDisplay) {
                        const match = builderOctaveDisplay.textContent.match(/-?\d+/);
                        if (match) fabRhOctave.textContent = match[0];
                    }
                }, 50);
            }

            setTimeout(() => {
                setIsHandlingAction(false);
                octaveChangeInProgress = false;
            }, 150);
        });
    }

    // Loop Toggle
    const fabLoopToggle = document.getElementById('fab-loop-toggle');
    const actionLoopToggle = document.getElementById('action-loop-toggle');

    if (fabLoopToggle) {
        // Sync initial value
        if (actionLoopToggle) {
            fabLoopToggle.checked = actionLoopToggle.checked;
        }

        fabLoopToggle.addEventListener('change', (e) => {
            e.stopPropagation();
            const isLooping = e.target.checked;
            if (actionLoopToggle) actionLoopToggle.checked = isLooping;
            if (window.setLoopPlayback) window.setLoopPlayback(isLooping);
        });
    }

    // Highlight Notes Toggle
    const fabHighlightToggle = document.getElementById('fab-highlight-toggle');
    const actionHighlightToggle = document.getElementById('action-highlight-toggle');

    if (fabHighlightToggle) {
        // Sync initial value
        if (actionHighlightToggle) {
            fabHighlightToggle.checked = actionHighlightToggle.checked;
        }

        fabHighlightToggle.addEventListener('change', (e) => {
            e.stopPropagation();
            const highlight = e.target.checked;
            if (actionHighlightToggle) actionHighlightToggle.checked = highlight;
            if (window.setHighlightNotes) window.setHighlightNotes(highlight);
        });
    }
}

/**
 * Prompt for checkpoint name and create a checkpoint
 * Used by FAB action handler
 */
async function promptAndCreateCheckpoint() {
    const name = await showPromptModal({
        title: 'Create Checkpoint',
        message: 'Enter a name for this checkpoint:',
        placeholder: 'e.g., Before refactoring, Working version...',
        confirmText: 'Create',
    });

    if (name && name.trim()) {
        if (window.createCheckpoint) {
            const result = window.createCheckpoint(name.trim());
            if (result && result.success) {
                // Show success feedback using toast if available
                if (window.toast?.success) {
                    window.toast.success(`Checkpoint "${name.trim()}" created`);
                }
            } else {
                // Show error feedback
                if (window.toast?.error) {
                    window.toast.error(result?.error || 'Failed to create checkpoint');
                }
            }
        }
    }
}
