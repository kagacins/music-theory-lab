/**
 * Recommendations Sidebar Controller
 * Phase 2.2: Recommendation Engine Integration
 *
 * This controller manages the chord recommendations sidebar:
 * - Listens for recommendation updates from the service
 * - Updates the sidebar UI when recommendations change
 * - Handles user interactions (clicks, refresh button)
 * - Manages sidebar context display (key, last chord)
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
import { getProgressionData, getCurrentKey } from '../state/trainerState.js';
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
        const sidebar = document.getElementById('chord-recommendations-sidebar');
        const resizeHandle = sidebar?.querySelector('.sidebar-resize-handle');
        
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
            resizeHandle.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        };
        
        const doResize = (clientX) => {
            if (!isResizing) return;
            
            const diff = clientX - startX;
            const newWidth = Math.max(256, Math.min(400, startWidth + diff));
            // Use setProperty with important to override any CSS constraints
            sidebar.style.setProperty('width', `${newWidth}px`, 'important');
            // Also ensure flex-shrink is 0 during resize
            sidebar.style.setProperty('flex-shrink', '0', 'important');
        };
        
        const stopResize = () => {
            if (isResizing) {
                isResizing = false;
                resizeHandle.classList.remove('resizing');
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
        const savedWidth = localStorage.getItem('chord-recommendations-sidebar-width');
        if (savedWidth) {
            const width = parseInt(savedWidth, 10);
            if (width >= 256 && width <= 400) {
                sidebar.style.setProperty('width', `${width}px`, 'important');
                sidebar.style.setProperty('flex-shrink', '0', 'important');
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

        // Setup refresh button click handler
        const refreshBtn = document.getElementById('refresh-recommendations-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refresh();
            });
        }

        // Listen for chord clicks (delegated event handling)
        // This will be set up when recommendations are rendered
        const recommendationsList = document.getElementById('recommendations-list');
        if (recommendationsList) {
            recommendationsList.addEventListener('click', (e) => {
                // Check if play button was clicked
                const playBtn = e.target.closest('.chord-play-btn');
                if (playBtn) {
                    e.stopPropagation(); // Prevent recommendation item click
                    const root = playBtn.dataset.chordRoot;
                    const type = playBtn.dataset.chordType;
                    const inversion = parseInt(playBtn.dataset.chordInversion || 0);
                    playChordPreview(root, type, inversion);
                    return;
                }

                // Find the clicked recommendation item
                const item = e.target.closest('.chord-recommendation-item');
                if (item) {
                    this.handleRecommendationClick(item);
                }
            });
        }

        // Listen for context play button clicks (delegated event handling)
        const contextDisplay = document.getElementById('last-chord-display');
        if (contextDisplay) {
            contextDisplay.addEventListener('click', (e) => {
                const playBtn = e.target.closest('.context-play-btn');
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
                const items = document.querySelectorAll('#recommendations-list .chord-recommendation-item');
                if (items[index]) {
                    items[index].classList.add('shortcut-pulse');
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
        const items = document.querySelectorAll('.chord-recommendation-item');
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
        const items = document.querySelectorAll('.chord-recommendation-item');
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
            showEmptyState('Error loading recommendations');
        }
    }

    /**
     * Update context display (key and last chord)
     * @param {string} key - Current key
     * @param {Array} progression - Current progression
     */
    updateContext(key, progression) {
        // Get last chord from progression
        let lastChordSymbol = null;
        let lastChordData = null;

        if (progression && progression.length > 0) {
            const lastChord = progression[progression.length - 1];
            const suffix = this.getChordSuffix(lastChord.type);
            lastChordSymbol = lastChord.root + suffix;

            // Pass chord data for playback button
            lastChordData = {
                root: lastChord.root,
                type: lastChord.type,
                inversion: lastChord.inversion || 0
            };
        }

        // Update the context display in the sidebar
        updateContextDisplay(key, lastChordSymbol, lastChordData);
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
