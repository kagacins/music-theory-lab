/**
 * Voice Leading Diagram Module
 *
 * Creates a collapsible panel showing voice leading analysis between chords.
 * Features:
 * - Collapsible panel matching app's design patterns
 * - Colored arcs showing voice motion (green=common, blue=step, orange=skip, red=leap)
 * - Warning detection: parallel 5ths/8ves, voice crossing, large leaps
 * - Filter toggles: show all, warnings only, hide new/dropped voices
 * - Warning arcs highlighted with distinct styling
 */

import {
    scoreEnhancedVoiceLeading,
    detectParallelMotion,
    detectVoiceCrossing
} from '../features/enhancedVoiceLeading.js';
import { getPiano, preWarmAudioContext } from '../audio/audioEngine.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const MOTION_COLORS = {
    commonTone: '#22C55E',      // Green - note stays the same
    stepwise: '#3B82F6',        // Blue - half/whole step
    skip: '#F97316',            // Orange - third to fifth
    leap: '#EF4444',            // Red - sixth or larger
    new: '#9CA3AF',             // Gray - new voice entering
    dropped: '#9CA3AF',         // Gray - voice exiting
};

const WARNING_COLORS = {
    parallelFifth: '#0EA5E9',   // Sky blue - parallel fifths (very distinct from red leap)
    parallelOctave: '#8B5CF6',  // Violet/purple - parallel octaves
    voiceCrossing: '#F59E0B',   // Amber/yellow - voice crossing
    largeleap: '#EC4899',       // Pink/magenta - large leaps
};

const MOTION_THRESHOLDS = {
    stepwise: 2,    // 0-2 semitones = stepwise
    skip: 7,        // 3-7 semitones = skip
    leapWarning: 8, // 8+ semitones = large leap warning
};

// Diagram layout constants
const DIAGRAM = {
    chordWidth: 70,
    chordSpacing: 90,
    noteRadius: 12,
    noteSpacing: 28,
    topPadding: 45,
    bottomPadding: 20,
    minHeight: 200,
    lineWidth: 2.5,
    curveOffset: 18,
};

// ============================================================================
// VOICE LEADING DIAGRAM CLASS
// ============================================================================

export class VoiceLeadingDiagram {
    constructor(options = {}) {
        this.compositionState = options.compositionState || null;
        this.onToggle = options.onToggle || (() => {});

        // State - always visible by default (user collapses/expands panel, not toggle on/off)
        this.isVisible = true;
        this.isPanelExpanded = true;
        this.container = null;
        this.svgElement = null;
        this.analysisData = null;

        // Filter state
        this.showWarningsOnly = false;
        this.showNewDropped = true;

        // Voice matching mode: 'smooth' (Hungarian algorithm) or 'voices' (register-based)
        this.matchingMode = 'smooth';

        // Load saved preferences (no longer load isVisible - always visible now)
        const savedMatchingMode = localStorage.getItem('voice-leading-matching-mode');
        if (savedMatchingMode) {
            this.matchingMode = savedMatchingMode;
        }
        const savedExpanded = localStorage.getItem('voice-leading-panel-expanded');
        if (savedExpanded !== null) {
            this.isPanelExpanded = savedExpanded === 'true';
        }
        const savedWarningsOnly = localStorage.getItem('voice-leading-warnings-only');
        if (savedWarningsOnly !== null) {
            this.showWarningsOnly = savedWarningsOnly === 'true';
        }
        const savedNewDropped = localStorage.getItem('voice-leading-show-new-dropped');
        if (savedNewDropped !== null) {
            this.showNewDropped = savedNewDropped === 'true';
        }
    }

    /**
     * Initialize the diagram - always shows the panel (user can collapse/expand)
     */
    init() {
        this.createContainer();
        // Always analyze and render since panel is always-on
        this.analyze();
        this.render();

        // If panel was collapsed in previous session, add to sidebar instead of showing
        if (!this.isPanelExpanded) {
            this.container.style.display = 'none';
            this.addToSidebar();
        } else {
            this.show();
        }
    }

    /**
     * Toggle panel expansion (not visibility - panel is always visible)
     * This is now an alias for togglePanel for backward compatibility
     */
    toggle() {
        this.togglePanel();
        return this.isPanelExpanded;
    }

    /**
     * Set visibility explicitly
     * For backward compatibility - now just ensures panel is shown and updated
     */
    setVisible(visible) {
        if (visible) {
            this.analyze();
            this.render();
            this.show();
        }
        // We no longer hide the panel - it's always on
        // User can collapse it if they don't want to see the content
    }

    /**
     * Toggle panel expansion with flying icon animation (matches sectionSidebar.js)
     */
    togglePanel() {
        this.isPanelExpanded = !this.isPanelExpanded;
        localStorage.setItem('voice-leading-panel-expanded', this.isPanelExpanded.toString());

        const content = document.getElementById('voice-leading-panel');
        const chevron = document.getElementById('voice-leading-chevron');
        const headerBtn = document.getElementById('voice-leading-toggle');

        if (this.isPanelExpanded) {
            // Expanding - animate icon from sidebar to panel, then show panel
            this.animateFromSidebar(() => {
                if (content) {
                    content.classList.remove('hidden');
                    chevron?.classList.add('rotate-180');
                }
                if (this.container) {
                    this.container.style.display = 'block';
                }
            });
        } else {
            // Collapsing - hide panel content, animate icon to sidebar
            if (content) {
                content.classList.add('hidden');
                chevron?.classList.remove('rotate-180');
            }
            this.animateToSidebar(headerBtn);
        }
    }

    /**
     * Animate icon flying from panel header to sidebar (collapse)
     */
    animateToSidebar(headerBtn) {
        const sectionSidebar = document.getElementById('melody-section-sidebar');
        const container = document.getElementById('melody-dashboard-sections-container');

        if (!sectionSidebar || !headerBtn) {
            if (this.container) this.container.style.display = 'none';
            this.addToSidebar();
            return;
        }

        const headerRect = headerBtn.getBoundingClientRect();

        // Create animated icon clone
        const animContainer = document.createElement('div');
        animContainer.style.cssText = `
            position: fixed;
            left: ${headerRect.left + headerRect.width / 2 - 14}px;
            top: ${headerRect.top + headerRect.height / 2 - 14}px;
            width: 28px;
            height: 28px;
            z-index: 9999;
            pointer-events: none;
            background-color: rgba(255, 255, 255, 0.95);
            border-radius: 6px;
            padding: 2px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const iconClone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        iconClone.setAttribute('class', 'w-6 h-6');
        iconClone.setAttribute('fill', 'none');
        iconClone.setAttribute('stroke', '#6366f1');
        iconClone.setAttribute('viewBox', '0 0 24 24');
        iconClone.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>';
        animContainer.appendChild(iconClone);
        document.body.appendChild(animContainer);

        // Hide the panel immediately
        if (this.container) this.container.style.display = 'none';

        // Show sidebar and add tab (invisible at first)
        sectionSidebar.style.display = 'flex';
        if (container) container.style.marginLeft = '4rem';
        this.addToSidebar();

        const tab = sectionSidebar.querySelector('[data-section-id="voice-leading"]');
        if (tab) tab.style.opacity = '0';

        requestAnimationFrame(() => {
            if (!tab) {
                animContainer.remove();
                return;
            }
            const tabRect = tab.getBoundingClientRect();

            animContainer.animate([
                {
                    left: `${headerRect.left + headerRect.width / 2 - 14}px`,
                    top: `${headerRect.top + headerRect.height / 2 - 14}px`,
                    transform: 'scale(1)',
                    opacity: 1
                },
                {
                    left: `${tabRect.left + tabRect.width / 2 - 14}px`,
                    top: `${tabRect.top + tabRect.height / 2 - 14}px`,
                    transform: 'scale(0.75)',
                    opacity: 0.9
                }
            ], {
                duration: 400,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                fill: 'forwards'
            }).onfinish = () => {
                animContainer.remove();
                if (tab) {
                    tab.style.opacity = '1';
                    tab.style.transition = 'opacity 0.2s';
                }
                if (window.updateTabSidebarHeight) {
                    setTimeout(() => window.updateTabSidebarHeight('melody'), 50);
                }
            };
        });
    }

    /**
     * Animate icon flying from sidebar to panel header (expand)
     */
    animateFromSidebar(onComplete) {
        const sectionSidebar = document.getElementById('melody-section-sidebar');
        const container = document.getElementById('melody-dashboard-sections-container');
        const tab = sectionSidebar?.querySelector('[data-section-id="voice-leading"]');
        const headerBtn = document.getElementById('voice-leading-toggle');

        if (!tab || !headerBtn) {
            this.removeFromSidebar();
            if (onComplete) onComplete();
            return;
        }

        const tabRect = tab.getBoundingClientRect();

        const animContainer = document.createElement('div');
        animContainer.style.cssText = `
            position: fixed;
            left: ${tabRect.left + tabRect.width / 2 - 14}px;
            top: ${tabRect.top + tabRect.height / 2 - 14}px;
            width: 28px;
            height: 28px;
            z-index: 9999;
            pointer-events: none;
            background-color: rgba(255, 255, 255, 0.95);
            border-radius: 6px;
            padding: 2px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const iconClone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        iconClone.setAttribute('class', 'w-6 h-6');
        iconClone.setAttribute('fill', 'none');
        iconClone.setAttribute('stroke', '#6366f1');
        iconClone.setAttribute('viewBox', '0 0 24 24');
        iconClone.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>';
        animContainer.appendChild(iconClone);
        document.body.appendChild(animContainer);

        tab.style.opacity = '0';

        if (onComplete) onComplete();
        const headerIcon = headerBtn.querySelector('svg');
        if (headerIcon) headerIcon.style.opacity = '0';

        requestAnimationFrame(() => {
            const headerRect = headerBtn.getBoundingClientRect();

            animContainer.animate([
                {
                    left: `${tabRect.left + tabRect.width / 2 - 14}px`,
                    top: `${tabRect.top + tabRect.height / 2 - 14}px`,
                    transform: 'scale(0.75)',
                    opacity: 0.9
                },
                {
                    left: `${headerRect.left + headerRect.width / 2 - 14}px`,
                    top: `${headerRect.top + headerRect.height / 2 - 14}px`,
                    transform: 'scale(1)',
                    opacity: 1
                }
            ], {
                duration: 400,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                fill: 'forwards'
            }).onfinish = () => {
                animContainer.remove();
                if (headerIcon) {
                    headerIcon.style.opacity = '1';
                    headerIcon.style.transition = 'opacity 0.2s';
                }
                this.removeFromSidebar();
            };
        });
    }

    /**
     * Add a tab to the section sidebar when collapsed
     */
    addToSidebar(retryCount = 0) {
        const sectionSidebar = document.getElementById('melody-section-sidebar');
        if (!sectionSidebar) {
            // Retry a few times if sidebar doesn't exist yet (it may be created with a delay)
            if (retryCount < 5) {
                setTimeout(() => this.addToSidebar(retryCount + 1), 100);
            }
            return;
        }

        if (sectionSidebar.querySelector('[data-section-id="voice-leading"]')) return;

        const tab = document.createElement('button');
        tab.className = 'section-sidebar-tab w-12 h-12 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white transition-all flex items-center justify-center shadow-md';
        tab.setAttribute('data-section-id', 'voice-leading');
        tab.style.width = '48px';
        tab.style.height = '48px';
        tab.style.minHeight = '48px';
        tab.style.minWidth = '48px';

        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('class', 'w-6 h-6');
        icon.setAttribute('fill', 'none');
        icon.setAttribute('stroke', 'currentColor');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>';
        tab.appendChild(icon);

        const tooltip = document.createElement('div');
        tooltip.className = 'sidebar-section-tooltip';
        tooltip.textContent = 'Voice Leading';
        tooltip.style.cssText = 'position: fixed; background-color: #111827; color: white; font-size: 12px; border-radius: 4px; padding: 4px 8px; pointer-events: none; white-space: nowrap; z-index: 9999; opacity: 0; visibility: hidden;';
        document.body.appendChild(tooltip);

        tab.addEventListener('mouseenter', () => {
            const tabRect = tab.getBoundingClientRect();
            tooltip.style.left = `${tabRect.right + 8}px`;
            tooltip.style.top = `${tabRect.top + tabRect.height / 2}px`;
            tooltip.style.transform = 'translateY(-50%)';
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '1';
        });

        tab.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
            tooltip.style.visibility = 'hidden';
        });

        tab.addEventListener('click', () => this.togglePanel());
        tab._tooltip = tooltip;

        // Insert at beginning
        const firstTab = sectionSidebar.querySelector('[data-section-id]');
        if (firstTab) {
            sectionSidebar.insertBefore(tab, firstTab);
        } else {
            sectionSidebar.appendChild(tab);
        }

        // Show the sidebar and set container margin
        sectionSidebar.style.display = 'flex';
        const container = document.getElementById('melody-dashboard-sections-container');
        if (container) {
            container.style.marginLeft = '4rem';
        }

        // Update sidebar height
        if (window.updateTabSidebarHeight) {
            setTimeout(() => window.updateTabSidebarHeight('melody'), 50);
        }
    }

    /**
     * Remove the tab from the section sidebar when expanded
     */
    removeFromSidebar() {
        const sectionSidebar = document.getElementById('melody-section-sidebar');
        const container = document.getElementById('melody-dashboard-sections-container');
        if (!sectionSidebar) return;

        const tab = sectionSidebar.querySelector('[data-section-id="voice-leading"]');
        if (tab) {
            if (tab._tooltip) tab._tooltip.remove();
            tab.remove();

            const remainingTabs = sectionSidebar.querySelectorAll('[data-section-id]');
            if (remainingTabs.length === 0) {
                sectionSidebar.style.display = 'none';
                if (container) container.style.marginLeft = '0';
            }

            if (window.updateTabSidebarHeight) {
                setTimeout(() => window.updateTabSidebarHeight('melody'), 50);
            }
        }
    }

    /**
     * Set matching mode explicitly
     */
    setMatchingMode(mode) {
        if (this.matchingMode === mode) return; // Already in this mode
        this.matchingMode = mode;
        localStorage.setItem('voice-leading-matching-mode', this.matchingMode);
        this.analyze(); // Re-analyze with new mode
        this.render();
        this.updateFilterButtons();
    }

    /**
     * Set warnings filter explicitly
     */
    setWarningsFilter(warningsOnly) {
        if (this.showWarningsOnly === warningsOnly) return; // Already in this state
        this.showWarningsOnly = warningsOnly;
        localStorage.setItem('voice-leading-warnings-only', this.showWarningsOnly.toString());
        this.render();
        this.updateFilterButtons();
    }

    /**
     * Toggle warnings-only filter (legacy, for backwards compatibility)
     */
    toggleWarningsOnly() {
        this.setWarningsFilter(!this.showWarningsOnly);
    }

    /**
     * Toggle show new/dropped voices
     */
    toggleNewDropped() {
        this.showNewDropped = !this.showNewDropped;
        localStorage.setItem('voice-leading-show-new-dropped', this.showNewDropped.toString());
        this.render();
        this.updateFilterButtons();
    }

    /**
     * Update filter button states for segmented controls
     */
    updateFilterButtons() {
        // Mode segmented control
        const modeSmoothBtn = document.getElementById('vl-mode-smooth');
        const modeVoicesBtn = document.getElementById('vl-mode-voices');

        if (modeSmoothBtn && modeVoicesBtn) {
            if (this.matchingMode === 'smooth') {
                modeSmoothBtn.classList.add('bg-blue-500', 'text-white');
                modeSmoothBtn.classList.remove('bg-white', 'text-gray-600', 'hover:bg-gray-50');
                modeVoicesBtn.classList.remove('bg-purple-500', 'text-white');
                modeVoicesBtn.classList.add('bg-white', 'text-gray-600', 'hover:bg-gray-50');
            } else {
                modeSmoothBtn.classList.remove('bg-blue-500', 'text-white');
                modeSmoothBtn.classList.add('bg-white', 'text-gray-600', 'hover:bg-gray-50');
                modeVoicesBtn.classList.add('bg-purple-500', 'text-white');
                modeVoicesBtn.classList.remove('bg-white', 'text-gray-600', 'hover:bg-gray-50');
            }
        }

        // View segmented control
        const viewAllBtn = document.getElementById('vl-view-all');
        const viewWarningsBtn = document.getElementById('vl-view-warnings');

        if (viewAllBtn && viewWarningsBtn) {
            if (this.showWarningsOnly) {
                viewAllBtn.classList.remove('bg-gray-700', 'text-white');
                viewAllBtn.classList.add('bg-white', 'text-gray-600', 'hover:bg-gray-50');
                viewWarningsBtn.classList.add('bg-red-500', 'text-white');
                viewWarningsBtn.classList.remove('bg-white', 'text-gray-600', 'hover:bg-gray-50');
            } else {
                viewAllBtn.classList.add('bg-gray-700', 'text-white');
                viewAllBtn.classList.remove('bg-white', 'text-gray-600', 'hover:bg-gray-50');
                viewWarningsBtn.classList.remove('bg-red-500', 'text-white');
                viewWarningsBtn.classList.add('bg-white', 'text-gray-600', 'hover:bg-gray-50');
            }
        }

        // New/Dropped checkbox toggle
        const newDroppedBtn = document.getElementById('vl-filter-new-dropped');
        const newDroppedCheckbox = document.getElementById('vl-new-dropped-checkbox');
        const newDroppedCheck = document.getElementById('vl-new-dropped-check');

        if (newDroppedBtn) {
            if (this.showNewDropped) {
                newDroppedBtn.classList.add('bg-indigo-50', 'text-indigo-700', 'border-indigo-300');
                newDroppedBtn.classList.remove('bg-white', 'text-gray-500', 'border-gray-300', 'hover:bg-gray-50');
            } else {
                newDroppedBtn.classList.remove('bg-indigo-50', 'text-indigo-700', 'border-indigo-300');
                newDroppedBtn.classList.add('bg-white', 'text-gray-500', 'border-gray-300', 'hover:bg-gray-50');
            }
        }

        if (newDroppedCheckbox) {
            if (this.showNewDropped) {
                newDroppedCheckbox.classList.add('bg-indigo-500', 'border-indigo-500');
                newDroppedCheckbox.classList.remove('bg-white', 'border-gray-400');
            } else {
                newDroppedCheckbox.classList.remove('bg-indigo-500', 'border-indigo-500');
                newDroppedCheckbox.classList.add('bg-white', 'border-gray-400');
            }
        }

        if (newDroppedCheck) {
            if (this.showNewDropped) {
                newDroppedCheck.classList.remove('hidden');
            } else {
                newDroppedCheck.classList.add('hidden');
            }
        }
    }

    /**
     * Create the container panel
     */
    createContainer() {
        // Check if already exists
        if (document.getElementById('voice-leading-section')) {
            this.container = document.getElementById('voice-leading-section');
            return;
        }

        this.container = document.createElement('div');
        this.container.id = 'voice-leading-section';
        this.container.className = 'mb-3 melody-section-item';
        this.container.style.display = 'none';

        const expandedClass = this.isPanelExpanded ? '' : 'hidden';
        const chevronClass = this.isPanelExpanded ? 'rotate-180' : '';

        this.container.innerHTML = `
            <!-- Voice Leading Panel Header -->
            <button id="voice-leading-toggle"
                    class="w-full px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-between">
                <span class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-white/70 cursor-move drag-handle" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Drag to reorder" style="pointer-events: auto;">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
                    </svg>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                    </svg>
                    Voice Leading
                    <span id="voice-leading-quality-badge" class="text-xs bg-white/20 px-2 py-0.5 rounded-full">--</span>
                </span>
                <svg id="voice-leading-chevron" class="w-5 h-5 transform transition-transform ${chevronClass}" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                </svg>
            </button>

            <!-- Panel Content -->
            <div id="voice-leading-panel" class="mt-2 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 border-l-4 border-l-indigo-500 overflow-hidden ${expandedClass}">

                <!-- Filter Controls -->
                <div class="flex items-center justify-between px-3 py-2 bg-white/50 border-b border-indigo-200">
                    <div class="flex items-center gap-3 flex-wrap">
                        <!-- Matching Mode: Segmented Control -->
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs text-gray-500">Mode:</span>
                            <div class="inline-flex rounded-md overflow-hidden border border-gray-300">
                                <button id="vl-mode-smooth"
                                        class="px-2 py-1 text-xs font-medium transition-all border-r border-gray-300 ${this.matchingMode === 'smooth' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}"
                                        title="Minimize total voice movement">
                                    Smooth
                                </button>
                                <button id="vl-mode-voices"
                                        class="px-2 py-1 text-xs font-medium transition-all ${this.matchingMode === 'voices' ? 'bg-purple-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}"
                                        title="Track by register position">
                                    Voice Parts
                                </button>
                            </div>
                            <button id="vl-mode-info" class="p-0.5 text-gray-400 hover:text-gray-600 transition-colors" title="Learn about matching modes">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                                </svg>
                            </button>
                        </div>

                        <span class="text-gray-300">|</span>

                        <!-- View Filter: Segmented Control -->
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs text-gray-500">Show:</span>
                            <div class="inline-flex rounded-md overflow-hidden border border-gray-300">
                                <button id="vl-view-all"
                                        class="px-2 py-1 text-xs font-medium transition-all border-r border-gray-300 ${!this.showWarningsOnly ? 'bg-gray-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}">
                                    All
                                </button>
                                <button id="vl-view-warnings"
                                        class="px-2 py-1 text-xs font-medium transition-all flex items-center gap-1 ${this.showWarningsOnly ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}">
                                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                    </svg>
                                    Warnings
                                </button>
                            </div>
                        </div>

                        <span class="text-gray-300">|</span>

                        <!-- New/Dropped: Checkbox-style toggle -->
                        <button id="vl-filter-new-dropped"
                                class="flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-all ${this.showNewDropped ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}"
                                title="Show gray arcs for voices that appear or disappear between chords (e.g., going from 3 notes to 4 notes)">
                            <span id="vl-new-dropped-checkbox" class="w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${this.showNewDropped ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-gray-400'}">
                                <svg id="vl-new-dropped-check" class="w-2.5 h-2.5 text-white ${this.showNewDropped ? '' : 'hidden'}" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                            </span>
                            <span>Added/Removed Voices</span>
                        </button>
                    </div>
                    <div id="vl-warning-summary" class="text-xs text-gray-500">
                        <!-- Warning summary will be inserted here -->
                    </div>
                </div>

                <!-- Mode Info Panel (hidden by default) -->
                <div id="vl-mode-info-panel" class="hidden px-3 py-3 bg-blue-50 border-b border-blue-200 text-sm">
                    <div class="flex justify-between items-start mb-2">
                        <span class="font-semibold text-blue-900">Voice Matching Modes</span>
                        <button id="vl-mode-info-close" class="text-blue-400 hover:text-blue-600">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                    <div class="space-y-3 text-xs text-blue-800">
                        <div class="flex gap-2">
                            <span class="px-2 py-0.5 bg-blue-200 text-blue-800 rounded font-medium shrink-0">Smooth</span>
                            <p>Uses the <strong>Hungarian algorithm</strong> to minimize total semitone movement across all voices. Best for analyzing <em>efficiency</em> of voice leading. May connect notes across registers if it reduces overall movement.</p>
                        </div>
                        <div class="flex gap-2">
                            <span class="px-2 py-0.5 bg-purple-200 text-purple-800 rounded font-medium shrink-0">Voice Parts</span>
                            <p>Connects notes by <strong>register position</strong>: top note → top note, middle → middle, bottom → bottom. Best for understanding how <em>individual voice parts</em> move. Shows soprano, alto, tenor, bass lines.</p>
                        </div>
                        <div class="mt-2 p-2 bg-white/50 rounded border border-blue-200">
                            <p class="text-blue-700"><strong>Example:</strong> G→D chord with D4 on top. "Smooth" might connect D4→D3 (same pitch class). "Voice Parts" connects D4→A3 (both are top notes in their chords).</p>
                        </div>
                    </div>
                </div>

                <!-- Diagram Area -->
                <div id="voice-leading-diagram-area" class="p-3 overflow-x-auto bg-white/30">
                    <!-- SVG diagram will be inserted here -->
                </div>

                <!-- Legend -->
                <div class="px-3 py-2 bg-white/50 border-t border-indigo-200">
                    <div class="flex justify-center flex-wrap gap-x-4 gap-y-1 text-xs">
                        <!-- Motion types row -->
                        <div class="flex items-center gap-3">
                            <span class="text-gray-500 font-medium">Motion:</span>
                            <div class="vl-legend-item flex items-center gap-1" data-tooltip="COMMON TONE (Excellent): Same pitch held between chords. Creates stability. Best voice leading choice.">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${MOTION_COLORS.commonTone}" stroke-width="2.5"/></svg>
                                <span class="text-gray-600">Common</span>
                            </div>
                            <div class="vl-legend-item flex items-center gap-1" data-tooltip="STEPWISE (Good): Half or whole step (1-2 semitones). Smooth, singable. Generally desirable.">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${MOTION_COLORS.stepwise}" stroke-width="2.5"/></svg>
                                <span class="text-gray-600">Step</span>
                            </div>
                            <div class="vl-legend-item flex items-center gap-1" data-tooltip="SKIP (Acceptable): Third to fifth (3-7 semitones). Moderate movement. Use sparingly for variety.">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${MOTION_COLORS.skip}" stroke-width="2.5" stroke-dasharray="4,2"/></svg>
                                <span class="text-gray-600">Skip</span>
                            </div>
                            <div class="vl-legend-item flex items-center gap-1" data-tooltip="LEAP (Use with care): Sixth or larger (8+ semitones). Can sound awkward. Best followed by contrary stepwise motion.">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${MOTION_COLORS.leap}" stroke-width="2.5" stroke-dasharray="3,3"/></svg>
                                <span class="text-gray-600">Leap</span>
                            </div>
                        </div>
                        <!-- Warnings row -->
                        <div class="flex items-center gap-3 ml-2 pl-2 border-l border-gray-300">
                            <span class="text-gray-500 font-medium">Warnings:</span>
                            <div class="vl-legend-item flex items-center gap-1" data-tooltip="PARALLEL 5THS (Avoid): Two voices moving in parallel perfect 5ths. Sounds hollow. Prohibited in classical counterpoint.">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${WARNING_COLORS.parallelFifth}" stroke-width="3"/></svg>
                                <span style="color: #0EA5E9;" class="font-medium">P5</span>
                            </div>
                            <div class="vl-legend-item flex items-center gap-1" data-tooltip="PARALLEL 8VES (Avoid): Two voices moving in parallel octaves. Reduces voice independence. Prohibited in classical counterpoint.">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${WARNING_COLORS.parallelOctave}" stroke-width="3"/></svg>
                                <span style="color: #8B5CF6;" class="font-medium">P8</span>
                            </div>
                            <div class="vl-legend-item flex items-center gap-1" data-tooltip="LARGE LEAP (Caution): Jump of 8+ semitones. Can sound abrupt. Consider if it serves a musical purpose.">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${WARNING_COLORS.largeleap}" stroke-width="3"/></svg>
                                <span style="color: #EC4899;" class="font-medium">Lg Leap</span>
                            </div>
                            <div class="vl-legend-item flex items-center gap-1" data-tooltip="VOICE CROSSING (Caution): Lower voice moves above higher voice. Can confuse voice independence. Sometimes acceptable briefly.">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${WARNING_COLORS.voiceCrossing}" stroke-width="3"/></svg>
                                <span class="text-amber-600 font-medium">Cross</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add tooltip styles if not already present
        if (!document.getElementById('vl-tooltip-styles')) {
            const style = document.createElement('style');
            style.id = 'vl-tooltip-styles';
            style.textContent = `
                .vl-legend-item {
                    position: relative;
                    cursor: help;
                }
                .vl-legend-item::after {
                    content: attr(data-tooltip);
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #1f2937;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 11px;
                    line-height: 1.4;
                    white-space: normal;
                    width: max-content;
                    max-width: 250px;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.2s, visibility 0.2s;
                    z-index: 1000;
                    pointer-events: none;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    margin-bottom: 6px;
                }
                .vl-legend-item:hover::after {
                    opacity: 1;
                    visibility: visible;
                }
                .vl-legend-item::before {
                    content: '';
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    border: 6px solid transparent;
                    border-top-color: #1f2937;
                    margin-bottom: 0;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.2s, visibility 0.2s;
                    z-index: 1001;
                }
                .vl-legend-item:hover::before {
                    opacity: 1;
                    visibility: visible;
                }

                /* Arc tooltip styles */
                #vl-arc-tooltip {
                    position: fixed;
                    background: #1f2937;
                    color: white;
                    padding: 8px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    line-height: 1.4;
                    white-space: pre-line;
                    max-width: 280px;
                    z-index: 10000;
                    pointer-events: none;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.15s, visibility 0.15s;
                }
                #vl-arc-tooltip.visible {
                    opacity: 1;
                    visibility: visible;
                }
                #vl-arc-tooltip::after {
                    content: '';
                    position: absolute;
                    top: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    border: 6px solid transparent;
                    border-top-color: #1f2937;
                }
            `;
            document.head.appendChild(style);
        }

        // Create arc tooltip container if not present
        if (!document.getElementById('vl-arc-tooltip')) {
            const tooltip = document.createElement('div');
            tooltip.id = 'vl-arc-tooltip';
            document.body.appendChild(tooltip);
        }

        // Attach event listeners
        setTimeout(() => {
            const headerBtn = document.getElementById('voice-leading-toggle');
            if (headerBtn) {
                headerBtn.addEventListener('click', (e) => {
                    if (!e.target.closest('.drag-handle')) {
                        this.togglePanel();
                    }
                });
            }

            const newDroppedBtn = document.getElementById('vl-filter-new-dropped');
            if (newDroppedBtn) {
                newDroppedBtn.addEventListener('click', () => this.toggleNewDropped());
            }

            // Matching mode segmented control
            const modeSmoothBtn = document.getElementById('vl-mode-smooth');
            const modeVoicesBtn = document.getElementById('vl-mode-voices');
            if (modeSmoothBtn) {
                modeSmoothBtn.addEventListener('click', () => this.setMatchingMode('smooth'));
            }
            if (modeVoicesBtn) {
                modeVoicesBtn.addEventListener('click', () => this.setMatchingMode('voices'));
            }

            // View filter segmented control
            const viewAllBtn = document.getElementById('vl-view-all');
            const viewWarningsBtn = document.getElementById('vl-view-warnings');
            if (viewAllBtn) {
                viewAllBtn.addEventListener('click', () => this.setWarningsFilter(false));
            }
            if (viewWarningsBtn) {
                viewWarningsBtn.addEventListener('click', () => this.setWarningsFilter(true));
            }

            // Mode info panel toggle
            const modeInfoBtn = document.getElementById('vl-mode-info');
            const modeInfoPanel = document.getElementById('vl-mode-info-panel');
            const modeInfoClose = document.getElementById('vl-mode-info-close');

            if (modeInfoBtn && modeInfoPanel) {
                modeInfoBtn.addEventListener('click', () => {
                    modeInfoPanel.classList.toggle('hidden');
                });
            }
            if (modeInfoClose && modeInfoPanel) {
                modeInfoClose.addEventListener('click', () => {
                    modeInfoPanel.classList.add('hidden');
                });
            }

            // Set up drag handle listeners (matching sectionDragDrop.js pattern)
            const dragHandle = this.container.querySelector('.drag-handle');
            if (dragHandle) {
                dragHandle.style.pointerEvents = 'auto';
                dragHandle.style.userSelect = 'none';
                dragHandle.style.webkitUserSelect = 'none';

                dragHandle.addEventListener('mousedown', function(e) {
                    e.stopPropagation();
                }, true);

                dragHandle.addEventListener('click', function(e) {
                    if (e.detail === 0) {
                        e.stopPropagation();
                        e.preventDefault();
                    }
                }, true);
            }
        }, 0);

        // Insert into the page - find the best container
        // Priority: 1) Staff Notation Card panel, 2) Melody sections, 3) Trainer container
        const staffNotationPanel = document.getElementById('staff-notation-card-panel');
        const staffNotationCard = document.getElementById('staff-notation-card-toggle')?.closest('.melody-section-item');
        const melodySectionsContainer = document.getElementById('melody-dashboard-sections-container');
        const trainerContainer = document.querySelector('#trainer-sections-container');
        const compositionNotationPanel = document.getElementById('composition-notation-panel');

        if (staffNotationCard && staffNotationCard.parentElement) {
            // Insert after the Staff Notation card as a new section
            staffNotationCard.parentElement.insertBefore(this.container, staffNotationCard.nextSibling);
        } else if (staffNotationPanel) {
            // Insert at the top of staff notation panel
            staffNotationPanel.insertBefore(this.container, staffNotationPanel.firstChild);
        } else if (compositionNotationPanel) {
            const panelBody = compositionNotationPanel.querySelector('.panel-body') || compositionNotationPanel;
            panelBody.insertBefore(this.container, panelBody.firstChild);
        } else if (melodySectionsContainer) {
            melodySectionsContainer.appendChild(this.container);
        } else if (trainerContainer) {
            trainerContainer.appendChild(this.container);
        } else {
            // Ultimate fallback - find main content area
            const mainContent = document.querySelector('.composition-studio-content') ||
                               document.querySelector('main') ||
                               document.body;
            mainContent.appendChild(this.container);
        }

        // Reinitialize drag-drop for the melody tab to recognize this new section
        setTimeout(() => {
            if (window.reinitSectionDragDrop) {
                window.reinitSectionDragDrop('melody');
            }
        }, 100);
    }

    /**
     * Analyze voice leading
     */
    analyze() {
        const compositionState = this.compositionState || window.getCompositionState?.();
        if (!compositionState) return null;

        const measures = compositionState.measures || [];
        if (measures.length < 2) {
            this.analysisData = null;
            return null;
        }

        const chords = [];
        const transitions = [];
        let totalScore = 0;
        const warnings = [];

        // Get progression data for chord names
        const progressionData = compositionState.exportToProgressionData?.() ||
                                compositionState.progressionData || [];

        // Collect chord data
        for (let i = 0; i < measures.length; i++) {
            const measure = measures[i];
            const notes = this.getMeasureNotes(measure, 'bass');
            const midi = this.extractAllMidiValues(notes);

            // Get chord name from progression data - use simpleName to match chord cards
            let chordName = '?';
            const progChord = progressionData[i];
            if (progChord) {
                // Priority: simpleName (matches chord cards) > name > root+type
                if (progChord.simpleName) {
                    chordName = progChord.simpleName;
                } else if (progChord.name) {
                    chordName = progChord.name;
                } else if (progChord.root) {
                    chordName = progChord.root + (progChord.type || '');
                }
            }
            if (chordName === '?') {
                chordName = this.getChordName(measure);
            }

            chords.push({
                index: i,
                name: chordName,
                midi: midi,
                notes: midi.map(m => this.midiToNoteNameWithOctave(m)),
            });
        }

        // Analyze transitions
        for (let i = 0; i < chords.length - 1; i++) {
            const fromChord = chords[i];
            const toChord = chords[i + 1];

            if (fromChord.midi.length === 0 || toChord.midi.length === 0) continue;

            const key = compositionState.metadata?.key || 'C';
            const analysis = scoreEnhancedVoiceLeading(fromChord.midi, toChord.midi, key);
            const parallelMotion = detectParallelMotion(fromChord.midi, toChord.midi);
            const voiceCrossing = detectVoiceCrossing(fromChord.midi, toChord.midi);

            const motions = this.analyzeVoiceMotions(fromChord.midi, toChord.midi);

            // Detect which voice pairs have parallel issues
            const parallelVoicePairs = new Set();
            if (parallelMotion?.details) {
                for (const detail of parallelMotion.details) {
                    if (detail.voices) {
                        parallelVoicePairs.add(`${detail.voices[0]}-${detail.voices[1]}`);
                    }
                }
            }

            // Detect voice crossing pairs
            const crossingVoicePairs = new Set();
            if (voiceCrossing?.details) {
                for (const detail of voiceCrossing.details) {
                    if (detail.voices) {
                        crossingVoicePairs.add(`${detail.voices[0]}-${detail.voices[1]}`);
                    }
                }
            }

            // Mark motions with warnings
            motions.forEach(motion => {
                motion.warnings = [];

                // Skip warnings for common tones (they didn't move, so can't be part of parallel motion)
                const isCommonTone = motion.type === 'commonTone' || motion.interval === 0;

                // Check if this motion is part of parallel motion (only if voice actually moved)
                if (!isCommonTone && motion.type !== 'new' && motion.type !== 'dropped') {
                    for (const pair of parallelVoicePairs) {
                        const [v1, v2] = pair.split('-').map(Number);
                        if (motion.fromVoice === v1 || motion.fromVoice === v2) {
                            // Determine which type of parallel motion
                            const warningType = parallelMotion.parallelFifths ? 'P5' : 'P8';
                            if (!motion.warnings.includes(warningType)) {
                                motion.warnings.push(warningType);
                            }
                        }
                    }
                }

                // Check voice crossing (can include common tones if they cross)
                for (const pair of crossingVoicePairs) {
                    const [v1, v2] = pair.split('-').map(Number);
                    if (motion.fromVoice === v1 || motion.fromVoice === v2) {
                        if (!motion.warnings.includes('crossing')) {
                            motion.warnings.push('crossing');
                        }
                    }
                }

                // Large leap warning (only for actual motion, not common tones)
                if (!isCommonTone && motion.interval !== null && motion.interval >= MOTION_THRESHOLDS.leapWarning) {
                    motion.warnings.push('leap');
                }
            });

            const transitionWarnings = [];
            if (parallelMotion?.parallelFifths) {
                transitionWarnings.push({ type: 'P5', description: 'Parallel 5ths' });
            }
            if (parallelMotion?.parallelOctaves) {
                transitionWarnings.push({ type: 'P8', description: 'Parallel 8ves' });
            }
            if (voiceCrossing?.count > 0) {
                transitionWarnings.push({ type: 'crossing', description: `Voice crossing (${voiceCrossing.count})` });
            }

            // Count large leaps
            const largeLeaps = motions.filter(m => m.interval >= MOTION_THRESHOLDS.leapWarning).length;
            if (largeLeaps > 0) {
                transitionWarnings.push({ type: 'leap', description: `Large leap${largeLeaps > 1 ? 's' : ''} (${largeLeaps})` });
            }

            const transition = {
                fromIndex: i,
                toIndex: i + 1,
                motions,
                score: analysis?.score || 0,
                warnings: transitionWarnings,
                hasWarnings: transitionWarnings.length > 0,
            };

            transitions.push(transition);
            totalScore += transition.score;

            // Add to global warnings list
            transitionWarnings.forEach(w => {
                warnings.push({ ...w, from: i, to: i + 1 });
            });
        }

        const avgScore = transitions.length > 0 ? totalScore / transitions.length : 0;

        this.analysisData = {
            chords,
            transitions,
            avgScore,
            warnings,
            quality: this.getQualityLabel(avgScore, warnings.length),
        };

        return this.analysisData;
    }

    /**
     * Get quality label
     */
    getQualityLabel(score, warningCount) {
        if (warningCount > 2) return { label: 'Issues', color: '#EF4444', bgClass: 'bg-red-500' };
        if (warningCount > 0) return { label: 'Caution', color: '#F59E0B', bgClass: 'bg-amber-500' };
        if (score >= 80) return { label: 'Excellent', color: '#22C55E', bgClass: 'bg-green-500' };
        if (score >= 60) return { label: 'Good', color: '#3B82F6', bgClass: 'bg-blue-500' };
        if (score >= 40) return { label: 'Fair', color: '#F97316', bgClass: 'bg-orange-500' };
        return { label: 'Poor', color: '#EF4444', bgClass: 'bg-red-500' };
    }

    /**
     * Analyze voice motions between chords
     * Uses either Hungarian algorithm (smooth) or register-based matching (voices)
     */
    analyzeVoiceMotions(fromMidi, toMidi) {
        const motions = [];

        const fromLen = fromMidi.length;
        const toLen = toMidi.length;

        if (fromLen === 0 || toLen === 0) return motions;

        if (this.matchingMode === 'voices') {
            // Voice Parts mode: match by register position (top→top, middle→middle, etc.)
            return this.analyzeVoiceMotionsByRegister(fromMidi, toMidi);
        }

        // Smooth mode: use Hungarian algorithm for optimal matching
        // Build cost matrix
        const costs = [];
        for (let f = 0; f < fromLen; f++) {
            costs[f] = [];
            for (let t = 0; t < toLen; t++) {
                costs[f][t] = Math.abs(toMidi[t] - fromMidi[f]);
            }
        }

        // Use Hungarian algorithm for optimal matching
        const matches = this.hungarianMatch(costs, fromLen, toLen);

        // Create motion objects from matches
        const fromUsed = new Set();
        const toUsed = new Set();

        for (const match of matches) {
            fromUsed.add(match.f);
            toUsed.add(match.t);
            motions.push({
                fromVoice: match.f,
                toVoice: match.t,
                fromMidi: fromMidi[match.f],
                toMidi: toMidi[match.t],
                interval: costs[match.f][match.t],
                type: this.getMotionType(costs[match.f][match.t]),
            });
        }

        // Mark unmatched notes
        for (let f = 0; f < fromLen; f++) {
            if (!fromUsed.has(f)) {
                motions.push({
                    fromVoice: f,
                    toVoice: -1,
                    fromMidi: fromMidi[f],
                    toMidi: null,
                    interval: null,
                    type: 'dropped',
                });
            }
        }
        for (let t = 0; t < toLen; t++) {
            if (!toUsed.has(t)) {
                motions.push({
                    fromVoice: -1,
                    toVoice: t,
                    fromMidi: null,
                    toMidi: toMidi[t],
                    interval: null,
                    type: 'new',
                });
            }
        }

        // Sort by fromVoice for display
        motions.sort((a, b) => {
            if (a.fromVoice === -1) return 1;
            if (b.fromVoice === -1) return -1;
            return a.fromVoice - b.fromVoice;
        });

        return motions;
    }

    /**
     * Analyze voice motions by register position
     * Top note → top note, second from top → second from top, etc.
     */
    analyzeVoiceMotionsByRegister(fromMidi, toMidi) {
        const motions = [];
        const fromLen = fromMidi.length;
        const toLen = toMidi.length;

        // Notes are already sorted low to high, so highest index = soprano
        // Match from the top down (soprano first, then alto, etc.)
        const minLen = Math.min(fromLen, toLen);

        for (let i = 0; i < minLen; i++) {
            // Match from top: fromMidi[fromLen-1-i] → toMidi[toLen-1-i]
            const fromIdx = fromLen - 1 - i;
            const toIdx = toLen - 1 - i;
            const interval = Math.abs(toMidi[toIdx] - fromMidi[fromIdx]);

            motions.push({
                fromVoice: fromIdx,
                toVoice: toIdx,
                fromMidi: fromMidi[fromIdx],
                toMidi: toMidi[toIdx],
                interval: interval,
                type: this.getMotionType(interval),
            });
        }

        // Mark dropped voices (from chord has more notes)
        for (let i = minLen; i < fromLen; i++) {
            const fromIdx = fromLen - 1 - i;
            motions.push({
                fromVoice: fromIdx,
                toVoice: -1,
                fromMidi: fromMidi[fromIdx],
                toMidi: null,
                interval: null,
                type: 'dropped',
            });
        }

        // Mark new voices (to chord has more notes)
        for (let i = minLen; i < toLen; i++) {
            const toIdx = toLen - 1 - i;
            motions.push({
                fromVoice: -1,
                toVoice: toIdx,
                fromMidi: null,
                toMidi: toMidi[toIdx],
                interval: null,
                type: 'new',
            });
        }

        // Sort by fromVoice for display
        motions.sort((a, b) => {
            if (a.fromVoice === -1) return 1;
            if (b.fromVoice === -1) return -1;
            return a.fromVoice - b.fromVoice;
        });

        return motions;
    }

    /**
     * Hungarian algorithm for optimal bipartite matching
     */
    hungarianMatch(costs, fromLen, toLen) {
        const n = Math.max(fromLen, toLen);
        const INF = 10000;
        const matrix = [];

        for (let i = 0; i < n; i++) {
            matrix[i] = [];
            for (let j = 0; j < n; j++) {
                if (i < fromLen && j < toLen) {
                    matrix[i][j] = costs[i][j];
                } else {
                    matrix[i][j] = INF;
                }
            }
        }

        const u = new Array(n + 1).fill(0);
        const v = new Array(n + 1).fill(0);
        const p = new Array(n + 1).fill(0);
        const way = new Array(n + 1).fill(0);

        for (let i = 1; i <= n; i++) {
            p[0] = i;
            let j0 = 0;
            const minv = new Array(n + 1).fill(INF);
            const used = new Array(n + 1).fill(false);

            do {
                used[j0] = true;
                const i0 = p[j0];
                let delta = INF;
                let j1 = 0;

                for (let j = 1; j <= n; j++) {
                    if (!used[j]) {
                        const cur = matrix[i0 - 1][j - 1] - u[i0] - v[j];
                        if (cur < minv[j]) {
                            minv[j] = cur;
                            way[j] = j0;
                        }
                        if (minv[j] < delta) {
                            delta = minv[j];
                            j1 = j;
                        }
                    }
                }

                for (let j = 0; j <= n; j++) {
                    if (used[j]) {
                        u[p[j]] += delta;
                        v[j] -= delta;
                    } else {
                        minv[j] -= delta;
                    }
                }

                j0 = j1;
            } while (p[j0] !== 0);

            do {
                const j1 = way[j0];
                p[j0] = p[j1];
                j0 = j1;
            } while (j0 !== 0);
        }

        const matches = [];
        for (let j = 1; j <= n; j++) {
            if (p[j] !== 0 && p[j] - 1 < fromLen && j - 1 < toLen) {
                matches.push({ f: p[j] - 1, t: j - 1 });
            }
        }

        return matches;
    }

    /**
     * Get motion type from interval
     */
    getMotionType(interval) {
        if (interval === 0) return 'commonTone';
        if (interval <= MOTION_THRESHOLDS.stepwise) return 'stepwise';
        if (interval <= MOTION_THRESHOLDS.skip) return 'skip';
        return 'leap';
    }

    /**
     * Render the diagram
     */
    render() {
        if (!this.container) return;

        const diagramArea = document.getElementById('voice-leading-diagram-area');
        if (!diagramArea) return;

        // If no analysis data (empty progression), show empty state
        if (!this.analysisData) {
            diagramArea.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <p class="text-sm">Add chords to your progression to see voice leading analysis</p>
                </div>
            `;
            // Clear the badge
            const badge = document.getElementById('voice-leading-quality-badge');
            if (badge) {
                badge.textContent = '--';
                badge.style.background = '';
            }
            // Clear warning summary
            const warningSummary = document.getElementById('vl-warning-summary');
            if (warningSummary) {
                warningSummary.innerHTML = '';
            }
            return;
        }

        const { chords, transitions, warnings, quality } = this.analysisData;

        // Update quality badge
        const badge = document.getElementById('voice-leading-quality-badge');
        if (badge) {
            badge.textContent = quality.label;
            badge.style.background = quality.color;
        }

        // Update warning summary - count individual arcs with warnings
        const warningSummary = document.getElementById('vl-warning-summary');
        if (warningSummary) {
            // Count warnings from actual arc motions, not just transitions
            const arcWarningCounts = { P5: 0, P8: 0, crossing: 0, leap: 0 };
            transitions.forEach(t => {
                t.motions.forEach(m => {
                    if (m.warnings) {
                        m.warnings.forEach(w => {
                            if (arcWarningCounts.hasOwnProperty(w)) {
                                arcWarningCounts[w]++;
                            }
                        });
                    }
                });
            });

            const totalWarnings = Object.values(arcWarningCounts).reduce((a, b) => a + b, 0);
            if (totalWarnings === 0) {
                warningSummary.innerHTML = '<span class="text-green-600">No issues detected</span>';
            } else {
                const parts = [];
                if (arcWarningCounts.P5 > 0) parts.push(`<span class="text-red-600">${arcWarningCounts.P5} Parallel 5ths</span>`);
                if (arcWarningCounts.P8 > 0) parts.push(`<span class="text-red-600">${arcWarningCounts.P8} Parallel 8ves</span>`);
                if (arcWarningCounts.leap > 0) parts.push(`<span class="text-red-600">${arcWarningCounts.leap} Large leaps</span>`);
                if (arcWarningCounts.crossing > 0) parts.push(`<span class="text-red-600">${arcWarningCounts.crossing} Voice crossings</span>`);
                warningSummary.innerHTML = parts.join(' · ');
            }
        }

        // Filter transitions if warnings-only mode
        let displayTransitions = transitions;
        if (this.showWarningsOnly) {
            displayTransitions = transitions.filter(t => t.hasWarnings);
        }

        // Calculate diagram dimensions
        const numChords = chords.length;
        const maxNotes = Math.max(...chords.map(c => c.midi.length), 3);
        const width = Math.max(400, numChords * DIAGRAM.chordSpacing + 40);

        // Find global MIDI range for pitch-based Y positioning
        const allMidi = chords.flatMap(c => c.midi);
        const midiMin = Math.min(...allMidi);
        const midiMax = Math.max(...allMidi);
        const midiRange = Math.max(12, midiMax - midiMin); // At least one octave range

        // Store for use in getNoteYByPitch
        this._midiMin = midiMin;
        this._midiMax = midiMax;
        this._midiRange = midiRange;

        const height = Math.max(DIAGRAM.minHeight, DIAGRAM.topPadding + 150 + DIAGRAM.bottomPadding);

        // Create SVG
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.style.display = 'block';
        svg.style.margin = '0 auto';

        // Draw voice leading lines first (behind notes)
        displayTransitions.forEach(transition => {
            const fromChord = chords[transition.fromIndex];
            const toChord = chords[transition.toIndex];
            const fromX = this.getChordX(transition.fromIndex, numChords, width);
            const toX = this.getChordX(transition.toIndex, numChords, width);

            transition.motions.forEach((motion, voiceIdx) => {
                // Skip new/dropped if filter is off
                if (!this.showNewDropped && (motion.type === 'new' || motion.type === 'dropped')) {
                    return;
                }

                // Skip non-warning arcs in warnings-only mode
                if (this.showWarningsOnly && (!motion.warnings || motion.warnings.length === 0)) {
                    return;
                }

                // Use pitch-based Y positioning for accurate visual representation
                const fromY = motion.fromMidi !== null
                    ? this.getNoteYByPitch(motion.fromMidi, height)
                    : this.getNoteYByPitch(motion.toMidi, height);
                const toY = motion.toMidi !== null
                    ? this.getNoteYByPitch(motion.toMidi, height)
                    : this.getNoteYByPitch(motion.fromMidi, height);

                const path = this.createVoiceLine(
                    fromX + DIAGRAM.noteRadius,
                    fromY,
                    toX - DIAGRAM.noteRadius,
                    toY,
                    motion,
                    voiceIdx
                );
                svg.appendChild(path);
            });
        });

        // Draw warning badges at transition points
        transitions.forEach(transition => {
            if (transition.warnings.length > 0) {
                const fromX = this.getChordX(transition.fromIndex, numChords, width);
                const toX = this.getChordX(transition.toIndex, numChords, width);
                const midX = (fromX + toX) / 2;

                transition.warnings.forEach((warning, idx) => {
                    const badge = this.createWarningBadge(midX, 20 + idx * 20, warning.type);
                    svg.appendChild(badge);
                });
            }
        });

        // Draw chords
        chords.forEach((chord, i) => {
            const x = this.getChordX(i, numChords, width);
            const chordGroup = this.createChordVisual(chord, x, height);
            svg.appendChild(chordGroup);
        });

        // Clear and append
        diagramArea.innerHTML = '';
        diagramArea.appendChild(svg);

        // Render fix suggestions if there are warnings
        this.renderFixSuggestions();
    }

    /**
     * Get X position for a chord
     */
    getChordX(index, totalChords, width) {
        const usableWidth = width - 60;
        const spacing = usableWidth / Math.max(1, totalChords - 1);
        return 30 + index * spacing;
    }

    /**
     * Get Y position for a note based on its actual MIDI pitch
     * Higher pitches = lower Y (higher on screen)
     */
    getNoteYByPitch(midiValue, height) {
        const startY = DIAGRAM.topPadding + 30;
        const availableHeight = height - startY - DIAGRAM.bottomPadding - 20;

        // Map MIDI value to Y position (inverted: higher pitch = lower Y)
        const normalized = (midiValue - this._midiMin) / this._midiRange;
        const y = startY + availableHeight * (1 - normalized);

        return y;
    }

    /**
     * Get Y position for a note in a chord (legacy - by voice index)
     */
    getNoteY(voiceIndex, totalNotes, height) {
        const startY = DIAGRAM.topPadding + 20;
        const availableHeight = height - startY - DIAGRAM.bottomPadding;
        const spacing = Math.min(DIAGRAM.noteSpacing, availableHeight / Math.max(1, totalNotes));
        const reversedIndex = totalNotes - 1 - voiceIndex;
        return startY + reversedIndex * spacing + spacing / 2;
    }

    /**
     * Create visual representation of a chord
     */
    createChordVisual(chord, x, height) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        // Chord label background
        const labelText = chord.name;
        const labelWidth = Math.max(30, labelText.length * 7 + 8);

        const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        labelBg.setAttribute('x', x - labelWidth / 2);
        labelBg.setAttribute('y', 4);
        labelBg.setAttribute('width', labelWidth);
        labelBg.setAttribute('height', 18);
        labelBg.setAttribute('rx', '4');
        labelBg.setAttribute('fill', '#4F46E5');
        group.appendChild(labelBg);

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', x);
        label.setAttribute('y', 17);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '11');
        label.setAttribute('font-weight', '600');
        label.setAttribute('fill', 'white');
        label.textContent = labelText;
        group.appendChild(label);

        // Note circles - positioned by actual pitch
        chord.midi.forEach((midi, i) => {
            const y = this.getNoteYByPitch(midi, height);

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', DIAGRAM.noteRadius);
            circle.setAttribute('fill', '#6366f1');
            circle.setAttribute('stroke', 'white');
            circle.setAttribute('stroke-width', '2');
            group.appendChild(circle);

            // Note name
            const noteText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            noteText.setAttribute('x', x);
            noteText.setAttribute('y', y + 4);
            noteText.setAttribute('text-anchor', 'middle');
            noteText.setAttribute('font-size', '9');
            noteText.setAttribute('font-weight', '600');
            noteText.setAttribute('fill', 'white');
            noteText.textContent = this.midiToNoteName(midi);
            group.appendChild(noteText);

            // Octave subscript
            const octave = Math.floor(midi / 12) - 1;
            const octaveText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            octaveText.setAttribute('x', x + DIAGRAM.noteRadius + 3);
            octaveText.setAttribute('y', y + 6);
            octaveText.setAttribute('text-anchor', 'start');
            octaveText.setAttribute('font-size', '8');
            octaveText.setAttribute('fill', '#6b7280');
            octaveText.textContent = octave;
            group.appendChild(octaveText);
        });

        return group;
    }

    /**
     * Create a voice leading line
     */
    createVoiceLine(x1, y1, x2, y2, motion, voiceIndex) {
        const hasWarnings = motion.warnings && motion.warnings.length > 0;
        const hasMultipleWarnings = motion.warnings && motion.warnings.length > 1;
        const isNewOrDropped = motion.type === 'new' || motion.type === 'dropped';

        // Determine color - prioritize by severity: P5/P8 > crossing > leap
        let color;
        let secondaryColor = null;
        if (hasWarnings) {
            if (motion.warnings.includes('P5')) {
                color = WARNING_COLORS.parallelFifth;
            } else if (motion.warnings.includes('P8')) {
                color = WARNING_COLORS.parallelOctave;
            } else if (motion.warnings.includes('crossing')) {
                color = WARNING_COLORS.voiceCrossing;
            } else {
                color = WARNING_COLORS.largeleap;
            }
            // Get secondary color for multi-warning arcs
            if (hasMultipleWarnings) {
                const otherWarnings = motion.warnings.filter(w => {
                    if (color === WARNING_COLORS.parallelFifth) return w !== 'P5';
                    if (color === WARNING_COLORS.parallelOctave) return w !== 'P8';
                    if (color === WARNING_COLORS.voiceCrossing) return w !== 'crossing';
                    return w !== 'leap';
                });
                if (otherWarnings.length > 0) {
                    const other = otherWarnings[0];
                    secondaryColor = other === 'P5' ? WARNING_COLORS.parallelFifth :
                                     other === 'P8' ? WARNING_COLORS.parallelOctave :
                                     other === 'crossing' ? WARNING_COLORS.voiceCrossing :
                                     WARNING_COLORS.largeleap;
                }
            }
        } else {
            color = MOTION_COLORS[motion.type] || MOTION_COLORS.stepwise;
        }

        // Calculate bezier curve
        const midX = (x1 + x2) / 2;
        const curveDir = voiceIndex % 2 === 0 ? -1 : 1;
        const curveAmount = DIAGRAM.curveOffset + (voiceIndex * 5);
        const midY = (y1 + y2) / 2;
        const ctrlY = midY + curveDir * curveAmount;

        // For new/dropped voices, draw partial arcs
        let d;
        if (motion.type === 'dropped') {
            // Arc fades out to the right
            const fadeX = x1 + (x2 - x1) * 0.4;
            d = `M ${x1} ${y1} Q ${(x1 + fadeX) / 2} ${y1 + curveDir * 15} ${fadeX} ${y1 + curveDir * 25}`;
        } else if (motion.type === 'new') {
            // Arc fades in from the left
            const fadeX = x2 - (x2 - x1) * 0.4;
            d = `M ${fadeX} ${y2 + curveDir * 25} Q ${(fadeX + x2) / 2} ${y2 + curveDir * 15} ${x2} ${y2}`;
        } else {
            d = `M ${x1} ${y1} Q ${midX} ${ctrlY} ${x2} ${y2}`;
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', hasWarnings ? DIAGRAM.lineWidth + 1.5 : (isNewOrDropped ? 1.5 : DIAGRAM.lineWidth));
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('opacity', isNewOrDropped ? '0.4' : (hasWarnings ? '1' : '0.8'));

        // Build tooltip text
        let tooltipText = '';
        if (motion.fromMidi !== null && motion.toMidi !== null) {
            const fromNote = this.midiToNoteNameWithOctave(motion.fromMidi);
            const toNote = this.midiToNoteNameWithOctave(motion.toMidi);
            const interval = motion.interval || 0;
            tooltipText = `${fromNote} → ${toNote} (${interval} semitones)`;
        }
        if (hasWarnings) {
            const warningLabels = motion.warnings.map(w => {
                if (w === 'P5') return 'Parallel 5th';
                if (w === 'P8') return 'Parallel 8ve';
                if (w === 'crossing') return 'Voice crossing';
                if (w === 'leap') return 'Large leap';
                return w;
            });
            tooltipText += tooltipText ? '\n' : '';
            tooltipText += '⚠ ' + warningLabels.join(', ');
        }

        // Dashed style for skips, leaps, and new/dropped
        // Use larger gaps for warnings so the dash pattern is clearly visible
        if (motion.type === 'skip') {
            path.setAttribute('stroke-dasharray', hasWarnings ? '8,5' : '6,3');
        } else if (motion.type === 'leap') {
            path.setAttribute('stroke-dasharray', hasWarnings ? '6,6' : '4,4');
        } else if (isNewOrDropped) {
            path.setAttribute('stroke-dasharray', '3,3');
        }

        // Helper to add tooltip and click-to-play event listeners
        const addInteractiveEvents = (element, text, fromMidi, toMidi) => {
            // Make clickable if we have both notes
            const isClickable = fromMidi !== null && toMidi !== null;
            element.style.cursor = isClickable ? 'pointer' : 'help';

            // Click to play voice motion
            if (isClickable) {
                element.addEventListener('click', (e) => {
                    e.stopPropagation();

                    // Visual feedback - brief flash
                    const originalOpacity = path.getAttribute('opacity') || '0.8';
                    path.setAttribute('opacity', '1');
                    path.setAttribute('stroke-width', String(parseFloat(path.getAttribute('stroke-width')) + 2));

                    setTimeout(() => {
                        path.setAttribute('opacity', originalOpacity);
                        path.setAttribute('stroke-width', String(parseFloat(path.getAttribute('stroke-width')) - 2));
                    }, 300);

                    // Play the voice motion
                    this.playVoiceMotion(fromMidi, toMidi);

                    // Update tooltip to show "Playing..."
                    const tooltip = document.getElementById('vl-arc-tooltip');
                    if (tooltip) {
                        const originalText = tooltip.textContent;
                        tooltip.innerHTML = '🔊 Playing...';
                        setTimeout(() => {
                            tooltip.textContent = originalText;
                        }, 1400);
                    }
                });
            }

            // Tooltip on hover
            if (text) {
                const hoverText = isClickable ? text + '\n🔊 Click to hear' : text;

                element.addEventListener('mouseenter', (e) => {
                    const tooltip = document.getElementById('vl-arc-tooltip');
                    if (tooltip) {
                        tooltip.textContent = hoverText;
                        tooltip.classList.add('visible');
                        // Position above the cursor
                        const tooltipRect = tooltip.getBoundingClientRect();
                        tooltip.style.left = `${e.clientX - tooltipRect.width / 2}px`;
                        tooltip.style.top = `${e.clientY - tooltipRect.height - 15}px`;
                    }
                });

                element.addEventListener('mousemove', (e) => {
                    const tooltip = document.getElementById('vl-arc-tooltip');
                    if (tooltip && tooltip.classList.contains('visible')) {
                        const tooltipRect = tooltip.getBoundingClientRect();
                        tooltip.style.left = `${e.clientX - tooltipRect.width / 2}px`;
                        tooltip.style.top = `${e.clientY - tooltipRect.height - 15}px`;
                    }
                });

                element.addEventListener('mouseleave', () => {
                    const tooltip = document.getElementById('vl-arc-tooltip');
                    if (tooltip) {
                        tooltip.classList.remove('visible');
                    }
                });
            }
        };

        // Add glow effect for warnings
        if (hasWarnings) {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

            const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            glow.setAttribute('d', d);
            glow.setAttribute('fill', 'none');
            glow.setAttribute('stroke', color);
            glow.setAttribute('stroke-width', DIAGRAM.lineWidth + 6);
            glow.setAttribute('stroke-linecap', 'round');
            glow.setAttribute('opacity', '0.2');
            group.appendChild(glow);

            // For multi-warning arcs, add a secondary colored stroke
            if (hasMultipleWarnings && secondaryColor) {
                const secondaryPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                secondaryPath.setAttribute('d', d);
                secondaryPath.setAttribute('fill', 'none');
                secondaryPath.setAttribute('stroke', secondaryColor);
                secondaryPath.setAttribute('stroke-width', DIAGRAM.lineWidth + 0.5);
                secondaryPath.setAttribute('stroke-linecap', 'round');
                secondaryPath.setAttribute('stroke-dasharray', '2,6'); // Dots along the line
                secondaryPath.setAttribute('opacity', '0.9');
                group.appendChild(secondaryPath);
            }

            group.appendChild(path);

            // Add interactive events (tooltip + click-to-play)
            addInteractiveEvents(group, tooltipText, motion.fromMidi, motion.toMidi);

            return group;
        }

        // Non-warning arcs: add interactive events
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.appendChild(path);
        addInteractiveEvents(group, tooltipText, motion.fromMidi, motion.toMidi);
        return group;
    }

    /**
     * Create a warning badge
     */
    createWarningBadge(x, y, type) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        const color = type === 'P5' ? WARNING_COLORS.parallelFifth :
                      type === 'P8' ? WARNING_COLORS.parallelOctave :
                      type === 'crossing' ? WARNING_COLORS.voiceCrossing :
                      WARNING_COLORS.largeleap;

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', '10');
        circle.setAttribute('fill', color);
        circle.setAttribute('stroke', 'white');
        circle.setAttribute('stroke-width', '2');
        group.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y + 3);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '8');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', 'white');
        text.textContent = type === 'crossing' ? 'X' : type;
        group.appendChild(text);

        // JavaScript-based tooltip
        const tooltipText = type === 'P5' ? 'Parallel Fifths - Two voices moving in parallel perfect 5ths' :
                           type === 'P8' ? 'Parallel Octaves - Two voices moving in parallel octaves' :
                           type === 'crossing' ? 'Voice Crossing - Lower voice moves above higher voice' :
                           'Large Leap - Movement of 8+ semitones';

        group.style.cursor = 'help';
        group.addEventListener('mouseenter', (e) => {
            const tooltip = document.getElementById('vl-arc-tooltip');
            if (tooltip) {
                tooltip.textContent = tooltipText;
                tooltip.classList.add('visible');
                tooltip.style.left = `${e.clientX - 100}px`;
                tooltip.style.top = `${e.clientY - 50}px`;
            }
        });
        group.addEventListener('mouseleave', () => {
            const tooltip = document.getElementById('vl-arc-tooltip');
            if (tooltip) {
                tooltip.classList.remove('visible');
            }
        });

        return group;
    }

    /**
     * Show the panel
     */
    show() {
        if (this.container) {
            this.container.style.display = 'block';
        }
    }

    /**
     * Hide the panel
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    /**
     * Update (re-analyze and re-render)
     */
    update() {
        // Always update - panel is always visible now
        this.analyze();
        this.render();
    }

    /**
     * Destroy
     */
    destroy() {
        this.hide();
        if (this.container && this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        this.container = null;
        this.analysisData = null;
    }

    // ========================================================================
    // FIX SUGGESTIONS
    // ========================================================================

    /**
     * Generate fix suggestions for voice leading issues
     * @param {Array} warnings - Array of warning objects from analysis
     * @param {Array} transitions - Array of transition objects
     * @returns {Array} Array of suggestion objects
     */
    generateFixSuggestions(warnings, transitions) {
        const suggestions = [];

        // Collect detailed warnings from transitions
        const warningDetails = [];
        transitions.forEach((t, idx) => {
            t.motions.forEach(m => {
                if (m.warnings && m.warnings.length > 0) {
                    m.warnings.forEach(w => {
                        warningDetails.push({
                            type: w,
                            transition: idx,
                            fromChord: idx,
                            toChord: idx + 1,
                            motion: m
                        });
                    });
                }
            });
        });

        // Group by warning type and generate suggestions
        const parallelFifths = warningDetails.filter(w => w.type === 'P5');
        const parallelOctaves = warningDetails.filter(w => w.type === 'P8');
        const voiceCrossings = warningDetails.filter(w => w.type === 'crossing');
        const largeLeaps = warningDetails.filter(w => w.type === 'leap');

        // Parallel Fifths suggestions
        if (parallelFifths.length > 0) {
            suggestions.push({
                type: 'P5',
                icon: '🔵',
                title: 'Parallel 5ths Detected',
                issue: `Found ${parallelFifths.length} parallel fifth${parallelFifths.length > 1 ? 's' : ''} between chords.`,
                fixes: [
                    'Move one voice by step while the other stays (common tone)',
                    'Use contrary motion - one voice up, one voice down',
                    'Try a different chord inversion to break the parallel movement',
                    'Add a passing tone or suspension to one of the voices'
                ]
            });
        }

        // Parallel Octaves suggestions
        if (parallelOctaves.length > 0) {
            suggestions.push({
                type: 'P8',
                icon: '🟣',
                title: 'Parallel Octaves Detected',
                issue: `Found ${parallelOctaves.length} parallel octave${parallelOctaves.length > 1 ? 's' : ''} between chords.`,
                fixes: [
                    'Have one voice hold a common tone while the other moves',
                    'Move voices in contrary or oblique motion',
                    'Change the voicing of one chord to break the doubling',
                    'Consider using a 10th (compound 3rd) instead of an octave'
                ]
            });
        }

        // Voice Crossing suggestions
        if (voiceCrossings.length > 0) {
            suggestions.push({
                type: 'crossing',
                icon: '🟡',
                title: 'Voice Crossing Detected',
                issue: `Found ${voiceCrossings.length} voice crossing${voiceCrossings.length > 1 ? 's' : ''}.`,
                fixes: [
                    'Rearrange chord voicings to keep voices in their registers',
                    'Use a different inversion that maintains voice order',
                    'Expand or contract the chord spacing to avoid overlap',
                    'Consider if the melody line can take a different path'
                ]
            });
        }

        // Large Leap suggestions
        if (largeLeaps.length > 0) {
            const avgLeap = largeLeaps.reduce((sum, w) => sum + (w.motion.interval || 0), 0) / largeLeaps.length;
            suggestions.push({
                type: 'leap',
                icon: '🩷',
                title: 'Large Leaps Detected',
                issue: `Found ${largeLeaps.length} leap${largeLeaps.length > 1 ? 's' : ''} of 8+ semitones (avg: ${Math.round(avgLeap)} semitones).`,
                fixes: [
                    'Follow the leap with stepwise motion in the opposite direction',
                    'Insert a passing chord to break the large interval',
                    'Use a different chord inversion closer to the previous voicing',
                    'Consider if the leap serves a melodic purpose (if so, it may be intentional)'
                ]
            });
        }

        return suggestions;
    }

    /**
     * Render fix suggestions UI
     */
    renderFixSuggestions() {
        if (!this.analysisData) return;

        const { transitions, warnings } = this.analysisData;
        const suggestions = this.generateFixSuggestions(warnings, transitions);

        // Find or create suggestions container
        let suggestionsContainer = document.getElementById('vl-fix-suggestions');
        if (!suggestionsContainer) {
            const panel = document.getElementById('voice-leading-panel');
            if (!panel) return;

            suggestionsContainer = document.createElement('div');
            suggestionsContainer.id = 'vl-fix-suggestions';
            suggestionsContainer.className = 'border-t border-indigo-200';

            // Insert before the legend
            const legend = panel.querySelector('.px-3.py-2.bg-white\\/50.border-t');
            if (legend) {
                panel.insertBefore(suggestionsContainer, legend);
            } else {
                panel.appendChild(suggestionsContainer);
            }
        }

        if (suggestions.length === 0) {
            suggestionsContainer.innerHTML = '';
            suggestionsContainer.style.display = 'none';
            return;
        }

        suggestionsContainer.style.display = 'block';
        suggestionsContainer.innerHTML = `
            <div class="px-3 py-2 bg-amber-50">
                <button id="vl-suggestions-toggle" class="w-full flex items-center justify-between text-left">
                    <span class="flex items-center gap-2 text-sm font-medium text-amber-800">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                        </svg>
                        Fix Suggestions (${suggestions.length})
                    </span>
                    <svg id="vl-suggestions-chevron" class="w-4 h-4 text-amber-600 transform transition-transform" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                </button>
                <div id="vl-suggestions-content" class="hidden mt-2 space-y-3">
                    ${suggestions.map(s => `
                        <div class="bg-white rounded-lg p-3 shadow-sm border border-amber-200">
                            <div class="flex items-start gap-2">
                                <span class="text-lg">${s.icon}</span>
                                <div class="flex-1">
                                    <div class="font-medium text-gray-900 text-sm">${s.title}</div>
                                    <div class="text-xs text-gray-600 mt-0.5">${s.issue}</div>
                                    <div class="mt-2">
                                        <div class="text-xs font-medium text-green-700 mb-1">How to fix:</div>
                                        <ul class="text-xs text-gray-700 space-y-1">
                                            ${s.fixes.map(fix => `
                                                <li class="flex items-start gap-1.5">
                                                    <span class="text-green-500 mt-0.5">•</span>
                                                    <span>${fix}</span>
                                                </li>
                                            `).join('')}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Add toggle behavior
        const toggleBtn = document.getElementById('vl-suggestions-toggle');
        const content = document.getElementById('vl-suggestions-content');
        const chevron = document.getElementById('vl-suggestions-chevron');

        if (toggleBtn && content && chevron) {
            toggleBtn.addEventListener('click', () => {
                content.classList.toggle('hidden');
                chevron.classList.toggle('rotate-180');
            });
        }
    }

    // ========================================================================
    // AUDIO PLAYBACK
    // ========================================================================

    /**
     * Play a voice motion (two notes in sequence)
     * @param {number} fromMidi - Starting MIDI note
     * @param {number} toMidi - Ending MIDI note
     */
    async playVoiceMotion(fromMidi, toMidi) {
        preWarmAudioContext();
        const piano = getPiano();
        if (!piano) {
            console.warn('[VoiceLeading] Piano not initialized');
            return;
        }

        try {
            const fromNote = this.midiToNoteNameWithOctave(fromMidi);
            const toNote = this.midiToNoteNameWithOctave(toMidi);

            const now = Tone.now();

            // Play first note
            piano.triggerAttackRelease(fromNote, 0.6, now);

            // Play second note after a short gap
            piano.triggerAttackRelease(toNote, 0.6, now + 0.7);

        } catch (err) {
            console.error('[VoiceLeading] Error playing voice motion:', err);
        }
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    getMeasureNotes(measure, staff) {
        if (!measure?.notation?.[staff]?.voices) return [];
        const notes = [];
        for (const voice of measure.notation[staff].voices) {
            if (voice.notes) {
                notes.push(...voice.notes.filter(n => !n.isRest));
            }
        }
        return notes;
    }

    extractAllMidiValues(notes) {
        const midiValues = [];
        for (const note of notes) {
            if (note.pitches && Array.isArray(note.pitches)) {
                for (const pitch of note.pitches) {
                    const midi = this.pitchToMidi(pitch);
                    if (midi !== null) midiValues.push(midi);
                }
            } else if (note.pitch) {
                const midi = this.pitchToMidi(note.pitch);
                if (midi !== null) midiValues.push(midi);
            }
        }
        return midiValues.sort((a, b) => a - b);
    }

    pitchToMidi(pitch) {
        if (!pitch) return null;
        const noteMap = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
        const match = pitch.match(/^([A-G])([#b]?)(\d+)$/);
        if (!match) return null;
        const [, note, accidental, octave] = match;
        let midi = noteMap[note] + (parseInt(octave) + 1) * 12;
        if (accidental === '#') midi += 1;
        if (accidental === 'b') midi -= 1;
        return midi;
    }

    midiToNoteName(midi) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return noteNames[midi % 12];
    }

    midiToNoteNameWithOctave(midi) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        return noteNames[midi % 12] + octave;
    }

    getChordName(measure) {
        if (measure?.chordSymbol && typeof measure.chordSymbol === 'string') {
            return measure.chordSymbol;
        }
        if (measure?.chord?.symbol) {
            return measure.chord.symbol;
        }
        if (measure?.chord && typeof measure.chord === 'string') {
            return measure.chord;
        }
        if (measure?.progressionChord?.symbol) {
            return measure.progressionChord.symbol;
        }
        const bassNotes = this.getMeasureNotes(measure, 'bass');
        if (bassNotes.length > 0) {
            const pitches = bassNotes[0].pitches || [bassNotes[0].pitch];
            if (pitches && pitches.length > 0 && pitches[0]) {
                const root = pitches[0].replace(/\d+$/, '');
                return root || '?';
            }
        }
        return `M${measure?.index + 1 || '?'}`;
    }
}

// ============================================================================
// BACKWARD COMPATIBILITY ALIASES
// ============================================================================

export const VoiceLeadingOverlay = VoiceLeadingDiagram;
export const VoiceLeadingAnalyzer = VoiceLeadingDiagram;

// ============================================================================
// SINGLETON & EXPORTS
// ============================================================================

let diagramInstance = null;

export function getVoiceLeadingOverlay() {
    return diagramInstance;
}

export function initVoiceLeadingOverlay(options = {}) {
    if (diagramInstance) {
        diagramInstance.destroy();
    }

    diagramInstance = new VoiceLeadingDiagram(options);
    diagramInstance.init();

    window.voiceLeadingDiagram = diagramInstance;
    window.voiceLeadingOverlay = diagramInstance;
    window.voiceLeadingAnalyzer = diagramInstance;
    window.toggleVoiceLeading = () => diagramInstance.toggle();

    return diagramInstance;
}

/**
 * Toggle voice leading panel expansion (panel is always visible)
 * For backward compatibility with code that called toggleVoiceLeadingOverlay
 */
export function toggleVoiceLeadingOverlay() {
    // If no instance exists, create and initialize one
    if (!diagramInstance) {
        initVoiceLeadingIfReady();
    }

    if (diagramInstance) {
        // Toggle panel expansion, not visibility
        diagramInstance.togglePanel();
        return diagramInstance.isPanelExpanded;
    }

    return false;
}

/**
 * Initialize voice leading if composition data is available
 * Called automatically when page loads with composition studio
 */
export function initVoiceLeadingIfReady() {
    if (diagramInstance) {
        // Already initialized, just update
        diagramInstance.update();
        return diagramInstance;
    }

    // Try to get compositionState from various sources
    const compositionState = window.getCompositionState?.() ||
                             window.getNotationComposer?.()?.compositionState ||
                             null;

    // Only create if we have composition state or if we're on the composition studio page
    const isCompositionStudio = document.getElementById('staff-notation-card-panel') ||
                                document.getElementById('composition-notation-panel') ||
                                document.querySelector('.composition-studio-content');

    if (!compositionState && !isCompositionStudio) {
        return null;
    }

    diagramInstance = new VoiceLeadingDiagram({
        compositionState,
        onToggle: () => {}, // No external toggle sync needed anymore
    });
    diagramInstance.init();

    // Expose globally
    window.voiceLeadingDiagram = diagramInstance;
    window.voiceLeadingOverlay = diagramInstance;
    window.voiceLeadingAnalyzer = diagramInstance;

    return diagramInstance;
}

/**
 * Update voice leading analysis (call when progression changes)
 */
export function updateVoiceLeading() {
    if (diagramInstance) {
        diagramInstance.update();
    } else {
        // Try to initialize if not yet created
        initVoiceLeadingIfReady();
    }
}

/**
 * Set visibility explicitly - for backward compatibility
 * Now just ensures the panel is initialized and updated
 */
export function setVoiceLeadingVisible(visible) {
    if (visible) {
        if (!diagramInstance) {
            initVoiceLeadingIfReady();
        } else {
            diagramInstance.update();
        }
    }
    return true;
}

// Expose global functions
window.toggleVoiceLeading = toggleVoiceLeadingOverlay;
window.setVoiceLeadingVisible = setVoiceLeadingVisible;
window.updateVoiceLeading = updateVoiceLeading;
window.initVoiceLeadingIfReady = initVoiceLeadingIfReady;

// Auto-initialize on page load for composition studio
if (typeof document !== 'undefined') {
    const autoInit = () => {
        // Delay to allow page to fully initialize
        setTimeout(() => {
            initVoiceLeadingIfReady();
        }, 800);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }
}

export default VoiceLeadingDiagram;
