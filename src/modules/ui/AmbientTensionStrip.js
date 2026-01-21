/**
 * AmbientTensionStrip - Minimal tension visualization for ambient display
 *
 * A simplified, compact tension curve that:
 * - Shows at-a-glance tension shape without interaction
 * - Provides passive awareness of harmonic tension
 * - Expands to full analysis on click
 * - Respects Experience Mode settings
 *
 * This is a Layer 1 (Ambient) feature per the Educational Enhancement Roadmap.
 */

import { getTensionArcPlanner, CHORD_TENSION_SCORES } from '../analysis/TensionArcPlanner.js';
import { getExperienceMode } from '../state/globalState.js';
import { getHarmonyAnalyzer } from '../analysis/harmonyAnalyzer.js';

export class AmbientTensionStrip {
    constructor() {
        this.planner = getTensionArcPlanner();
        this.harmonyAnalyzer = getHarmonyAnalyzer();
        this.height = 32;
        this.curveHeight = 24;
        // Track hashes per container to support multiple render targets
        this._containerHashes = new Map();
        // Track active render contexts for re-rendering on mode change
        this._activeContexts = new Map();

        // Listen for Experience Mode changes
        this._setupModeChangeListener();
    }

    /**
     * Set up listener for Experience Mode changes
     */
    _setupModeChangeListener() {
        window.addEventListener('experienceModeChanged', () => {
            // Re-render all active contexts when mode changes
            this._activeContexts.forEach((context, containerId) => {
                const container = document.getElementById(containerId) || context.container;
                if (container && document.body.contains(container)) {
                    // Invalidate cache to force re-render
                    this._containerHashes.delete(containerId);
                    this.render(container, context.progressionData, context.key);
                }
            });
        });
    }

    /**
     * Render minimal tension strip
     * @param {HTMLElement} container - Container to render into
     * @param {Array} progressionData - Chord progression
     * @param {string} key - Current key
     */
    render(container, progressionData, key) {
        if (!container) return;

        // Generate container ID early for context tracking
        const containerId = container.id || 'default';

        // Store context for re-rendering on mode change
        this._activeContexts.set(containerId, { container, progressionData, key });

        // Check experience mode - hidden in Focus mode, visible in Learn mode
        const mode = getExperienceMode?.() || 'learn';
        if (mode === 'focus') {
            this.remove(container);
            return;
        }

        // Need at least 2 chords to show a meaningful curve
        if (!progressionData || progressionData.length < 2) {
            this.remove(container);
            return;
        }

        // Generate hash to avoid unnecessary re-renders
        const hash = this._generateHash(progressionData, key);
        const lastHash = this._containerHashes.get(containerId);

        // Also check if the strip actually exists in this container
        // (it may have been wiped by innerHTML replacement)
        const existingStrip = container.querySelector('#ambient-tension-strip');
        const stripExists = !!existingStrip;

        if (hash === lastHash && stripExists) {
            return; // No changes and strip exists, skip render
        }
        this._containerHashes.set(containerId, hash);

        const curve = this.planner.calculateCurrentCurve(progressionData, key);
        const html = this._generateHTML(curve, progressionData, containerId);

        // Find or create container
        let strip = container.querySelector('#ambient-tension-strip');
        if (!strip) {
            strip = document.createElement('div');
            strip.id = 'ambient-tension-strip';
            strip.className = 'ambient-tension-strip';

            // Smart insertion based on container type
            // Look for section picker and cards container with various IDs used across panels
            const sectionPicker = container.querySelector('#fs-section-picker, #fs-qa-section-picker, #fs-ab-section-picker');
            const cardsContainer = container.querySelector('#fs-chord-cards-container, #fs-quick-add-cards-container, #fs-auto-bass-cards-container');

            // Always insert BEFORE the cards container (which comes after section picker)
            // This ensures the strip appears below header/controls/section picker but above cards
            if (cardsContainer) {
                container.insertBefore(strip, cardsContainer);
            } else if (sectionPicker) {
                // Fallback: insert after section picker if no cards container found
                sectionPicker.insertAdjacentElement('afterend', strip);
            } else {
                // Classic view - insert at beginning
                const firstChild = container.firstElementChild;
                if (firstChild) {
                    container.insertBefore(strip, firstChild);
                } else {
                    container.appendChild(strip);
                }
            }
        }

        strip.innerHTML = html;
        this._attachListeners(strip, progressionData, key, curve);
    }

    /**
     * Generate a simple hash of progression data
     */
    _generateHash(progressionData, key) {
        return `${key}-${progressionData.map(c => `${c.root}${c.type}${c.inversion || 0}`).join(',')}`;
    }

    /**
     * Generate the HTML for the tension strip
     * @param {Array} curve - Tension curve data
     * @param {Array} progressionData - Chord progression
     * @param {string} containerId - Unique container ID for gradient references
     */
    _generateHTML(curve, progressionData, containerId = 'default') {
        // Calculate width based on container, but cap it
        const width = Math.min(900, Math.max(300, window.innerWidth - 80));
        const padding = { left: 12, right: 12 };
        const graphWidth = width - padding.left - padding.right;
        const xStep = graphWidth / Math.max(1, curve.length - 1);

        // Map tension values to SVG points
        const points = curve.map((point, i) => ({
            x: padding.left + (i * xStep),
            y: this.curveHeight - (point.tension * (this.curveHeight - 6)) - 3,
            tension: point.tension,
            index: i
        }));

        const pathData = this._createSmoothPath(points);
        const areaPath = points.length > 0
            ? `${pathData} L ${points[points.length - 1].x} ${this.curveHeight} L ${points[0].x} ${this.curveHeight} Z`
            : '';

        // Calculate average tension for the label
        const avgTension = curve.reduce((sum, p) => sum + p.tension, 0) / curve.length;
        const tensionLabel = avgTension < 0.33 ? 'Low' : avgTension < 0.66 ? 'Medium' : 'High';
        const tensionPct = Math.round(avgTension * 100);

        // Create unique gradient IDs to avoid SVG ID collisions between multiple strips
        const gradientFillId = `tension-gradient-fill-${containerId}`;
        const gradientStrokeId = `tension-gradient-stroke-${containerId}`;

        return `
            <div class="ambient-tension-strip-inner"
                 style="
                    height: ${this.height}px;
                    padding: 4px 8px;
                    cursor: pointer;
                    transition: background 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border-radius: 6px;
                    background: linear-gradient(to right, rgba(16, 185, 129, 0.05), rgba(245, 158, 11, 0.05), rgba(239, 68, 68, 0.05));
                 "
                 title="Tension: ${tensionPct}% (${tensionLabel}) — Click for full analysis">

                <!-- Label -->
                <div style="
                    font-size: 10px;
                    font-weight: 500;
                    color: #6b7280;
                    white-space: nowrap;
                    min-width: 50px;
                ">
                    <span style="color: ${this._getTensionColor(avgTension)};">●</span>
                    Tension
                </div>

                <!-- SVG Curve -->
                <svg width="${width}" height="${this.curveHeight}" style="display: block; flex: 1;">
                    <defs>
                        <linearGradient id="${gradientFillId}" x1="0%" y1="100%" x2="0%" y2="0%">
                            <stop offset="0%" stop-color="#10b981" stop-opacity="0.15" />
                            <stop offset="50%" stop-color="#f59e0b" stop-opacity="0.15" />
                            <stop offset="100%" stop-color="#ef4444" stop-opacity="0.15" />
                        </linearGradient>
                        <!-- Stroke gradient: use solid color for better visibility -->
                        <linearGradient id="${gradientStrokeId}" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stop-color="#10b981" />
                            <stop offset="50%" stop-color="#f59e0b" />
                            <stop offset="100%" stop-color="#ef4444" />
                        </linearGradient>
                    </defs>

                    <!-- Area fill -->
                    <path d="${areaPath}" fill="url(#${gradientFillId})" />

                    <!-- Curve line -->
                    <path d="${pathData}"
                          stroke="url(#${gradientStrokeId})"
                          stroke-width="2.5"
                          fill="none"
                          stroke-linecap="round"
                          stroke-linejoin="round" />

                    <!-- Data points (small dots) -->
                    ${points.map((p, i) => `
                        <circle cx="${p.x}" cy="${p.y}" r="3"
                                fill="${this._getTensionColor(p.tension)}"
                                stroke="white" stroke-width="1"
                                class="tension-point"
                                data-index="${i}"
                                data-tension="${Math.round(p.tension * 100)}" />
                    `).join('')}

                    <!-- Chord position tick marks -->
                    ${points.map((p) => `
                        <line x1="${p.x}" y1="${this.curveHeight - 1}"
                              x2="${p.x}" y2="${this.curveHeight}"
                              stroke="#d1d5db" stroke-width="1" />
                    `).join('')}
                </svg>

                <!-- Expand indicator -->
                <div style="
                    font-size: 10px;
                    color: #9ca3af;
                    display: flex;
                    align-items: center;
                    gap: 2px;
                ">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 15l-6-6-6 6"/>
                    </svg>
                </div>
            </div>
        `;
    }

    /**
     * Create a smooth bezier path from points
     */
    _createSmoothPath(points) {
        if (!points || points.length === 0) return '';
        if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

        let path = `M ${points[0].x} ${points[0].y}`;

        for (let i = 0; i < points.length - 1; i++) {
            const curr = points[i];
            const next = points[i + 1];

            // Use quadratic bezier for smooth curves
            const midX = (curr.x + next.x) / 2;
            const midY = (curr.y + next.y) / 2;

            if (i === 0) {
                // First segment - start smooth
                path += ` Q ${curr.x} ${curr.y}, ${midX} ${midY}`;
            } else {
                path += ` T ${midX} ${midY}`;
            }
        }

        // End at last point
        const last = points[points.length - 1];
        path += ` T ${last.x} ${last.y}`;

        return path;
    }

    /**
     * Get color for tension level
     */
    _getTensionColor(tension) {
        if (tension < 0.33) return '#10b981'; // Green - low tension
        if (tension < 0.66) return '#f59e0b'; // Amber - medium tension
        return '#ef4444'; // Red - high tension
    }

    /**
     * Generate a human-readable explanation of WHY a chord has its tension level
     * @param {Object} chord - Chord object
     * @param {string} key - Current key
     * @param {number} tension - Calculated tension value (0-1)
     * @param {number} index - Position in progression
     * @param {number} total - Total chords in progression
     * @returns {string} Explanation text
     */
    _generateTensionExplanation(chord, key, tension, index, total) {
        if (!chord) return 'Unknown chord';

        const reasons = [];
        const tensionPct = Math.round(tension * 100);
        const tensionLevel = tension < 0.33 ? 'Low' : tension < 0.66 ? 'Medium' : 'High';

        // Get chord type info
        const typeInfo = CHORD_TENSION_SCORES[chord.type];
        const chordSymbol = `${chord.root}${this._getChordSymbol(chord.type)}`;

        // 1. Chord type contribution
        if (typeInfo) {
            if (typeInfo.baseTension >= 0.7) {
                reasons.push(`${chord.type} chords have inherent dissonance`);
            } else if (typeInfo.baseTension >= 0.5) {
                reasons.push(`${chord.type} chords create moderate tension`);
            } else if (typeInfo.baseTension <= 0.25) {
                reasons.push(`${chord.type} chords are stable and consonant`);
            }
        }

        // 2. Harmonic function contribution
        try {
            const func = this.harmonyAnalyzer.getChordFunction(chord, key);
            if (func === 'Dominant') {
                reasons.push(`Dominant function creates strong pull to resolve`);
            } else if (func === 'Tonic') {
                reasons.push(`Tonic function provides resolution and rest`);
            } else if (func === 'Subdominant' || func === 'Predominant') {
                reasons.push(`${func} function builds anticipation`);
            }
        } catch (e) {
            // Harmony analyzer not available
        }

        // 3. Borrowed/chromatic chord
        try {
            const scaleChords = this.harmonyAnalyzer.getMajorScaleChords(key);
            const isInKey = this.harmonyAnalyzer.isChordInKey(chord, scaleChords);
            if (!isInKey) {
                reasons.push(`Borrowed from outside the key (adds color)`);
            }
        } catch (e) {
            // Harmony analyzer not available
        }

        // 4. Inversion
        if (chord.inversion && chord.inversion > 0) {
            const inversionNames = ['', '1st', '2nd', '3rd'];
            reasons.push(`${inversionNames[chord.inversion] || chord.inversion + 'th'} inversion adds instability`);
        }

        // Build the explanation
        let explanation = `${chordSymbol}: ${tensionPct}% tension (${tensionLevel})`;
        if (reasons.length > 0) {
            explanation += '\n• ' + reasons.slice(0, 2).join('\n• ');
        }

        return explanation;
    }

    /**
     * Get chord symbol for display
     */
    _getChordSymbol(type) {
        const symbols = {
            'Major': '',
            'Minor': 'm',
            'Diminished': '°',
            'Augmented': '+',
            'Dominant 7th': '7',
            'Major 7th': 'maj7',
            'Minor 7th': 'm7',
            'Diminished 7th': '°7',
            'Half-Diminished 7th': 'ø7',
            'Sus2': 'sus2',
            'Sus4': 'sus4',
            'Add9': 'add9',
            'Major 9th': 'maj9',
            'Dominant 9th': '9',
            'Minor 9th': 'm9'
        };
        return symbols[type] || '';
    }

    /**
     * Attach event listeners
     */
    _attachListeners(strip, progressionData, key, curve) {
        const inner = strip.querySelector('.ambient-tension-strip-inner');
        if (!inner) return;

        // Create a floating tooltip element for rich explanations
        // Use position: fixed to escape overflow containers
        let tooltip = document.getElementById('tension-explanation-tooltip-global');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'tension-explanation-tooltip-global';
            tooltip.style.cssText = `
                position: fixed;
                z-index: 999999;
                background: white;
                border-radius: 10px;
                font-size: 12px;
                line-height: 1.5;
                max-width: 280px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1);
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease;
                overflow: hidden;
            `;
            document.body.appendChild(tooltip);
        }

        // Click to open full tension analysis
        inner.addEventListener('click', (e) => {
            // Don't open modal if clicking on a specific point - just show tooltip
            if (e.target.classList.contains('tension-point')) {
                return;
            }

            // Open Unified Recommendation Modal to Optimize tab
            if (window.showUnifiedRecommendationModal) {
                window.showUnifiedRecommendationModal({
                    initialTab: 'chord',
                    initialIntent: 'optimize'
                });
            }
        });

        // Hover effects on points with rich explanation tooltips
        const points = strip.querySelectorAll('.tension-point');
        points.forEach(point => {
            point.addEventListener('mouseenter', (e) => {
                point.setAttribute('r', '5');
                const index = parseInt(point.dataset.index, 10);
                const chord = progressionData[index];
                const tensionValue = curve[index]?.tension || 0;

                // Generate pretty HTML tooltip
                const tooltipContent = this._generatePrettyTooltipHTML(
                    chord, key, tensionValue, index, progressionData.length
                );

                // Show tooltip with pretty formatting
                tooltip.innerHTML = tooltipContent;
                tooltip.style.opacity = '1';

                // Position tooltip above the point using fixed positioning
                const pointRect = point.getBoundingClientRect();
                const tooltipWidth = 280;

                // Center horizontally on the point, but keep within viewport
                let left = pointRect.left + pointRect.width / 2 - tooltipWidth / 2;
                left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));

                // Position above the point
                const top = pointRect.top - 10;

                tooltip.style.left = `${left}px`;
                tooltip.style.bottom = `${window.innerHeight - top}px`;
                tooltip.style.top = 'auto';

                // Highlight corresponding chord card
                if (window.highlightChordCard) {
                    window.highlightChordCard(index);
                }
            });

            point.addEventListener('mouseleave', () => {
                point.setAttribute('r', '3');
                tooltip.style.opacity = '0';
                if (window.unhighlightAllChordCards) {
                    window.unhighlightAllChordCards();
                }
            });
        });
    }

    /**
     * Generate pretty HTML for the tooltip
     */
    _generatePrettyTooltipHTML(chord, key, tension, index, total) {
        if (!chord) return '<div style="padding: 12px;">Unknown chord</div>';

        const tensionPct = Math.round(tension * 100);
        const tensionLevel = tension < 0.33 ? 'Low' : tension < 0.66 ? 'Medium' : 'High';
        const tensionColor = this._getTensionColor(tension);
        const chordSymbol = `${chord.root}${this._getChordSymbol(chord.type)}`;

        // Get gradient colors based on tension
        const gradientStart = tension < 0.33 ? '#10b981' : tension < 0.66 ? '#f59e0b' : '#ef4444';
        const gradientEnd = tension < 0.33 ? '#059669' : tension < 0.66 ? '#d97706' : '#dc2626';

        // Collect reasons
        const reasons = [];
        const typeInfo = CHORD_TENSION_SCORES[chord.type];

        if (typeInfo) {
            if (typeInfo.baseTension >= 0.7) {
                reasons.push({ icon: '⚡', text: `${chord.type} chords have inherent dissonance` });
            } else if (typeInfo.baseTension >= 0.5) {
                reasons.push({ icon: '〰️', text: `${chord.type} chords create moderate tension` });
            } else if (typeInfo.baseTension <= 0.25) {
                reasons.push({ icon: '✨', text: `${chord.type} chords are stable and consonant` });
            }
        }

        try {
            const func = this.harmonyAnalyzer.getChordFunction(chord, key);
            if (func === 'Dominant') {
                reasons.push({ icon: '➡️', text: 'Dominant function - wants to resolve' });
            } else if (func === 'Tonic') {
                reasons.push({ icon: '🏠', text: 'Tonic function - home base, restful' });
            } else if (func === 'Subdominant' || func === 'Predominant') {
                reasons.push({ icon: '📈', text: `${func} - builds anticipation` });
            }
        } catch (e) {}

        try {
            const scaleChords = this.harmonyAnalyzer.getMajorScaleChords(key);
            const isInKey = this.harmonyAnalyzer.isChordInKey(chord, scaleChords);
            if (!isInKey) {
                reasons.push({ icon: '🎨', text: 'Borrowed chord - adds color' });
            }
        } catch (e) {}

        if (chord.inversion && chord.inversion > 0) {
            const inversionNames = ['', '1st', '2nd', '3rd'];
            reasons.push({ icon: '↕️', text: `${inversionNames[chord.inversion] || chord.inversion + 'th'} inversion` });
        }

        // Build HTML
        const reasonsHTML = reasons.slice(0, 3).map(r =>
            `<div style="display: flex; align-items: center; gap: 8px; padding: 4px 0;">
                <span style="font-size: 14px;">${r.icon}</span>
                <span style="color: #4b5563;">${r.text}</span>
            </div>`
        ).join('');

        return `
            <!-- Header with gradient -->
            <div style="
                background: linear-gradient(135deg, ${gradientStart}, ${gradientEnd});
                padding: 10px 14px;
                color: white;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 700; font-size: 16px;">${chordSymbol}</span>
                    <span style="
                        background: rgba(255,255,255,0.25);
                        padding: 2px 8px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: 600;
                    ">${tensionLevel}</span>
                </div>
                <div style="margin-top: 4px; font-size: 13px; opacity: 0.9;">
                    Tension: ${tensionPct}%
                </div>
            </div>
            <!-- Body with reasons -->
            ${reasons.length > 0 ? `
                <div style="padding: 10px 14px; background: #fafafa;">
                    <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 6px;">
                        Why this tension?
                    </div>
                    ${reasonsHTML}
                </div>
            ` : ''}
            <!-- Arrow pointer -->
            <div style="
                position: absolute;
                bottom: -8px;
                left: 50%;
                transform: translateX(-50%);
                width: 0;
                height: 0;
                border-left: 8px solid transparent;
                border-right: 8px solid transparent;
                border-top: 8px solid ${reasons.length > 0 ? '#fafafa' : 'white'};
            "></div>
        `;
    }

    /**
     * Remove the tension strip from container
     */
    remove(container) {
        if (!container) return;
        const strip = container.querySelector('#ambient-tension-strip');
        if (strip) {
            strip.remove();
            const containerId = container.id || 'default';
            this._containerHashes.delete(containerId);
        }
    }

    /**
     * Force a re-render by clearing the cache
     * @param {HTMLElement} [container] - Specific container to invalidate, or all if not provided
     */
    invalidate(container) {
        if (container) {
            const containerId = container.id || 'default';
            this._containerHashes.delete(containerId);
        } else {
            this._containerHashes.clear();
        }
    }
}

// Singleton instance
let instance = null;

/**
 * Get or create the AmbientTensionStrip singleton
 * @returns {AmbientTensionStrip}
 */
export function getAmbientTensionStrip() {
    if (!instance) {
        instance = new AmbientTensionStrip();
    }
    return instance;
}

/**
 * Convenience function to render the ambient tension strip
 * @param {HTMLElement} container - Container to render into
 * @param {Array} progressionData - Chord progression
 * @param {string} key - Current key
 */
export function renderAmbientTensionStrip(container, progressionData, key) {
    getAmbientTensionStrip().render(container, progressionData, key);
}

/**
 * Remove the ambient tension strip from a container
 * @param {HTMLElement} container - Container to remove from
 */
export function removeAmbientTensionStrip(container) {
    getAmbientTensionStrip().remove(container);
}

export default AmbientTensionStrip;
