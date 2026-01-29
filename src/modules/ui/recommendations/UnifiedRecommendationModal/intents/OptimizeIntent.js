/**
 * OptimizeIntent.js - Tension Arc Optimization Intent
 *
 * Handles the "Optimize" intent in the Unified Recommendation Modal.
 * Provides tension arc analysis, visualization, and optimization tools.
 *
 * Features:
 * - Tension arc visualization with SVG graph
 * - Template selection for different tension arc shapes
 * - Mismatch detection and highlighting
 * - Section background visualization
 * - Integration with full Tension Optimizer modal
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { getCompositionState } from '../../../../state/compositionState.js';
import { getCurrentKey, getProgressionData } from '../../../../state/trainerState.js';
import { getTensionArcPlanner, TensionArcPlanner } from '../../../../analysis/TensionArcPlanner.js';
import { hideAllScoreTooltips } from '../MusicUtils.js';

// ============================================================================
// STATE
// ============================================================================

// State for the embedded tension arc UI
let tensionArcState = {
    showTargetCurve: true,
    showSectionBackground: true,
    showMismatches: true,
    expectedLength: 8
};

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

/**
 * Render the Optimize Intent content
 * @param {HTMLElement} container - The container element to render into
 */
function renderOptimizeIntent(container) {
    // Clear container first
    container.innerHTML = '';

    const progressionData = getProgressionData() || [];
    const key = getCurrentKey() || 'C';
    const compositionState = getCompositionState();
    const sections = compositionState?.sections || [];

    if (progressionData.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #6b7280;">
                <div style="font-size: 48px; margin-bottom: 16px;">📈</div>
                <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #374151;">No Progression to Analyze</h3>
                <p style="margin: 0; font-size: 14px;">Add some chords first to see tension arc analysis.</p>
            </div>
        `;
        return;
    }

    // Get the tension planner
    const planner = getTensionArcPlanner();

    // Set expected length based on progression
    if (tensionArcState.expectedLength < progressionData.length) {
        tensionArcState.expectedLength = Math.max(8, progressionData.length + 4);
    }

    // Convert sections format
    const convertedSections = sections.map(section => ({
        type: section.type,
        startIndex: Math.min(...(section.chordIndices || [0])),
        endIndex: Math.max(...(section.chordIndices || [0])),
        label: section.label,
        color: section.color
    }));

    // Calculate current tension curve
    const currentCurve = planner.calculateCurrentCurve(progressionData, key, convertedSections);

    // Get comparison to target
    const comparison = planner.compareToTarget(progressionData, key, convertedSections);

    // Build the UI
    container.innerHTML = `
        <div class="tension-arc-modal-container" style="padding: 16px;">
            ${renderTensionHeader(planner)}
            ${renderTensionControls(planner, progressionData.length)}
            ${renderTensionSVG(progressionData, currentCurve, comparison, convertedSections, planner)}
            ${renderTensionStats(comparison)}
            ${renderTensionMismatchList(comparison)}
            ${renderTensionActions()}
        </div>
    `;

    // Attach event listeners
    attachTensionEventListeners(container, progressionData, key, convertedSections, planner);
}

// ============================================================================
// RENDER HELPER FUNCTIONS
// ============================================================================

/**
 * Render the header section with title and legend
 * @param {TensionArcPlanner} planner - The tension arc planner instance
 * @returns {string} HTML string
 */
function renderTensionHeader(planner) {
    const template = planner.getTemplate();
    return `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <svg style="width: 20px; height: 20px; color: #8b5cf6;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
                </svg>
                <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #374151;">Tension Arc Analysis</h3>
                <span style="font-size: 11px; padding: 2px 8px; background: #ede9fe; color: #6d28d9; border-radius: 10px;">
                    ${template.name}
                </span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; font-size: 11px;">
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: #10b981;"></div>
                    <span style="color: #6b7280;">Low</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: #f59e0b;"></div>
                    <span style="color: #6b7280;">Medium</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444;"></div>
                    <span style="color: #6b7280;">High</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px; margin-left: 8px; padding-left: 8px; border-left: 1px solid #d1d5db;">
                    <div style="width: 16px; height: 0; border-top: 2px dashed #a855f7;"></div>
                    <span style="color: #6b7280;">Target</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the controls section with template selector and toggles
 * @param {TensionArcPlanner} planner - The tension arc planner instance
 * @param {number} currentChordCount - Number of chords currently in progression
 * @returns {string} HTML string
 */
function renderTensionControls(planner, currentChordCount) {
    const templates = TensionArcPlanner.getAvailableTemplates();
    const currentTemplate = planner.currentTemplate;

    return `
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-bottom: 12px; padding: 12px; background: #f9fafb; border-radius: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <label style="font-size: 12px; font-weight: 500; color: #4b5563;">Template:</label>
                <select id="modal-tension-template-select" style="font-size: 12px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 6px; background: white;">
                    ${templates.map(t => `
                        <option value="${t.id}" ${t.id === currentTemplate ? 'selected' : ''}>
                            ${t.name}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <label style="font-size: 12px; font-weight: 500; color: #4b5563;" title="Expected total chords in finished progression">Expected Length:</label>
                <input type="number" id="modal-expected-length-input" value="${tensionArcState.expectedLength}" min="4" max="64"
                       style="width: 56px; font-size: 12px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 6px; background: white;"
                       title="Set how many chords you expect in your full progression">
                <span style="font-size: 11px; color: #9ca3af;">(${currentChordCount} now)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; margin-left: auto;">
                <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #4b5563; cursor: pointer;">
                    <input type="checkbox" id="modal-show-target-curve" ${tensionArcState.showTargetCurve ? 'checked' : ''} style="border-radius: 4px;">
                    <span>Show Target</span>
                </label>
                <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #4b5563; cursor: pointer;">
                    <input type="checkbox" id="modal-show-section-bg" ${tensionArcState.showSectionBackground ? 'checked' : ''} style="border-radius: 4px;">
                    <span>Sections</span>
                </label>
                <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #4b5563; cursor: pointer;">
                    <input type="checkbox" id="modal-show-mismatches" ${tensionArcState.showMismatches ? 'checked' : ''} style="border-radius: 4px;">
                    <span>Mismatches</span>
                </label>
            </div>
        </div>
    `;
}

/**
 * Render the main SVG tension arc visualization
 * @param {Array} progressionData - The chord progression data
 * @param {Array} currentCurve - The calculated current tension curve
 * @param {Object} comparison - The comparison results
 * @param {Array} sections - The song sections
 * @param {TensionArcPlanner} planner - The tension arc planner instance
 * @returns {string} HTML string
 */
function renderTensionSVG(progressionData, currentCurve, comparison, sections, planner) {
    const width = 700;
    const height = 180;
    const padding = { top: 30, right: 30, bottom: 40, left: 50 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    const expectedLength = tensionArcState.expectedLength;
    const xStep = graphWidth / Math.max(1, expectedLength - 1);

    // Calculate points for current curve
    const currentPoints = currentCurve.map((point, i) => ({
        x: padding.left + (i * xStep),
        y: padding.top + graphHeight - (point.tension * graphHeight),
        tension: point.tension,
        chord: point.chord,
        index: i
    }));

    // Calculate full target curve
    const fullTargetPoints = [];
    for (let i = 0; i < expectedLength; i++) {
        const normalizedPosition = i / Math.max(1, expectedLength - 1);
        const targetTension = planner.getTargetTensionAt(normalizedPosition);
        fullTargetPoints.push({
            x: padding.left + (i * xStep),
            y: padding.top + graphHeight - (targetTension * graphHeight),
            tension: targetTension,
            isFuture: i >= currentCurve.length
        });
    }

    const currentPathData = createTensionSmoothPath(currentPoints);
    const fullTargetPathData = createTensionSmoothPath(fullTargetPoints);

    const sectionBackgrounds = renderTensionSectionBackgrounds(sections, progressionData, padding, graphWidth, graphHeight, xStep);
    const mismatchHighlights = renderTensionMismatchHighlights(comparison.mismatches, padding, graphHeight, xStep);

    const currentEndX = padding.left + ((currentCurve.length - 1) * xStep);

    return `
        <div style="overflow-x: auto; margin-bottom: 12px;">
            <svg id="modal-tension-arc-svg" width="${width}" height="${height}" style="display: block; margin: 0 auto;">
                <defs>
                    <linearGradient id="modal-tension-gradient" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#10b981" />
                        <stop offset="50%" stop-color="#f59e0b" />
                        <stop offset="100%" stop-color="#ef4444" />
                    </linearGradient>
                    <linearGradient id="modal-tension-gradient-fill" x1="0%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stop-color="#10b981" stop-opacity="0.15" />
                        <stop offset="50%" stop-color="#f59e0b" stop-opacity="0.15" />
                        <stop offset="100%" stop-color="#ef4444" stop-opacity="0.15" />
                    </linearGradient>
                </defs>

                <!-- Section backgrounds -->
                <g id="modal-section-backgrounds" style="display: ${tensionArcState.showSectionBackground ? 'block' : 'none'}">
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

                <!-- Future region background -->
                ${currentCurve.length < expectedLength ? `
                    <rect x="${currentEndX}" y="${padding.top}"
                          width="${padding.left + graphWidth - currentEndX}" height="${graphHeight}"
                          fill="#f3e8ff" opacity="0.3" />
                    <text x="${currentEndX + 8}" y="${padding.top + 14}" font-size="10" fill="#a855f7" font-style="italic">
                        Future chords
                    </text>
                ` : ''}

                <!-- Mismatch highlights -->
                <g id="modal-mismatch-highlights" style="display: ${tensionArcState.showMismatches ? 'block' : 'none'}">
                    ${mismatchHighlights}
                </g>

                <!-- Target curve (dashed) -->
                <g id="modal-target-curve" style="display: ${tensionArcState.showTargetCurve ? 'block' : 'none'}">
                    <path d="${fullTargetPathData}" stroke="#a855f7" stroke-width="2" fill="none"
                          stroke-dasharray="6,4" stroke-linecap="round" opacity="0.7" />
                </g>

                <!-- Vertical divider at end of current progression -->
                ${currentCurve.length < expectedLength && currentCurve.length > 0 ? `
                    <line x1="${currentEndX}" y1="${padding.top}" x2="${currentEndX}" y2="${padding.top + graphHeight}"
                          stroke="#a855f7" stroke-width="1" stroke-dasharray="4,2" opacity="0.5" />
                ` : ''}

                <!-- Area fill under current curve -->
                ${currentPoints.length > 0 ? `
                    <path d="${currentPathData} L ${currentPoints[currentPoints.length - 1]?.x || padding.left} ${padding.top + graphHeight} L ${currentPoints[0]?.x || padding.left} ${padding.top + graphHeight} Z"
                          fill="url(#modal-tension-gradient-fill)" />
                ` : ''}

                <!-- Current tension curve -->
                <path d="${currentPathData}" stroke="url(#modal-tension-gradient)" stroke-width="3"
                      fill="none" stroke-linecap="round" stroke-linejoin="round" />

                <!-- Data points -->
                ${currentPoints.map((point, i) => {
                    const isMismatch = comparison.mismatches.some(m => m.index === i);
                    let color = '#10b981';
                    if (point.tension > 0.66) color = '#ef4444';
                    else if (point.tension > 0.33) color = '#f59e0b';

                    return `
                        <circle class="modal-tension-point" data-chord-index="${i}"
                                cx="${point.x}" cy="${point.y}" r="${isMismatch ? 7 : 5}"
                                fill="${color}" stroke="${isMismatch ? '#dc2626' : '#1f2937'}"
                                stroke-width="${isMismatch ? 3 : 2}"
                                style="cursor: pointer; transition: all 0.2s;" />
                    `;
                }).join('')}

                <!-- X-axis labels -->
                ${Array.from({length: expectedLength}, (_, i) => {
                    const x = padding.left + (i * xStep);
                    const isCurrent = i < currentCurve.length;
                    return `
                        <line x1="${x}" y1="${padding.top + graphHeight}" x2="${x}" y2="${padding.top + graphHeight + 5}"
                              stroke="${isCurrent ? '#9ca3af' : '#d8b4fe'}" stroke-width="1" />
                        <text x="${x}" y="${padding.top + graphHeight + 18}" text-anchor="middle"
                              font-size="10" fill="${isCurrent ? '#6b7280' : '#c4b5fd'}">${i + 1}</text>
                    `;
                }).join('')}

                <!-- Y-axis label -->
                <text x="${padding.left / 2}" y="${height / 2}" text-anchor="middle" font-size="11" fill="#9ca3af"
                      transform="rotate(-90, ${padding.left / 2}, ${height / 2})">Tension</text>

                <!-- X-axis label -->
                <text x="${width / 2}" y="${padding.top + graphHeight + 35}" text-anchor="middle"
                      font-size="11" fill="#9ca3af">Chord Position (${currentCurve.length} of ${expectedLength})</text>
            </svg>
        </div>
    `;
}

/**
 * Create a smooth path through tension points using quadratic curves
 * @param {Array} points - Array of {x, y} points
 * @returns {string} SVG path data string
 */
function createTensionSmoothPath(points) {
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
 * Render section background rectangles in the SVG
 * @param {Array} sections - Song sections
 * @param {Array} progressionData - Chord progression data
 * @param {Object} padding - SVG padding object
 * @param {number} graphWidth - Graph width
 * @param {number} graphHeight - Graph height
 * @param {number} xStep - X step between points
 * @returns {string} SVG elements string
 */
function renderTensionSectionBackgrounds(sections, progressionData, padding, graphWidth, graphHeight, xStep) {
    if (!sections || sections.length === 0) return '';

    return sections.filter(s => s.startIndex !== undefined).map(section => {
        const startX = padding.left + (section.startIndex * xStep);
        const endX = padding.left + (section.endIndex * xStep);
        const width = endX - startX + xStep * 0.5;

        return `
            <rect x="${startX - xStep * 0.25}" y="${padding.top - 5}"
                  width="${width}" height="${graphHeight + 10}"
                  fill="${section.color || '#8b5cf6'}" opacity="0.1" rx="4" />
            <text x="${startX + width / 2 - xStep * 0.25}" y="${padding.top - 8}"
                  text-anchor="middle" font-size="9" fill="${section.color || '#8b5cf6'}" font-weight="600">
                ${section.label || section.type || ''}
            </text>
        `;
    }).join('');
}

/**
 * Render mismatch highlight rectangles in the SVG
 * @param {Array} mismatches - Array of mismatch objects
 * @param {Object} padding - SVG padding object
 * @param {number} graphHeight - Graph height
 * @param {number} xStep - X step between points
 * @returns {string} SVG elements string
 */
function renderTensionMismatchHighlights(mismatches, padding, graphHeight, xStep) {
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
 * Render the statistics summary bar
 * @param {Object} comparison - The comparison results object
 * @returns {string} HTML string
 */
function renderTensionStats(comparison) {
    const alignmentPct = Math.round(comparison.alignment * 100);
    const alignmentColor = alignmentPct >= 85 ? '#16a34a' :
                          alignmentPct >= 70 ? '#d97706' : '#dc2626';

    return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #f9fafb; border-radius: 8px; font-size: 12px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="color: #6b7280;">Template Alignment:</span>
                    <span style="font-weight: 700; color: ${alignmentColor};">${alignmentPct}%</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="color: #6b7280;">Mismatches:</span>
                    <span style="font-weight: 600; color: ${comparison.mismatches.length > 0 ? '#d97706' : '#16a34a'};">
                        ${comparison.mismatches.length}
                    </span>
                </div>
            </div>
            <div style="color: #6b7280; font-style: italic;">
                ${comparison.overall}
            </div>
        </div>
    `;
}

/**
 * Render the mismatch list section
 * @param {Object} comparison - The comparison results object
 * @returns {string} HTML string
 */
function renderTensionMismatchList(comparison) {
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
        <div id="modal-mismatch-list" style="padding: 12px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; margin-bottom: 12px; display: ${tensionArcState.showMismatches ? 'block' : 'none'};">
            <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #92400e; display: flex; align-items: center; gap: 6px;">
                <svg style="width: 14px; height: 14px;" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                Tension Mismatches
            </h4>
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${significantMismatches.slice(0, 5).map(m => `
                    <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 12px;">
                        <span style="font-weight: 600; color: #b45309; min-width: 60px;">
                            Chord ${m.index + 1}:
                        </span>
                        <span style="color: #92400e;">
                            ${m.direction === 'too-high' ? '↑' : '↓'}
                            ${Math.round(Math.abs(m.deviation) * 100)}% ${m.direction.replace('-', ' ')}
                            – ${m.suggestion}
                        </span>
                    </div>
                `).join('')}
                ${significantMismatches.length > 5 ? `
                    <div style="font-size: 11px; color: #b45309; font-style: italic;">
                        +${significantMismatches.length - 5} more mismatches
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Render the action buttons section
 * @returns {string} HTML string
 */
function renderTensionActions() {
    return `
        <div style="display: flex; gap: 12px; justify-content: center;">
            <button id="open-full-optimizer-btn" style="
                padding: 10px 20px;
                border: 1px solid #d1d5db;
                border-radius: 8px;
                background: white;
                color: #374151;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.2s;
            ">
                <span>🔧</span> Open Full Optimizer
            </button>
        </div>
    `;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Attach event listeners to the tension arc UI elements
 * @param {HTMLElement} container - The container element
 * @param {Array} progressionData - The chord progression data
 * @param {string} key - The current key
 * @param {Array} sections - The song sections
 * @param {TensionArcPlanner} planner - The tension arc planner instance
 */
function attachTensionEventListeners(container, progressionData, key, sections, planner) {
    // Template selector
    const templateSelect = container.querySelector('#modal-tension-template-select');
    if (templateSelect) {
        templateSelect.addEventListener('change', (e) => {
            planner.setTemplate(e.target.value);
            // Re-render just the tension arc section (container is already the correct target)
            renderOptimizeIntent(container);
        });
    }

    // Expected length input
    const expectedLengthInput = container.querySelector('#modal-expected-length-input');
    if (expectedLengthInput) {
        expectedLengthInput.addEventListener('change', (e) => {
            const newLength = parseInt(e.target.value, 10);
            if (newLength >= 4 && newLength <= 64) {
                tensionArcState.expectedLength = newLength;
                // Re-render just the tension arc section (container is already the correct target)
                renderOptimizeIntent(container);
            }
        });
    }

    // Toggle checkboxes
    const toggleTargetCurve = container.querySelector('#modal-show-target-curve');
    if (toggleTargetCurve) {
        toggleTargetCurve.addEventListener('change', (e) => {
            tensionArcState.showTargetCurve = e.target.checked;
            const targetCurve = container.querySelector('#modal-target-curve');
            if (targetCurve) targetCurve.style.display = tensionArcState.showTargetCurve ? 'block' : 'none';
        });
    }

    const toggleSectionBg = container.querySelector('#modal-show-section-bg');
    if (toggleSectionBg) {
        toggleSectionBg.addEventListener('change', (e) => {
            tensionArcState.showSectionBackground = e.target.checked;
            const sectionBgs = container.querySelector('#modal-section-backgrounds');
            if (sectionBgs) sectionBgs.style.display = tensionArcState.showSectionBackground ? 'block' : 'none';
        });
    }

    const toggleMismatches = container.querySelector('#modal-show-mismatches');
    if (toggleMismatches) {
        toggleMismatches.addEventListener('change', (e) => {
            tensionArcState.showMismatches = e.target.checked;
            const mismatchHighlights = container.querySelector('#modal-mismatch-highlights');
            const mismatchList = container.querySelector('#modal-mismatch-list');
            if (mismatchHighlights) mismatchHighlights.style.display = tensionArcState.showMismatches ? 'block' : 'none';
            if (mismatchList) mismatchList.style.display = tensionArcState.showMismatches ? 'block' : 'none';
        });
    }

    // Open full optimizer button
    const openFullOptimizerBtn = container.querySelector('#open-full-optimizer-btn');
    if (openFullOptimizerBtn) {
        openFullOptimizerBtn.addEventListener('click', () => {
            // Hide any open score tooltips before opening another modal
            hideAllScoreTooltips();
            // Close the unified modal via window reference
            if (window.closeUnifiedRecommendationModal) {
                window.closeUnifiedRecommendationModal();
            }
            if (window.showTensionOptimizerModal) {
                window.showTensionOptimizerModal();
            } else {
                import('../../../tensionOptimizerModal.js').then(module => {
                    module.showTensionOptimizerModal();
                }).catch(err => {
                    console.error('Could not open Tension Optimizer:', err);
                });
            }
        });
    }

    // Data point interactions
    const dataPoints = container.querySelectorAll('.modal-tension-point');
    dataPoints.forEach((circle) => {
        const index = parseInt(circle.getAttribute('data-chord-index'), 10);

        circle.addEventListener('mouseenter', () => {
            circle.setAttribute('r', '9');
            if (window.highlightChordCard) window.highlightChordCard(index);
        });

        circle.addEventListener('mouseleave', () => {
            const isMismatch = circle.getAttribute('stroke') === '#dc2626';
            circle.setAttribute('r', isMismatch ? '7' : '5');
            if (window.unhighlightAllChordCards) window.unhighlightAllChordCards();
        });

        circle.addEventListener('click', () => {
            if (window.selectChordCard) window.selectChordCard(index);
        });
    });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get color for tension level (0-100 scale)
 * @param {number} tension - Tension value from 0 to 100
 * @returns {string} Hex color code
 */
function getTensionColor(tension) {
    if (tension >= 80) return '#ef4444'; // High tension - red
    if (tension >= 60) return '#f97316'; // Medium-high - orange
    if (tension >= 40) return '#eab308'; // Medium - yellow
    if (tension >= 20) return '#22c55e'; // Low-medium - green
    return '#06b6d4'; // Low tension - cyan
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    renderOptimizeIntent,
    renderTensionHeader,
    renderTensionControls,
    renderTensionSVG,
    createTensionSmoothPath,
    renderTensionSectionBackgrounds,
    renderTensionMismatchHighlights,
    renderTensionStats,
    renderTensionMismatchList,
    renderTensionActions,
    attachTensionEventListeners,
    getTensionColor,
    tensionArcState
};
