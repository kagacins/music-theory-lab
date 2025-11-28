/**
 * TensionArcUI Module
 * Phase 3: Enhanced Tension Visualization
 *
 * Provides an enhanced tension curve visualization that:
 * - Shows per-section tension areas with colored backgrounds
 * - Displays target template curve for comparison
 * - Highlights tension mismatches
 * - Allows template selection
 * - Integrates with the TensionArcPlanner
 */

import { getTensionArcPlanner, TensionArcPlanner, TENSION_ARC_TEMPLATES } from '../analysis/TensionArcPlanner.js';
import { getHarmonyAnalyzer } from '../analysis/harmonyAnalyzer.js';

/**
 * TensionArcUI class
 * Enhanced tension visualization with template comparison
 */
export class TensionArcUI {
    constructor() {
        this.planner = getTensionArcPlanner();
        this.harmonyAnalyzer = getHarmonyAnalyzer();
        this.container = null;
        this.showTargetCurve = true;
        this.showSectionBackground = true;
        this.showMismatches = true;
        this.expectedLength = 8; // Default expected progression length
    }

    /**
     * Render the enhanced tension curve
     * @param {HTMLElement} container - Container to render into
     * @param {Array} progressionData - Chord progression data
     * @param {string} key - Current key
     * @param {Array} sections - Section data from compositionState
     */
    render(container, progressionData, key, sections = []) {
        if (!progressionData || progressionData.length === 0) {
            this.renderEmpty(container);
            return;
        }

        this.container = container;

        // IMPORTANT: Remove ALL existing tension arc containers from the entire document
        // to prevent duplicates across different panels
        document.querySelectorAll('#tension-arc-container').forEach(el => el.remove());
        document.querySelectorAll('#tension-curve-container').forEach(el => el.remove());

        // Only render in the main progression-visualization-panel
        const targetPanel = document.getElementById('progression-visualization-panel');
        if (!targetPanel) {
            return; // Don't render if the target panel doesn't exist
        }

        // Calculate current tension curve
        const currentCurve = this.planner.calculateCurrentCurve(progressionData, key, this.convertSections(sections));

        // Get comparison to target
        const comparison = this.planner.compareToTarget(progressionData, key, this.convertSections(sections));

        // Build the UI
        const uiContainer = document.createElement('div');
        uiContainer.id = 'tension-arc-container';
        uiContainer.className = 'mb-4 px-2';

        uiContainer.innerHTML = `
            ${this.renderHeader()}
            ${this.renderControls(progressionData.length)}
            ${this.renderSVG(progressionData, currentCurve, comparison, sections)}
            ${this.renderStats(comparison)}
            ${this.renderMismatchList(comparison)}
        `;

        // Insert at the end of the target panel (after chord cards)
        targetPanel.appendChild(uiContainer);

        // Attach event listeners
        this.attachEventListeners(uiContainer, progressionData, key, sections);
    }

    /**
     * Convert sections from compositionState format to planner format
     */
    convertSections(sections) {
        if (!sections || sections.length === 0) return [];

        return sections.map(section => ({
            type: section.type,
            startIndex: Math.min(...section.chordIndices),
            endIndex: Math.max(...section.chordIndices),
            label: section.label,
            color: section.color
        }));
    }

    /**
     * Render empty state
     */
    renderEmpty(container) {
        const emptyContainer = document.createElement('div');
        emptyContainer.id = 'tension-arc-container';
        emptyContainer.className = 'mb-4 px-2 py-4 text-center text-gray-500 text-sm';
        emptyContainer.innerHTML = `
            <svg class="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
            </svg>
            <p>Add chords to see tension analysis</p>
        `;

        const existing = container.querySelector('#tension-arc-container');
        if (existing) existing.remove();
        container.insertBefore(emptyContainer, container.firstChild);
    }

    /**
     * Render header with title and legend
     */
    renderHeader() {
        const template = this.planner.getTemplate();
        return `
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
                    </svg>
                    <h3 class="text-sm font-semibold text-gray-700">Tension Arc Analysis</h3>
                    <span class="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                        ${template.name}
                    </span>
                </div>
                <div class="flex items-center gap-3 text-xs">
                    <div class="flex items-center gap-1">
                        <div class="w-3 h-3 rounded-full bg-green-500"></div>
                        <span class="text-gray-600">Low</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <div class="w-3 h-3 rounded-full bg-amber-500"></div>
                        <span class="text-gray-600">Medium</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <div class="w-3 h-3 rounded-full bg-red-500"></div>
                        <span class="text-gray-600">High</span>
                    </div>
                    <div class="flex items-center gap-1 ml-2 border-l pl-2 border-gray-300">
                        <div class="w-4 h-0 border-t-2 border-dashed border-purple-400"></div>
                        <span class="text-gray-600">Target</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render controls for template selection and toggles
     * @param {number} currentChordCount - Current number of chords in progression
     */
    renderControls(currentChordCount = 0) {
        const templates = TensionArcPlanner.getAvailableTemplates();
        const currentTemplate = this.planner.currentTemplate;

        // Expected length defaults to current count + 4, minimum 8
        if (!this.expectedLength) {
            this.expectedLength = Math.max(8, currentChordCount + 4);
        }

        return `
            <div class="flex flex-wrap items-center gap-4 mb-2 p-2 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-2">
                    <label class="text-xs font-medium text-gray-600">Template:</label>
                    <select id="tension-template-select" class="text-xs px-2 py-1 border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500">
                        ${templates.map(t => `
                            <option value="${t.id}" ${t.id === currentTemplate ? 'selected' : ''}>
                                ${t.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-xs font-medium text-gray-600" title="Expected total chords in finished progression">Expected Length:</label>
                    <input type="number" id="expected-length-input" value="${this.expectedLength}" min="4" max="64"
                           class="w-14 text-xs px-2 py-1 border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                           title="Set how many chords you expect in your full progression to see the complete target curve">
                    <span class="text-xs text-gray-500">(${currentChordCount} now)</span>
                </div>
                <div class="flex items-center gap-3">
                    <label class="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                        <input type="checkbox" id="show-target-curve" ${this.showTargetCurve ? 'checked' : ''} class="rounded border-gray-300 text-purple-600 focus:ring-purple-500">
                        <span>Show Target</span>
                    </label>
                    <label class="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                        <input type="checkbox" id="show-section-bg" ${this.showSectionBackground ? 'checked' : ''} class="rounded border-gray-300 text-purple-600 focus:ring-purple-500">
                        <span>Section Colors</span>
                    </label>
                    <label class="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                        <input type="checkbox" id="show-mismatches" ${this.showMismatches ? 'checked' : ''} class="rounded border-gray-300 text-purple-600 focus:ring-purple-500">
                        <span>Highlight Mismatches</span>
                    </label>
                </div>
            </div>
        `;
    }

    /**
     * Render the main SVG visualization
     */
    renderSVG(progressionData, currentCurve, comparison, sections) {
        const width = Math.min(1200, window.innerWidth - 40);
        const height = 160;
        const padding = { top: 25, right: 30, bottom: 35, left: 45 };
        const graphWidth = width - padding.left - padding.right;
        const graphHeight = height - padding.top - padding.bottom;

        // Use expected length for the full x-axis scale
        const expectedLength = this.expectedLength || Math.max(8, currentCurve.length + 4);
        const xStep = graphWidth / Math.max(1, expectedLength - 1);

        // Calculate points for current curve (positioned within the expected length scale)
        const currentPoints = currentCurve.map((point, i) => ({
            x: padding.left + (i * xStep),
            y: padding.top + graphHeight - (point.tension * graphHeight),
            tension: point.tension,
            chord: point.chord,
            index: i
        }));

        // Calculate FULL target curve spanning the entire expected length
        const fullTargetPoints = [];
        for (let i = 0; i < expectedLength; i++) {
            const normalizedPosition = i / Math.max(1, expectedLength - 1);
            const targetTension = this.planner.getTargetTensionAt(normalizedPosition);
            fullTargetPoints.push({
                x: padding.left + (i * xStep),
                y: padding.top + graphHeight - (targetTension * graphHeight),
                tension: targetTension,
                isFuture: i >= currentCurve.length
            });
        }

        // Create path data for current curve and full target curve
        const currentPathData = this.createSmoothPath(currentPoints);
        const fullTargetPathData = this.createSmoothPath(fullTargetPoints);

        // Separate path for the "future" portion of target (lighter/more dashed)
        const futureTargetPoints = fullTargetPoints.filter(p => p.isFuture);
        const futureTargetPathData = futureTargetPoints.length > 1 ? this.createSmoothPath(futureTargetPoints) : '';

        // Section backgrounds
        const sectionBackgrounds = this.renderSectionBackgrounds(sections, progressionData, padding, graphWidth, graphHeight, xStep);

        // Mismatch highlights
        const mismatchHighlights = this.renderMismatchHighlights(comparison.mismatches, padding, graphHeight, xStep);

        // Divider line showing where current progression ends
        const currentEndX = padding.left + ((currentCurve.length - 1) * xStep);

        return `
            <svg id="tension-arc-svg" width="${width}" height="${height}" class="mx-auto">
                <defs>
                    <linearGradient id="tension-arc-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#10b981" />
                        <stop offset="50%" stop-color="#f59e0b" />
                        <stop offset="100%" stop-color="#ef4444" />
                    </linearGradient>
                    <linearGradient id="tension-arc-gradient-fill" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#10b981" stop-opacity="0.15" />
                        <stop offset="50%" stop-color="#f59e0b" stop-opacity="0.15" />
                        <stop offset="100%" stop-color="#ef4444" stop-opacity="0.15" />
                    </linearGradient>
                </defs>

                <!-- Section backgrounds -->
                <g id="section-backgrounds" style="display: ${this.showSectionBackground ? 'block' : 'none'}">
                    ${sectionBackgrounds}
                </g>

                <!-- Grid lines -->
                ${[0, 25, 50, 75, 100].map(pct => {
                    const y = padding.top + graphHeight - (pct / 100 * graphHeight);
                    return `
                        <line x1="${padding.left}" y1="${y}" x2="${padding.left + graphWidth}" y2="${y}"
                              stroke="#e5e7eb" stroke-width="1" stroke-dasharray="2,2" />
                        <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9ca3af">
                            ${pct}
                        </text>
                    `;
                }).join('')}

                <!-- Future region background (shaded area for upcoming chords) -->
                ${currentCurve.length < expectedLength ? `
                    <rect x="${currentEndX}" y="${padding.top}"
                          width="${padding.left + graphWidth - currentEndX}" height="${graphHeight}"
                          fill="#f3e8ff" opacity="0.3" />
                    <text x="${currentEndX + 8}" y="${padding.top + 12}" font-size="9" fill="#a855f7" font-style="italic">
                        Future
                    </text>
                ` : ''}

                <!-- Mismatch highlights -->
                <g id="mismatch-highlights" style="display: ${this.showMismatches ? 'block' : 'none'}">
                    ${mismatchHighlights}
                </g>

                <!-- Full target curve (dashed) - shows entire expected progression -->
                <g id="target-curve" style="display: ${this.showTargetCurve ? 'block' : 'none'}">
                    <path d="${fullTargetPathData}" stroke="#a855f7" stroke-width="2" fill="none"
                          stroke-dasharray="6,4" stroke-linecap="round" opacity="0.7" />
                </g>

                <!-- Vertical divider line at end of current progression -->
                ${currentCurve.length < expectedLength && currentCurve.length > 0 ? `
                    <line x1="${currentEndX}" y1="${padding.top}" x2="${currentEndX}" y2="${padding.top + graphHeight}"
                          stroke="#a855f7" stroke-width="1" stroke-dasharray="4,2" opacity="0.5" />
                ` : ''}

                <!-- Area fill under current curve -->
                <path d="${currentPathData} L ${currentPoints[currentPoints.length - 1]?.x || padding.left} ${padding.top + graphHeight} L ${currentPoints[0]?.x || padding.left} ${padding.top + graphHeight} Z"
                      fill="url(#tension-arc-gradient-fill)" />

                <!-- Current tension curve -->
                <path d="${currentPathData}" stroke="url(#tension-arc-gradient)" stroke-width="3"
                      fill="none" stroke-linecap="round" stroke-linejoin="round" />

                <!-- Data points for current chords -->
                ${currentPoints.map((point, i) => {
                    const isMismatch = comparison.mismatches.some(m => m.index === i);
                    let color = '#10b981';
                    if (point.tension > 0.66) color = '#ef4444';
                    else if (point.tension > 0.33) color = '#f59e0b';

                    return `
                        <circle class="tension-arc-point" data-chord-index="${i}"
                                cx="${point.x}" cy="${point.y}" r="${isMismatch ? 7 : 5}"
                                fill="${color}" stroke="${isMismatch ? '#dc2626' : '#1f2937'}"
                                stroke-width="${isMismatch ? 3 : 2}"
                                style="cursor: pointer; transition: all 0.2s;" />
                    `;
                }).join('')}

                <!-- X-axis labels for ALL positions (current + future) -->
                ${Array.from({length: expectedLength}, (_, i) => {
                    const x = padding.left + (i * xStep);
                    const isCurrent = i < currentCurve.length;
                    const isLast = i === currentCurve.length - 1;
                    return `
                        <line x1="${x}" y1="${padding.top + graphHeight}" x2="${x}" y2="${padding.top + graphHeight + 5}"
                              stroke="${isCurrent ? '#9ca3af' : '#d8b4fe'}" stroke-width="1" />
                        <text x="${x}" y="${padding.top + graphHeight + 18}" text-anchor="middle"
                              font-size="10" fill="${isCurrent ? '#6b7280' : '#c4b5fd'}"
                              font-weight="${isLast ? '700' : '500'}">${i + 1}</text>
                    `;
                }).join('')}

                <!-- Y-axis label -->
                <text x="${padding.left / 2}" y="${height / 2}" text-anchor="middle" font-size="11" fill="#9ca3af"
                      transform="rotate(-90, ${padding.left / 2}, ${height / 2})">Tension</text>

                <!-- X-axis label -->
                <text x="${width / 2}" y="${padding.top + graphHeight + 32}" text-anchor="middle"
                      font-size="11" fill="#9ca3af">Chord Position (${currentCurve.length} of ${expectedLength})</text>
            </svg>
        `;
    }

    /**
     * Create smooth bezier path from points
     */
    createSmoothPath(points) {
        if (!points || points.length === 0) return '';
        if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

        let path = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];
            const controlX = (current.x + next.x) / 2;
            path += ` Q ${controlX} ${current.y}, ${controlX} ${(current.y + next.y) / 2}`;
            path += ` Q ${controlX} ${next.y}, ${next.x} ${next.y}`;
        }
        return path;
    }

    /**
     * Render section background areas
     */
    renderSectionBackgrounds(sections, progressionData, padding, graphWidth, graphHeight, xStep) {
        if (!sections || sections.length === 0) return '';

        return sections.map(section => {
            const startX = padding.left + (Math.min(...section.chordIndices) * xStep);
            const endX = padding.left + (Math.max(...section.chordIndices) * xStep);
            const width = endX - startX + xStep * 0.5;

            return `
                <rect x="${startX - xStep * 0.25}" y="${padding.top - 5}"
                      width="${width}" height="${graphHeight + 10}"
                      fill="${section.color}" opacity="0.1" rx="4" />
                <text x="${startX + width / 2 - xStep * 0.25}" y="${padding.top - 8}"
                      text-anchor="middle" font-size="9" fill="${section.color}" font-weight="600">
                    ${section.label || section.type}
                </text>
            `;
        }).join('');
    }

    /**
     * Render mismatch highlight areas
     */
    renderMismatchHighlights(mismatches, padding, graphHeight, xStep) {
        if (!mismatches || mismatches.length === 0) return '';

        return mismatches.map(mismatch => {
            const x = padding.left + (mismatch.index * xStep);
            const severity = mismatch.severity;
            const color = severity === 'significant' ? '#dc2626' :
                         severity === 'moderate' ? '#f97316' : '#fbbf24';
            const opacity = severity === 'significant' ? 0.2 :
                           severity === 'moderate' ? 0.15 : 0.1;

            return `
                <rect x="${x - xStep * 0.3}" y="${padding.top}"
                      width="${xStep * 0.6}" height="${graphHeight}"
                      fill="${color}" opacity="${opacity}" rx="2" />
            `;
        }).join('');
    }

    /**
     * Render alignment stats
     */
    renderStats(comparison) {
        const alignmentPct = Math.round(comparison.alignment * 100);
        const alignmentColor = alignmentPct >= 85 ? 'text-green-600' :
                              alignmentPct >= 70 ? 'text-amber-600' : 'text-red-600';

        return `
            <div class="flex items-center justify-between mt-2 p-2 bg-gray-50 rounded-lg text-xs">
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                        <span class="text-gray-500">Template Alignment:</span>
                        <span class="font-bold ${alignmentColor}">${alignmentPct}%</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-gray-500">Mismatches:</span>
                        <span class="font-medium ${comparison.mismatches.length > 0 ? 'text-amber-600' : 'text-green-600'}">
                            ${comparison.mismatches.length}
                        </span>
                    </div>
                </div>
                <div class="text-gray-500 italic">
                    ${comparison.overall}
                </div>
            </div>
        `;
    }

    /**
     * Render mismatch list with suggestions
     */
    renderMismatchList(comparison) {
        if (!comparison.mismatches || comparison.mismatches.length === 0) {
            return '';
        }

        const significantMismatches = comparison.mismatches.filter(m =>
            m.severity === 'moderate' || m.severity === 'significant'
        );

        if (significantMismatches.length === 0) {
            return '';
        }

        return `
            <div id="mismatch-list" class="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg"
                 style="display: ${this.showMismatches ? 'block' : 'none'}">
                <h4 class="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1">
                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    Tension Mismatches
                </h4>
                <div class="space-y-1.5">
                    ${significantMismatches.slice(0, 3).map(m => `
                        <div class="flex items-start gap-2 text-xs">
                            <span class="font-medium text-amber-700 min-w-[60px]">
                                Chord ${m.index + 1}:
                            </span>
                            <span class="text-amber-600">
                                ${m.direction === 'too-high' ? '↑' : '↓'}
                                ${Math.round(Math.abs(m.deviation) * 100)}% ${m.direction.replace('-', ' ')}
                                – ${m.suggestion}
                            </span>
                        </div>
                    `).join('')}
                    ${significantMismatches.length > 3 ? `
                        <div class="text-xs text-amber-500 italic">
                            +${significantMismatches.length - 3} more mismatches
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners(container, progressionData, key, sections) {
        // Template selector
        const templateSelect = container.querySelector('#tension-template-select');
        if (templateSelect) {
            templateSelect.addEventListener('change', (e) => {
                this.planner.setTemplate(e.target.value);
                this.render(this.container.parentElement, progressionData, key, sections);
            });
        }

        // Toggle checkboxes
        const toggleTargetCurve = container.querySelector('#show-target-curve');
        if (toggleTargetCurve) {
            toggleTargetCurve.addEventListener('change', (e) => {
                this.showTargetCurve = e.target.checked;
                const targetCurve = container.querySelector('#target-curve');
                if (targetCurve) targetCurve.style.display = this.showTargetCurve ? 'block' : 'none';
            });
        }

        const toggleSectionBg = container.querySelector('#show-section-bg');
        if (toggleSectionBg) {
            toggleSectionBg.addEventListener('change', (e) => {
                this.showSectionBackground = e.target.checked;
                const sectionBgs = container.querySelector('#section-backgrounds');
                if (sectionBgs) sectionBgs.style.display = this.showSectionBackground ? 'block' : 'none';
            });
        }

        const toggleMismatches = container.querySelector('#show-mismatches');
        if (toggleMismatches) {
            toggleMismatches.addEventListener('change', (e) => {
                this.showMismatches = e.target.checked;
                const mismatchHighlights = container.querySelector('#mismatch-highlights');
                const mismatchList = container.querySelector('#mismatch-list');
                if (mismatchHighlights) mismatchHighlights.style.display = this.showMismatches ? 'block' : 'none';
                if (mismatchList) mismatchList.style.display = this.showMismatches ? 'block' : 'none';
            });
        }

        // Expected length input - re-renders the graph with new expected length
        const expectedLengthInput = container.querySelector('#expected-length-input');
        if (expectedLengthInput) {
            expectedLengthInput.addEventListener('change', (e) => {
                const newLength = parseInt(e.target.value, 10);
                if (newLength >= 4 && newLength <= 64) {
                    this.expectedLength = newLength;
                    // Re-render with new expected length
                    this.render(this.container, progressionData, key, sections);
                }
            });
        }

        // Data point interactions
        const dataPoints = container.querySelectorAll('.tension-arc-point');
        dataPoints.forEach((circle, index) => {
            circle.addEventListener('mouseenter', () => {
                circle.setAttribute('r', '8');
                this.highlightChordCard(index);
            });

            circle.addEventListener('mouseleave', () => {
                const isMismatch = circle.getAttribute('stroke') === '#dc2626';
                circle.setAttribute('r', isMismatch ? '7' : '5');
                this.unhighlightAllChordCards();
            });

            circle.addEventListener('click', () => {
                if (window.selectChordCard) {
                    window.selectChordCard(index);
                }
            });

            circle.addEventListener('mousedown', () => {
                if (window.startProgressionChord) {
                    window.startProgressionChord(index);
                }
            });

            circle.addEventListener('mouseup', () => {
                if (window.stopTrainerChord) {
                    window.stopTrainerChord();
                }
            });
        });
    }

    /**
     * Highlight a chord card by index
     */
    highlightChordCard(index) {
        if (window.highlightChordCard) {
            window.highlightChordCard(index);
        }
    }

    /**
     * Unhighlight all chord cards
     */
    unhighlightAllChordCards() {
        if (window.unhighlightAllChordCards) {
            window.unhighlightAllChordCards();
        }
    }

    /**
     * Update the visualization with new data
     */
    update(progressionData, key, sections) {
        if (this.container) {
            this.render(this.container.parentElement || this.container, progressionData, key, sections);
        }
    }
}

// Create singleton instance
let uiInstance = null;

/**
 * Get or create the TensionArcUI singleton
 * @returns {TensionArcUI}
 */
export function getTensionArcUI() {
    if (!uiInstance) {
        uiInstance = new TensionArcUI();
    }
    return uiInstance;
}

/**
 * Render enhanced tension arc visualization
 * Drop-in replacement for renderTensionCurve
 * @param {HTMLElement} container - Container element
 * @param {Array} progressionData - Chord progression
 * @param {string} key - Current key
 * @param {Array} sections - Section data (optional)
 */
export function renderEnhancedTensionCurve(container, progressionData, key, sections = []) {
    const ui = getTensionArcUI();
    ui.render(container, progressionData, key, sections);
}

export default TensionArcUI;
