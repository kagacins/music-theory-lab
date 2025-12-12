/**
 * Recommendations Sidebar Controller
 * Phase 2.2: Recommendation Engine Integration
 *
 * This controller manages the chord recommendations sidebar:
 * - Listens for recommendation updates from the service
 * - Updates the sidebar UI when recommendations change
 * - Handles user interactions (clicks, refresh button)
 * - Manages sidebar context display (key, currently selected chord)
 */

import {
    renderRecommendations,
    updateContextDisplay,
    showLoadingState,
    showEmptyState,
    clearRecommendations,
    renderAnalysisPanel,
    showEmptyAnalysis,
    playChordPreview
} from './recommendationsSidebar.js';

import { getRecommendationService } from '../integration/recommendationService.js';
import { getProgressionData, getCurrentKey, getSelectedChordIndex } from '../state/trainerState.js';
import { addChordToProgressionByParams } from '../features/progressionBuilder.js';

/**
 * RecommendationsSidebarController Class
 * Manages sidebar state and coordinates between service and UI
 */
export class RecommendationsSidebarController {
    constructor(recommendationService) {
        this.service = recommendationService || getRecommendationService();
        this.isInitialized = false;
        this.currentInversion = 0; // Default inversion for inserted chords
    }

    /**
     * Initialize the controller and set up event listeners
     */
    initialize() {
        if (this.isInitialized) return;

        this.setupEventListeners();
        this.setupResizeHandle();
        this.setupKeyboardShortcuts();
        this.isInitialized = true;

        // Initial refresh
        this.refresh();
    }
    
    /**
     * Setup resize handle for the sidebar
     */
    setupResizeHandle() {
        const sidebar = document.getElementById('chord-recommendations-
        const resizeHandle = sidebar?.querySelector('.sidebar-resize-
        
        if (!sidebar || !resizeHandle) {
            return;
        }
        
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        
        const startResize = (clientX) => {
            isResizing = true;
            startX = clientX;
            startWidth = sidebar.offsetWidth;
            resizeHandle.classList.add('
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        };
        
        const doResize = (clientX) => {
            if (!isResizing) return;
            
            const diff = clientX - startX;
            const newWidth = Math.max(256, Math.min(400, startWidth + diff));
            // Use setProperty with important to override any CSS constraints
            sidebar.style.setProperty('width', `${newWidth}px`, '
            // Also ensure flex-shrink is 0 during resize
            sidebar.style.setProperty('flex-shrink', '0', '
        };
        
        const stopResize = () => {
            if (isResizing) {
                isResizing = false;
                resizeHandle.classList.remove('
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                // Save width to localStorage
                const width = sidebar.offsetWidth;
                localStorage.setItem('chord-recommendations-sidebar-width', width.toString());
            }
        };
        
        // Mouse events
        resizeHandle.addEventListener('mousedown', (e) => {
            startResize(e.clientX);
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            doResize(e.clientX);
        });
        
        document.addEventListener('mouseup', stopResize);
        
        // Touch events for mobile
        resizeHandle.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startResize(touch.clientX);
            e.preventDefault();
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            if (!isResizing) return;
            const touch = e.touches[0];
            doResize(touch.clientX);
            e.preventDefault();
        }, { passive: false });
        
        document.addEventListener('touchend', stopResize);
        document.addEventListener('touchcancel', stopResize);
        
        // Restore saved width
        const savedWidth = localStorage.getItem('chord-recommendations-sidebar-
        if (savedWidth) {
            const width = parseInt(savedWidth, 10);
            if (width >= 256 && width <= 400) {
                sidebar.style.setProperty('width', `${width}px`, '
                sidebar.style.setProperty('flex-shrink', '0', '
            }
        }
    }

    /**
     * Setup event listeners for UI interactions and service updates
     */
    setupEventListeners() {
        // Listen for recommendation updates from the service
        window.addEventListener('recommendationsUpdated', (e) => {
            this.handleRecommendationsUpdate(e);
        });

        // Listen for chord selection changes to update the "Selected Chord" display
        window.addEventListener('chordCardSelected', () => {
            const progression = getProgressionData();
            const key = getCurrentKey();
            this.updateContext(key, progression);
        });

        // Setup refresh button click handler
        const refreshBtn = document.getElementById('refresh-recommendations-
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refresh();
            });
        }

        // Listen for chord clicks (delegated event handling)
        // This will be set up when recommendations are rendered
        const recommendationsList = document.getElementById('recommendations-
        if (recommendationsList) {
            recommendationsList.addEventListener('click', (e) => {
                // Check if play button was clicked
                const playBtn = e.target.closest('.chord-play-
                if (playBtn) {
                    e.stopPropagation(); // Prevent recommendation item click
                    const root = playBtn.dataset.chordRoot;
                    const type = playBtn.dataset.chordType;
                    const inversion = parseInt(playBtn.dataset.chordInversion || 0);
                    playChordPreview(root, type, inversion);
                    return;
                }

                // Check if "Why?" button was clicked
                const whyBtn = e.target.closest('.chord-why-
                if (whyBtn) {
                    e.stopPropagation(); // Prevent recommendation item click
                    const root = whyBtn.dataset.chordRoot;
                    const type = whyBtn.dataset.chordType;
                    const romanNumeral = whyBtn.dataset.chordFunction;
                    const confidence = parseInt(whyBtn.dataset.chordScore || 0);

                    // Get the full recommendation data from the item
                    const item = whyBtn.closest('.chord-recommendation-
                    const reasons = item ? this.getRecommendationReasons(item) : [];

                    // Get previous chord's roman numeral from progression
                    const progression = getProgressionData();
                    const progressionRomans = window.getProgressionRomans ? window.getProgressionRomans() : [];
                    const prevChord = progressionRomans.length > 0 ? progressionRomans[progressionRomans.length - 1] : null;

                    // Show "Why This Works" panel
                    if (window.showWhyThisWorks) {
                        window.showWhyThisWorks({
                            chord: root,
                            type: type,
                            romanNumeral: romanNumeral,
                            prevChord: prevChord,
                            confidence: confidence,
                            reasons: reasons
                        });
                    }
                    return;
                }

                // Find the clicked recommendation item
                const item = e.target.closest('.chord-recommendation-
                if (item) {
                    this.handleRecommendationClick(item);
                }
            });
        }

        // Listen for context play button clicks (delegated event handling)
        const contextDisplay = document.getElementById('last-chord-
        if (contextDisplay) {
            contextDisplay.addEventListener('click', (e) => {
                const playBtn = e.target.closest('.context-play-
                if (playBtn) {
                    const root = playBtn.dataset.chordRoot;
                    const type = playBtn.dataset.chordType;
                    const inversion = parseInt(playBtn.dataset.chordInversion || 0);
                    playChordPreview(root, type, inversion);
                }
            });
        }
    }

    /**
     * Setup keyboard shortcuts for quick access
     * Phase 2.4: Keyboard shortcuts implementation
     *
     * Shortcuts:
     * - 1-5: Insert top 5 recommendations
     * - R: Refresh recommendations
     * - Esc: Deselect/dismiss
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only process shortcuts when on Melody Composer tab
            const currentTab = document.querySelector('.tab-content:not(.hidden)');
            if (!currentTab || currentTab.id !== 'tab-melody') {
                return;
            }

            // Don't process if user is typing in an input or textarea
            const activeElement = document.activeElement;
            if (activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable
            )) {
                return;
            }

            // Handle number keys 1-5 (insert recommendations)
            // Only handle when in chords mode (main.js handles melody mode)
            if (e.key >= '1' && e.key <= '5') {
                // Check if we're in chords suggestion mode
                const currentMode = window.getCurrentSuggestionMode ? window.getCurrentSuggestionMode() : 'chords';
                if (currentMode !== 'chords') {
                    // Let main.js handle melody mode shortcuts
                    return;
                }

                e.preventDefault();
                e.stopImmediatePropagation(); // Prevent main.js handler from also firing
                const index = parseInt(e.key) - 1;
                this.insertRecommendationByIndex(index);

                // Add pulse animation
                const items = document.querySelectorAll('#recommendations-list .chord-recommendation-
                if (items[index]) {
                    items[index].classList.add('shortcut-
                    setTimeout(() => items[index].classList.remove('shortcut-pulse'), 500);
                }
                return;
            }

            // Handle 'R' key (refresh)
            // Only handle when in chords mode (main.js handles melody mode)
            if (e.key === 'r' || e.key === 'R') {
                const currentMode = window.getCurrentSuggestionMode ? window.getCurrentSuggestionMode() : 'chords';
                if (currentMode !== 'chords') {
                    return;
                }
                e.preventDefault();
                e.stopImmediatePropagation();
                this.refresh();
                return;
            }

            // Handle 'Esc' key (deselect)
            // Only handle when in chords mode (main.js handles melody mode)
            if (e.key === 'Escape') {
                const currentMode = window.getCurrentSuggestionMode ? window.getCurrentSuggestionMode() : 'chords';
                if (currentMode !== 'chords') {
                    return;
                }
                e.preventDefault();
                e.stopImmediatePropagation();
                this.deselectAllRecommendations();
                return;
            }
        });
    }

    /**
     * Insert a recommendation by its index (0-4 for keys 1-5)
     * @param {number} index - Index of recommendation to insert
     */
    insertRecommendationByIndex(index) {
        const items = document.querySelectorAll('.chord-recommendation-
        if (index < 0 || index >= items.length) {
            return;
        }

        const item = items[index];
        this.handleRecommendationClick(item);
    }

    /**
     * Deselect all recommendation items
     */
    deselectAllRecommendations() {
        const items = document.querySelectorAll('.chord-recommendation-
        items.forEach(item => item.classList.remove('selected'));
    }

    /**
     * Handle recommendation update events from the service
     * Phase 2.3: Now also renders harmonic analysis
     * @param {CustomEvent} event - recommendationsUpdated event
     */
    handleRecommendationsUpdate(event) {
        const { recommendations, key, progression, analysis } = event.detail;

        // Render recommendations in sidebar
        renderRecommendations(recommendations);

        // Phase 2.3: Render harmonic analysis panel
        if (analysis) {
            renderAnalysisPanel(analysis);
        } else {
            showEmptyAnalysis();
        }

        // Update context display
        this.updateContext(key, progression);
    }

    /**
     * Handle click on a recommendation item
     * @param {HTMLElement} item - The clicked recommendation item element
     */
    handleRecommendationClick(item) {
        const chordRoot = item.dataset.chordRoot;
        const chordType = item.dataset.chordType;

        if (!chordRoot || !chordType) {
            return;
        }

        // Insert the chord into the progression
        this.insertChordFromRecommendation(chordRoot, chordType);
    }

    /**
     * Get reasons from the stored recommendation data
     * Since tooltips store the full recommendation data, we can access it from cached recommendations
     * @param {HTMLElement} item - The recommendation item element
     * @returns {Array} Array of reason objects
     */
    getRecommendationReasons(item) {
        // Try to get from cached recommendations in the service
        if (this.service && this.service.cachedRecommendations) {
            const root = item.dataset.chordRoot;
            const type = item.dataset.chordType;

            const cached = this.service.cachedRecommendations.find(rec =>

            if (cached && cached.reasons) {
                return cached.reasons;
            }

            // Also check for scoreBreakdown which can be converted to reasons
            if (cached && cached.scoreBreakdown) {
                return this.convertBreakdownToReasons(cached.scoreBreakdown, cached.reason);
            }
        }

        return [];
    }

    /**
     * Convert score breakdown to reason objects for display
     * @param {Object} breakdown - Score breakdown object
     * @param {string} reason - Overall reason string
     * @returns {Array} Array of reason objects
     */
    convertBreakdownToReasons(breakdown, reason) {
        const reasons = [];

        if (reason) {
            reasons.push({
                category: 'recommendation',
                explanation: reason,
                commonTalk: reason
            });
        }

        if (breakdown.functionScore > 0) {
            reasons.push({
                category: 'harmonic_function',
                explanation: `Strong harmonic function score: ${Math.round(breakdown.functionScore)}%`,
                commonTalk: 'This chord fits well within the key'
            });
        }

        if (breakdown.voiceLeadingScore > 70) {
            reasons.push({
                category: 'voice_leading',
                explanation: `Smooth voice leading: ${Math.round(breakdown.voiceLeadingScore)}%`,
                commonTalk: 'Notes move smoothly from the previous chord'
            });
        }

        if (breakdown.styleFit > 0) {
            reasons.push({
                category: 'style_fit',
                explanation: `Matches your style preference: ${Math.round(breakdown.styleFit)}%`,
                commonTalk: 'Fits the musical style you selected'
            });
        }

        if (breakdown.moodFit > 0) {
            reasons.push({
                category: 'mood_fit',
                explanation: `Matches your mood preference: ${Math.round(breakdown.moodFit)}%`,
                commonTalk: 'Evokes the emotional feeling you want'
            });
        }

        return reasons;
    }

    /**
     * Insert a chord from a recommendation into the progression
     * @param {string} root - Chord root note
     * @param {string} type - Chord type
     */
    insertChordFromRecommendation(root, type) {
        try {
            // Insert chord into progression
            // Note: addChordToProgressionByParams has signature: (chordType, root, inversion)
            addChordToProgressionByParams(type, root, this.currentInversion);

            // The progression will automatically trigger bass auto-fill via existing integration
            // The progressionUpdated event will trigger recommendation refresh
        } catch (error) {
            // Error inserting chord
        }
    }

    /**
     * Refresh recommendations based on current progression and key
     */
    async refresh() {
        // Show loading state
        showLoadingState();

        try {
            // Get current state
            const progression = getProgressionData();
            const key = getCurrentKey();

            // Request new recommendations from service
            await this.service.getRecommendations(progression, key);

            // Service will dispatch 'recommendationsUpdated' event
            // which will trigger handleRecommendationsUpdate
        } catch (error) {
            showEmptyState('Error loading 
        }
    }

    /**
     * Update context display (key and currently selected chord)
     * @param {string} key - Current key
     * @param {Array} progression - Current progression
     */
    updateContext(key, progression) {
        // Get the currently selected chord from progression
        let selectedChordSymbol = null;
        let selectedChordData = null;

        if (progression && progression.length > 0) {
            // Get the selected chord index (defaults to last chord if no selection)
            const selectedIndex = getSelectedChordIndex();
            const chordIndex = (selectedIndex !== null && selectedIndex >= 0 && selectedIndex < progression.length)
                ? selectedIndex
                : progression.length - 1;

            const selectedChord = progression[chordIndex];
            const suffix = this.getChordSuffix(selectedChord.type);
            selectedChordSymbol = selectedChord.root + suffix;

            // Pass chord data for playback button
            selectedChordData = {
                root: selectedChord.root,
                type: selectedChord.type,
                inversion: selectedChord.inversion || 0
            };
        }

        // Update the context display in the sidebar
        updateContextDisplay(key, selectedChordSymbol, selectedChordData);
    }

    /**
     * Get chord suffix for display
     * @param {string} type - Chord type
     * @returns {string} Suffix (m, 7, etc.)
     */
    getChordSuffix(type) {
        const suffixes = {
            'Major': '',
            'Minor': 'm',
            'Diminished': 'dim',
            'Augmented': 'aug',
            'Major7': 'maj7',
            'Minor7': 'm7',
            'Dominant7': '7',
            'Diminished7': 'dim7',
            'HalfDiminished7': 'm7♭5',
            'Sus2': 'sus2',
            'Sus4': 'sus4',
            'Add9': 'add9',
            'Major6': '6',
            'Minor6': 'm6'
        };
        return suffixes[type] || '';
    }

    /**
     * Set the inversion to use for inserted chords
     * @param {number} inversion - Inversion (0, 1, or 2)
     */
    setInversion(inversion) {
        this.currentInversion = inversion;
    }

    /**
     * Clear all recommendations from the sidebar
     */
    clear() {
        clearRecommendations();
        this.service.clearRecommendations();
    }
}

// Create singleton instance
let controllerInstance = null;

/**
 * Get or create the RecommendationsSidebarController singleton
 * @returns {RecommendationsSidebarController}
 */
export function getRecommendationsSidebarController() {
    if (!controllerInstance) {
        controllerInstance = new RecommendationsSidebarController();
    }
    return controllerInstance;
}

// Export for direct use
export default RecommendationsSidebarController;
