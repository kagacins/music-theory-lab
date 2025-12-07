/**
 * Unified Smart Chord Suggestions Panel
 * Combines theory-based AI recommendations with style/mood preferences
 */

import { analyzeProgression } from '../features/chordRecommendations.js';
import { getProgressionData, getCurrentKey } from '../state/trainerState.js';
import { getHarmonyAnalyzer } from '../analysis/harmonyAnalyzer.js';

/**
 * Initialize modals and event listeners for analysis features
 * (Panel removed - modals still needed for Quick Analysis Bar)
 */
export function initUnifiedSuggestionsPanel() {
    // Find and remove the old panels if they still exist
    const oldSmartPanel = document.querySelector('#recommendations-panel');
    const oldStyleMoodPanel = document.querySelector('#style-mood-insights-panel')?.closest('.trainer-section-item');
    const oldUnifiedPanel = document.querySelector('#unified-suggestions-panel')?.closest('.trainer-section-item');

    if (oldSmartPanel) oldSmartPanel.remove();
    if (oldStyleMoodPanel) oldStyleMoodPanel.remove();
    if (oldUnifiedPanel) oldUnifiedPanel.remove();

    // Create and insert modals at document body level
    insertModals();

    // Attach event listeners for modals
    attachEventListeners();
    
    console.log('Analysis modals initialized');
}


/**
 * Insert modals at document body level for proper z-index
 */
function insertModals() {
    // Check if modals already exist
    if (document.getElementById('tension-map-modal') || document.getElementById('full-analysis-modal')) {
        return; // Already inserted
    }

    const modalsHTML = `
        <!-- Harmonic Tension Map Modal -->
        <div id="tension-map-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onclick="if(event.target === this) window.closeTensionMapModal()">
            <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onclick="event.stopPropagation()">
                <div class="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"></path>
                        </svg>
                        Harmonic Tension Map
                    </h3>
                    <button onclick="window.closeTensionMapModal()" class="text-white/80 hover:text-white transition">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="p-6 overflow-y-auto" style="max-height: calc(90vh - 80px);">
                    <div class="space-y-4">
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <p class="text-sm text-gray-600">Track tension build-ups and releases throughout your progression</p>
                                <span id="modal-tension-summary" class="text-xs font-semibold text-purple-600">0% avg • 0% peak</span>
                            </div>
                            <div id="modal-tension-meter" class="h-3 bg-purple-50 border border-purple-200 rounded-full overflow-hidden flex"></div>
                            <div class="flex justify-between text-xs text-gray-400 mt-1">
                                <span>Calm</span>
                                <span>Balanced</span>
                                <span>Charged</span>
                                <span>Tense</span>
                            </div>
                        </div>
                        <div id="modal-tension-details" class="space-y-2"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Full Analysis Modal -->
        <div id="full-analysis-modal" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onclick="if(event.target === this) window.closeFullAnalysisModal()">
            <div class="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden" onclick="event.stopPropagation()">
                <div class="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4 flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path>
                            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path>
                        </svg>
                        Progression Analysis
                    </h3>
                    <button onclick="window.closeFullAnalysisModal()" class="text-white/80 hover:text-white transition">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="p-6 overflow-y-auto" style="max-height: calc(90vh - 80px);">
                    <div id="modal-full-analysis" class="space-y-4"></div>
                </div>
            </div>
        </div>
    `;

    // Insert at document body level
    document.body.insertAdjacentHTML('beforeend', modalsHTML);
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
    // Modal controls
    window.showTensionMapModal = () => {
        document.getElementById('tension-map-modal').classList.remove('hidden');
        updateTensionMap();
    };

    window.closeTensionMapModal = () => {
        document.getElementById('tension-map-modal').classList.add('hidden');
    };

    window.showFullAnalysisModal = () => {
        document.getElementById('full-analysis-modal').classList.remove('hidden');
        updateFullAnalysis();
    };

    window.closeFullAnalysisModal = () => {
        document.getElementById('full-analysis-modal').classList.add('hidden');
    };

    // Refresh suggestions
    window.refreshUnifiedSuggestions = updateUnifiedSuggestions;

    // Update on load
    window.updateUnifiedSuggestions = updateUnifiedSuggestions;
    updateUnifiedSuggestions();
}

/**
 * Update unified suggestions
 */
export function updateUnifiedSuggestions() {
    const progression = getProgressionData();
    const key = getCurrentKey();

    if (!progression || !key) return;

    updateQuickAnalysis(progression, key);
}

/**
 * Update quick analysis bar
 */
function updateQuickAnalysis(progression, key) {
    // Get elements from both trainer tab and melody tab
    const romanNumeralsEl = document.getElementById('quick-roman-numerals');
    const moodEl = document.getElementById('quick-mood');
    const tensionEl = document.getElementById('quick-tension');
    const romanNumeralsMelodyEl = document.getElementById('quick-roman-numerals-melody');
    const moodMelodyEl = document.getElementById('quick-mood-melody');
    const tensionMelodyEl = document.getElementById('quick-tension-melody');

    // Return early if no elements exist at all
    const hasTrainerElements = romanNumeralsEl && moodEl && tensionEl;
    const hasMelodyElements = romanNumeralsMelodyEl && moodMelodyEl && tensionMelodyEl;
    if (!hasTrainerElements && !hasMelodyElements) {
        return;
    }

    if (progression.length === 0) {
        if (hasTrainerElements) {
            romanNumeralsEl.textContent = '—';
            moodEl.textContent = '—';
            tensionEl.textContent = '—';
        }
        if (hasMelodyElements) {
            romanNumeralsMelodyEl.textContent = '—';
            moodMelodyEl.textContent = '—';
            tensionMelodyEl.textContent = '—';
        }
        return;
    }

    const analysis = analyzeProgression(progression, key);

    // Roman numerals (show all, or last 8 if too long)
    const maxToShow = 8;
    const romansToShow = analysis.romanNumerals.length > maxToShow
        ? analysis.romanNumerals.slice(-maxToShow)
        : analysis.romanNumerals;
    const romans = romansToShow.join(' - ');

    // Mood with emoji
    const moodEmoji = getMoodEmoji(analysis.mood);
    const moodText = `${moodEmoji} ${analysis.mood}`;

    // Calculate average HARMONIC tension (NOT voice leading)
    // Use the same tension curve calculation for consistency - inversions don't affect harmonic tension
    let avgTension = 0;
    if (analysis.tensionCurve && analysis.tensionCurve.length > 0) {
        const sum = analysis.tensionCurve.reduce((acc, val) => acc + val, 0);
        avgTension = Math.round(sum / analysis.tensionCurve.length);
    }
    const tensionText = `${avgTension}%`;

    // Update trainer tab elements
    if (hasTrainerElements) {
        romanNumeralsEl.textContent = romans;
        moodEl.textContent = moodText;
        tensionEl.textContent = tensionText;
    }

    // Update melody tab elements
    if (hasMelodyElements) {
        romanNumeralsMelodyEl.textContent = romans;
        moodMelodyEl.textContent = moodText;
        tensionMelodyEl.textContent = tensionText;
    }
}

/**
 * Update tension map in modal
 */
function updateTensionMap() {
    const progression = getProgressionData();
    const key = getCurrentKey();

    if (!progression || progression.length === 0) {
        document.getElementById('modal-tension-meter').innerHTML = '';
        document.getElementById('modal-tension-details').innerHTML = '<p class="text-sm text-gray-500 italic">Add chords to visualize tension</p>';
        return;
    }

    // Calculate tension for each chord using HarmonyAnalyzer
    const harmonyAnalyzer = getHarmonyAnalyzer();
    const tensions = harmonyAnalyzer.calculateTensionCurve(progression, key);

    const avgTension = tensions.reduce((a, b) => a + b, 0) / tensions.length;
    const maxTension = Math.max(...tensions);

    document.getElementById('modal-tension-summary').textContent = `${Math.round(avgTension)}% avg • ${Math.round(maxTension)}% peak`;

    // Build tension meter
    const meterHTML = tensions.map(tension => {
        const width = 100 / tensions.length;
        const color = tension < 25 ? 'bg-green-400' : tension < 50 ? 'bg-yellow-400' : tension < 75 ? 'bg-orange-400' : 'bg-red-500';
        return `<div class="${color}" style="width: ${width}%; height: 100%;" title="${Math.round(tension)}% tension"></div>`;
    }).join('');

    document.getElementById('modal-tension-meter').innerHTML = meterHTML;

    // Build details list
    const detailsHTML = progression.map((chord, i) => {
        const tension = tensions[i];
        const color = tension < 25 ? 'text-green-600' : tension < 50 ? 'text-yellow-600' : tension < 75 ? 'text-orange-600' : 'text-red-600';
        return `
            <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span class="text-sm font-medium">${chord.name || chord.root}</span>
                <span class="${color} text-sm font-semibold">${Math.round(tension)}%</span>
            </div>
        `;
    }).join('');

    document.getElementById('modal-tension-details').innerHTML = detailsHTML;
}

/**
 * Update full analysis in modal
 */
function updateFullAnalysis() {
    const progression = getProgressionData();
    const key = getCurrentKey();

    if (!progression || progression.length === 0 || !key) {
        document.getElementById('modal-full-analysis').innerHTML = '<p class="text-gray-500 italic">Add chords to see analysis</p>';
        return;
    }

    const analysis = analyzeProgression(progression, key);

    const stars = '⭐'.repeat(analysis.complexity) + '☆'.repeat(5 - analysis.complexity);
    const vlQuality = analysis.voiceLeadingQuality;
    const vlBars = Math.round(vlQuality / 20);
    const vlDisplay = '■'.repeat(vlBars) + '□'.repeat(5 - vlBars);

    const html = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <h4 class="font-bold text-indigo-900 mb-2">Roman Numeral Analysis</h4>
                <p class="text-2xl font-bold text-indigo-700">${analysis.romanNumerals.join(' - ')}</p>
            </div>

            ${analysis.commonName ? `
            <div class="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <h4 class="font-bold text-purple-900 mb-2">Pattern Recognition</h4>
                <p class="text-lg font-bold text-purple-700">🎵 ${analysis.commonName}</p>
                ${analysis.similarSongs.length > 0 ? `
                <p class="text-sm text-purple-600 mt-2">Examples: ${analysis.similarSongs.join(', ')}</p>
                ` : ''}
            </div>
            ` : ''}

            <div class="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 class="font-bold text-blue-900 mb-2">Mood & Character</h4>
                <p class="text-xl font-semibold">${getMoodEmoji(analysis.mood)} ${analysis.mood}</p>
            </div>

            <div class="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                <h4 class="font-bold text-cyan-900 mb-2">Complexity</h4>
                <p class="text-2xl">${stars}</p>
            </div>

            <div class="p-4 bg-teal-50 rounded-lg border border-teal-200 md:col-span-2">
                <h4 class="font-bold text-teal-900 mb-2">Voice Leading Quality</h4>
                <div class="flex items-center gap-3">
                    <span class="font-mono text-xl">${vlDisplay}</span>
                    <span class="text-teal-700 font-semibold">${vlQuality}%</span>
                </div>
                <p class="text-sm text-teal-600 mt-2">
                    ${vlQuality >= 80 ? 'Excellent - Very smooth connections' :
                      vlQuality >= 60 ? 'Good - Mostly smooth with some jumps' :
                      vlQuality >= 40 ? 'Moderate - Some large voice movements' :
                      'Challenging - Significant voice movement'}
                </p>
            </div>
        </div>
    `;

    document.getElementById('modal-full-analysis').innerHTML = html;
}

/**
 * Get emoji for mood
 */
function getMoodEmoji(mood) {
    const emojiMap = {
        'Uplifting': '😊',
        'Positive': '🙂',
        'Neutral': '😐',
        'Thoughtful': '🤔',
        'Melancholic': '😢'
    };
    return emojiMap[mood] || '🎵';
}
