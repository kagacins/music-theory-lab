/**
 * letItBeTutorial.js
 *
 * "Let It Be" Interactive Tutorial System
 * Teaches users how to create the iconic Beatles chorus using guided mode.
 *
 * Provides two tutorial paths:
 * 1. Chords Tutorial - Creating the Am-G-F-C progression
 * 2. Melody Tutorial - Adding the vocal melody to the progression
 *
 * Extracted from main.js during Phase 3 refactoring.
 */

/**
 * Start the Let It Be tutorial - entry point from landing page or button
 * Handles transition from landing page if needed, then launches tutorial selection modal
 */
export function startLetItBeTutorial() {
    const landingPage = document.getElementById('landing-page');
    const mainApp = document.getElementById('main-app');

    // If we're on the landing page, enter the app first
    if (landingPage && !landingPage.classList.contains('hidden')) {
        // Fade out landing page
        landingPage.style.transition = 'opacity 0.3s ease-out';
        landingPage.style.opacity = '0';

        setTimeout(() => {
            landingPage.classList.add('hidden');
            mainApp.classList.remove('hidden');

            // Fade in main app
            mainApp.style.opacity = '0';
            mainApp.style.transition = 'opacity 0.3s ease-in';
            setTimeout(() => {
                mainApp.style.opacity = '1';
                // Switch to Chord Lab and start the tutorial
                if (window.switchTab) {
                    window.switchTab('builder');
                }
                // Start the guided tutorial after a brief delay
                setTimeout(() => {
                    launchLetItBeTutorial();
                }, 500);
            }, 50);
        }, 300);
    } else {
        // Already in the app, just start the tutorial
        if (window.switchTab) {
            window.switchTab('builder');
        }
        setTimeout(() => {
            launchLetItBeTutorial();
        }, 300);
    }
}

/**
 * Launch the Let It Be tutorial steps
 * This is called after the app is ready and we're on the Chord Lab tab
 */
function launchLetItBeTutorial() {
    // Check if the guided mode system is available
    if (!window.startGuidedMode) {
        console.warn('[LetItBeTutorial] Guided mode not available yet. Retrying...');
        setTimeout(launchLetItBeTutorial, 500);
        return;
    }

    // Show modal with choice of Verse, Chorus, or Melody tutorial
    showTutorialStartModal(
        // Verse tutorial callback (recommended)
        () => {
            actuallyLaunchLetItBeVerseTutorial();
        },
        // Chorus tutorial callback
        () => {
            actuallyLaunchLetItBeChorusTutorial();
        },
        // Melody tutorial callback
        () => {
            actuallyLaunchLetItBeMelodyTutorial();
        }
    );
}

/**
 * Show a modal explaining the tutorial options
 */
function showTutorialStartModal(onConfirmVerse, onConfirmChorus, onConfirmMelody) {
    // Remove any existing modal
    const existingModal = document.getElementById('tutorial-start-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'tutorial-start-modal';
    modal.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/50';
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl max-w-lg mx-4 p-6">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <span class="text-2xl">🎸</span>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-gray-900">"Let It Be" Interactive Tutorial</h3>
                    <p class="text-sm text-gray-500">Learn to create the iconic Beatles chorus</p>
                </div>
            </div>
            <div class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p class="text-sm text-amber-800">
                    <strong>Note:</strong> These tutorials will clear any existing chord progression so you can start fresh. Your work will not be saved.
                </p>
            </div>
            <p class="text-gray-600 mb-4">
                Choose which part of "Let It Be" you'd like to learn:
            </p>
            <div class="space-y-3 mb-6">
                <button id="tutorial-start-verse" class="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-all font-medium flex items-center gap-3">
                    <span class="text-2xl">🎹</span>
                    <div class="text-left">
                        <div class="font-bold">Create Chords of Verse (Recommended)</div>
                        <div class="text-sm opacity-90">C-G-Am-F with inversions, grouping, duplication (start here!)</div>
                    </div>
                </button>
                <button id="tutorial-start-chorus" class="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all font-medium flex items-center gap-3">
                    <span class="text-2xl">🎹</span>
                    <div class="text-left">
                        <div class="font-bold">Create Chords of Chorus</div>
                        <div class="text-sm opacity-90">Am-G-F-C with drag & drop reordering, Quick Add, BPM</div>
                    </div>
                </button>
                <button id="tutorial-start-melody" class="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 transition-all font-medium flex items-center gap-3 opacity-60">
                    <span class="text-2xl">🎵</span>
                    <div class="text-left">
                        <div class="font-bold">Create Melody of Chorus (WIP)</div>
                        <div class="text-sm opacity-90">Learn VexFlow notation, add melody notes (coming soon)</div>
                    </div>
                </button>
            </div>
            <div class="flex justify-end">
                <button id="tutorial-start-cancel" class="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                    Cancel
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('tutorial-start-cancel').addEventListener('click', () => {
        modal.remove();
    });

    document.getElementById('tutorial-start-verse').addEventListener('click', () => {
        modal.remove();
        if (onConfirmVerse) onConfirmVerse();
    });

    document.getElementById('tutorial-start-chorus').addEventListener('click', () => {
        modal.remove();
        if (onConfirmChorus) onConfirmChorus();
    });

    document.getElementById('tutorial-start-melody').addEventListener('click', () => {
        modal.remove();
        if (onConfirmMelody) onConfirmMelody();
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

/**
 * Launch the "Let It Be" Verse Tutorial
 * Linear flow: C-G-Am-F with G in 1st inversion, grouping, duplication
 * Complete implementation restored from git commit 6c31253
 */
function actuallyLaunchLetItBeVerseTutorial() {
    console.log('[LetItBeVerseTutorial] Starting verse tutorial, clearing progression...');

    // Set flag to suppress Theory Moments during tutorial setup
    window.isTutorialSetupInProgress = true;

    // Clear the progression first
    clearProgression(true);

    // Reset BPM to 120
    const defaultBpm = 120;
    window.g_Tempo = defaultBpm;
    if (window.setPlaybackBPM) window.setPlaybackBPM(defaultBpm);
    if (window.setMelodyTempo) window.setMelodyTempo(defaultBpm);
    const fabBpmSlider = document.getElementById('fab-bpm-slider');
    const fabBpmValue = document.getElementById('fab-bpm-value');
    if (fabBpmSlider) fabBpmSlider.value = defaultBpm;
    if (fabBpmValue) fabBpmValue.textContent = defaultBpm;

    // Disable chord card tooltips during tutorial
    document.body.classList.add('progression-tooltips-disabled');

    // Helper function to expand Composition Studio panels
    function expandCompositionStudioPanels() {
        const chordProgressionPanel = document.getElementById('chord-progression-card-panel');
        const chordProgressionChevron = document.getElementById('chord-progression-card-chevron');
        if (chordProgressionPanel && chordProgressionPanel.classList.contains('hidden')) {
            chordProgressionPanel.classList.remove('hidden');
            if (chordProgressionChevron) chordProgressionChevron.classList.add('rotate-180');
        }
        const setupPanel = document.getElementById('melody-progression-setup-panel');
        const setupChevron = document.getElementById('melody-progression-setup-chevron');
        if (setupPanel && setupPanel.classList.contains('hidden')) {
            setupPanel.classList.remove('hidden');
            if (setupChevron) setupChevron.classList.add('rotate-180');
        }
    }

    const verseTutorialSteps = [
        // ========== INTRODUCTION ==========
        {
            instruction: 'Welcome! We\'re going to create the verse of "Let It Be" by The Beatles.',
            callout: '🎸 The verse uses the classic C-G-Am-F progression. You\'ll learn: Chord Lab, inversions, grouping, and duplication!',
            validation: null,
            successMessage: null
        },
        // ========== GO TO COMPOSITION STUDIO TO SET KEY ==========
        {
            instruction: '🎹 First, let\'s set the key. Click the "Composition Studio" tab.',
            spotlight: '#header-tab-btn-melody',
            targetElement: '#header-tab-btn-melody',
            callout: 'We\'ll set the key to C Major so our chords show Roman numerals correctly.',
            isActionStep: true,
            validation: { type: 'tab_selected', value: 'melody' },
            successMessage: 'Welcome to the Composition Studio!',
            quickAdvance: true
        },
        {
            instruction: 'Click the "Key" button to open the Circle of Fifths.',
            spotlight: '#melody-key-button',
            targetElement: '#melody-key-button',
            callout: '"Let It Be" is in C Major - the most common key for pop songs!',
            isActionStep: true,
            validation: { type: 'circle_of_fifths_opened' },
            successMessage: 'Circle of Fifths opened!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        {
            instruction: 'Click on "C" in the Circle of Fifths to set the key to C Major.',
            spotlight: '#circle-of-fifths-panel',
            targetElement: '#circle-of-fifths-panel',
            spotlightExtraHeight: 50,
            callout: 'C Major has no sharps or flats.',
            isActionStep: true,
            validation: { type: 'progression_key_changed', value: 'C Major' },
            successMessage: 'Key set to C Major!',
            quickAdvance: true
        },
        // ========== NAVIGATE TO CHORD LAB ==========
        {
            instruction: '🎵 Now let\'s go to the Chord Lab to build our chords. Click the "Chord Lab" tab.',
            spotlight: '#header-tab-btn-builder',
            targetElement: '#header-tab-btn-builder',
            callout: 'The Chord Lab is where you create and explore individual chords.',
            isActionStep: true,
            validation: { type: 'tab_selected', value: 'builder' },
            successMessage: 'Welcome to the Chord Lab!',
            quickAdvance: true
        },
        // ========== CHORD 1: C Major ==========
        {
            instruction: 'Let\'s build the first chord. Select "C" as the root note.',
            spotlight: '#builder-note-selector',
            targetElement: '#builder-note-selector',
            callout: 'The verse starts with C Major - the I chord (home base).',
            validation: { type: 'root_selected', value: 'C' },
            successMessage: 'C selected!',
            quickAdvance: true
        },
        {
            instruction: 'Select "Major" as the chord type.',
            spotlight: '#builder-chord-type-selector',
            targetElement: '#builder-chord-type-selector',
            callout: 'C Major gives us that bright, stable foundation.',
            validation: { type: 'type_selected', value: 'Major' },
            successMessage: 'Major selected!',
            quickAdvance: true
        },
        {
            instruction: 'Click the purple "+" button to add C Major to your progression.',
            spotlight: '#fab-add-chord-quick',
            targetElement: '#fab-add-chord-quick',
            callout: 'First chord of the verse!',
            validation: { type: 'chord_added_to_progression', value: 'C Major' },
            successMessage: 'C Major added!'
        },
        // ========== CHORD 2: G Major (1st Inversion) ==========
        {
            instruction: 'Now select "G" as the root for the second chord.',
            spotlight: '#builder-note-selector',
            targetElement: '#builder-note-selector',
            callout: 'G Major (V chord) creates tension that wants to resolve.',
            validation: { type: 'root_selected', value: 'G' },
            successMessage: 'G selected!',
            quickAdvance: true
        },
        {
            instruction: 'Keep "Major" selected (it should already be).',
            spotlight: '#builder-chord-type-selector',
            targetElement: '#builder-chord-type-selector',
            callout: 'G Major is the dominant chord - very powerful!',
            validation: { type: 'type_selected', value: 'Major' },
            successMessage: 'Major selected!',
            quickAdvance: true
        },
        {
            instruction: 'Click the purple "+" button to add G Major.',
            spotlight: '#fab-add-chord-quick',
            targetElement: '#fab-add-chord-quick',
            callout: 'We\'ll change this to 1st inversion in the Composition Studio later.',
            validation: { type: 'chord_added_to_progression', value: 'G Major' },
            successMessage: 'G Major added!'
        },
        // ========== CHORD 3: Am ==========
        {
            instruction: 'Select "A" as the root for the third chord.',
            spotlight: '#builder-note-selector',
            targetElement: '#builder-note-selector',
            callout: 'Am (vi chord) adds that emotional, melancholic touch.',
            validation: { type: 'root_selected', value: 'A' },
            successMessage: 'A selected!',
            quickAdvance: true
        },
        {
            instruction: 'Select "Minor" as the chord type.',
            spotlight: '#builder-chord-type-selector',
            targetElement: '#builder-chord-type-selector',
            callout: 'The minor chord gives the verse its reflective quality.',
            validation: { type: 'type_selected', value: 'Minor' },
            successMessage: 'Minor selected!',
            quickAdvance: true
        },
        {
            instruction: 'Click the purple "+" button to add Am.',
            spotlight: '#fab-add-chord-quick',
            targetElement: '#fab-add-chord-quick',
            callout: 'Third chord done!',
            validation: { type: 'chord_added_to_progression', value: 'A Minor' },
            successMessage: 'Am added!'
        },
        // ========== CHORD 4: F Major ==========
        {
            instruction: 'Select "F" as the root for the fourth and final chord.',
            spotlight: '#builder-note-selector',
            targetElement: '#builder-note-selector',
            callout: 'F Major (IV chord) completes our classic progression.',
            validation: { type: 'root_selected', value: 'F' },
            successMessage: 'F selected!',
            quickAdvance: true
        },
        {
            instruction: 'Select "Major" as the chord type.',
            spotlight: '#builder-chord-type-selector',
            targetElement: '#builder-chord-type-selector',
            callout: 'F Major - the subdominant that leads us back to C.',
            validation: { type: 'type_selected', value: 'Major' },
            successMessage: 'Major selected!',
            quickAdvance: true
        },
        {
            instruction: 'Click the purple "+" button to add F Major.',
            spotlight: '#fab-add-chord-quick',
            targetElement: '#fab-add-chord-quick',
            callout: 'We now have the complete C-G-Am-F progression!',
            validation: { type: 'chord_added_to_progression', value: 'F Major' },
            successMessage: 'F Major added! All four chords complete.'
        },
        // ========== SWITCH TO COMPOSITION STUDIO ==========
        {
            instruction: 'Great! Now click "Composition Studio" to edit our chords.',
            spotlight: '#header-tab-btn-melody',
            targetElement: '#header-tab-btn-melody',
            callout: 'Time to add the inversion and set up our verse!',
            validation: { type: 'tab_selected', value: 'melody' },
            successMessage: 'Welcome to the Composition Studio!',
            quickAdvance: true
        },
        // ========== EDIT G INVERSION ==========
        {
            instruction: '🔧 Let\'s improve voice leading! Click the "⋯" button on the G Major chord card to expand it.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 100,
            callout: 'Paul McCartney plays G in 1st inversion (B in bass) for smoother voice leading.',
            isActionStep: true,
            validation: { type: 'chord_card_expanded' },
            successMessage: 'Card expanded!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        {
            instruction: '🎹 In the yellow "🎹 Inversion" section, click "1" to select 1st inversion.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 200,
            callout: 'This puts B in the bass, keeping the top note (G) constant from the C chord.',
            isActionStep: true,
            validation: { type: 'chord_card_edited', property: 'inversion' },
            successMessage: 'G is now 1st inversion! The bass line is smoother.',
            quickAdvance: true,
            onEnter: () => {
                setTimeout(() => {
                    const invSections = document.querySelectorAll('.chord-card-inversion-section');
                    invSections.forEach(section => {
                        section.classList.add('animate-pulse');
                        section.style.boxShadow = '0 0 10px 3px rgba(234, 179, 8, 0.6)';
                    });
                }, 300);
            },
            onExit: () => {
                const invSections = document.querySelectorAll('.chord-card-inversion-section');
                invSections.forEach(section => {
                    section.classList.remove('animate-pulse');
                    section.style.boxShadow = '';
                });
            }
        },
        // ========== COLLAPSE CHORD CARD ==========
        {
            instruction: 'Click the "×" button to collapse the chord card.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 200,
            callout: 'Collapse the card to continue.',
            isActionStep: true,
            validation: { type: 'all_cards_collapsed' },
            successMessage: 'Card collapsed!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== CHANGE DURATION TO HALF NOTES ==========
        {
            instruction: '🎵 Change all chord durations to "2" (half notes). Find the Duration dropdowns below each card.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 50,
            callout: 'Each chord gets 2 beats. 4 chords × 2 beats = 8 beats (2 measures).',
            isActionStep: true,
            validation: { type: 'all_chords_duration', beats: 2 },
            successMessage: 'All chords set to half notes!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== SELECT ALL CHORDS ==========
        {
            instruction: '📁 Select all 4 chords: Click the first chord, then Shift+click the last chord.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 100,
            callout: 'Multi-select lets you group and manage chords together!',
            isActionStep: true,
            validation: { type: 'all_chords_selected', expectedCount: 4 },
            successMessage: 'All 4 chords selected!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== CLICK +ADD SECTION ==========
        {
            instruction: '➕ Click the "+Add Section" button in the header toolbar.',
            spotlight: 'button[title="Add Section"]',
            targetElement: 'button[title="Add Section"]',
            spotlightPadding: 10,
            callout: 'This groups your selected chords into a named section.',
            isActionStep: true,
            validation: { type: 'add_section_menu_opened' },
            successMessage: 'Section menu opened!',
            quickAdvance: true,
            onEnter: () => {
                expandCompositionStudioPanels();
                // Highlight the +Add Section button
                setTimeout(() => {
                    const addSectionBtn = document.querySelector('button[title="Add Section"]');
                    if (addSectionBtn) {
                        addSectionBtn.classList.add('animate-pulse');
                        addSectionBtn.style.boxShadow = '0 0 15px 5px rgba(255, 255, 255, 0.8)';
                    }
                }, 300);
            },
            onExit: () => {
                const addSectionBtn = document.querySelector('button[title="Add Section"]');
                if (addSectionBtn) {
                    addSectionBtn.classList.remove('animate-pulse');
                    addSectionBtn.style.boxShadow = '';
                }
            }
        },
        // ========== CLICK VERSE ==========
        {
            instruction: '🎼 Click "Verse" from the section type menu.',
            // No spotlight - the menu is already visible and we'll highlight it via onEnter
            spotlight: null,
            targetElement: null,
            callout: 'Naming sections helps organize your composition!',
            isActionStep: true,
            validation: { type: 'chords_grouped', groupName: 'verse' },
            successMessage: 'Chords grouped as "Verse"!',
            quickAdvance: true,
            onEnter: () => {
                // Wait for menu to appear and highlight it
                const highlightMenu = () => {
                    const menu = document.querySelector('.section-type-menu');
                    if (menu) {
                        menu.style.boxShadow = '0 0 20px 5px rgba(147, 51, 234, 0.7)';
                        menu.style.border = '2px solid rgba(147, 51, 234, 0.8)';
                        // Find and highlight the Verse button
                        const buttons = menu.querySelectorAll('button');
                        buttons.forEach(btn => {
                            if (btn.textContent.includes('Verse')) {
                                btn.classList.add('animate-pulse');
                                btn.style.backgroundColor = 'rgba(147, 51, 234, 0.3)';
                            }
                        });
                    } else {
                        // Menu not found yet, retry
                        setTimeout(highlightMenu, 50);
                    }
                };
                setTimeout(highlightMenu, 50);
            },
            onExit: () => {
                const menu = document.querySelector('.section-type-menu');
                if (menu) {
                    menu.style.boxShadow = '';
                    menu.style.border = '';
                    const buttons = menu.querySelectorAll('button');
                    buttons.forEach(btn => {
                        btn.classList.remove('animate-pulse');
                        btn.style.backgroundColor = '';
                    });
                }
            }
        },
        // ========== CLICK SECTION MENU (KEBAB) ==========
        {
            instruction: '⋮ Click the three dots menu (⋮) in the upper right corner of the Verse section.',
            spotlight: '.section-menu-btn',
            targetElement: '.section-menu-btn',
            spotlightPadding: 8,
            callout: 'This opens the section options menu.',
            isActionStep: true,
            validation: { type: 'section_menu_opened' },
            successMessage: 'Section menu opened!',
            quickAdvance: true,
            onEnter: () => {
                expandCompositionStudioPanels();
                setTimeout(() => {
                    const menuBtn = document.querySelector('.section-menu-btn');
                    if (menuBtn) {
                        menuBtn.classList.add('animate-pulse');
                        menuBtn.style.boxShadow = '0 0 15px 5px rgba(255, 255, 255, 0.8)';
                    }
                }, 300);
            },
            onExit: () => {
                const menuBtn = document.querySelector('.section-menu-btn');
                if (menuBtn) {
                    menuBtn.classList.remove('animate-pulse');
                    menuBtn.style.boxShadow = '';
                }
            }
        },
        // ========== CLICK DUPLICATE IN MENU ==========
        {
            instruction: '📋 Click "Duplicate" from the menu.',
            spotlight: '.section-context-menu',
            targetElement: '.section-context-menu',
            spotlightPadding: 10,
            callout: 'This will open the duplication options dialog.',
            isActionStep: true,
            validation: { type: 'duplicate_dialog_opened' },
            successMessage: 'Duplicate dialog opened!',
            quickAdvance: true,
            onEnter: () => {
                // Highlight the Duplicate option in the menu
                const highlightDuplicate = () => {
                    const menu = document.querySelector('.section-context-menu');
                    if (menu) {
                        menu.style.boxShadow = '0 0 20px 5px rgba(99, 102, 241, 0.5)';
                        const buttons = menu.querySelectorAll('button');
                        buttons.forEach(btn => {
                            if (btn.textContent.includes('Duplicate')) {
                                btn.classList.add('animate-pulse');
                                btn.style.backgroundColor = 'rgba(99, 102, 241, 0.2)';
                            }
                        });
                    } else {
                        setTimeout(highlightDuplicate, 50);
                    }
                };
                setTimeout(highlightDuplicate, 50);
            },
            onExit: () => {
                const menu = document.querySelector('.section-context-menu');
                if (menu) {
                    menu.style.boxShadow = '';
                    const buttons = menu.querySelectorAll('button');
                    buttons.forEach(btn => {
                        btn.classList.remove('animate-pulse');
                        btn.style.backgroundColor = '';
                    });
                }
            }
        },
        // ========== CLICK DUPLICATE IN DIALOG ==========
        {
            instruction: '📋 "Bass clef / Chords only" is already selected. Click the "Duplicate" button.',
            spotlight: '.duplicate-section-dialog-overlay',
            targetElement: '.duplicate-section-dialog-overlay',
            spotlightPadding: 20,
            callout: 'This duplicates the chords with empty treble clef for new melody writing.',
            isActionStep: true,
            validation: { type: 'group_duplicated' },
            successMessage: 'Group duplicated! You now have 8 chords.',
            quickAdvance: true,
            onEnter: () => {
                // Highlight the Duplicate button in the dialog
                const highlightDialog = () => {
                    const dialog = document.querySelector('.duplicate-section-dialog-overlay');
                    if (dialog) {
                        const duplicateBtn = dialog.querySelector('.duplicate-btn');
                        if (duplicateBtn) {
                            duplicateBtn.classList.add('animate-pulse');
                            duplicateBtn.style.boxShadow = '0 0 15px 5px rgba(99, 102, 241, 0.6)';
                        }
                    } else {
                        setTimeout(highlightDialog, 50);
                    }
                };
                setTimeout(highlightDialog, 50);
            },
            onExit: () => {
                const dialog = document.querySelector('.duplicate-section-dialog-overlay');
                if (dialog) {
                    const duplicateBtn = dialog.querySelector('.duplicate-btn');
                    if (duplicateBtn) {
                        duplicateBtn.classList.remove('animate-pulse');
                        duplicateBtn.style.boxShadow = '';
                    }
                }
            }
        },
        // ========== DELETE 7TH CHORD (Am) ==========
        {
            instruction: '🗑️ Delete the 7th chord (Am, 2nd to last) by clicking the × icon on its card.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 150,
            callout: 'We\'ll modify the ending for a proper verse resolution.',
            isActionStep: true,
            validation: { type: 'chord_deleted' },
            successMessage: 'Chord deleted!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== EXPAND LAST CHORD CARD ==========
        {
            instruction: '🎹 Click on the last chord (F) to expand its card.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 150,
            callout: 'We\'ll change F to 2nd inversion (F/C) for a smooth resolution.',
            isActionStep: true,
            validation: { type: 'chord_card_expanded' },
            successMessage: 'Card expanded!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== CHANGE TO F/C (2ND INVERSION) ==========
        {
            instruction: '🎹 In the yellow "🎹 Inversion" section, click "2" to select 2nd inversion (F/C).',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 200,
            callout: 'F/C (2nd inversion) puts C in the bass - perfect for resolving back to C Major!',
            isActionStep: true,
            validation: { type: 'chord_card_edited', property: 'inversion' },
            successMessage: 'F is now 2nd inversion (F/C)!',
            quickAdvance: true,
            onEnter: () => {
                setTimeout(() => {
                    const invSections = document.querySelectorAll('.chord-card-inversion-section');
                    invSections.forEach(section => {
                        section.classList.add('animate-pulse');
                        section.style.boxShadow = '0 0 10px 3px rgba(234, 179, 8, 0.6)';
                    });
                }, 300);
            },
            onExit: () => {
                const invSections = document.querySelectorAll('.chord-card-inversion-section');
                invSections.forEach(section => {
                    section.classList.remove('animate-pulse');
                    section.style.boxShadow = '';
                });
            }
        },
        // ========== COLLAPSE CHORD CARD ==========
        {
            instruction: 'Click the "×" button to collapse the chord card.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 150,
            callout: 'Collapse the card to access the duration dropdown.',
            isActionStep: true,
            validation: { type: 'all_cards_collapsed' },
            successMessage: 'Card collapsed!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== CHANGE DURATION TO WHOLE NOTE ==========
        {
            instruction: '🎵 Change the last chord\'s duration to "4" (whole note) using the Duration dropdown below the card.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 150,
            callout: 'The final F/C gets 4 beats, giving the verse a strong ending.',
            isActionStep: true,
            validation: { type: 'single_chord_duration', beats: 4 },
            successMessage: 'Duration set to whole note!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== FAB: BPM ==========
        {
            instruction: '⚙️ Click the floating action button (purple +) to open settings.',
            spotlight: '#mobile-fab-main',
            targetElement: '#mobile-fab-main',
            callout: 'Let\'s set the tempo for a ballad feel.',
            isActionStep: true,
            validation: { type: 'fab_opened' },
            successMessage: 'FAB opened!',
            quickAdvance: true
        },
        {
            instruction: 'Click the Settings button (gear icon) to see BPM controls.',
            spotlight: '.fab-category[data-category="settings"]',
            targetElement: '.fab-category[data-category="settings"]',
            callout: 'The Settings section contains tempo controls.',
            isActionStep: true,
            validation: { type: 'settings_section_clicked' },
            successMessage: 'Settings expanded!',
            quickAdvance: true
        },
        {
            instruction: 'Set the BPM to around 70 for the classic ballad feel.',
            spotlight: '#fab-bpm-slider',
            targetElement: '#fab-bpm-slider',
            callout: '"Let It Be" is a ballad at ~70 BPM.',
            isActionStep: true,
            validation: { type: 'bpm_changed', minBpm: 65, maxBpm: 75 },
            successMessage: 'Perfect tempo!',
            quickAdvance: true
        },
        {
            instruction: '📱 Close the FAB menu by tapping the purple + button.',
            spotlight: '#mobile-fab-main',
            targetElement: '#mobile-fab-main',
            callout: 'Close the menu to access the Play button.',
            isActionStep: true,
            validation: { type: 'fab_closed' },
            successMessage: 'Great!',
            quickAdvance: true
        },
        // ========== FINAL PLAYBACK ==========
        {
            instruction: '🎵 Click the green "Play" button to hear your verse!',
            spotlight: '#fab-play-all-quick',
            targetElement: '#fab-play-all-quick',
            callout: 'You\'ve built the complete "Let It Be" verse with proper voice leading!',
            isActionStep: true,
            validation: { type: 'progression_played' },
            successMessage: 'Beautiful! The verse sounds great!',
            quickAdvance: true,
            onEnter: () => {
                // Scroll the notation into view so it's visible during playback
                setTimeout(() => {
                    const notationContainer = document.querySelector('.notation-canvas-wrapper') ||
                                              document.getElementById('staff-notation-card-panel') ||
                                              document.getElementById('staff-notation-card');
                    if (notationContainer) {
                        notationContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            }
        },
        // ========== COMPLETION ==========
        {
            instruction: '🎉 Congratulations! You\'ve completed the "Let It Be" Verse tutorial!',
            callout: '📚 You learned: Adding chords in Chord Lab, Editing inversions for voice leading, Changing durations, Multi-selecting chords, Grouping & duplicating sections, Deleting chords, and Adjusting BPM!',
            validation: null,
            successMessage: null,
            allowFreeExplore: true
        }
    ];

    // Clear setup flag now that guided mode is starting
    window.isTutorialSetupInProgress = false;

    // Start the guided mode
    window.startGuidedMode({
        lessonId: 'let-it-be-verse-tutorial',
        lessonTitle: '"Let It Be" Verse Interactive Tutorial',
        targetTab: 'builder',
        steps: verseTutorialSteps,
        onComplete: (actionHistory) => {
            console.log('[LetItBeVerseTutorial] Tutorial completed!', actionHistory);
            if (window.switchTab) {
                window.switchTab('melody');
            }
            if (window.showModal) {
                window.showModal('🎉 Congratulations! You\'ve completed the "Let It Be" Verse tutorial! You now know how to build, edit, group, and duplicate chord progressions.', true);
            }
        },
        onCancel: () => {
            console.log('[LetItBeVerseTutorial] Tutorial cancelled by user.');
            if (window.switchTab) {
                window.switchTab('melody');
            }
        }
    });
}

/**
 * Launch the "Let It Be" Chorus Tutorial
 * Am-G-F-C progression with drag & drop, Quick Add, BPM
 * Complete implementation restored from git commit 6c31253
 * Note: In git this was named actuallyLaunchLetItBeTutorial (without Chorus suffix)
 */
function actuallyLaunchLetItBeChorusTutorial() {
    console.log('[LetItBeTutorial] Starting tutorial, clearing progression...');

    // Set flag to suppress Theory Moments during tutorial setup
    window.isTutorialSetupInProgress = true;

    // Clear the progression first (user already confirmed in the modal)
    clearProgression(true); // true = skip confirmation dialog

    // Reset BPM to 120
    const defaultBpm = 120;
    window.g_Tempo = defaultBpm;
    if (window.setPlaybackBPM) window.setPlaybackBPM(defaultBpm);
    if (window.setMelodyTempo) window.setMelodyTempo(defaultBpm);
    const fabBpmSlider = document.getElementById('fab-bpm-slider');
    const fabBpmValue = document.getElementById('fab-bpm-value');
    if (fabBpmSlider) fabBpmSlider.value = defaultBpm;
    if (fabBpmValue) fabBpmValue.textContent = defaultBpm;

    console.log('[LetItBeTutorial] Progression cleared, chords remaining:', window.getProgressionData?.()?.length || 0);

    // Disable chord card tooltips during tutorial for cleaner UI
    document.body.classList.add('progression-tooltips-disabled');

    // Helper function to expand Composition Studio panels for tutorial
    function expandCompositionStudioPanels() {
        // Expand the Chord Progression panel
        const chordProgressionPanel = document.getElementById('chord-progression-card-panel');
        const chordProgressionChevron = document.getElementById('chord-progression-card-chevron');
        if (chordProgressionPanel && chordProgressionPanel.classList.contains('hidden')) {
            chordProgressionPanel.classList.remove('hidden');
            if (chordProgressionChevron) chordProgressionChevron.classList.add('rotate-180');
        }

        // Expand the Progression Setup panel (contains key selector area)
        const setupPanel = document.getElementById('melody-progression-setup-panel');
        const setupChevron = document.getElementById('melody-progression-setup-chevron');
        if (setupPanel && setupPanel.classList.contains('hidden')) {
            setupPanel.classList.remove('hidden');
            if (setupChevron) setupChevron.classList.add('rotate-180');
        }
    }

    // Define the tutorial steps
    // "Let It Be" CHORUS progression: Am - G - F - C
    const letItBeTutorialSteps = [
        // ========== INTRODUCTION ==========
        {
            instruction: 'Welcome to the Interactive Tutorial! We\'re going to create the iconic chorus of "Let It Be" by The Beatles.',
            callout: '🎸 This tutorial will teach you the Chord Lab, Composition Studio, and more. We\'ll intentionally make a few "mistakes" along the way so you can learn how to fix them!',
            validation: null,
            successMessage: null
        },
        // ========== GO TO COMPOSITION STUDIO TO SET KEY ==========
        {
            instruction: '🎹 First, let\'s set the key. Click the "Composition Studio" tab.',
            spotlight: '#header-tab-btn-melody',
            targetElement: '#header-tab-btn-melody',
            callout: 'We\'ll set the key in the Composition Studio so our chords show Roman numerals correctly.',
            isActionStep: true,
            validation: { type: 'tab_selected', value: 'melody' },
            successMessage: 'Welcome to the Composition Studio!',
            quickAdvance: true
        },
        {
            instruction: 'Click the "Key" button (next to "Chord Progression") to open the Circle of Fifths.',
            spotlight: '#melody-key-button',
            targetElement: '#melody-key-button',
            callout: '"Let It Be" is in the key of C Major. Setting the key helps us see Roman numerals (like vi, V, IV, I) for each chord.',
            isActionStep: true,
            validation: { type: 'circle_of_fifths_opened' },
            successMessage: 'Circle of Fifths opened!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        {
            instruction: 'Click on "C" in the Circle of Fifths to set the key to C Major.',
            spotlight: '#circle-of-fifths-panel',
            targetElement: '#circle-of-fifths-panel',
            spotlightExtraHeight: 50,
            callout: 'C Major has no sharps or flats - it\'s the most common key for pop songs!',
            isActionStep: true,
            validation: { type: 'progression_key_changed', value: 'C Major' },
            successMessage: 'Key set to C Major! Now the chords will show their Roman numerals.',
            quickAdvance: true
        },
        // ========== NAVIGATE TO CHORD LAB ==========
        {
            instruction: '🎵 Now let\'s go to the Chord Lab to build our chords. Click the "Chord Lab" tab.',
            spotlight: '#header-tab-btn-builder',
            targetElement: '#header-tab-btn-builder',
            callout: 'The Chord Lab is where you create and explore individual chords before adding them to your progression.',
            isActionStep: true,
            validation: { type: 'tab_selected', value: 'builder' },
            successMessage: 'Welcome to the Chord Lab!',
            quickAdvance: true
        },
        // ========== CHORD LAB: Add Am (first chord of chorus) ==========
        {
            instruction: 'Let\'s start by building our first chord. Select "A" as the root note in the Note Selector grid.',
            spotlight: '#builder-note-selector',
            targetElement: '#builder-note-selector',
            callout: 'The "Let It Be" chorus starts with Am - the vi chord that gives it that emotional feel.',
            validation: { type: 'root_selected', value: 'A' },
            successMessage: 'A selected!',
            quickAdvance: true
        },
        {
            instruction: 'Now select "Minor" as the chord type.',
            spotlight: '#builder-chord-type-selector',
            targetElement: '#builder-chord-type-selector',
            callout: 'Am (A Minor) sets the melancholic, reflective mood of the chorus.',
            validation: { type: 'type_selected', value: 'Minor' },
            successMessage: 'Minor selected!',
            quickAdvance: true
        },
        {
            instruction: 'Click the purple "+" button on the right side of the screen to add Am to your progression.',
            spotlight: '#fab-add-chord-quick',
            targetElement: '#fab-add-chord-quick',
            callout: 'This Am chord starts our "Let It Be" chorus. The Add Chord button is in the floating action menu.',
            validation: { type: 'chord_added_to_progression', value: 'A Minor' },
            successMessage: 'Am added! First chord done.'
            // No quickAdvance - allow time for next step to position correctly
        },
        // ========== CHORD LAB: Add C Major (INTENTIONALLY WRONG - should be G) ==========
        {
            instruction: '⚠️ INTENTIONAL MISTAKE: Let\'s add C next - but wait, the chorus goes Am-G-F-C, so C should be LAST! Select "C" as the root.',
            spotlight: '#builder-note-selector',
            targetElement: '#builder-note-selector',
            callout: 'We\'re adding C in the wrong position on purpose. You\'ll learn to reorder chords in the Composition Studio!',
            validation: { type: 'root_selected', value: 'C' },
            successMessage: 'C selected!',
            quickAdvance: true
        },
        {
            instruction: 'Select "Major" as the chord type.',
            spotlight: '#builder-chord-type-selector',
            targetElement: '#builder-chord-type-selector',
            callout: 'C Major is the I chord - home base. But it belongs at the END of the chorus, not here!',
            validation: { type: 'type_selected', value: 'Major' },
            successMessage: 'Major selected!'
            // No quickAdvance - allow time for UI to adjust before FAB step
        },
        {
            instruction: 'Click the purple "+" button to add C Major to the progression.',
            spotlight: '#fab-add-chord-quick',
            targetElement: '#fab-add-chord-quick',
            callout: 'Remember: C is in the wrong position. We\'ll move it to the end later!',
            validation: { type: 'chord_added_to_progression', value: 'C Major' },
            successMessage: 'C Major added (in wrong position - we\'ll fix this)!'
            // No quickAdvance - allow time for next step to position correctly
        },
        // ========== CHORD LAB: Add G Major ==========
        {
            instruction: 'Now let\'s add the G chord. Select "G" as the root.',
            spotlight: '#builder-note-selector',
            targetElement: '#builder-note-selector',
            callout: 'G is the V chord - the dominant that creates tension before resolving to C.',
            validation: { type: 'root_selected', value: 'G' },
            successMessage: 'G selected!',
            quickAdvance: true
        },
        {
            instruction: 'Select "Major" as the chord type.',
            spotlight: '#builder-chord-type-selector',
            targetElement: '#builder-chord-type-selector',
            callout: 'G Major should be the 2nd chord in the chorus. We\'re also skipping F (another intentional mistake)!',
            validation: { type: 'type_selected', value: 'Major' },
            successMessage: 'Major selected!',
            quickAdvance: true
        },
        {
            instruction: 'Click the purple "+" button to add G Major to the progression.',
            spotlight: '#fab-add-chord-quick',
            targetElement: '#fab-add-chord-quick',
            callout: 'We now have Am - C - G, but we need Am - G - F - C. Time to fix it in the Composition Studio!',
            validation: { type: 'chord_added_to_progression', value: 'G Major' },
            successMessage: 'G Major added! Now let\'s head to the Composition Studio.'
            // No quickAdvance - allow time for next step to position correctly
        },
        // ========== SWITCH TO COMPOSITION STUDIO ==========
        {
            instruction: 'Great! Now click on the "Composition Studio" tab to see our progression and fix those mistakes.',
            spotlight: '#header-tab-btn-melody',
            targetElement: '#header-tab-btn-melody',
            callout: 'The Composition Studio is where you arrange, edit, and perfect your chord progressions.',
            validation: { type: 'tab_selected', value: 'melody' },
            successMessage: 'Welcome to the Composition Studio!',
            quickAdvance: true
        },
        // ========== COMPOSITION STUDIO: Summary + Drag/Drop combined ==========
        {
            instruction: '🔄 Your progression shows Am - C - G, but the chorus is Am - G - F - C. First, drag the C chord card to the END (after G). Click and hold the C card, then drag it past G.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 100,
            callout: 'Click on the C Major card (black rectangle) and drag it to the right of G. The order should become Am - G - C.',
            validation: { type: 'chord_reordered' },
            successMessage: 'C moved to the end! Now it\'s Am - G - C. We just need to add F!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== QUICK ADD: First show the button, then the form ==========
        {
            instruction: '➕ ADD MISSING F: Click the "+ Add Chord" button (next to the "Chord Progression" header) to open the Quick Add form.',
            spotlight: '#melody-quick-add-btn',
            targetElement: '#melody-quick-add-btn',
            callout: 'This button opens a quick way to add chords without going back to Chord Lab.',
            isActionStep: true,
            validation: { type: 'quick_add_form_opened' },
            successMessage: 'Quick Add form opened!',
            // No quickAdvance - allow time to scroll to Quick Add button
            onEnter: () => {
                expandCompositionStudioPanels();
                // Scroll the +Add Chord button into view (above any keyboard)
                setTimeout(() => {
                    const addChordBtn = document.getElementById('melody-quick-add-btn');
                    if (addChordBtn) {
                        addChordBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            }
        },
        {
            instruction: 'In the Quick Add form, select "F" as the root, leave it as "Major", and click "Add Chord".',
            spotlight: '#quick-add-chord-form-melody',
            targetElement: '#quick-add-chord-form-melody',
            spotlightExtraHeight: 50,
            callout: 'F Major (IV chord) is the missing piece! Leave the inversion as Root Position for now.',
            isActionStep: true,
            validation: { type: 'chord_added_to_progression', value: 'F Major' },
            successMessage: 'F Major added! Now we have Am - G - C - F. One more reorder to go!'
            // No quickAdvance - allow time to scroll to Quick Add form
        },
        // ========== DRAG F before C ==========
        {
            instruction: '🔄 Almost there! The order is Am - G - C - F but we need Am - G - F - C. Drag the C chord card to the END (after F).',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 100,
            callout: 'Drag the C Major card to the right of F. This completes the correct chorus order!',
            validation: { type: 'chord_reordered' },
            successMessage: 'Perfect! The chorus is now Am - G - F - C!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== CHANGE DURATION TO HALF NOTES ==========
        {
            instruction: '🎵 DURATION: The "Let It Be" chorus uses half notes (2 beats each). Look at the "Duration" row below each chord card and change ALL four chords to duration 2.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 50,
            callout: 'Find the Duration dropdowns showing "4" (whole notes). Change each one to "2" for half notes. The chorus has 4 chords × 2 beats = 8 beats (2 measures).',
            isActionStep: true,
            validation: { type: 'all_chords_duration', beats: 2 },
            successMessage: 'All chords set to half notes! Now the rhythm matches the original song.',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== FAB: Open and adjust BPM ==========
        {
            instruction: '⚙️ ADJUST TEMPO: Click the floating action button (the purple circle with +) in the bottom right corner to open it.',
            spotlight: '#mobile-fab-main',
            targetElement: '#mobile-fab-main',
            callout: 'The FAB (Floating Action Button) gives you quick access to playback settings, BPM, and more.',
            isActionStep: true,
            validation: { type: 'fab_opened' },
            successMessage: 'FAB opened! Now find the Settings (gear icon).',
            quickAdvance: true
        },
        {
            instruction: 'Click the gray Settings button (gear icon) in the FAB menu to see the BPM controls.',
            spotlight: '.fab-category[data-category="settings"]',
            targetElement: '.fab-category[data-category="settings"]',
            callout: 'The Settings section contains tempo (BPM), arpeggio speed, and other playback options.',
            isActionStep: true,
            validation: { type: 'settings_section_clicked' },
            successMessage: 'Settings expanded! Now adjust the BPM.',
            quickAdvance: true
        },
        {
            instruction: 'Use the BPM slider to set the tempo to around 70 BPM for the classic ballad feel.',
            spotlight: '#fab-bpm-slider',
            targetElement: '#fab-bpm-slider',
            callout: '"Let It Be" is a ballad at ~70 BPM. Set the tempo between 65-75 BPM.',
            isActionStep: true,
            validation: { type: 'bpm_changed', minBpm: 65, maxBpm: 75 },
            successMessage: 'Perfect tempo! The progression is ready to play.',
            quickAdvance: true
        },
        // ========== CLOSE FAB FIRST ==========
        {
            instruction: '📱 Close the FAB menu by tapping the purple + button.',
            spotlight: '#mobile-fab-main',
            targetElement: '#mobile-fab-main',
            callout: 'Close the menu to access the Play button.',
            isActionStep: true,
            validation: { type: 'fab_closed' },
            successMessage: 'Great!',
            quickAdvance: true  // Advance immediately without delay
        },
        // ========== FINAL PLAYBACK ==========
        {
            instruction: '🎵 LISTEN: Click the green "Play" button to hear your complete "Let It Be" progression!',
            spotlight: '#fab-play-all-quick',
            targetElement: '#fab-play-all-quick',
            callout: 'You\'ve built the iconic Am-G-F-C progression. Click Play to hear it!',
            isActionStep: true,
            validation: { type: 'progression_played' },
            successMessage: 'Beautiful! You\'ve created the "Let It Be" chorus progression!',
            quickAdvance: true,
            onEnter: () => {
                // Scroll the notation into view so it's visible during playback
                setTimeout(() => {
                    const notationContainer = document.querySelector('.notation-canvas-wrapper') ||
                                              document.getElementById('staff-notation-card-panel') ||
                                              document.getElementById('staff-notation-card');
                    if (notationContainer) {
                        notationContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            }
        },
        // ========== COMPLETION ==========
        {
            instruction: '🎉 Congratulations! You\'ve completed the "Let It Be" tutorial!',
            callout: '📚 You learned: Adding chords in Chord Lab, Reordering with drag & drop, Quick Add, Changing chord duration (half notes), Adjusting BPM (~70 for ballads), and Playing your progression!',
            validation: null,
            successMessage: null,
            allowFreeExplore: true
        }
    ];

    // Clear setup flag now that guided mode is starting
    window.isTutorialSetupInProgress = false;

    // Start the guided mode
    window.startGuidedMode({
        lessonId: 'let-it-be-chords-tutorial',
        lessonTitle: '"Let It Be" Chords Interactive Tutorial',
        targetTab: 'builder',
        steps: letItBeTutorialSteps,
        onComplete: (actionHistory) => {
            console.log('[LetItBeTutorial] Tutorial completed!', actionHistory);
            // Stay in Composition Studio
            if (window.switchTab) {
                window.switchTab('melody');
            }
            if (window.showModal) {
                window.showModal('🎉 Congratulations! You\'ve completed the "Let It Be" Chords tutorial. Keep exploring and creating!', true);
            }
        },
        onCancel: () => {
            console.log('[LetItBeTutorial] Tutorial cancelled by user.');
            // Return to Composition Studio on cancel too
            if (window.switchTab) {
                window.switchTab('melody');
            }
        }
    });
}

/**
 * Launch the "Let It Be" Melody Tutorial
 * Sets up the chord progression and starts the melody creation tutorial
 * Complete implementation restored from git commit 6c31253
 */
function actuallyLaunchLetItBeMelodyTutorial() {
    console.log('[LetItBeMelodyTutorial] Starting melody tutorial, setting up progression...');

    // Set flag to suppress Theory Moments during tutorial setup
    window.isTutorialSetupInProgress = true;

    // Clear the progression first
    clearProgression(true); // true = skip confirmation dialog

    // Disable chord card tooltips during tutorial for cleaner UI
    document.body.classList.add('progression-tooltips-disabled');

    // Switch to Composition Studio tab
    if (window.switchTab) {
        window.switchTab('melody');
    }

    // Helper function to expand necessary panels for the melody tutorial
    function expandMelodyTutorialPanels() {
        // Expand the Staff Notation panel
        const notationPanel = document.getElementById('staff-notation-card-panel');
        const notationChevron = document.getElementById('staff-notation-card-chevron');
        if (notationPanel && notationPanel.classList.contains('hidden')) {
            notationPanel.classList.remove('hidden');
            if (notationChevron) notationChevron.classList.add('rotate-180');
        }

        // Expand the Chord Progression panel
        const chordProgressionPanel = document.getElementById('chord-progression-card-panel');
        const chordProgressionChevron = document.getElementById('chord-progression-card-chevron');
        if (chordProgressionPanel && chordProgressionPanel.classList.contains('hidden')) {
            chordProgressionPanel.classList.remove('hidden');
            if (chordProgressionChevron) chordProgressionChevron.classList.add('rotate-180');
        }
    }

    // Set the key to C Major FIRST - use same method as Circle of Fifths
    setTimeout(() => {
        console.log('[LetItBeMelodyTutorial] Setting key to C Major...');

        // Use setKeyDropdownValue which properly handles the key change (same as Circle of Fifths)
        // This internally calls setCurrentKey and updates all necessary state
        if (window.setKeyDropdownValue) {
            window.setKeyDropdownValue('C', false); // 'C' not 'C Major' - the function handles quality
            console.log('[LetItBeMelodyTutorial] Used setKeyDropdownValue to set key to C Major');
        } else {
            // Fallback: directly update the dropdown and displays
            console.warn('[LetItBeMelodyTutorial] setKeyDropdownValue not available, using fallback');
            const keySelect = document.getElementById('trainer-key-select');
            if (keySelect) {
                keySelect.value = 'C';
                // Trigger change event to update state
                keySelect.dispatchEvent(new Event('change'));
            }
        }

        // Update ALL key displays (same as Circle of Fifths does)
        const keyDisplays = [
            'melody-current-key-display',
            'melody-key-display-text',
            'melody-workbench-key-display'
        ];
        keyDisplays.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'C Major';
        });

        console.log('[LetItBeMelodyTutorial] Key set to C Major');

        // Set BPM to 72 (ballad tempo)
        if (window.interactiveMelody) {
            window.interactiveMelody.tempo = 72;
        }
        // Update BPM slider
        const bpmSlider = document.getElementById('fab-bpm-slider');
        const bpmDisplay = document.getElementById('fab-bpm-value');
        if (bpmSlider) bpmSlider.value = 72;
        if (bpmDisplay) bpmDisplay.textContent = '72';

        // Add the chord progression with pickup measure:
        // C (pickup with dotted half rest, melody starts beat 4) - Am - G - F - C
        // Each chord is 2 beats (half note), inversions for smooth voice leading
        const chordsToAdd = [
            { root: 'C', type: 'Major', inversion: 0, beats: 2 },      // Pickup measure (dotted half rest + beat 4 melody)
            { root: 'A', type: 'Minor', inversion: 1, beats: 2 },      // Am 1st inv
            { root: 'G', type: 'Major', inversion: 1, beats: 2 },      // G 1st inv
            { root: 'F', type: 'Major', inversion: 0, beats: 2 },      // F root
            { root: 'C', type: 'Major', inversion: 0, beats: 2 }       // C root (end)
        ];

        chordsToAdd.forEach((chord, index) => {
            setTimeout(() => {
                if (window.addSpecificChordToProgression) {
                    window.addSpecificChordToProgression(chord.type, chord.inversion, false, chord.root);

                    // After adding, update the duration
                    setTimeout(() => {
                        const progressionData = window.getProgressionData?.() || [];
                        if (progressionData.length > index) {
                            if (window.updateChordDuration) {
                                window.updateChordDuration(index, chord.beats);
                            }
                        }
                    }, 50);
                }
            }, index * 100); // Stagger chord additions
        });

        // After all chords are added, set up the pickup measure and start the tutorial
        setTimeout(() => {
            // Expand panels BEFORE adding the rest
            expandMelodyTutorialPanels();

            // Add a dotted half rest to the pickup measure (beats 1-3)
            // This leaves beat 4 free for the user to add the pickup notes
            // First, select measure 0 so subsequent edits go there
            const notationComposer = window.getNotationComposer && window.getNotationComposer();
            if (notationComposer) {
                notationComposer.setSelectedMeasure(0);
            }

            // Add a dotted half rest directly to compositionState
            // This is more reliable than addNoteIntelligently for programmatic setup
            try {
                if (window.getCompositionState) {
                    const compositionState = window.getCompositionState();

                    console.log('[LetItBeMelodyTutorial] Measure count:', compositionState.getMeasureCount());

                    // Ensure measure 0 exists and has the proper structure
                    if (compositionState.getMeasureCount() > 0) {
                        const measure = compositionState.getMeasure(0);
                        console.log('[LetItBeMelodyTutorial] Measure 0:', measure);

                        // Ensure treble clef voice exists
                        if (measure && measure.notation && measure.notation.treble) {
                            // Ensure voice 0 exists
                            if (!measure.notation.treble.voices) {
                                measure.notation.treble.voices = [{ notes: [] }];
                            }
                            if (!measure.notation.treble.voices[0]) {
                                measure.notation.treble.voices[0] = { notes: [] };
                            }

                            // Add the dotted half rest at beat 0
                            const restNote = {
                                type: 'rest',
                                isRest: true,
                                duration: '2n',  // half note base
                                dotted: true,    // makes it 3 beats
                                beat: 0
                            };

                            measure.notation.treble.voices[0].notes.push(restNote);
                            console.log('[LetItBeMelodyTutorial] Added dotted half rest (3 beats) to measure 0 treble clef');
                            console.log('[LetItBeMelodyTutorial] Treble notes now:', measure.notation.treble.voices[0].notes);
                        } else {
                            console.warn('[LetItBeMelodyTutorial] Measure 0 treble notation not found. Measure:', measure);
                        }
                    } else {
                        console.warn('[LetItBeMelodyTutorial] No measures exist yet');
                    }
                } else {
                    console.warn('[LetItBeMelodyTutorial] getCompositionState not available');
                }
            } catch (e) {
                console.warn('[LetItBeMelodyTutorial] Could not add rest:', e);
            }

            // Verify the rest is still in compositionState before refresh
            const csBeforeRefresh = window.getCompositionState && window.getCompositionState();
            if (csBeforeRefresh) {
                const m0 = csBeforeRefresh.getMeasure(0);
                console.log('[LetItBeMelodyTutorial] Before refresh - Measure 0 treble voices:', m0?.notation?.treble?.voices);
            }

            // Refresh notation - call render directly on the notationComposer
            // to ensure our compositionState changes are rendered
            const nc = window.getNotationComposer && window.getNotationComposer();
            if (nc) {
                console.log('[LetItBeMelodyTutorial] Calling syncFromProgression...');
                nc.syncFromProgression();
                console.log('[LetItBeMelodyTutorial] syncFromProgression complete');

                // Check measureManager to see what was loaded
                if (nc.measureManager && nc.measureManager.measures && nc.measureManager.measures[0]) {
                    console.log('[LetItBeMelodyTutorial] MeasureManager measure 0 trebleNotes:', nc.measureManager.measures[0].trebleNotes);
                }
            } else if (window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
            }

            // Start the melody tutorial after setup is complete
            setTimeout(() => {
                launchLetItBeMelodyTutorialSteps();
            }, 300);
        }, chordsToAdd.length * 100 + 800); // Extra delay to ensure measures are fully initialized

    }, 100);
}
function launchLetItBeMelodyTutorialSteps() {
    console.log('[LetItBeMelodyTutorial] Starting tutorial steps...');

    // Helper function to expand Staff Notation panel
    function expandStaffNotationPanel() {
        const notationPanel = document.getElementById('staff-notation-card-panel');
        const notationChevron = document.getElementById('staff-notation-card-chevron');
        if (notationPanel && notationPanel.classList.contains('hidden')) {
            notationPanel.classList.remove('hidden');
            if (notationChevron) notationChevron.classList.add('rotate-180');
        }
    }

    // Helper function to scroll the notation toolbar into view
    function scrollToolbarIntoView() {
        const toolbar = document.getElementById('notation-toolbar-container');
        if (toolbar) {
            toolbar.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Helper function to scroll the notation panel into view (below virtual keyboard)
    function scrollNotationIntoView() {
        const notationPanel = document.getElementById('staff-notation-card-panel');
        if (notationPanel) {
            notationPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Define the melody tutorial steps
    // "Let It Be" chorus melody: "Let it be, let it be..."
    // This tutorial teaches Alt-based mode switching (Entry Mode On/Off), durations, ties, and rests
    const letItBeMelodySteps = [
        // ========== PART 1: INTRODUCTION ==========
        {
            instruction: 'Welcome to the "Let It Be" Melody Tutorial! We\'ll learn melody notation by entering the famous chorus melody.\n\n🎯 ASSISTED PLACEMENT MODE: This tutorial focuses on teaching you the notation toolbar. If you click at the wrong pitch, we\'ll automatically place the note in the correct position. Outside of tutorials, notes go exactly where you click!',
            callout: 'The chords are C - G - Am - F. The melody "Let it be, let it be..." starts on beat 4 of the first measure!',
            validation: null,
            successMessage: null
        },
        {
            instruction: 'Look at the Musical Notation card. This is where we\'ll enter the melody in the treble clef (top staff).',
            spotlight: '#staff-notation-card-panel',
            targetElement: '#staff-notation-card-panel',
            spotlightExtraHeight: 100,
            callout: 'The grand staff shows treble (melody) and bass clefs. The chords have already filled in some bass notes!',
            validation: null,
            successMessage: null,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'This is the Notation Toolbar. It has everything you need to enter notes, rests, and more.',
            spotlight: '#notation-toolbar-container',
            targetElement: '#notation-toolbar-container',
            spotlightExtraHeight: 20,
            callout: 'The toolbar has sections for: Input Mode, Duration, Modifiers (rests, dots, ties), and Edit functions.',
            validation: null,
            successMessage: null,
            onEnter: expandStaffNotationPanel
        },
        // ========== PART 2: TWO MODES EXPLAINED ==========
        {
            instruction: 'There are TWO ways to work with notation. Let\'s learn both!',
            callout: '✏ On: Entry Mode is ON - click to ADD notes.\n✏ Off: Entry Mode is OFF - click to SELECT notes, hold Alt to add.',
            validation: null,
            successMessage: null,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'ENTRY MODE ON (✏ On) is for adding new notes. Click on the staff and notes appear!',
            spotlight: '[data-interaction-mode="noteEntry"]',
            targetElement: '[data-interaction-mode="noteEntry"]',
            callout: 'With Entry Mode ON:\n• Click on staff = add note at that pitch\n• The duration button you\'ve selected determines the note length\n• Notes are added in sequence\n• Hold Alt to temporarily switch to Select mode',
            validation: null,
            successMessage: null,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'ENTRY MODE OFF (✏ Off) is for selecting and editing. Hold Alt to add notes!',
            spotlight: '[data-interaction-mode="select"]',
            targetElement: '[data-interaction-mode="select"]',
            callout: 'With Entry Mode OFF:\n• Click a note = select it\n• Shift+Click = select multiple notes\n• Hold Alt + Click = add a note\n• Alt+Click on selected note = add polyphony (stack another note)\n• Esc = unselect note\n• Use toolbar to transpose or delete',
            validation: null,
            successMessage: null,
            onEnter: expandStaffNotationPanel
        },
        // ========== PART 3: ADDING NOTES ==========
        {
            instruction: 'Let\'s start adding the melody! Click the Entry Mode ON button (✏ On).',
            spotlight: '[data-interaction-mode="noteEntry"]',
            targetElement: '[data-interaction-mode="noteEntry"]',
            callout: 'With Entry Mode ON, you can click anywhere on the treble staff to add notes.',
            isActionStep: true,
            validation: { type: 'interaction_mode_set', value: 'noteEntry' },
            successMessage: 'Entry Mode ON!',
            quickAdvance: true,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'The melody starts with a quick 16th note. Click the 16th note button.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: 'Duration buttons: Whole, Half, Quarter (♩), Eighth (♪), 16th, 32nd\nKeyboard shortcut: Shift+5 for 16th notes',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th note duration selected!',
            quickAdvance: true,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click in MEASURE 1 (first measure) at the E5 position to add the first note.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'E5 is in the 1st SPACE from the top in the treble clef (just below the top line).\n\n💡 Your mouse pointer\'s horizontal position within a measure doesn\'t matter - notes are added after the last note in that measure!\n\n💡 With Entry Mode ON, you\'ll see a "ghost note" preview showing exactly where your note will be placed!',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added! The melody has begun!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'The next note is an 8th note. Click the 8th note button (♪).',
            spotlight: '[data-duration="8n"]',
            targetElement: '[data-duration="8n"]',
            callout: 'Keyboard shortcut: Shift+4 for 8th notes',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '8n' },
            successMessage: 'Eighth note duration selected!',
            quickAdvance: true,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click in MEASURE 1 on D5 (the 4th line - 2nd line from the top).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'D5 is on the 4th LINE of the treble staff (2nd line from top).\nClick in MEASURE 1 - your mouse pointer\'s horizontal position within the measure doesn\'t matter. The new note will be added after the last note in the measure.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'D5',
            successMessage: 'D5 added!',
            quickAdvance: true,
            onEnter: expandStaffNotationPanel
        },
        // ========== PART 4: CREATING TIED NOTES ==========
        {
            instruction: 'Now let\'s learn about TIES! A tie connects two notes of the same pitch, making them ring as one.',
            callout: 'The next part has C5 (16th) TIED to C5 (quarter) - they\'ll ring together as one long note.\nTies are used for rhythms that can\'t be written as a single note.',
            validation: null,
            successMessage: null,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'Select 16th note duration for the first C5.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: 'We\'ll add a short C5 first, then tie it to a longer C5.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th note selected!',
            quickAdvance: true,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click in MEASURE 1 on C5 (3rd space from bottom / 2nd space from top) to add the first note of the tie.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'C5 is in the 3rd SPACE of the treble staff (2nd space from top).\nYour mouse pointer\'s horizontal position within the measure doesn\'t matter.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'C5',
            successMessage: 'First C5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Now select quarter note duration (♩) for the second part of the tie.',
            spotlight: '[data-duration="4n"]',
            targetElement: '[data-duration="4n"]',
            callout: 'The tied quarter note will sustain the C5.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '4n' },
            successMessage: 'Quarter note selected!',
            quickAdvance: true,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add another C5 at the same pitch (3rd space). Click anywhere in MEASURE 2.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'This C5 will be tied to the previous one.\nYour mouse pointer\'s horizontal position within the measure doesn\'t matter.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'C5',
            successMessage: 'Second C5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Turn Entry Mode OFF (✏ Off) so we can select the notes to tie them.',
            spotlight: '[data-interaction-mode="select"]',
            targetElement: '[data-interaction-mode="select"]',
            callout: 'With Entry Mode OFF, you can click to select existing notes.\nRemember: Hold Alt to add notes, Esc unselects.',
            isActionStep: true,
            validation: { type: 'interaction_mode_set', value: 'select' },
            successMessage: 'Entry Mode OFF!',
            quickAdvance: true,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click on the first C5 (16th note) to select it.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'When selected, the note will be highlighted. You can Shift+Click to select additional notes.',
            isActionStep: true,
            validation: { type: 'notes_selected' },
            successMessage: 'Note selected!',
            quickAdvance: true,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'Hold Shift and click the second C5 (quarter note) to add it to the selection.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Both C5 notes should now be highlighted.',
            isActionStep: true,
            validation: { type: 'multiple_notes_selected' },
            successMessage: 'Both notes selected!',
            quickAdvance: false,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'Click the Tie button (⁀) in the toolbar to connect the two notes!',
            spotlight: '.tie-btn',
            targetElement: '.tie-btn',
            callout: 'The tie creates a curved line connecting the notes.\nKeyboard shortcut: T',
            isActionStep: true,
            validation: { type: 'tie_created' },
            successMessage: 'Tie created! The two C5s now ring as one long note!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Press Esc to unselect the notes before continuing.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Pressing Esc clears your selection. This is important before adding more notes!',
            isActionStep: true,
            validation: { type: 'notes_deselected' },
            successMessage: 'Selection cleared!',
            quickAdvance: false,
            onEnter: expandStaffNotationPanel
        },
        // ========== PART 5: CONTINUING THE MELODY ==========
        {
            instruction: 'Now let\'s continue the melody! Turn Entry Mode ON (✏ On).',
            spotlight: '[data-interaction-mode="noteEntry"]',
            targetElement: '[data-interaction-mode="noteEntry"]',
            callout: 'We\'ll add: E5-G5-A5, rest, G5-G5-E5-D5-C5, A4-G4, tied E5s, and more!',
            isActionStep: true,
            validation: { type: 'interaction_mode_set', value: 'noteEntry' },
            successMessage: 'Entry Mode ON!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Select 16th note duration.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: 'Keyboard shortcut: Shift+5',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th note selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add E5 (1st space from top) to the second measure.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'E5 is in the 1st space from the top of the treble clef.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select 8th note duration (♪).',
            spotlight: '[data-duration="8n"]',
            targetElement: '[data-duration="8n"]',
            callout: 'Keyboard shortcut: Shift+4',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '8n' },
            successMessage: '8th note selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add G5 (1st ledger line above the staff) to the second measure.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'G5 is on the 1st ledger line ABOVE the treble staff.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'G5',
            successMessage: 'G5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select 16th note duration.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: 'Back to 16th notes.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th note selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add A5 (1st space above the staff - immediately above the G you just added) to the second measure.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'A5 is in the 1st SPACE above the staff (immediately above the G5 ledger line).',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'A5',
            successMessage: 'A5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Now add a quarter rest. Select quarter note duration.',
            spotlight: '[data-duration="4n"]',
            targetElement: '[data-duration="4n"]',
            callout: 'Quarter duration for the rest.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '4n' },
            successMessage: 'Quarter selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Turn on Rest mode (𝄽).',
            spotlight: '[data-action="rest"]',
            targetElement: '[data-action="rest"]',
            callout: 'Keyboard shortcut: R',
            isActionStep: true,
            validation: { type: 'rest_mode_activated' },
            successMessage: 'Rest mode on!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click to add the quarter rest.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Click anywhere in the current measure.',
            isActionStep: true,
            validation: { type: 'rest_added_to_treble' },
            successMessage: 'Quarter rest added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Turn off Rest mode.',
            spotlight: '[data-action="rest"]',
            targetElement: '[data-action="rest"]',
            callout: 'Back to note entry.',
            isActionStep: true,
            validation: { type: 'rest_mode_deactivated' },
            successMessage: 'Rest mode off!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Select 16th note duration for the next phrase.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: 'We\'ll add G5-G5-E5-D5.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th note selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add G5 (1st ledger line above).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'First of two G5s.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'G5',
            successMessage: 'G5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add another G5 (same position).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Second G5.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'G5',
            successMessage: 'G5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add E5 (1st space from top).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'E5 is in the 1st space from the top.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add D5 (4th line - 2nd line from top).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'D5 is on the 4th line of the treble clef.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'D5',
            successMessage: 'D5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select quarter note duration (♩).',
            spotlight: '[data-duration="4n"]',
            targetElement: '[data-duration="4n"]',
            callout: 'For the C5 quarter note.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '4n' },
            successMessage: 'Quarter selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add C5 (3rd space - 2nd space from top).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'C5 is in the 3rd space of the treble clef.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'C5',
            successMessage: 'C5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select 16th note duration.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: 'For A4.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add A4 (2nd space from bottom).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'A4 is in the 2nd space from the BOTTOM.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'A4',
            successMessage: 'A4 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select 8th note duration (♪).',
            spotlight: '[data-duration="8n"]',
            targetElement: '[data-duration="8n"]',
            callout: 'For G4.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '8n' },
            successMessage: '8th selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add G4 (2nd line from bottom).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'G4 is on the 2nd line from the BOTTOM.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'G4',
            successMessage: 'G4 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        // ========== TIED E5s ==========
        {
            instruction: 'Now another tied pair! Select 16th note.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: 'First E5 will be a 16th note.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add E5 (1st space from top).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'First E5 of the tied pair.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select quarter note duration.',
            spotlight: '[data-duration="4n"]',
            targetElement: '[data-duration="4n"]',
            callout: 'Second E5 will be a quarter.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '4n' },
            successMessage: 'Quarter selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add E5 (same position).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Second E5 of the tied pair.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Turn Entry Mode OFF (✏ Off) to select and tie them.',
            spotlight: '[data-interaction-mode="select"]',
            targetElement: '[data-interaction-mode="select"]',
            callout: 'We need to select both notes to tie them.',
            isActionStep: true,
            validation: { type: 'interaction_mode_set', value: 'select' },
            successMessage: 'Entry Mode OFF!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click the first E5 (16th) to select it.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Select the shorter E5 first.',
            isActionStep: true,
            validation: { type: 'notes_selected' },
            successMessage: 'Note selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Shift+Click the second E5 (quarter).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Add to selection with Shift+Click.',
            isActionStep: true,
            validation: { type: 'multiple_notes_selected' },
            successMessage: 'Both selected!',
            quickAdvance: false,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'Click the Tie button (⁀).',
            spotlight: '.tie-btn',
            targetElement: '.tie-btn',
            callout: 'Keyboard shortcut: T',
            isActionStep: true,
            validation: { type: 'tie_created' },
            successMessage: 'Tied!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Press Esc to deselect.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Clear selection before continuing.',
            isActionStep: true,
            validation: { type: 'notes_deselected' },
            successMessage: 'Deselected!',
            quickAdvance: false,
            onEnter: expandStaffNotationPanel
        },
        // ========== RESTS ==========
        {
            instruction: 'Add a quarter rest. Turn Entry Mode ON (✏ On).',
            spotlight: '[data-interaction-mode="noteEntry"]',
            targetElement: '[data-interaction-mode="noteEntry"]',
            callout: 'Back to Entry Mode for the rest.',
            isActionStep: true,
            validation: { type: 'interaction_mode_set', value: 'noteEntry' },
            successMessage: 'Entry Mode ON!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Select quarter duration.',
            spotlight: '[data-duration="4n"]',
            targetElement: '[data-duration="4n"]',
            callout: 'Quarter rest.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '4n' },
            successMessage: 'Quarter selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Turn on Rest mode.',
            spotlight: '[data-action="rest"]',
            targetElement: '[data-action="rest"]',
            callout: 'Keyboard: R',
            isActionStep: true,
            validation: { type: 'rest_mode_activated' },
            successMessage: 'Rest mode on!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click to add the quarter rest.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Add the quarter rest.',
            isActionStep: true,
            validation: { type: 'rest_added_to_treble' },
            successMessage: 'Quarter rest!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Now add a 16th rest. Select 16th duration.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: '16th rest.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click to add the 16th rest.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Add the short rest.',
            isActionStep: true,
            validation: { type: 'rest_added_to_treble' },
            successMessage: '16th rest!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Turn off Rest mode.',
            spotlight: '[data-action="rest"]',
            targetElement: '[data-action="rest"]',
            callout: 'Back to notes.',
            isActionStep: true,
            validation: { type: 'rest_mode_deactivated' },
            successMessage: 'Rest mode off!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        // ========== FINAL PHRASE ==========
        {
            instruction: 'Add three E5 16th notes. Duration should be 16th.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'First E5 of three.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add second E5.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Second E5.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add third E5.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Third E5.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select 8th note duration.',
            spotlight: '[data-duration="8n"]',
            targetElement: '[data-duration="8n"]',
            callout: 'F5 is an 8th note.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '8n' },
            successMessage: '8th selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add F5 (top line of the staff).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'F5 is on the TOP LINE of the treble clef.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'F5',
            successMessage: 'F5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select 16th note duration.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: 'Two more E5s.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add E5.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'E5 (1st space from top).',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add another E5.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Second E5.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select quarter note duration.',
            spotlight: '[data-duration="4n"]',
            targetElement: '[data-duration="4n"]',
            callout: 'D5 is a quarter note.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '4n' },
            successMessage: 'Quarter selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add D5 (4th line).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'D5 is on the 4th line (2nd line from top).',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'D5',
            successMessage: 'D5 quarter added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add a 16th rest. Select 16th duration.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: '16th rest coming up.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Turn on Rest mode.',
            spotlight: '[data-action="rest"]',
            targetElement: '[data-action="rest"]',
            callout: 'For the 16th rest.',
            isActionStep: true,
            validation: { type: 'rest_mode_activated' },
            successMessage: 'Rest mode on!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click to add the 16th rest.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Add the rest.',
            isActionStep: true,
            validation: { type: 'rest_added_to_treble' },
            successMessage: '16th rest!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Turn off Rest mode.',
            spotlight: '[data-action="rest"]',
            targetElement: '[data-action="rest"]',
            callout: 'Back to notes for the ending.',
            isActionStep: true,
            validation: { type: 'rest_mode_deactivated' },
            successMessage: 'Rest mode off!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add E5 (16th note, 1st space from top).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'E5 for the final phrase.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add D5 (4th line).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'D5.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'D5',
            successMessage: 'D5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add final C5 (3rd space).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Last note of the chorus!',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'C5',
            successMessage: 'Final C5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        // ========== SUMMARY ==========
        {
            instruction: '🎉 Congratulations! You\'ve entered the complete "Let It Be" chorus melody!',
            callout: 'You\'ve mastered:\n• Entry Mode toggle (✏ On/Off)\n• Alt-based mode switching\n• Duration selection\n• Adding rests\n• Creating ties\n• Staff positions (lines vs spaces)',
            validation: null,
            successMessage: null,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'You\'re ready to create your own melodies!',
            callout: 'KEYBOARD SHORTCUTS:\n• Shift+1-6: Duration (1=whole, 6=32nd)\n• R: Toggle rest mode\n• T: Create tie\n• Delete: Delete selected\n• Ctrl+Z: Undo\n\nMODE TIP: Entry Mode OFF = hold Alt to add notes. Entry Mode ON = click to add!',
            validation: null,
            successMessage: 'You\'ve mastered melody notation entry!',
            allowFreeExplore: true,
            onEnter: expandStaffNotationPanel
        }
    ];

    // Clear setup flag now that guided mode is starting
    window.isTutorialSetupInProgress = false;

    // Start the guided mode
    window.startGuidedMode({
        lessonId: 'let-it-be-melody-tutorial',
        lessonTitle: '"Let It Be" Melody Interactive Tutorial',
        targetTab: 'melody',
        steps: letItBeMelodySteps,
        onComplete: (actionHistory) => {
            console.log('[LetItBeMelodyTutorial] Tutorial completed!', actionHistory);
            // Stay in Composition Studio
            if (window.switchTab) {
                window.switchTab('melody');
            }
            if (window.showModal) {
                window.showModal('🎉 Congratulations! You\'ve completed the "Let It Be" melody tutorial. Keep creating!', true);
            }
        },
        onCancel: () => {
            console.log('[LetItBeMelodyTutorial] Tutorial cancelled by user.');
            // Stay in Composition Studio
            if (window.switchTab) {
                window.switchTab('melody');
            }
        }
    });
}
