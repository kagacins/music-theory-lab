/**
 * Chord Recommendations UI Panel
 * Displays intelligent chord suggestions and progression analysis
 */

import { generateChordRecommendations, analyzeProgression } from '../features/chordRecommendations.js';
import { getProgressionData, getCurrentKey } from '../state/trainerState.js';

/**
 * Initialize recommendations panel
 */
export function initRecommendationsPanel() {
    // Find the trainer sections container
    const trainerContainer = document.querySelector('#trainer-sections-container');
    if (!trainerContainer) {
        console.warn('Trainer sections container not found');
        return;
    }

    // Create and insert the recommendations panel
    const panelHTML = createRecommendationsPanelHTML();

    // Insert as the first section in the trainer container (before song search)
    trainerContainer.insertAdjacentHTML('afterbegin', panelHTML);
    attachEventListeners();

    console.log('Smart Recommendations panel initialized successfully');
}

/**
 * Create the HTML for the recommendations panel
 */
function createRecommendationsPanelHTML() {
    return `
        <!-- Smart Suggestions Panel -->
        <div class="mb-3 trainer-section-item">
            <button onclick="window.toggleRecommendationsPanel && window.toggleRecommendationsPanel()"
                    class="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-between">
                <span class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-white/70 cursor-move drag-handle" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Drag to reorder">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
                    </svg>
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                    </svg>
                    Smart Suggestions
                    <span class="text-xs bg-white/20 px-2 py-0.5 rounded-full">AI</span>
                </span>
                <svg id="recommendations-chevron" class="w-5 h-5 transform transition-transform" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                </svg>
            </button>

            <!-- Content -->
            <div id="recommendations-content" class="mt-2 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200 space-y-4">
                <!-- Progression Analysis -->
                <div id="progression-analysis" class="bg-white rounded-lg p-3 border border-purple-300">
                    <h4 class="text-sm font-bold text-purple-800 mb-2 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path>
                            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path>
                        </svg>
                        Progression Analysis
                    </h4>
                    <div id="analysis-content" class="text-sm text-gray-700 space-y-2">
                        <p class="text-gray-500 italic">Add chords to see analysis...</p>
                    </div>
                </div>

                <!-- Next Chord Suggestions -->
                <div id="next-chord-suggestions" class="bg-white rounded-lg p-3 border border-purple-300">
                    <h4 class="text-sm font-bold text-purple-800 mb-3 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clip-rule="evenodd"></path>
                        </svg>
                        What's Next?
                    </h4>
                    <div id="suggestions-list" class="space-y-2">
                        <p class="text-sm text-gray-500 italic">Add a chord to get suggestions...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
    // Toggle panel visibility
    window.toggleRecommendationsPanel = function() {
        const content = document.getElementById('recommendations-content');
        const chevron = document.getElementById('recommendations-chevron');

        if (content.classList.contains('hidden')) {
            content.classList.remove('hidden');
            chevron.classList.remove('rotate-180');
        } else {
            content.classList.add('hidden');
            chevron.classList.add('rotate-180');
        }
    };

    // Update recommendations when progression changes
    window.updateRecommendations = updateRecommendations;

    // Auto-update on progression changes (call this from progressionBuilder.js)
    updateRecommendations();
}

/**
 * Update recommendations based on current progression
 */
export function updateRecommendations() {
    const progression = getProgressionData();
    const key = getCurrentKey();

    if (!progression || !key) return;

    // Update analysis
    updateAnalysisDisplay(progression, key);

    // Update suggestions
    updateSuggestionsDisplay(progression, key);
}

/**
 * Update the analysis display
 */
function updateAnalysisDisplay(progression, key) {
    const analysisContent = document.getElementById('analysis-content');
    if (!analysisContent) return;

    if (progression.length === 0) {
        analysisContent.innerHTML = '<p class="text-gray-500 italic">Add chords to see analysis...</p>';
        return;
    }

    const analysis = analyzeProgression(progression, key);

    // Build stars for complexity
    const stars = '⭐'.repeat(analysis.complexity) + '☆'.repeat(5 - analysis.complexity);

    // Build voice leading bar
    const vlQuality = analysis.voiceLeadingQuality;
    const vlBars = Math.round(vlQuality / 20);
    const vlDisplay = '■'.repeat(vlBars) + '□'.repeat(5 - vlBars);

    const html = `
        <div class="space-y-2">
            <div class="flex items-center justify-between">
                <span class="font-medium text-gray-600">Roman Numerals:</span>
                <span class="font-bold text-purple-700">${analysis.romanNumerals.join(' - ')}</span>
            </div>

            ${analysis.commonName ? `
            <div class="p-2 bg-purple-50 rounded border border-purple-200">
                <div class="font-semibold text-purple-800">🎵 ${analysis.commonName}</div>
                ${analysis.similarSongs.length > 0 ? `
                <div class="text-xs text-purple-600 mt-1">
                    Examples: ${analysis.similarSongs.slice(0, 2).join(', ')}
                </div>
                ` : ''}
            </div>
            ` : ''}

            <div class="grid grid-cols-2 gap-2 text-xs">
                <div>
                    <span class="text-gray-600">Mood:</span>
                    <span class="ml-1 font-semibold">${getMoodEmoji(analysis.mood)} ${analysis.mood}</span>
                </div>
                <div>
                    <span class="text-gray-600">Complexity:</span>
                    <span class="ml-1">${stars}</span>
                </div>
            </div>

            <div class="text-xs">
                <span class="text-gray-600">Voice Leading:</span>
                <span class="ml-1 font-mono">${vlDisplay}</span>
                <span class="ml-1 text-gray-500">(${vlQuality}%)</span>
            </div>
        </div>
    `;

    analysisContent.innerHTML = html;
}

/**
 * Update the suggestions display
 */
function updateSuggestionsDisplay(progression, key) {
    const suggestionsList = document.getElementById('suggestions-list');
    if (!suggestionsList) return;

    const recommendations = generateChordRecommendations(progression, key);

    if (recommendations.length === 0) {
        suggestionsList.innerHTML = '<p class="text-sm text-gray-500 italic">No suggestions available</p>';
        return;
    }

    const html = recommendations.map((rec, index) => {
        const confidence = rec.confidence;
        const stars = confidence >= 90 ? '⭐⭐⭐' : confidence >= 75 ? '⭐⭐' : '⭐';

        return `
            <div class="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 hover:border-purple-400 transition-all cursor-pointer"
                 onclick="window.addRecommendedChord && window.addRecommendedChord('${rec.chord}', '${rec.type}', ${rec.inversion})">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <span class="text-lg font-bold text-purple-800">${rec.chord}${rec.type === 'minor' ? 'm' : ''}</span>
                        <span class="text-xs text-purple-600">${stars}</span>
                        <span class="text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full">${confidence}%</span>
                    </div>
                    <button class="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded transition">
                        Add →
                    </button>
                </div>

                ${rec.reasons && rec.reasons.length > 0 ? `
                <div class="space-y-1 text-xs">
                    ${rec.reasons.slice(0, 2).map(reason => `
                        <div class="flex items-start gap-1">
                            <span class="text-purple-600 mt-0.5">•</span>
                            <div>
                                <span class="font-medium text-purple-700">${reason.category.replace('_', ' ')}:</span>
                                <span class="text-gray-700">${reason.commonTalk}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ` : ''}

                ${rec.songExamples && rec.songExamples.length > 0 ? `
                <div class="mt-2 text-xs text-gray-600">
                    <span class="font-medium">Examples:</span> ${rec.songExamples.slice(0, 2).join(', ')}
                </div>
                ` : ''}
            </div>
        `;
    }).join('');

    suggestionsList.innerHTML = html;
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

/**
 * Add recommended chord to progression
 */
window.addRecommendedChord = function(root, type, inversion) {
    // This will be connected to the existing addChord function in progressionBuilder.js
    if (window.addChordFromRecommendation) {
        window.addChordFromRecommendation(root, type, inversion);
    } else {
        console.warn('addChordFromRecommendation not available');
    }
};
