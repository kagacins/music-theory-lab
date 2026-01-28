/**
 * TheoryPanel.js - Theory Insights Panel for Full-Screen Dock
 *
 * Displays progression analysis including:
 * - Named progressions (e.g., "Axis Progression", "Canon Progression")
 * - Pattern detection (cadences, sequences, modal interchange)
 * - Harmonic rhythm analysis
 * - Chord function distribution
 * - Coach engine insights (observations, suggestions, opportunities)
 * - Composition tips
 */

import { getCompositionState } from '../../../state/compositionState.js';
import { getCurrentKey } from '../../../state/trainerState.js';
import {
    detectAllPatterns,
    getTopPatterns,
    PATTERN_CATEGORIES
} from '../../../analysis/patternDetection.js';
import { HarmonyAnalyzer } from '../../../analysis/harmonyAnalyzer.js';
import { detectAllObservations } from '../../../teaching/coachEngine/detectors/index.js';
import { generateAllSuggestions } from '../../../teaching/coachEngine/generators/index.js';
import { scanAllOpportunities } from '../../../teaching/coachEngine/scanners/opportunityScanner.js';
import { COACH_ITEM_TYPES } from '../../../teaching/coachEngine/types.js';

/**
 * Render the Theory panel content
 * @param {HTMLElement} container - The container element to render into
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onClose - Called when close button is clicked
 * @param {Function} callbacks.getChords - Returns array of chords from composition state
 */
export function renderTheoryPanel(container, callbacks = {}) {
    const { onClose, getChords } = callbacks;

    const compState = getCompositionState();
    // Get key from trainerState (the single source of truth for current key)
    const rawKey = getCurrentKey() || 'C';
    const mode = compState?.getSettings?.()?.mode || 'major';
    // Handle keys that already have 'm' suffix (e.g., "Bbm" should display as "Bb Minor", not "Bbm Major")
    const keyEndsWithMinor = rawKey.endsWith('m') && rawKey.length > 1 && !rawKey.endsWith('dim');
    const key = keyEndsWithMinor ? rawKey.slice(0, -1) : rawKey;
    const keyDisplay = keyEndsWithMinor
        ? `${key} Minor`
        : `${rawKey} ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;

    // Get progression data for analysis
    const progressionData = compState?.exportToProgressionData?.() || [];
    const chords = getChords ? getChords(compState) : _getChords(compState);

    // Run pattern detection
    let analysisData = null;
    if (progressionData.length >= 2) {
        analysisData = _analyzeProgression(progressionData, key);
    }

    container.innerHTML = `
        <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 border-b border-yellow-600">
            <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Theory Insights</span>
            <button class="fs-panel-close-btn p-1 rounded-full hover:bg-white/20 transition-colors" title="Close panel">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>
        <div class="p-2 overflow-y-auto" style="height: calc(100% - 40px);">
            <div class="text-[10px] text-gray-500 mb-1.5">Key: ${keyDisplay} • ${chords.length} chord${chords.length !== 1 ? 's' : ''}</div>
            <div id="fs-theory-content" class="space-y-1.5">
                ${chords.length < 2
                    ? '<div class="text-gray-400 text-sm text-center py-4">Add at least 2 chords to see theory analysis</div>'
                    : _generateTheoryInsights(analysisData, chords, key)
                }
            </div>
        </div>
    `;

    // Close button handler
    container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
        if (onClose) onClose();
    });
}

/**
 * Get chords from composition state
 * @private
 */
function _getChords(compState) {
    const segments = compState?.getChordSegments?.() || [];
    return segments.map(seg => seg.chord).filter(Boolean);
}

/**
 * Analyze the progression using pattern detection
 * @private
 */
function _analyzeProgression(progressionData, key) {
    try {
        // Run pattern detection
        const patterns = detectAllPatterns(progressionData, key);
        const topPatterns = getTopPatterns(patterns, 8); // Get top 8 patterns

        // Use HarmonyAnalyzer for named progressions
        const harmonyAnalyzer = new HarmonyAnalyzer();
        const namedProgressions = harmonyAnalyzer.detectCommonPatterns(progressionData, key);

        // Get harmonic rhythm analysis
        const harmonicRhythm = _analyzeHarmonicRhythm(progressionData);

        // Analyze chord function distribution
        const functionAnalysis = _analyzeChordFunctions(progressionData, key);

        // Get coach engine insights (progression-wide observations, suggestions, opportunities)
        const coachInsights = _getCoachInsights(progressionData, key);

        return {
            topPatterns,
            namedProgressions,
            harmonicRhythm,
            functionAnalysis,
            coachInsights,
            chordCount: progressionData.length
        };
    } catch (e) {
        console.warn('[Theory] Analysis error:', e);
        return null;
    }
}

/**
 * Analyze harmonic rhythm (how often chords change)
 * @private
 */
function _analyzeHarmonicRhythm(progressionData) {
    if (!progressionData || progressionData.length === 0) return null;

    const beatDurations = progressionData.map(c => c.beats || 4);
    const totalBeats = beatDurations.reduce((a, b) => a + b, 0);
    const avgBeats = totalBeats / progressionData.length;

    let rhythmType = 'moderate';
    let description = '';

    if (avgBeats <= 2) {
        rhythmType = 'fast';
        description = 'Quick harmonic changes create energy and momentum';
    } else if (avgBeats <= 4) {
        rhythmType = 'moderate';
        description = 'Balanced pacing allows melodies to breathe';
    } else {
        rhythmType = 'slow';
        description = 'Extended harmonies create space for development';
    }

    return { avgBeats, rhythmType, description, totalBeats };
}

/**
 * Analyze chord function distribution (tonic, subdominant, dominant)
 * @private
 */
function _analyzeChordFunctions(progressionData, key) {
    const functions = { tonic: 0, subdominant: 0, dominant: 0, chromatic: 0 };
    const harmonyAnalyzer = new HarmonyAnalyzer();

    progressionData.forEach(chord => {
        const roman = harmonyAnalyzer.getRomanNumeral(chord, key);
        const upperRoman = roman?.toUpperCase().replace(/[^IViv]/g, '') || '';

        if (['I', 'VI', 'III'].includes(upperRoman)) {
            functions.tonic++;
        } else if (['IV', 'II'].includes(upperRoman)) {
            functions.subdominant++;
        } else if (['V', 'VII'].includes(upperRoman)) {
            functions.dominant++;
        } else {
            functions.chromatic++;
        }
    });

    const total = progressionData.length;
    return {
        tonic: Math.round((functions.tonic / total) * 100),
        subdominant: Math.round((functions.subdominant / total) * 100),
        dominant: Math.round((functions.dominant / total) * 100),
        chromatic: Math.round((functions.chromatic / total) * 100)
    };
}

/**
 * Get coach engine insights (observations, suggestions, opportunities)
 * Filters to only progression-wide items (not chord-specific)
 * @private
 */
function _getCoachInsights(progressionData, key) {
    if (!progressionData || progressionData.length < 2) {
        return { observations: [], suggestions: [], opportunities: [] };
    }

    try {
        // Build context for coach engine
        const context = {
            progression: progressionData,
            key: key,
            mode: key?.endsWith('m') && !key?.endsWith('dim') ? 'minor' : 'major'
        };

        // Run all detectors, generators, and scanners
        const allObservations = detectAllObservations(context);
        const allSuggestions = generateAllSuggestions(context);
        const allOpportunities = scanAllOpportunities(context);

        // Filter to progression-wide items for Theory Panel display
        //
        // These are patterns that describe the OVERALL progression character,
        // not just what happens at a specific chord. Chord-specific items
        // (cadences, borrowed chords, secondary dominants, etc.) show on
        // chord badges when clicked; these provide a summary view.
        //
        // OBSERVATIONS that describe progression-wide patterns:
        const progressionWideObservations = [
            // Sequences spanning multiple chords
            'circle-of-fifths',       // e.g., Am → Dm → G → C
            'harmonic-sequence',      // Repeated interval patterns
            'ostinato-pattern',       // Repetition patterns
            'palindromic-progression', // Symmetrical progressions
            // Voice leading & texture assessments (overall quality)
            'smooth-voice-leading',   // Overall VL quality score
            'chromatic-bass-line',    // Bass line spanning multiple chords
            'chromatic-voice-motion', // Voice motion across progression
            'pedal-point',            // Sustained note across chords
            // Tension arc (describes overall shape)
            'tension-climax'          // Peak tension point
            // NOTE: The following are CHORD-SPECIFIC and show on chord badges:
            // - parallel-harmony (shows on chords involved in parallel motion)
            // - retrogression (shows on the chord where backwards motion occurs)
            // - dorian-pattern, mixolydian-pattern (shows on the modal chord pair)
            // - chromatic-mediant (shows on the mediant chord)
            // - tritone-substitution (shows on the substituted chord)
            // - chromatic-dominant-approach (shows on the approaching chord)
            // - harmonic-rhythm-change (shows on chord where rhythm changes)
        ];

        // SUGGESTIONS that apply to the whole progression:
        const progressionWideSuggestions = [
            'vary-harmonic-rhythm'
        ];

        // OPPORTUNITIES (all are progression-wide by nature):
        const progressionWideOpportunities = [
            'no-borrowed-chords', 'no-cadence', 'no-secondary-dominants',
            'flat-tension', 'bass-always-root', 'no-extensions', 'function-imbalance'
        ];

        const progressionWideIds = [
            ...progressionWideObservations,
            ...progressionWideSuggestions,
            ...progressionWideOpportunities
        ];

        const isProgressionWide = (item) => {
            // Items explicitly marked as progression-wide by ID
            if (progressionWideIds.includes(item.id)) return true;
            // Opportunities are always progression-wide
            if (item.type === COACH_ITEM_TYPES.OPPORTUNITY) return true;
            return false;
        };

        return {
            observations: allObservations.filter(isProgressionWide),
            suggestions: allSuggestions.filter(isProgressionWide),
            opportunities: allOpportunities // All opportunities are progression-wide
        };
    } catch (e) {
        console.warn('[Theory] Coach insights error:', e);
        return { observations: [], suggestions: [], opportunities: [] };
    }
}

/**
 * Generate the HTML for theory insights
 * @private
 */
function _generateTheoryInsights(analysisData, chords, key) {
    if (!analysisData) {
        return `
            <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                <div class="text-sm text-gray-500">Keep adding chords to unlock insights!</div>
            </div>
        `;
    }

    let html = '';

    // Named Progressions Section
    if (analysisData.namedProgressions && analysisData.namedProgressions.length > 0) {
        html += `
            <div class="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-2">
                <div class="flex items-center gap-1.5 mb-1.5">
                    <span class="text-sm">🎼</span>
                    <span class="font-semibold text-purple-800 text-xs">Named Progressions</span>
                </div>
                <div class="space-y-1">
                    ${analysisData.namedProgressions.slice(0, 3).map(prog => `
                        <div class="bg-white/60 rounded px-2 py-1">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-medium text-purple-700 text-xs">${prog.name || prog.pattern}</span>
                                ${prog.matches ? `<span class="text-[10px] text-purple-400">m.${prog.matches[0] + 1}</span>` : ''}
                                ${prog.pattern ? `<span class="text-[10px] text-purple-500 font-mono">${prog.pattern.join('-')}</span>` : ''}
                            </div>
                            ${prog.description ? `<div class="text-[10px] text-purple-600/80 mt-0.5 leading-tight">${prog.description}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Detected Patterns Section
    if (analysisData.topPatterns && analysisData.topPatterns.length > 0) {
        html += `
            <div class="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-2">
                <div class="flex items-center gap-1.5 mb-1">
                    <span class="text-sm">🔍</span>
                    <span class="font-semibold text-amber-800 text-xs">Detected Patterns</span>
                </div>
                <div class="space-y-0.5">
                    ${analysisData.topPatterns.slice(0, 5).map(pattern => {
                        const category = PATTERN_CATEGORIES[pattern.category];
                        const color = category?.color || '#6b7280';
                        const icon = category?.icon || '•';
                        const displayName = pattern.fullName || pattern.name || pattern.type;

                        return `
                            <div class="flex items-start gap-1.5 bg-white/60 rounded px-2 py-1">
                                <span class="text-xs leading-none mt-0.5">${icon}</span>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <span class="font-medium text-xs" style="color: ${color}">${displayName}</span>
                                        ${pattern.positions ? `<span class="text-[10px] text-gray-400">m.${pattern.positions[0] + 1}</span>` : ''}
                                    </div>
                                    ${pattern.description ? `<div class="text-[10px] text-gray-500 leading-tight truncate">${pattern.description}</div>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // Harmonic Rhythm Analysis
    if (analysisData.harmonicRhythm) {
        const hr = analysisData.harmonicRhythm;
        const rhythmColors = {
            fast: { bg: 'from-red-50 to-orange-50', border: 'border-red-200', text: 'text-red-700', icon: '⚡' },
            moderate: { bg: 'from-green-50 to-emerald-50', border: 'border-green-200', text: 'text-green-700', icon: '🎵' },
            slow: { bg: 'from-blue-50 to-cyan-50', border: 'border-blue-200', text: 'text-blue-700', icon: '🌊' }
        };
        const colors = rhythmColors[hr.rhythmType];

        html += `
            <div class="bg-gradient-to-r ${colors.bg} border ${colors.border} rounded-lg p-2">
                <div class="flex items-center gap-1.5">
                    <span class="text-sm">${colors.icon}</span>
                    <span class="font-semibold ${colors.text} text-xs">Harmonic Rhythm: ${hr.rhythmType.charAt(0).toUpperCase() + hr.rhythmType.slice(1)}</span>
                    <span class="text-[10px] text-gray-400 ml-auto">${hr.avgBeats.toFixed(1)} beats/chord</span>
                </div>
                <div class="text-[10px] text-gray-600 mt-0.5">${hr.description}</div>
            </div>
        `;
    }

    // Chord Function Distribution
    if (analysisData.functionAnalysis) {
        const fa = analysisData.functionAnalysis;
        html += `
            <div class="bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200 rounded-lg p-2">
                <div class="flex items-center gap-1.5 mb-1">
                    <span class="text-sm">📊</span>
                    <span class="font-semibold text-slate-700 text-xs">Harmonic Function Balance</span>
                </div>
                <div class="flex gap-0.5 h-3 rounded-full overflow-hidden bg-gray-200">
                    ${fa.tonic > 0 ? `<div class="bg-blue-500" style="width: ${fa.tonic}%" title="Tonic ${fa.tonic}%"></div>` : ''}
                    ${fa.subdominant > 0 ? `<div class="bg-amber-500" style="width: ${fa.subdominant}%" title="Subdominant ${fa.subdominant}%"></div>` : ''}
                    ${fa.dominant > 0 ? `<div class="bg-red-500" style="width: ${fa.dominant}%" title="Dominant ${fa.dominant}%"></div>` : ''}
                    ${fa.chromatic > 0 ? `<div class="bg-purple-500" style="width: ${fa.chromatic}%" title="Chromatic ${fa.chromatic}%"></div>` : ''}
                </div>
                <div class="flex justify-between text-[9px] text-gray-500 mt-0.5">
                    <span class="flex items-center gap-0.5"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>T ${fa.tonic}%</span>
                    <span class="flex items-center gap-0.5"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>S ${fa.subdominant}%</span>
                    <span class="flex items-center gap-0.5"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>D ${fa.dominant}%</span>
                    ${fa.chromatic > 0 ? `<span class="flex items-center gap-0.5"><span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>C ${fa.chromatic}%</span>` : ''}
                </div>
            </div>
        `;
    }

    // Coach Insights Section (progression-wide observations and suggestions from coach engine)
    if (analysisData.coachInsights) {
        const { observations, suggestions, opportunities } = analysisData.coachInsights;
        const allInsights = [...observations, ...suggestions, ...opportunities];

        if (allInsights.length > 0) {
            html += `
                <div class="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-2">
                    <div class="flex items-center gap-1.5 mb-1.5">
                        <span class="text-sm">🎓</span>
                        <span class="font-semibold text-indigo-800 text-xs">Coach Insights</span>
                    </div>
                    <div class="space-y-1.5">
                        ${allInsights.slice(0, 5).map(insight => _renderCoachInsight(insight)).join('')}
                    </div>
                </div>
            `;
        }
    }

    // Composition Tips based on analysis
    const tips = _generateCompositionTips(analysisData, chords, key);
    if (tips.length > 0) {
        html += `
            <div class="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-2">
                <div class="flex items-center gap-1.5 mb-1">
                    <span class="text-sm">💡</span>
                    <span class="font-semibold text-emerald-800 text-xs">Suggestions</span>
                </div>
                <div class="space-y-0.5">
                    ${tips.map(tip => `
                        <div class="text-[10px] text-emerald-700 flex items-start gap-1">
                            <span class="text-emerald-500">→</span>
                            <span>${tip}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    return html || `
        <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
            <div class="text-sm text-gray-500">Analysis complete - add more chords for deeper insights!</div>
        </div>
    `;
}

/**
 * Generate composition tips based on analysis
 * @private
 */
function _generateCompositionTips(analysisData, chords, key) {
    const tips = [];
    const fa = analysisData.functionAnalysis;
    const hr = analysisData.harmonicRhythm;

    // Balance suggestions
    if (fa.dominant < 15 && chords.length >= 4) {
        tips.push('Consider adding a V chord for stronger resolution');
    }
    if (fa.tonic > 60) {
        tips.push('Try varying chord functions - your progression is tonic-heavy');
    }
    if (fa.chromatic > 30) {
        tips.push('Great chromatic color! Consider resolving to diatonic chords for contrast');
    }

    // Rhythm suggestions
    if (hr.rhythmType === 'fast' && chords.length > 8) {
        tips.push('Consider longer chord durations to let harmonies breathe');
    }
    if (hr.rhythmType === 'slow' && chords.length < 4) {
        tips.push('Try adding more harmonic movement for interest');
    }

    // Pattern-based suggestions
    if (!analysisData.namedProgressions || analysisData.namedProgressions.length === 0) {
        if (chords.length >= 4) {
            tips.push('Try a classic ii-V-I or I-V-vi-IV progression for familiarity');
        }
    }

    // Check for lack of cadences
    const hasCadence = analysisData.topPatterns?.some(p =>
        ['PAC', 'HC', 'DC', 'PC'].includes(p.type)
    );
    if (!hasCadence && chords.length >= 3) {
        tips.push('End phrases with a cadence (V→I or IV→I) for closure');
    }

    return tips.slice(0, 3); // Limit to 3 tips
}

/**
 * Render a single coach insight item
 * @private
 */
function _renderCoachInsight(insight) {
    // Get the message for simple skill level (or fallback)
    let message = '';
    if (typeof insight.message === 'object') {
        message = insight.message.simple || insight.message.intermediate || 'Interesting pattern detected!';
    } else if (typeof insight.message === 'string') {
        message = insight.message;
    }

    // Interpolate data placeholders
    if (insight.data && typeof message === 'string') {
        message = message.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return insight.data[key] !== undefined ? insight.data[key] : match;
        });
    }

    // Extract location information from insight data
    const locationInfo = _getInsightLocation(insight);

    // Determine styling based on type
    const typeStyles = {
        [COACH_ITEM_TYPES.OBSERVATION]: {
            bg: 'bg-emerald-100/60',
            border: 'border-emerald-300',
            text: 'text-emerald-800',
            label: 'Noticed',
            labelBg: 'bg-emerald-500'
        },
        [COACH_ITEM_TYPES.SUGGESTION]: {
            bg: 'bg-purple-100/60',
            border: 'border-purple-300',
            text: 'text-purple-800',
            label: 'Try This',
            labelBg: 'bg-purple-500'
        },
        [COACH_ITEM_TYPES.OPPORTUNITY]: {
            bg: 'bg-amber-100/60',
            border: 'border-amber-300',
            text: 'text-amber-800',
            label: 'Explore',
            labelBg: 'bg-amber-500'
        }
    };

    const style = typeStyles[insight.type] || typeStyles[COACH_ITEM_TYPES.OBSERVATION];
    const emoji = insight.emoji || '💡';
    const title = insight.title || 'Insight';

    return `
        <div class="${style.bg} border ${style.border} rounded px-2 py-1.5">
            <div class="flex items-start gap-1.5">
                <span class="text-sm leading-none">${emoji}</span>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="font-medium text-xs ${style.text}">${title}</span>
                        <span class="text-[8px] px-1.5 py-0.5 rounded-full text-white ${style.labelBg}">${style.label}</span>
                        ${locationInfo ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-mono">${locationInfo}</span>` : ''}
                    </div>
                    <div class="text-[10px] ${style.text} opacity-80 leading-tight mt-0.5">${message}</div>
                    ${insight.data?.suggestion ? `
                        <div class="text-[10px] ${style.text} opacity-70 italic mt-0.5">💡 ${insight.data.suggestion}</div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Extract location information from insight data for display
 * @param {Object} insight - Coach insight item
 * @returns {string|null} Human-readable location string or null
 * @private
 */
function _getInsightLocation(insight) {
    const data = insight?.data;
    if (!data) return null;

    // For tension climax - use the position field if available, or build from peakIndex
    if (data.position) {
        return data.position;
    }

    // For patterns with a peak index (tension climax)
    if (typeof data.peakIndex === 'number') {
        const chordInfo = data.peakChord ? ` (${data.peakChord})` : '';
        return `chord ${data.peakIndex + 1}${chordInfo}`;
    }

    // For patterns with a start index (sequences, pedal points, chromatic bass, parallel harmony)
    if (typeof data.startIndex === 'number') {
        const endIndex = data.endIndex ?? data.startIndex;
        if (endIndex > data.startIndex) {
            return `chords ${data.startIndex + 1}-${endIndex + 1}`;
        }
        return `chord ${data.startIndex + 1}`;
    }

    // For patterns with a single chord index
    if (typeof data.chordIndex === 'number') {
        return `chord ${data.chordIndex + 1}`;
    }

    // For patterns with chord indices array
    if (Array.isArray(data.chordIndices) && data.chordIndices.length > 0) {
        if (data.chordIndices.length === 1) {
            return `chord ${data.chordIndices[0] + 1}`;
        }
        const first = data.chordIndices[0] + 1;
        const last = data.chordIndices[data.chordIndices.length - 1] + 1;
        return `chords ${first}-${last}`;
    }

    return null;
}
