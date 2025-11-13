/**
 * Unified Smart Chord Suggestions Panel
 * Combines theory-based AI recommendations with style/mood preferences
 */

import { generateUnifiedChordSuggestions, SUGGESTION_STYLES, SUGGESTION_MOODS } from '../features/unifiedChordSuggestions.js';
import { analyzeProgression, generateChordRecommendations } from '../features/chordRecommendations.js';
import { CHORD_DEFINITIONS } from '../../data/music-data.js';
import { getProgressionData, getCurrentKey, getSuggestionStyle, getSuggestionMood, setSuggestionStyle, setSuggestionMood } from '../state/trainerState.js';

/**
 * Replace both panels with a unified suggestions panel
 */
export function initUnifiedSuggestionsPanel() {
    // Find and remove the old panels
    const oldSmartPanel = document.querySelector('#recommendations-panel');
    const oldStyleMoodPanel = document.querySelector('#style-mood-insights-panel')?.closest('.trainer-section-item');

    if (oldSmartPanel) oldSmartPanel.remove();
    if (oldStyleMoodPanel) oldStyleMoodPanel.remove();

    // Find the trainer sections container
    const trainerContainer = document.querySelector('#trainer-sections-container');
    if (!trainerContainer) {
        console.warn('Trainer sections container not found');
        return;
    }

    // Check for saved section order
    let savedOrder = null;
    try {
        const saved = localStorage.getItem('sectionOrder_trainer');
        savedOrder = saved ? JSON.parse(saved) : null;
    } catch (e) {
        console.warn('Error loading section order:', e);
    }

    // Create and insert the unified panel
    const panelHTML = createUnifiedPanelHTML();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = panelHTML;
    const unifiedPanel = tempDiv.firstElementChild;

    // Create and insert modals at document body level
    insertModals();

    // Check if unified-suggestions is in the saved order
    const sectionId = 'unified-suggestions';
    if (savedOrder && savedOrder.includes(sectionId)) {
        // Find the position in saved order
        const targetIndex = savedOrder.indexOf(sectionId);
        
        // Get all existing sections
        const existingSections = Array.from(trainerContainer.children);
        const sectionMap = new Map();
        
        existingSections.forEach(section => {
            const toggle = section.querySelector('button[id$="-toggle"]');
            if (toggle) {
                const id = toggle.id.replace('-toggle', '');
                sectionMap.set(id, section);
            }
        });

        // Find the section that should come after unified-suggestions
        let insertBefore = null;
        for (let i = targetIndex + 1; i < savedOrder.length; i++) {
            const nextSectionId = savedOrder[i];
            const nextSection = sectionMap.get(nextSectionId);
            if (nextSection) {
                insertBefore = nextSection;
                break;
            }
        }

        // Insert at the correct position
        if (insertBefore) {
            trainerContainer.insertBefore(unifiedPanel, insertBefore);
        } else {
            // If no section comes after, append to end
            trainerContainer.appendChild(unifiedPanel);
        }
    } else {
        // If not in saved order, insert at the top (default position)
        trainerContainer.insertBefore(unifiedPanel, trainerContainer.firstChild);
    }

    attachEventListeners();
    
    // If there's a saved order and the unified panel is in it, trigger a reorder
    // to ensure it's in the correct position (in case drag-and-drop already ran)
    if (savedOrder && savedOrder.includes(sectionId)) {
        // Use a small delay to ensure DOM is ready, then trigger reorder
        setTimeout(() => {
            // Import and use the reorder function from sectionDragDrop if available
            // For now, we'll manually reorder by calling the same logic
            const sections = Array.from(trainerContainer.querySelectorAll('.trainer-section-item'));
            const sectionMap = new Map();
            
            sections.forEach(section => {
                const toggle = section.querySelector('button[id$="-toggle"]');
                if (toggle) {
                    const id = toggle.id.replace('-toggle', '');
                    sectionMap.set(id, section);
                }
            });

            // Reorder sections based on saved order
            savedOrder.forEach(id => {
                const section = sectionMap.get(id);
                if (section) {
                    trainerContainer.appendChild(section);
                }
            });
        }, 50);
    }
    
    console.log('Unified Smart Chord Suggestions panel initialized');
}

/**
 * Create the HTML for unified panel
 */
function createUnifiedPanelHTML() {
    return `
        <!-- Unified Smart Chord Suggestions Panel -->
        <div class="mb-3 trainer-section-item">
            <button id="unified-suggestions-toggle" onclick="window.toggleUnifiedSuggestionsPanel && window.toggleUnifiedSuggestionsPanel()"
                    class="w-full px-4 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-between">
                <span class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-white/70 cursor-move drag-handle" fill="none" stroke="currentColor" viewBox="0 0 24 24" title="Drag to reorder">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
                    </svg>
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                    </svg>
                    Smart Chord Suggestions
                    <span class="text-xs bg-white/20 px-2 py-0.5 rounded-full">AI</span>
                </span>
                <svg id="unified-suggestions-chevron" class="w-5 h-5 transform transition-transform rotate-180" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                </svg>
            </button>

            <!-- Content -->
            <div id="unified-suggestions-panel" class="mt-2 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 rounded-lg p-2.5 border border-purple-200 space-y-2">

                <!-- Quick Analysis Bar -->
                <div class="flex items-center justify-between p-2 bg-white rounded-lg border border-purple-200 shadow-sm">
                    <div class="flex items-center gap-3 flex-wrap text-xs">
                        <div class="flex items-center gap-1">
                            <span class="text-gray-600">Analysis:</span>
                            <span id="quick-roman-numerals" class="font-bold text-purple-700">—</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <span class="text-gray-600">Mood:</span>
                            <span id="quick-mood" class="font-semibold">—</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <span class="text-gray-600">Tension:</span>
                            <button onclick="window.showTensionMapModal && window.showTensionMapModal()"
                                    class="px-1.5 py-0.5 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-semibold rounded transition"
                                    title="View tension map">
                                <span id="quick-tension">—</span>
                            </button>
                        </div>
                    </div>
                    <button onclick="window.showFullAnalysisModal && window.showFullAnalysisModal()"
                            class="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded transition">
                        Details
                    </button>
                </div>

                <!-- Style & Mood Controls -->
                <div class="grid grid-cols-2 gap-2">
                    <div class="p-2 bg-white border border-indigo-200 rounded-lg">
                        <label for="unified-style-select" class="text-xs font-semibold text-indigo-800 block mb-1">Musical Style</label>
                        <select id="unified-style-select" class="w-full p-1.5 text-xs bg-white border border-indigo-200 rounded text-gray-800 focus:ring-indigo-500 focus:border-indigo-500"></select>
                    </div>
                    <div class="p-2 bg-white border border-purple-200 rounded-lg">
                        <label for="unified-mood-select" class="text-xs font-semibold text-purple-800 block mb-1">Intended Mood</label>
                        <select id="unified-mood-select" class="w-full p-1.5 text-xs bg-white border border-purple-200 rounded text-gray-800 focus:ring-purple-500 focus:border-purple-500"></select>
                    </div>
                </div>

                <!-- Suggested Next Chords -->
                <div class="bg-white rounded-lg p-2 border border-indigo-300 shadow-sm">
                    <div class="flex items-center justify-between mb-2">
                        <h4 class="text-xs font-bold text-indigo-800 flex items-center gap-1">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clip-rule="evenodd"></path>
                            </svg>
                            What's Next?
                        </h4>
                        <button onclick="window.refreshUnifiedSuggestions && window.refreshUnifiedSuggestions()"
                                class="px-2 py-0.5 text-xs font-semibold text-white bg-indigo-500 hover:bg-indigo-600 rounded transition">
                            Refresh
                        </button>
                    </div>
                    <div id="unified-suggestions-list" class="space-y-1.5">
                        <p class="text-xs text-gray-500 italic">Add chords to get intelligent suggestions...</p>
                    </div>
                </div>

            </div>
        </div>
    `;
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
    // Toggle main panel
    window.toggleUnifiedSuggestionsPanel = function() {
        const panel = document.getElementById('unified-suggestions-panel');
        const section = panel?.closest('.trainer-section-item');
        const chevron = document.getElementById('unified-suggestions-chevron');
        if (!panel || !chevron || !section) return;

        const isHidden = panel.classList.contains('hidden');
        if (isHidden) {
            // Expanding
            panel.classList.remove('hidden');
            chevron.classList.add('rotate-180');
        } else {
            // Collapsing - hide panel which will trigger MutationObserver
            panel.classList.add('hidden');
            chevron.classList.remove('rotate-180');
        }

        // Save panel state
        if (window.savePanelState) {
            window.savePanelState('unified-suggestions-panel', !isHidden);
        }

        // Manually trigger sidebar update with a small delay to ensure DOM is updated
        if (window.triggerSectionSidebarUpdate) {
            setTimeout(() => {
                window.triggerSectionSidebarUpdate('trainer', 'unified-suggestions');
            }, 50);
        }
    };

    // Initialize Style dropdown
    const styleSelect = document.getElementById('unified-style-select');
    if (styleSelect) {
        SUGGESTION_STYLES.forEach(style => {
            const option = document.createElement('option');
            option.value = style.id;
            option.textContent = style.label;
            styleSelect.appendChild(option);
        });
        styleSelect.value = getSuggestionStyle() || 'balanced';
        styleSelect.onchange = () => {
            setSuggestionStyle(styleSelect.value);
            updateUnifiedSuggestions();
        };
    }

    // Initialize Mood dropdown
    const moodSelect = document.getElementById('unified-mood-select');
    if (moodSelect) {
        SUGGESTION_MOODS.forEach(mood => {
            const option = document.createElement('option');
            option.value = mood.id;
            option.textContent = mood.label;
            moodSelect.appendChild(option);
        });
        moodSelect.value = getSuggestionMood() || 'bright';
        moodSelect.onchange = () => {
            setSuggestionMood(moodSelect.value);
            updateUnifiedSuggestions();
        };
    }

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
    updateSuggestionsList(progression, key);
}

/**
 * Update quick analysis bar
 */
function updateQuickAnalysis(progression, key) {
    const romanNumeralsEl = document.getElementById('quick-roman-numerals');
    const moodEl = document.getElementById('quick-mood');
    const tensionEl = document.getElementById('quick-tension');
    
    // Return early if elements don't exist yet
    if (!romanNumeralsEl || !moodEl || !tensionEl) {
        return;
    }
    
    if (progression.length === 0) {
        romanNumeralsEl.textContent = '—';
        moodEl.textContent = '—';
        tensionEl.textContent = '—';
        return;
    }

    const analysis = analyzeProgression(progression, key);

    // Roman numerals (show last 4)
    const romans = analysis.romanNumerals.slice(-4).join(' - ');
    romanNumeralsEl.textContent = romans;

    // Mood with emoji
    const moodEmoji = getMoodEmoji(analysis.mood);
    moodEl.textContent = `${moodEmoji} ${analysis.mood}`;

    // Calculate average tension (simplified - would integrate with existing tension calculation)
    const avgTension = Math.round(analysis.voiceLeadingQuality / 2); // Placeholder
    tensionEl.textContent = `${avgTension}%`;
}

/**
 * Update suggestions list (uses progression-aware recommendations with different roots)
 */
function updateSuggestionsList(progression, key) {
    const suggestionsList = document.getElementById('unified-suggestions-list');
    if (!suggestionsList) return;

    if (progression.length === 0) {
        suggestionsList.innerHTML = '<p class="text-sm text-gray-500 italic">Add chords to get intelligent suggestions...</p>';
        return;
    }

    // Get style and mood preferences
    const style = getSuggestionStyle() || 'balanced';
    const mood = getSuggestionMood() || 'bright';

    // Use the old recommendation system which understands keys and harmonic function
    const recommendations = generateChordRecommendations(progression, key, style, mood);

    if (recommendations.length === 0) {
        suggestionsList.innerHTML = '<p class="text-sm text-gray-500 italic">No suggestions available</p>';
        return;
    }

    const html = recommendations.map((rec) => {
        const confidence = rec.confidence;
        const stars = confidence >= 90 ? '⭐⭐⭐' : confidence >= 75 ? '⭐⭐' : '⭐';

        // Get chord symbol
        const chordSymbol = CHORD_DEFINITIONS[rec.type]?.symbol || '';
        const chordLabel = `${rec.chord}${chordSymbol}`;

        return `
            <div class="p-2 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-200 hover:border-indigo-400 hover:shadow-sm transition-all cursor-pointer group"
                 onclick="window.addChordFromUnifiedSuggestion && window.addChordFromUnifiedSuggestion('${rec.type}', '${rec.chord}', ${rec.inversion || 0})">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-base font-bold text-indigo-800">${chordLabel}</span>
                            <span class="text-xs text-indigo-600">${stars}</span>
                            <span class="text-xs bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded-full font-semibold">${confidence}%</span>
                        </div>
                        ${rec.reasons && rec.reasons.length > 0 ? `
                        <div class="text-xs text-gray-600 leading-tight">
                            ${rec.reasons[0].commonTalk}
                        </div>
                        ` : ''}
                    </div>
                    <button class="px-2 py-1 bg-indigo-600 group-hover:bg-indigo-700 text-white text-xs font-semibold rounded shadow-sm transition">
                        Add
                    </button>
                </div>
            </div>
        `;
    }).join('');

    suggestionsList.innerHTML = html;

    // Set up add chord callback
    window.addChordFromUnifiedSuggestion = (chordType, root, inversion) => {
        if (window.addChordToProgression) {
            window.addChordToProgression(chordType, root, inversion);
        }
    };
}


/**
 * Update tension map in modal
 */
function updateTensionMap() {
    // This would integrate with existing tension calculation logic
    // Placeholder implementation
    const progression = getProgressionData();

    if (!progression || progression.length === 0) {
        document.getElementById('modal-tension-meter').innerHTML = '';
        document.getElementById('modal-tension-details').innerHTML = '<p class="text-sm text-gray-500 italic">Add chords to visualize tension</p>';
        return;
    }

    // Calculate tension for each chord (simplified)
    const tensions = progression.map((chord, i) => {
        // Placeholder - would use actual tension calculation
        return Math.random() * 100;
    });

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
