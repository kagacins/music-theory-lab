/**
 * Theory Insights Panel Module
 *
 * A collapsible panel showing real-time harmonic analysis:
 * - Detected patterns (cadences, sequences, modal patterns)
 * - Borrowed chord opportunities
 * - Learning prompts with links to relevant lessons
 */

import {
    detectAllPatterns,
    getTopPatterns,
    PATTERN_CATEGORIES,
    CADENCE_PATTERNS,
    MODAL_PATTERNS,
    BORROWED_CHORDS
} from '../analysis/patternDetection.js';

// Note: getAllBorrowedChords and MODAL_INTERCHANGE_CHORDS exist in comprehensiveChordRecommendations.js
// but are not exported. We use local implementations for borrowed chord suggestions.

// ============================================================================
// CONSTANTS
// ============================================================================

const PATTERN_TO_LESSON = {
    'DORIAN': 'lesson-modes-intro',
    'MIXOLYDIAN': 'lesson-modes-intro',
    'PHRYGIAN': 'lesson-modes-intro',
    'LYDIAN': 'lesson-modes-intro',
    'AEOLIAN': 'lesson-modes-intro',
    'PAC': 'lesson-advanced-voice-leading',
    'HC': 'lesson-advanced-voice-leading',
    'DC': 'lesson-advanced-voice-leading',
    'PC': 'lesson-advanced-voice-leading',
    'borrowed': 'lesson-modal-harmony',
    'extended': 'lesson-extended-chords'
};

const MODE_DESCRIPTIONS = {
    'DORIAN': { name: 'Dorian', characteristic: 'minor with raised 6th', examples: 'Jazz, funk, Santana' },
    'MIXOLYDIAN': { name: 'Mixolydian', characteristic: 'major with flat 7th', examples: 'Rock, blues, folk' },
    'PHRYGIAN': { name: 'Phrygian', characteristic: 'minor with flat 2nd', examples: 'Flamenco, metal' },
    'LYDIAN': { name: 'Lydian', characteristic: 'major with raised 4th', examples: 'Film scores, dreamy' },
    'AEOLIAN': { name: 'Aeolian', characteristic: 'natural minor', examples: 'Pop ballads, rock' }
};

// Detailed concept explanations for the Learn More modal
// Uses template placeholders like {{I}}, {{V}}, {{vi}}, {{KEY}} for key-aware transposition
const CONCEPT_EXPLANATIONS = {
    // Modes
    'DORIAN': {
        title: 'Dorian Mode',
        summary: 'A minor mode with a raised 6th scale degree',
        explanation: `The Dorian mode is built on the 2nd degree of the major scale. It has a minor quality but with a brighter sound than natural minor due to the raised 6th.

**Key characteristics:**
• Minor 3rd (gives minor quality)
• Major 6th (the "Dorian flavor")
• i - IV movement is characteristic

**Common uses:** Jazz, funk, blues-rock. Think "So What" by Miles Davis, "Oye Como Va" by Santana.

**In {{KEY}} major:** When you see {{vi}}m followed by {{bVII}} (the IV chord in Dorian), you're hearing that characteristic Dorian i-IV movement.`
    },
    'MIXOLYDIAN': {
        title: 'Mixolydian Mode',
        summary: 'A major mode with a lowered 7th scale degree',
        explanation: `The Mixolydian mode is built on the 5th degree of the major scale. It sounds major but with a bluesy, rock edge from the flat 7th.

**Key characteristics:**
• Major 3rd (gives major quality)
• Minor 7th (the "flat 7")
• I - bVII movement is characteristic

**Common uses:** Rock, blues, folk, country. Think "Sweet Home Alabama," "Norwegian Wood."

**In {{KEY}} major:** The {{bVII}} chord creates that classic rock sound. Try {{I}} → {{bVII}} → {{I}} for that definitive Mixolydian feel.`
    },
    'PHRYGIAN': {
        title: 'Phrygian Mode',
        summary: 'A minor mode with a lowered 2nd scale degree',
        explanation: `The Phrygian mode is built on the 3rd degree of the major scale. It has a dark, Spanish/Middle Eastern flavor from the flat 2nd.

**Key characteristics:**
• Minor 3rd (gives minor quality)
• Minor 2nd (the exotic sound)
• i - bII movement is characteristic

**Common uses:** Flamenco, metal, Middle Eastern music. Think "White Rabbit" intro.

**In {{KEY}} major:** The half-step movement from {{I}} down to {{bII}} creates that exotic Phrygian tension.`
    },
    'LYDIAN': {
        title: 'Lydian Mode',
        summary: 'A major mode with a raised 4th scale degree',
        explanation: `The Lydian mode is built on the 4th degree of the major scale. It has a dreamy, floating quality from the raised 4th.

**Key characteristics:**
• Major 3rd (gives major quality)
• Augmented 4th (#4)
• Avoids the perfect 4th's pull to the 3rd

**Common uses:** Film scores, progressive rock, jazz. Think the "Simpsons" theme, "Flying in a Blue Dream."

**In {{KEY}} major:** The #4 ({{#4_note}}) removes the natural resolution to the 3rd, creating an open, ethereal sound.`
    },
    'AEOLIAN': {
        title: 'Aeolian Mode (Natural Minor)',
        summary: 'The natural minor scale',
        explanation: `The Aeolian mode is the natural minor scale, built on the 6th degree of the major scale.

**Key characteristics:**
• Minor 3rd, 6th, and 7th
• The "default" minor sound
• i - bVII - bVI progressions are common

**Common uses:** Pop ballads, rock, classical. The most common minor mode in Western music.

**In {{KEY}} major:** The relative minor is {{vi}}m. A natural minor progression would be {{vi}}m → {{V}} → {{IV}}.`
    },
    // Cadences
    'PAC': {
        title: 'Perfect Authentic Cadence (V-I)',
        summary: 'The strongest resolution in tonal music',
        explanation: `A Perfect Authentic Cadence is the V chord resolving to I, both in root position, with the melody ending on the tonic note.

**Why it works:**
• The leading tone (7th scale degree) in {{V}} resolves up to {{I}}
• The 4th scale degree resolves down to the 3rd
• Creates maximum sense of arrival and finality

**Common uses:** Endings of phrases, sections, and entire pieces. The definitive "the end" sound.

**In {{KEY}} major:** {{V}} → {{I}} with {{I}} in the melody.`
    },
    'HC': {
        title: 'Half Cadence',
        summary: 'A pause on the dominant chord',
        explanation: `A Half Cadence ends on the V chord, creating a sense of incompleteness—like a musical question mark.

**Why it works:**
• The {{V}} chord has inherent tension wanting to resolve to {{I}}
• Stopping on {{V}} leaves the listener expecting more
• Creates contrast when followed by phrases that resolve

**Common uses:** End of first phrase in antecedent-consequent pairs, mid-section pauses.

**In {{KEY}} major:** Any progression ending on {{V}} (like {{I}} - {{IV}} - {{V}}).`
    },
    'DC': {
        title: 'Deceptive Cadence (V-vi)',
        summary: 'The unexpected resolution to vi',
        explanation: `A Deceptive Cadence is when V resolves to vi instead of the expected I chord.

**Why it works:**
• The {{vi}}m chord shares two notes with {{I}} ({{vi_shared_notes}})
• The leading tone still resolves up
• Creates surprise while maintaining harmonic logic

**Common uses:** Extending phrases, adding emotional depth, avoiding predictability.

**In {{KEY}} major:** {{V}} → {{vi}}m when you expected {{V}} → {{I}}.`
    },
    'PC': {
        title: 'Plagal Cadence (IV-I)',
        summary: 'The "Amen" cadence',
        explanation: `A Plagal Cadence moves from IV to I, often called the "Amen" cadence for its use in hymns.

**Why it works:**
• {{IV}} and {{I}} share a common tone ({{I}})
• Creates a softer, less dramatic resolution than V-I
• The subdominant has a "restful" quality

**Common uses:** Hymn endings, after a perfect cadence for reinforcement, gentle conclusions.

**In {{KEY}} major:** {{IV}} → {{I}}.`
    },
    // Borrowed chords
    'borrowed-bVI': {
        title: 'Flat VI Chord (bVI)',
        summary: 'Borrowed from the parallel minor',
        explanation: `The bVI chord is "borrowed" from the parallel minor key—using {{bVI}} major in {{KEY}} major instead of {{vi}} minor.

**Why it works:**
• Creates chromatic voice leading
• Adds dramatic, epic quality
• Common in the bVI - bVII - I progression

**Common uses:** Rock, pop, film scores. Think "The Final Countdown," countless movie climaxes.

**In {{KEY}} major:** {{bVI}} → {{bVII}} → {{I}} gives that triumphant, larger-than-life sound.`
    },
    'borrowed-bVII': {
        title: 'Flat VII Chord (bVII)',
        summary: 'The Mixolydian borrowed chord',
        explanation: `The bVII chord comes from Mixolydian mode or the parallel minor—using {{bVII}} major in {{KEY}} major.

**Why it works:**
• Creates the classic rock sound
• Provides a major chord a whole step below {{I}}
• Less tension than {{V}}, more color than {{IV}}

**Common uses:** Rock, pop, folk. Essential in classic rock progressions.

**In {{KEY}} major:** {{bVII}} → {{I}} is one of the most common rock cadences.`
    },
    'borrowed-iv': {
        title: 'Minor iv Chord',
        summary: 'The melancholy borrowed chord',
        explanation: `The minor iv chord is borrowed from the parallel minor—using {{iv}}m in {{KEY}} major instead of {{IV}} major.

**Why it works:**
• The minor 3rd adds instant melancholy
• Common in the I - iv - I or I - IV - iv - I patterns
• Creates emotional depth without leaving major

**Common uses:** Ballads, emotional moments. "Creep" by Radiohead uses this effect.

**In {{KEY}} major:** {{IV}} → {{iv}}m → {{I}} gives that bittersweet, tugging-at-heartstrings feeling.`
    },
    'borrowed-bIII': {
        title: 'Flat III Chord (bIII)',
        summary: 'A chromatic mediant from parallel minor',
        explanation: `The bIII chord is borrowed from the parallel minor—using {{bIII}} major in {{KEY}} major.

**Why it works:**
• Shares no common tones with {{I}}—maximum contrast
• Creates an unexpected but smooth voice leading
• Often part of chromatic mediant relationships

**Common uses:** Pop, rock, film scores for unexpected shifts.

**In {{KEY}} major:** {{I}} → {{bIII}} creates a "lifting" sensation through chromatic movement.`
    },
    'borrowed-ii°': {
        title: 'Diminished ii Chord',
        summary: 'Borrowed from the parallel minor',
        explanation: `The diminished ii chord is borrowed from the parallel minor—using {{ii}}dim in {{KEY}} major instead of {{ii}}m.

**Why it works:**
• The diminished quality adds tension
• Contains the leading tone
• Functions as a substitute for V7

**Common uses:** Classical, jazz, adding intensity before a cadence.

**In {{KEY}} major:** {{ii}}dim → {{V}} → {{I}} intensifies the standard ii - V - I progression.`
    }
};

// Create aliases for raw type codes (without 'borrowed-' prefix)
CONCEPT_EXPLANATIONS['bVI'] = CONCEPT_EXPLANATIONS['borrowed-bVI'];
CONCEPT_EXPLANATIONS['bVII'] = CONCEPT_EXPLANATIONS['borrowed-bVII'];
CONCEPT_EXPLANATIONS['iv'] = CONCEPT_EXPLANATIONS['borrowed-iv'];
CONCEPT_EXPLANATIONS['bIII'] = CONCEPT_EXPLANATIONS['borrowed-bIII'];
CONCEPT_EXPLANATIONS['ii°'] = CONCEPT_EXPLANATIONS['borrowed-ii°'];

// ============================================================================
// THEORY INSIGHTS PANEL CLASS
// ============================================================================

export class TheoryInsightsPanel {
    constructor(options = {}) {
        this.compositionState = options.compositionState || null;
        this.onUpdate = options.onUpdate || (() => {});

        // State
        this.isPanelExpanded = true;
        this.container = null;
        this.analysisData = null;
        this.dismissedPrompts = new Set();

        // Load saved preferences
        const savedExpanded = localStorage.getItem('theory-insights-panel-expanded');
        if (savedExpanded !== null) {
            this.isPanelExpanded = savedExpanded === 'true';
        }

        const savedDismissed = localStorage.getItem('theory-insights-dismissed-prompts');
        if (savedDismissed) {
            try {
                this.dismissedPrompts = new Set(JSON.parse(savedDismissed));
            } catch (e) {
                // Ignore parse errors
            }
        }
    }

    /**
     * Initialize the panel
     */
    init() {
        this.createContainer();
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
     * Toggle panel expansion with flying icon animation (matches sectionSidebar.js)
     */
    togglePanel() {
        this.isPanelExpanded = !this.isPanelExpanded;
        localStorage.setItem('theory-insights-panel-expanded', this.isPanelExpanded.toString());

        const content = document.getElementById('theory-insights-panel');
        const chevron = document.getElementById('theory-insights-chevron');
        const headerBtn = document.getElementById('theory-insights-toggle');
        const headerIcon = headerBtn?.querySelector('svg');

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
            this.animateToSidebar(headerBtn, headerIcon);
        }
    }

    /**
     * Animate icon flying from panel header to sidebar (collapse)
     */
    animateToSidebar(headerBtn, headerIcon) {
        const sectionSidebar = document.getElementById('melody-section-sidebar');
        const container = document.getElementById('melody-dashboard-sections-container');

        if (!sectionSidebar || !headerBtn) {
            // Fallback - just hide and add tab
            if (this.container) this.container.style.display = 'none';
            this.addToSidebar();
            return;
        }

        // Get header button position
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

        // Clone the icon or create a default one
        const iconClone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        iconClone.setAttribute('class', 'w-6 h-6');
        iconClone.setAttribute('fill', 'currentColor');
        iconClone.setAttribute('viewBox', '0 0 20 20');
        iconClone.style.color = '#d97706'; // amber-600
        iconClone.innerHTML = '<path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/>';
        animContainer.appendChild(iconClone);
        document.body.appendChild(animContainer);

        // Hide the panel immediately
        if (this.container) this.container.style.display = 'none';

        // Show sidebar and add tab (invisible at first)
        sectionSidebar.style.display = 'flex';
        if (container) container.style.marginLeft = '4rem';
        this.addToSidebar();

        const tab = sectionSidebar.querySelector('[data-section-id="theory-insights"]');
        if (tab) tab.style.opacity = '0';

        // Animate to sidebar position
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
        const tab = sectionSidebar?.querySelector('[data-section-id="theory-insights"]');
        const headerBtn = document.getElementById('theory-insights-toggle');

        if (!tab || !headerBtn) {
            // Fallback - just show panel
            this.removeFromSidebar();
            if (onComplete) onComplete();
            return;
        }

        const tabRect = tab.getBoundingClientRect();

        // Create animated icon clone
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
        iconClone.setAttribute('fill', 'currentColor');
        iconClone.setAttribute('viewBox', '0 0 20 20');
        iconClone.style.color = '#d97706';
        iconClone.innerHTML = '<path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/>';
        animContainer.appendChild(iconClone);
        document.body.appendChild(animContainer);

        // Hide tab immediately
        tab.style.opacity = '0';

        // Show the panel (but hide the header icon momentarily)
        if (onComplete) onComplete();
        const headerIcon = headerBtn.querySelector('svg');
        if (headerIcon) headerIcon.style.opacity = '0';

        // Get target position
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

        // Don't add if already exists
        if (sectionSidebar.querySelector('[data-section-id="theory-insights"]')) {
            return;
        }

        // Create the tab element
        const tab = document.createElement('button');
        tab.className = 'section-sidebar-tab w-12 h-12 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white transition-all flex items-center justify-center shadow-md';
        tab.setAttribute('data-section-id', 'theory-insights');
        tab.style.width = '48px';
        tab.style.height = '48px';
        tab.style.minHeight = '48px';
        tab.style.minWidth = '48px';

        // Lightbulb icon
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('class', 'w-6 h-6');
        icon.setAttribute('fill', 'currentColor');
        icon.setAttribute('viewBox', '0 0 20 20');
        icon.innerHTML = '<path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/>';
        tab.appendChild(icon);

        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'sidebar-section-tooltip';
        tooltip.textContent = 'Theory Insights';
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

        sectionSidebar.appendChild(tab);

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

        const tab = sectionSidebar.querySelector('[data-section-id="theory-insights"]');
        if (tab) {
            if (tab._tooltip) tab._tooltip.remove();
            tab.remove();

            // Check if section sidebar should be hidden
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
     * Create the container panel
     */
    createContainer() {
        // Check if already exists
        if (document.getElementById('theory-insights-section')) {
            this.container = document.getElementById('theory-insights-section');
            return;
        }

        this.container = document.createElement('div');
        this.container.id = 'theory-insights-section';
        this.container.className = 'mb-3 melody-section-item';
        this.container.style.display = 'none';

        const expandedClass = this.isPanelExpanded ? '' : 'hidden';
        const chevronClass = this.isPanelExpanded ? 'rotate-180' : '';

        this.container.innerHTML = `
            <!-- Theory Insights Panel Header -->
            <button id="theory-insights-toggle"
                    class="w-full px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-between">
                <span class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-white/70 cursor-move drag-handle" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Drag to reorder" style="pointer-events: auto;">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
                    </svg>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                    </svg>
                    Theory Insights
                    <span id="theory-insights-badge" class="text-xs bg-white/20 px-2 py-0.5 rounded-full">--</span>
                </span>
                <svg id="theory-insights-chevron" class="w-5 h-5 transform transition-transform ${chevronClass}" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                </svg>
            </button>

            <!-- Panel Content -->
            <div id="theory-insights-panel" class="mt-2 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-200 border-l-4 border-l-amber-500 overflow-hidden ${expandedClass}">
                <!-- Content will be rendered here -->
                <div id="theory-insights-inner" class="p-3 space-y-3">
                    <div class="text-sm text-gray-500 text-center py-4">
                        Add chords to see theory insights
                    </div>
                </div>
            </div>
        `;

        // Attach event listeners
        setTimeout(() => {
            const headerBtn = document.getElementById('theory-insights-toggle');
            if (headerBtn) {
                headerBtn.addEventListener('click', (e) => {
                    if (!e.target.closest('.drag-handle')) {
                        this.togglePanel();
                    }
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
        // Priority: After Voice Leading panel, then staff notation elements, then melody/trainer containers
        const voiceLeadingPanel = document.getElementById('voice-leading-section');
        const staffNotationCard = document.getElementById('staff-notation-card-toggle')?.closest('.melody-section-item');
        const staffNotationPanel = document.getElementById('staff-notation-card-panel');
        const melodySectionsContainer = document.getElementById('melody-dashboard-sections-container');
        const trainerContainer = document.querySelector('#trainer-sections-container');

        if (voiceLeadingPanel && voiceLeadingPanel.parentElement) {
            // Insert after Voice Leading panel
            voiceLeadingPanel.parentElement.insertBefore(this.container, voiceLeadingPanel.nextSibling);
        } else if (staffNotationCard && staffNotationCard.parentElement) {
            // Insert after staff notation card (same location Voice Leading uses)
            staffNotationCard.parentElement.insertBefore(this.container, staffNotationCard.nextSibling);
        } else if (staffNotationPanel) {
            // Insert at beginning of notation panel
            staffNotationPanel.insertBefore(this.container, staffNotationPanel.firstChild);
        } else if (melodySectionsContainer) {
            melodySectionsContainer.appendChild(this.container);
        } else if (trainerContainer) {
            trainerContainer.appendChild(this.container);
        } else {
            // Fallback
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
     * Analyze the current progression for patterns
     */
    analyze() {
        const compositionState = this.compositionState || window.getCompositionState?.();
        if (!compositionState) {
            this.analysisData = null;
            return null;
        }

        const progressionData = compositionState.exportToProgressionData?.() ||
                                compositionState.progressionData || [];

        if (progressionData.length < 2) {
            this.analysisData = null;
            return null;
        }

        const key = compositionState.metadata?.key || 'C';

        // Run pattern detection
        const patterns = detectAllPatterns(progressionData, key);
        const topPatterns = getTopPatterns(patterns, 5);

        // Get borrowed chord opportunities
        const borrowedOpportunities = this.generateBorrowedOpportunities(progressionData, key);

        // Find the most significant pattern for learning prompt
        const learningPrompt = this.generateLearningPrompt(patterns, progressionData);

        this.analysisData = {
            patterns,
            topPatterns,
            borrowedOpportunities,
            learningPrompt,
            key,
            chordCount: progressionData.length
        };

        return this.analysisData;
    }

    /**
     * Generate borrowed chord opportunities based on current progression
     */
    generateBorrowedOpportunities(progressionData, key) {
        const opportunities = [];
        const isMinorKey = key && (key.includes('m') || key.toLowerCase().includes('min'));

        // In major keys, suggest borrowed chords from parallel minor and other modes
        if (!isMinorKey) {
            const borrowedOptions = [
                { numeral: 'bVI', source: 'Parallel Minor', description: 'Dramatic lift, emotional depth', color: '#ec4899' },
                { numeral: 'bVII', source: 'Mixolydian', description: 'Rock/folk color, resolves to I', color: '#f59e0b' },
                { numeral: 'iv', source: 'Parallel Minor', description: 'Melancholy touch, bittersweet', color: '#8b5cf6' },
                { numeral: 'bIII', source: 'Parallel Minor', description: 'Open, expansive feeling', color: '#3b82f6' }
            ];

            // Check which borrowed chords are NOT already in the progression
            const usedNumerals = new Set(progressionData.map(c => c.roman || c.romanNumeral || ''));

            borrowedOptions.forEach(option => {
                if (!usedNumerals.has(option.numeral)) {
                    // Suggest for a position in the progression
                    const suggestedPosition = this.findGoodPositionFor(option.numeral, progressionData);
                    opportunities.push({
                        ...option,
                        suggestedPosition,
                        chordName: this.getRootFromNumeral(option.numeral, key)
                    });
                }
            });
        }

        return opportunities.slice(0, 3); // Limit to top 3 suggestions
    }

    /**
     * Find a good position to suggest a borrowed chord
     */
    findGoodPositionFor(numeral, progressionData) {
        // bVI often works well before V or at climactic moments
        // bVII works before I or as a passing chord
        // iv works anywhere IV would work

        const len = progressionData.length;
        if (len < 3) return len; // Suggest at end

        // Find positions based on chord function
        for (let i = 0; i < len; i++) {
            const roman = progressionData[i]?.roman || progressionData[i]?.romanNumeral || '';

            if (numeral === 'bVI' && (roman === 'V' || roman === 'V7')) {
                return i; // Before V
            }
            if (numeral === 'bVII' && (roman === 'I' || roman === 'Imaj7')) {
                return i; // Before I
            }
            if (numeral === 'iv' && (roman === 'IV' || roman === 'IVmaj7')) {
                return i; // Replace IV
            }
        }

        // Default: suggest in middle of progression
        return Math.floor(len / 2);
    }

    /**
     * Get the root note from a roman numeral in a given key
     */
    getRootFromNumeral(numeral, key) {
        const keyRoot = key.replace(/m$|min$/i, '');
        const noteOrder = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const flatNoteOrder = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

        const keyIndex = noteOrder.indexOf(keyRoot) !== -1 ? noteOrder.indexOf(keyRoot) : flatNoteOrder.indexOf(keyRoot);
        if (keyIndex === -1) return numeral;

        const numeralOffsets = {
            'I': 0, 'bII': 1, 'II': 2, 'bIII': 3, 'III': 4, 'IV': 5,
            '#IV': 6, 'bV': 6, 'V': 7, 'bVI': 8, 'VI': 9, 'bVII': 10, 'VII': 11,
            'i': 0, 'ii': 2, 'iii': 4, 'iv': 5, 'v': 7, 'vi': 9, 'vii': 11
        };

        const cleanNumeral = numeral.replace(/[°7maj]/g, '');
        const offset = numeralOffsets[cleanNumeral];
        if (offset === undefined) return numeral;

        const rootIndex = (keyIndex + offset) % 12;

        // Flat numerals (bVI, bVII, bIII, bII) should always use flat spelling
        const isFlattedNumeral = cleanNumeral.startsWith('b');
        const useFlats = isFlattedNumeral || key.includes('b') || ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'].includes(keyRoot);

        return useFlats ? flatNoteOrder[rootIndex] : noteOrder[rootIndex];
    }

    /**
     * Get the chord type (Major/Minor) from a roman numeral
     */
    getChordTypeFromNumeral(numeral) {
        // Lowercase numerals are minor (iv, ii, etc)
        // Uppercase numerals are major (bVI, bVII, IV, etc)
        // Diminished: vii°, ii°
        // The base numeral (without b, #, 7, maj, °) determines major/minor

        const cleanNumeral = numeral.replace(/^b|^#|7|maj|°/g, '');

        // Check if the base numeral is lowercase (minor) or uppercase (major)
        if (cleanNumeral.toLowerCase() === cleanNumeral) {
            // All lowercase = minor (iv, ii, vi, etc.)
            if (numeral.includes('°')) {
                return 'Diminished';
            }
            return 'Minor';
        } else {
            // Contains uppercase = major (IV, bVI, bVII, etc.)
            return 'Major';
        }
    }

    /**
     * Generate a learning prompt based on detected patterns
     */
    generateLearningPrompt(patterns, progressionData) {
        // Find the most educational pattern to highlight
        if (patterns.modal && patterns.modal.length > 0) {
            const mode = patterns.modal[0];
            const modeInfo = MODE_DESCRIPTIONS[mode.type];
            if (modeInfo && !this.dismissedPrompts.has(mode.type)) {
                return {
                    type: mode.type,
                    title: `You're using ${modeInfo.name} mode!`,
                    description: `The ${mode.description || modeInfo.characteristic}. Common in ${modeInfo.examples}.`,
                    lessonId: PATTERN_TO_LESSON[mode.type]
                };
            }
        }

        if (patterns.borrowed && patterns.borrowed.length > 0) {
            const borrowed = patterns.borrowed[0];
            if (!this.dismissedPrompts.has('borrowed-' + borrowed.type)) {
                return {
                    type: 'borrowed-' + borrowed.type,
                    title: `You're using a borrowed chord (${borrowed.name})!`,
                    description: borrowed.description,
                    lessonId: PATTERN_TO_LESSON['borrowed']
                };
            }
        }

        if (patterns.cadences && patterns.cadences.length > 0) {
            const cadence = patterns.cadences[0];
            if (!this.dismissedPrompts.has(cadence.type)) {
                return {
                    type: cadence.type,
                    title: `${cadence.fullName} detected!`,
                    description: cadence.description,
                    lessonId: PATTERN_TO_LESSON[cadence.type]
                };
            }
        }

        return null;
    }

    /**
     * Dismiss a learning prompt
     */
    dismissPrompt(promptType) {
        this.dismissedPrompts.add(promptType);
        localStorage.setItem('theory-insights-dismissed-prompts', JSON.stringify([...this.dismissedPrompts]));
        this.render();
    }

    /**
     * Open a lesson from the panel
     */
    openLesson(lessonId) {
        console.log('[TheoryInsights] Opening lesson:', lessonId);

        // First try the direct function if available
        if (window.renderLessonViewer && typeof window.renderLessonViewer === 'function') {
            // Switch to learn tab first
            if (window.switchTab && typeof window.switchTab === 'function') {
                window.switchTab('learn');
            } else {
                // Try clicking the tab button
                const learnTab = document.querySelector('[data-tab="learn"]');
                if (learnTab) learnTab.click();
            }

            // Render the lesson after a short delay to ensure tab is visible
            setTimeout(() => {
                const learnContainer = document.getElementById('learn-tab-content');
                if (learnContainer) {
                    window.renderLessonViewer(lessonId, learnContainer, true);
                }
            }, 150);
            return;
        }

        // Fallback methods
        if (window.openLessonById && typeof window.openLessonById === 'function') {
            window.openLessonById(lessonId);
        } else if (window.showLessonViewer && typeof window.showLessonViewer === 'function') {
            window.showLessonViewer(lessonId);
        } else if (window.wtwOpenLesson && typeof window.wtwOpenLesson === 'function') {
            window.wtwOpenLesson(lessonId);
        } else {
            // Last resort: navigate to lessons tab
            console.warn('[TheoryInsights] Lesson viewer not available. Lesson ID:', lessonId);
            const learnTab = document.querySelector('[data-tab="learn"]');
            if (learnTab) learnTab.click();
        }
    }

    /**
     * Get chord/note name for a scale degree in a given key
     * Handles proper enharmonic spelling based on key context
     */
    getChordInKey(degree, key) {
        // Use flats for flat keys, sharps for sharp keys
        const flatKeys = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'];
        const useFlats = flatKeys.includes(key) || key.includes('b');

        const sharpNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        const notes = useFlats ? flatNotes : sharpNotes;

        // Find key index (handle enharmonics)
        let keyIndex = notes.indexOf(key);
        if (keyIndex === -1) {
            // Try enharmonic equivalent
            const enharmonics = { 'C#': 'Db', 'Db': 'C#', 'D#': 'Eb', 'Eb': 'D#', 'F#': 'Gb', 'Gb': 'F#', 'G#': 'Ab', 'Ab': 'G#', 'A#': 'Bb', 'Bb': 'A#' };
            keyIndex = notes.indexOf(enharmonics[key] || key);
        }
        if (keyIndex === -1) keyIndex = 0;

        // Scale degrees to semitones (major scale)
        const degreeToSemitone = {
            'I': 0, 'ii': 2, 'II': 2, 'iii': 4, 'III': 4, 'IV': 5, 'iv': 5,
            'V': 7, 'vi': 9, 'VI': 9, 'vii': 11, 'VII': 11,
            'bII': 1, 'bIII': 3, 'bVI': 8, 'bVII': 10, '#4': 6
        };

        const semitone = degreeToSemitone[degree];
        if (semitone === undefined) return degree;

        const noteIndex = (keyIndex + semitone) % 12;
        return notes[noteIndex];
    }

    /**
     * Get the notes shared between vi and I chords for deceptive cadence explanation
     */
    getSharedNotes(key) {
        const I = this.getChordInKey('I', key);
        const iii = this.getChordInKey('iii', key);
        const V = this.getChordInKey('V', key);
        // vi chord contains: vi root, I (shared), iii (shared with I chord's 3rd and 5th relationship)
        // Actually in C: Am has A, C, E - C major has C, E, G - shared notes are C and E
        return `${I} and ${iii}`;
    }

    /**
     * Transpose explanation text by replacing all template placeholders with key-specific values
     */
    transposeExplanation(text, key) {
        if (!text || !key) return text;

        // Build replacement map
        const replacements = {
            '{{KEY}}': key,
            '{{I}}': this.getChordInKey('I', key),
            '{{ii}}': this.getChordInKey('ii', key),
            '{{iii}}': this.getChordInKey('iii', key),
            '{{IV}}': this.getChordInKey('IV', key),
            '{{iv}}': this.getChordInKey('iv', key),
            '{{V}}': this.getChordInKey('V', key),
            '{{vi}}': this.getChordInKey('vi', key),
            '{{vii}}': this.getChordInKey('vii', key),
            '{{bII}}': this.getChordInKey('bII', key),
            '{{bIII}}': this.getChordInKey('bIII', key),
            '{{bVI}}': this.getChordInKey('bVI', key),
            '{{bVII}}': this.getChordInKey('bVII', key),
            '{{#4_note}}': this.getChordInKey('#4', key),
            '{{vi_shared_notes}}': this.getSharedNotes(key)
        };

        // Replace all placeholders
        let result = text;
        for (const [placeholder, value] of Object.entries(replacements)) {
            result = result.split(placeholder).join(value);
        }

        return result;
    }

    /**
     * Show a modal with concept explanation
     */
    showConceptModal(conceptType, fallbackTitle) {
        console.log('[TheoryInsights] Showing concept modal:', conceptType);

        // Get the explanation from our dictionary
        const concept = CONCEPT_EXPLANATIONS[conceptType];

        if (!concept) {
            console.warn('[TheoryInsights] No explanation found for:', conceptType);
            return;
        }

        // Remove existing modal if present
        const existingModal = document.getElementById('theory-concept-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Get current key for context-aware transposition
        const currentKey = window.getCompositionState?.()?.metadata?.key ||
                          window.getCurrentKey?.() || 'C';

        // Transpose the explanation to the current key
        const transposedExplanation = this.transposeExplanation(concept.explanation, currentKey);

        // Convert markdown-style formatting to HTML
        const formatText = (text) => {
            return text
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/•/g, '<span class="text-blue-500">•</span>')
                .replace(/\n\n/g, '</p><p class="mt-2">')
                .replace(/\n/g, '<br>');
        };

        // Create modal HTML
        const modalHTML = `
            <div id="theory-concept-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.5);">
                <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
                    <!-- Header -->
                    <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
                        <div>
                            <h2 class="text-xl font-bold text-white">${concept.title}</h2>
                            <p class="text-blue-100 text-sm mt-0.5">${concept.summary}</p>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="px-2 py-1 bg-white/20 rounded text-white text-xs font-medium">Key: ${currentKey}</span>
                            <button id="close-concept-modal" class="text-white/80 hover:text-white transition-colors">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="p-6 overflow-y-auto flex-1">
                        <div class="prose prose-sm max-w-none text-gray-700">
                            <p>${formatText(transposedExplanation)}</p>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="px-6 py-4 bg-gray-50 border-t flex justify-end">
                        <button id="dismiss-concept-modal" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                            Got it!
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add event listeners
        const modal = document.getElementById('theory-concept-modal');
        const closeBtn = document.getElementById('close-concept-modal');
        const dismissBtn = document.getElementById('dismiss-concept-modal');

        const closeModal = () => {
            modal.remove();
        };

        closeBtn.addEventListener('click', closeModal);
        dismissBtn.addEventListener('click', closeModal);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * Render the panel content
     */
    render() {
        if (!this.container) return;

        const innerContainer = document.getElementById('theory-insights-inner');
        if (!innerContainer) return;

        // Update badge
        const badge = document.getElementById('theory-insights-badge');
        if (badge) {
            if (!this.analysisData) {
                badge.textContent = '--';
            } else {
                const patternCount = this.analysisData.topPatterns.length;
                badge.textContent = patternCount > 0 ? `${patternCount} patterns` : 'Analyzing...';
            }
        }

        // Render content
        if (!this.analysisData || this.analysisData.chordCount < 2) {
            innerContainer.innerHTML = `
                <div class="text-sm text-gray-500 text-center py-4">
                    Add chords to see theory insights
                </div>
            `;
            return;
        }

        let html = '';

        // Detected Patterns Section (with inline Learn More links)
        html += this.renderPatternsSection();

        // Borrowed Chord Opportunities Section
        html += this.renderBorrowedOpportunitiesSection();

        // Note: Learning prompt section removed - Learn More links are now inline with detected patterns

        innerContainer.innerHTML = html;

        // Attach event listeners for buttons
        this.attachEventListeners();
    }

    /**
     * Render the detected patterns section with inline Learn More links
     */
    renderPatternsSection() {
        const { topPatterns } = this.analysisData;

        if (!topPatterns || topPatterns.length === 0) {
            return `
                <div class="text-sm text-gray-500 italic">
                    No notable patterns detected yet. Keep building!
                </div>
            `;
        }

        let html = `
            <div class="space-y-2">
                <h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                    <svg class="w-3.5 h-3.5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                    </svg>
                    Detected Patterns
                </h4>
                <div class="space-y-1.5">
        `;

        topPatterns.forEach(pattern => {
            const category = PATTERN_CATEGORIES[pattern.category];
            const color = category?.color || '#6b7280';
            const icon = category?.icon || '';

            // Get a lesson ID for this pattern type
            const lessonId = this.getLessonForPattern(pattern);

            // Use fullName if available (cadences), otherwise name, otherwise type
            const displayName = pattern.fullName || pattern.name || pattern.type;

            html += `
                <div class="flex items-start gap-2 text-sm bg-white/30 rounded px-2 py-1.5">
                    <span class="text-lg leading-none">${icon}</span>
                    <div class="flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-medium" style="color: ${color}">${displayName}</span>
                            ${pattern.positions ? `<span class="text-gray-400 text-xs">at m.${pattern.positions.map(p => p + 1).join('-')}</span>` : ''}
                            <button class="learn-more-btn text-xs text-blue-600 hover:text-blue-800 hover:underline" data-concept-type="${pattern.type}" data-concept-title="${displayName}">Learn →</button>
                        </div>
                        ${pattern.description ? `<div class="text-xs text-gray-500">${pattern.description}</div>` : ''}
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Get a lesson ID for a detected pattern
     */
    getLessonForPattern(pattern) {
        // Map pattern types to lessons
        const patternLessonMap = {
            'PAC': 'lesson-advanced-voice-leading',
            'HC': 'lesson-advanced-voice-leading',
            'PC': 'lesson-advanced-voice-leading',
            'DC': 'lesson-advanced-voice-leading',
            'PHC': 'lesson-advanced-voice-leading',
            'DORIAN': 'lesson-modes-intro',
            'MIXOLYDIAN': 'lesson-modes-intro',
            'PHRYGIAN': 'lesson-modes-intro',
            'LYDIAN': 'lesson-modes-intro',
            'AEOLIAN': 'lesson-modes-intro',
            'borrowed': 'lesson-modal-harmony'
        };

        // Check pattern type first
        if (pattern.type && patternLessonMap[pattern.type]) {
            return patternLessonMap[pattern.type];
        }

        // Check pattern category
        if (pattern.category === 'cadence') {
            return 'lesson-advanced-voice-leading';
        }
        if (pattern.category === 'modal') {
            return 'lesson-modes-intro';
        }
        if (pattern.category === 'borrowed') {
            return 'lesson-modal-harmony';
        }

        return null;
    }

    /**
     * Render the borrowed chord opportunities section
     */
    renderBorrowedOpportunitiesSection() {
        const { borrowedOpportunities } = this.analysisData;

        if (!borrowedOpportunities || borrowedOpportunities.length === 0) {
            return '';
        }

        let html = `
            <div class="space-y-2 pt-2 border-t border-amber-200">
                <h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                    <svg class="w-3.5 h-3.5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clip-rule="evenodd"/>
                    </svg>
                    Borrowed Chords to Explore
                </h4>
                <p class="text-xs text-gray-500 -mt-1">These add color anywhere in your progression. Click + to add after the selected chord.</p>
                <div class="space-y-1.5">
        `;

        borrowedOpportunities.forEach((opp, idx) => {
            // Use proper chord type derivation from numeral
            const chordType = this.getChordTypeFromNumeral(opp.numeral);
            const displayName = `${opp.chordName} ${chordType === 'Minor' ? 'm' : ''}`;

            html += `
                <div class="flex items-center gap-2 text-sm bg-white/50 rounded px-2 py-1.5 hover:bg-white/80 transition-colors">
                    <span class="font-mono font-semibold text-xs px-1.5 py-0.5 rounded" style="background: ${opp.color}20; color: ${opp.color}">${opp.numeral}</span>
                    <span class="font-medium text-gray-700">${displayName}</span>
                    <span class="text-xs text-gray-400">from ${opp.source}</span>
                    <div class="flex gap-1 flex-shrink-0">
                        <button class="preview-borrowed-chord-btn w-7 h-7 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full transition-all text-xs"
                                data-root="${opp.chordName}"
                                data-type="${chordType}"
                                data-numeral="${opp.numeral}"
                                title="Hold to preview ${displayName}">
                            ▶
                        </button>
                        <button class="add-borrowed-chord-btn w-7 h-7 flex items-center justify-center bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-full transition-all text-sm font-bold"
                                data-root="${opp.chordName}"
                                data-type="${chordType}"
                                data-numeral="${opp.numeral}"
                                title="Add ${displayName} after selected chord">
                            +
                        </button>
                    </div>
                    <span class="flex-1 text-xs text-gray-500 truncate">${opp.description}</span>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Render the learning prompt section
     */
    renderLearningPromptSection() {
        const { learningPrompt } = this.analysisData;

        if (!learningPrompt) {
            return '';
        }

        return `
            <div class="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div class="flex items-start gap-2">
                    <svg class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                    </svg>
                    <div class="flex-1">
                        <div class="font-semibold text-sm text-blue-800">${learningPrompt.title}</div>
                        <div class="text-xs text-blue-600 mt-0.5">${learningPrompt.description}</div>
                        <div class="flex items-center gap-2 mt-2">
                            <button class="learn-more-btn px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                    data-concept-type="${learningPrompt.type}"
                                    data-concept-title="${learningPrompt.title}">
                                Learn More
                            </button>
                            <button class="dismiss-prompt-btn px-2 py-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                                    data-prompt-type="${learningPrompt.type}">
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners to rendered elements
     */
    attachEventListeners() {
        // Learn more buttons - show concept explanation modal
        const learnMoreBtns = this.container.querySelectorAll('.learn-more-btn');
        console.log('[TheoryInsights] Found learn-more-btn count:', learnMoreBtns.length);
        learnMoreBtns.forEach((btn, idx) => {
            console.log(`[TheoryInsights] Button ${idx} dataset:`, btn.dataset);
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Use btn directly, not e.target (which could be text node)
                const conceptType = btn.dataset.conceptType;
                const conceptTitle = btn.dataset.conceptTitle;
                console.log('[TheoryInsights] Learn More clicked - type:', conceptType, 'title:', conceptTitle);
                console.log('[TheoryInsights] Button element:', btn);
                console.log('[TheoryInsights] Button outerHTML:', btn.outerHTML);
                this.showConceptModal(conceptType, conceptTitle);
            });
        });

        // Dismiss buttons
        const dismissBtns = this.container.querySelectorAll('.dismiss-prompt-btn');
        dismissBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Use btn directly, not e.target
                const promptType = btn.dataset.promptType;
                this.dismissPrompt(promptType);
            });
        });

        // Preview borrowed chord buttons (play while pressed - mousedown/mouseup)
        const previewBorrowedBtns = this.container.querySelectorAll('.preview-borrowed-chord-btn');
        previewBorrowedBtns.forEach(btn => {
            // Play on mousedown
            btn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const root = btn.dataset.root;
                const type = btn.dataset.type;
                this.startPreview(root, type);
                btn.classList.add('bg-blue-300');
            });

            // Stop on mouseup
            btn.addEventListener('mouseup', (e) => {
                e.stopPropagation();
                this.stopPreview();
                btn.classList.remove('bg-blue-300');
            });

            // Stop if mouse leaves button while pressed
            btn.addEventListener('mouseleave', () => {
                this.stopPreview();
                btn.classList.remove('bg-blue-300');
            });

            // Touch support
            btn.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const root = btn.dataset.root;
                const type = btn.dataset.type;
                this.startPreview(root, type);
                btn.classList.add('bg-blue-300');
            });

            btn.addEventListener('touchend', (e) => {
                e.stopPropagation();
                this.stopPreview();
                btn.classList.remove('bg-blue-300');
            });
        });

        // Add borrowed chord buttons (add after selected chord)
        const addBorrowedBtns = this.container.querySelectorAll('.add-borrowed-chord-btn');
        addBorrowedBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const root = btn.dataset.root;
                const type = btn.dataset.type;
                const numeral = btn.dataset.numeral;

                // Save scroll position relative to BOTTOM of document
                // This way, when content is added above (VexFlow notation), we stay in the same place
                const docHeight = document.documentElement.scrollHeight;
                const viewportHeight = window.innerHeight;
                const distanceFromBottom = docHeight - window.scrollY - viewportHeight;

                // Hide scrolling during the operation
                const html = document.documentElement;
                const originalOverflow = html.style.overflow;
                html.style.overflow = 'hidden';

                this.addBorrowedChord(root, type, numeral);

                // Single restore after all renders complete, then show scroll again
                setTimeout(() => {
                    const newDocHeight = document.documentElement.scrollHeight;
                    const newScrollY = newDocHeight - viewportHeight - distanceFromBottom;
                    window.scrollTo(0, Math.max(0, newScrollY));
                    html.style.overflow = originalOverflow;
                }, 400);
            });
        });
    }

    /**
     * Initialize piano sampler if needed
     */
    async initPiano() {
        if (this.piano) return true;

        if (typeof Tone === 'undefined') {
            console.warn('[TheoryInsights] Tone.js not available');
            return false;
        }

        try {
            await Tone.start();
            this.piano = new Tone.Sampler({
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
                baseUrl: "https://tonejs.github.io/audio/salamander/"
            }).toDestination();

            // Wait for sampler to load
            await new Promise(resolve => {
                if (this.piano.loaded) {
                    resolve();
                } else {
                    this.piano.onload = resolve;
                }
            });
            return true;
        } catch (e) {
            console.error('[TheoryInsights] Piano sampler init error:', e);
            return false;
        }
    }

    /**
     * Start playing a chord (hold until stopPreview is called)
     */
    async startPreview(root, type) {
        console.log(`[TheoryInsights] Starting preview: ${root} ${type}`);

        // Build the chord notes
        this.currentPreviewNotes = this.buildChordNotes(root, type);

        // Try to use the shared piano if available
        if (window.sharedPiano) {
            try {
                await window.Tone?.start();
                window.sharedPiano.triggerAttack(this.currentPreviewNotes);
                this.activePreviewPiano = window.sharedPiano;
                return;
            } catch (e) {
                console.warn('[TheoryInsights] Shared piano error:', e);
            }
        }

        // Use our own sampler
        const ready = await this.initPiano();
        if (ready && this.piano) {
            try {
                this.piano.triggerAttack(this.currentPreviewNotes);
                this.activePreviewPiano = this.piano;
                console.log(`[TheoryInsights] Playing chord:`, this.currentPreviewNotes);
            } catch (e) {
                console.error('[TheoryInsights] Piano playback error:', e);
            }
        }
    }

    /**
     * Stop the currently playing preview
     */
    stopPreview() {
        if (this.currentPreviewNotes && this.activePreviewPiano) {
            try {
                this.activePreviewPiano.triggerRelease(this.currentPreviewNotes);
            } catch (e) {
                console.warn('[TheoryInsights] Error stopping preview:', e);
            }
        }
        this.currentPreviewNotes = null;
        this.activePreviewPiano = null;
    }

    /**
     * Build chord notes from root and type
     */
    buildChordNotes(root, type) {
        const noteToSemitone = {
            'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
            'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
        };

        // Use flats or sharps based on root spelling
        const useFlats = root.includes('b');
        const semitoneToNote = useFlats
            ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
            : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const rootSemitone = noteToSemitone[root] ?? 0;

        const intervals = {
            'Major': [0, 4, 7],
            'Minor': [0, 3, 7],
            'Diminished': [0, 3, 6],
            'Augmented': [0, 4, 8],
            'major': [0, 4, 7],
            'minor': [0, 3, 7],
            'diminished': [0, 3, 6],
            'augmented': [0, 4, 8]
        };

        const chordIntervals = intervals[type] || intervals['Major'];
        const octave = 3; // Bass clef octave

        return chordIntervals.map(interval => {
            const noteSemitone = (rootSemitone + interval) % 12;
            const noteOctave = octave + Math.floor((rootSemitone + interval) / 12);
            return semitoneToNote[noteSemitone] + noteOctave;
        });
    }

    /**
     * Add a borrowed chord to the progression after the selected chord
     */
    addBorrowedChord(root, type, numeral) {
        console.log(`[TheoryInsights] Adding borrowed chord: ${root} ${type} (${numeral})`);

        // Map lowercase type to proper type name
        const typeMap = {
            'major': 'Major',
            'minor': 'Minor',
            'diminished': 'Diminished',
            'augmented': 'Augmented'
        };
        const properType = typeMap[type] || type;

        // Get the selected chord index
        const selectedIndex = window.getSelectedChordIndex?.() ?? -1;
        const insertIndex = selectedIndex >= 0 ? selectedIndex + 1 : null;

        // Build chord notes for playback
        const notes = this.buildChordNotes(root, type);

        // Build chord name
        const typeSuffix = properType === 'Minor' ? 'm' :
                          properType === 'Diminished' ? 'dim' :
                          properType === 'Augmented' ? 'aug' : '';
        const name = `${root}${typeSuffix}`;

        // Build chord data for insertion with complete information
        const chordData = {
            root: root,
            type: properType,
            inversion: 0,
            duration: 4,
            notes: notes,
            roman: numeral || '',
            name: name
        };

        // Use insertChordCardAt if we have a specific position
        if (insertIndex !== null && window.insertChordCardAt) {
            const success = window.insertChordCardAt(insertIndex, chordData, 4);
            if (success) {
                console.log(`[TheoryInsights] Inserted ${root} ${properType} (${numeral}) at index ${insertIndex}`);
                return;
            }
        }

        // Fallback to addSpecificChordToProgression (adds at end)
        if (window.addSpecificChordToProgression) {
            window.addSpecificChordToProgression(properType, 0, true, root);
            console.log(`[TheoryInsights] Added ${root} ${properType} at end of progression`);
        } else {
            console.warn('[TheoryInsights] No method available to add chord');
        }
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
}

// ============================================================================
// SINGLETON & EXPORTS
// ============================================================================

let panelInstance = null;

export function getTheoryInsightsPanel() {
    return panelInstance;
}

export function initTheoryInsightsPanel(options = {}) {
    if (panelInstance) {
        panelInstance.destroy();
    }

    panelInstance = new TheoryInsightsPanel(options);
    panelInstance.init();

    window.theoryInsightsPanel = panelInstance;

    return panelInstance;
}

export function updateTheoryInsights() {
    if (panelInstance) {
        panelInstance.update();
    } else {
        initTheoryInsightsIfReady();
    }
}

export function initTheoryInsightsIfReady() {
    if (panelInstance) {
        panelInstance.update();
        return panelInstance;
    }

    const compositionState = window.getCompositionState?.() ||
                             window.getNotationComposer?.()?.compositionState ||
                             null;

    const isCompositionStudio = document.getElementById('staff-notation-card-panel') ||
                                document.getElementById('composition-notation-panel') ||
                                document.querySelector('.composition-studio-content');

    console.log('[TheoryInsights] Init check - compositionState:', !!compositionState, 'isCompositionStudio:', !!isCompositionStudio);

    if (!compositionState && !isCompositionStudio) {
        console.log('[TheoryInsights] Skipping init - not in composition studio');
        return null;
    }

    console.log('[TheoryInsights] Creating panel instance...');
    panelInstance = new TheoryInsightsPanel({
        compositionState,
        onUpdate: () => {}
    });
    panelInstance.init();

    window.theoryInsightsPanel = panelInstance;
    console.log('[TheoryInsights] Panel initialized successfully');

    return panelInstance;
}

// Expose global functions
window.updateTheoryInsights = updateTheoryInsights;
window.initTheoryInsightsIfReady = initTheoryInsightsIfReady;

// Auto-initialize on page load
if (typeof document !== 'undefined') {
    const autoInit = () => {
        // Initial attempt after 1.5 seconds (after voice leading panel)
        setTimeout(() => {
            const result = initTheoryInsightsIfReady();
            if (!result) {
                // Retry after another 2 seconds if not found
                setTimeout(() => {
                    initTheoryInsightsIfReady();
                }, 2000);
            }
        }, 1500);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }
}

export default TheoryInsightsPanel;
