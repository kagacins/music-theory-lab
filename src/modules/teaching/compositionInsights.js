/**
 * Composition Insights Module
 * Phase 4 of Tier 1: Teaching-Composition Integration
 *
 * Analyzes user composition patterns and provides personalized recommendations.
 */

import {
    getInsightsData,
    addCompositionToHistory,
    getAggregateStats,
    calculateUsagePercentages,
    clearInsightsData
} from './insightsStorage.js';

// ============================================================================
// STATE
// ============================================================================

let isInitialized = false;
let currentDashboard = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the Composition Insights system
 */
export function initCompositionInsights() {
    if (isInitialized) return;

    // Listen for progression events to track
    window.addEventListener('progressionUpdated', handleProgressionUpdate);
    window.addEventListener('progressionExported', handleProgressionExported);
    window.addEventListener('progressionSaved', handleProgressionSaved);

    // Expose global functions
    window.showCompositionInsights = showInsightsDashboard;
    window.hideCompositionInsights = hideInsightsDashboard;
    window.clearCompositionInsights = clearInsightsData;

    isInitialized = true;
    console.log('[CompositionInsights] Initialized');
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle progression update events
 * Track all activity including unsaved work
 */
function handleProgressionUpdate(event) {
    // Track at intervals to avoid excessive writes
    // We'll do this on export/save instead for cleaner data
}

/**
 * Handle progression export
 */
function handleProgressionExported(event) {
    trackCurrentProgression('export');
}

/**
 * Handle progression save
 */
function handleProgressionSaved(event) {
    trackCurrentProgression('save');
}

/**
 * Track the current progression
 * @param {string} source - Where the track was triggered from
 */
function trackCurrentProgression(source) {
    const trainerState = window.getTrainerState ? window.getTrainerState() : null;
    if (!trainerState || !trainerState.progressionData || trainerState.progressionData.length === 0) {
        return;
    }

    const snapshot = createCompositionSnapshot(trainerState, source);
    addCompositionToHistory(snapshot);

    console.log('[CompositionInsights] Tracked composition:', source);
}

/**
 * Create a composition snapshot from trainer state
 * @param {Object} trainerState - Current trainer state
 * @param {string} source - Source of tracking
 * @returns {Object} Composition snapshot
 */
function createCompositionSnapshot(trainerState, source) {
    const progression = trainerState.progressionData || [];

    // Calculate voice leading score if available
    let voiceLeadingScore = null;
    if (window.calculateProgressionVoiceLeading) {
        try {
            const vlResult = window.calculateProgressionVoiceLeading(progression);
            voiceLeadingScore = vlResult?.averageScore;
        } catch (e) {
            // Voice leading calculation not available
        }
    }

    // Detect patterns
    const patterns = detectPatterns(progression, trainerState.currentKey);

    return {
        key: trainerState.currentKey,
        chords: progression.map(chord => ({
            root: chord.root,
            type: chord.type,
            roman: chord.roman || chord.romanNumeral,
            inversion: chord.inversion
        })),
        chordCount: progression.length,
        patterns,
        voiceLeadingScore,
        source
    };
}

/**
 * Detect patterns in a progression
 * @param {Array} progression - Chord progression
 * @param {string} key - Current key
 * @returns {Object} Detected patterns
 */
function detectPatterns(progression, key) {
    const patterns = {
        deceptiveCadences: 0,
        plagalCadences: 0,
        perfectCadences: 0,
        borrowedChords: 0,
        secondaryDominants: 0
    };

    for (let i = 0; i < progression.length; i++) {
        const chord = progression[i];
        const romanRaw = chord.roman || chord.romanNumeral || '';
        const roman = romanRaw.toUpperCase();

        // Check borrowed chords (flat prefix like bVII, bVI, bIII)
        // Must check BEFORE toUpperCase since 'b' becomes 'B'
        // Check both ASCII 'b' and Unicode '♭'
        const hasFlatPrefix = romanRaw.startsWith('b') || romanRaw.startsWith('♭');
        const hasSharpPrefix = romanRaw.startsWith('#') || romanRaw.startsWith('♯');
        if (hasFlatPrefix || hasSharpPrefix) {
            patterns.borrowedChords++;
        }

        // Check secondary dominants
        if (roman.includes('/')) {
            patterns.secondaryDominants++;
        }

        // Check cadences (need previous chord)
        if (i > 0) {
            const prevRoman = (progression[i-1].roman || progression[i-1].romanNumeral || '').toUpperCase();

            // V -> vi = deceptive
            if ((prevRoman === 'V' || prevRoman === 'V7') && roman === 'VI') {
                patterns.deceptiveCadences++;
            }

            // IV -> I = plagal
            if (prevRoman === 'IV' && roman === 'I') {
                patterns.plagalCadences++;
            }

            // V -> I = perfect
            if ((prevRoman === 'V' || prevRoman === 'V7') && roman === 'I') {
                patterns.perfectCadences++;
            }
        }
    }

    return patterns;
}

// ============================================================================
// INSIGHTS GENERATION
// ============================================================================

/**
 * Generate insights based on user's composition history
 * @returns {Array} Array of insight objects
 */
export function generateInsights() {
    const stats = getAggregateStats();
    const insights = [];

    if (stats.totalProgressions < 3) {
        insights.push({
            type: 'welcome',
            title: 'Building Your Profile',
            message: `You've created ${stats.totalProgressions} progression(s). Keep composing to unlock personalized insights!`,
            icon: '🎵',
            color: '#6366f1'
        });
        return insights;
    }

    // Analyze chord vocabulary
    const chordVocabInsight = analyzeChordVocabulary(stats);
    if (chordVocabInsight) insights.push(chordVocabInsight);

    // Analyze harmonic adventure
    const adventureInsight = analyzeHarmonicAdventure(stats);
    if (adventureInsight) insights.push(adventureInsight);

    // Analyze key preferences
    const keyInsight = analyzeKeyPreferences(stats);
    if (keyInsight) insights.push(keyInsight);

    // Analyze voice leading
    const voiceLeadingInsight = analyzeVoiceLeading(stats);
    if (voiceLeadingInsight) insights.push(voiceLeadingInsight);

    // Add encouraging insight if no issues
    if (insights.length === 0) {
        insights.push({
            type: 'great-job',
            title: 'Balanced Composer',
            message: 'Your composition habits show great variety! Keep exploring.',
            icon: '⭐',
            color: '#22c55e',
            score: 100
        });
    }

    return insights;
}

/**
 * Analyze chord vocabulary diversity
 */
function analyzeChordVocabulary(stats) {
    const usage = calculateUsagePercentages(stats.chordTypeUsage);
    const totalChords = Object.values(stats.chordTypeUsage).reduce((s, c) => s + c, 0);

    if (totalChords === 0) return null;

    // Calculate diversity (number of different types used)
    const typesUsed = Object.keys(stats.chordTypeUsage).length;

    // Check if dominated by triads
    const triadTypes = ['Major', 'Minor', 'Diminished', 'Augmented'];
    const triadCount = triadTypes.reduce((sum, type) =>
        sum + (stats.chordTypeUsage[type] || 0), 0);
    const triadPercentage = Math.round((triadCount / totalChords) * 100);

    if (triadPercentage > 85) {
        return {
            type: 'chord-vocabulary',
            title: 'Expand Your Chord Palette',
            message: `${triadPercentage}% of your chords are basic triads. Try adding some 7th chords for richer harmony!`,
            icon: '🎹',
            color: '#f59e0b',
            score: 100 - triadPercentage + 15,
            action: {
                label: 'Learn 7th Chords',
                lessonId: 'seventh-chords'
            }
        };
    }

    if (typesUsed < 4) {
        return {
            type: 'chord-vocabulary',
            title: 'Chord Variety',
            message: `You've used ${typesUsed} different chord types. There's a whole world of extensions and alterations to explore!`,
            icon: '🎹',
            color: '#f59e0b',
            score: typesUsed * 20,
            action: {
                label: 'Explore Chord Types',
                lessonId: 'chord-types'
            }
        };
    }

    return null;
}

/**
 * Analyze harmonic adventure (borrowed chords, secondary dominants, etc.)
 */
function analyzeHarmonicAdventure(stats) {
    const totalChords = Object.values(stats.chordTypeUsage).reduce((s, c) => s + c, 0);
    if (totalChords === 0) return null;

    const adventureChords = stats.borrowedChordCount + stats.secondaryDominantCount;
    const adventurePercentage = Math.round((adventureChords / totalChords) * 100);

    if (adventurePercentage < 5 && stats.totalProgressions > 5) {
        return {
            type: 'harmonic-adventure',
            title: 'Try Harmonic Color',
            message: 'Your progressions stay close to home. Borrowed chords can add unexpected color and emotion!',
            icon: '🌈',
            color: '#8b5cf6',
            score: adventurePercentage * 10,
            action: {
                label: 'Learn Modal Interchange',
                lessonId: 'modal-interchange'
            }
        };
    }

    if (stats.deceptiveCadenceCount === 0 && stats.totalProgressions > 8) {
        return {
            type: 'cadence-variety',
            title: 'Surprise Your Listeners',
            message: 'You haven\'t used any deceptive cadences yet. They\'re great for adding unexpected twists!',
            icon: '😮',
            color: '#ec4899',
            score: 50,
            action: {
                label: 'Learn Deceptive Cadences',
                lessonId: 'cadences'
            }
        };
    }

    return null;
}

/**
 * Analyze key preferences
 */
function analyzeKeyPreferences(stats) {
    const usage = calculateUsagePercentages(stats.keyUsage);
    if (usage.length === 0) return null;

    // Check if dominated by one key
    const topKey = usage[0];
    if (topKey.percentage > 60 && stats.totalProgressions > 5) {
        return {
            type: 'key-variety',
            title: 'Explore New Keys',
            message: `${topKey.percentage}% of your compositions are in ${topKey.name}. Try the relative minor or a different key signature!`,
            icon: '🔑',
            color: '#3b82f6',
            score: 100 - topKey.percentage,
            action: {
                label: 'Try a New Key',
                lessonId: 'key-signatures'
            }
        };
    }

    return null;
}

/**
 * Analyze voice leading quality
 */
function analyzeVoiceLeading(stats) {
    if (stats.voiceLeadingScoreCount < 3) return null;

    const avgScore = stats.avgVoiceLeadingScore;

    if (avgScore < 60) {
        return {
            type: 'voice-leading',
            title: 'Smooth Voice Leading',
            message: `Your average voice leading score is ${avgScore}/100. Smoother connections between chords can make progressions flow better.`,
            icon: '🎼',
            color: '#14b8a6',
            score: avgScore,
            action: {
                label: 'Voice Leading Tips',
                lessonId: 'voice-leading'
            }
        };
    }

    return null;
}

// ============================================================================
// DASHBOARD UI
// ============================================================================

/**
 * Show the insights dashboard
 */
export function showInsightsDashboard() {
    // Remove existing dashboard
    hideInsightsDashboard();

    const stats = getAggregateStats();
    const insights = generateInsights();

    // Create dashboard modal
    const modal = document.createElement('div');
    modal.id = 'composition-insights-dashboard';
    modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-4';
    modal.innerHTML = createDashboardHTML(stats, insights);

    // Add styles
    addDashboardStyles();

    // Add to DOM
    document.body.appendChild(modal);
    currentDashboard = modal;

    // Setup event listeners
    modal.querySelector('.close-dashboard')?.addEventListener('click', hideInsightsDashboard);
    modal.querySelector('.clear-data-btn')?.addEventListener('click', () => {
        if (confirm('Clear all composition history? This cannot be undone.')) {
            clearInsightsData();
            hideInsightsDashboard();
            showInsightsDashboard(); // Refresh
        }
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('backdrop')) {
            hideInsightsDashboard();
        }
    });

    // Close on Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            hideInsightsDashboard();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

/**
 * Hide the insights dashboard
 */
export function hideInsightsDashboard() {
    if (currentDashboard) {
        currentDashboard.remove();
        currentDashboard = null;
    }
    document.getElementById('composition-insights-dashboard')?.remove();
}

/**
 * Create dashboard HTML
 */
function createDashboardHTML(stats, insights) {
    const chordUsage = calculateUsagePercentages(stats.chordTypeUsage);
    const keyUsage = calculateUsagePercentages(stats.keyUsage);
    const romanUsage = calculateUsagePercentages(stats.romanNumeralUsage);

    return `
        <!-- Backdrop -->
        <div class="backdrop absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

        <!-- Modal Content -->
        <div class="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onclick="event.stopPropagation()">
            <!-- Header -->
            <div class="px-6 py-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <h2 class="text-xl font-bold flex items-center gap-2">
                            <span>📊</span> Your Composition DNA
                        </h2>
                        <p class="text-sm text-white/80">Based on ${stats.totalProgressions} compositions</p>
                    </div>
                    <button class="close-dashboard p-2 hover:bg-white/20 rounded-lg transition">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Scrollable Content -->
            <div class="overflow-y-auto max-h-[calc(90vh-140px)] p-6 space-y-6">

                <!-- Insights Section -->
                <div class="space-y-4">
                    <h3 class="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <span>💡</span> Personalized Insights
                    </h3>
                    ${insights.map(insight => createInsightCard(insight)).join('')}
                </div>

                <!-- Stats Grid -->
                <div class="grid grid-cols-2 gap-4">
                    <!-- Chord Types -->
                    <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                        <h4 class="text-sm font-bold text-blue-800 mb-3">Chord Types Used</h4>
                        ${chordUsage.length > 0 ? createBarChart(chordUsage.slice(0, 5), '#3b82f6') : '<p class="text-gray-500 text-sm">No data yet</p>'}
                    </div>

                    <!-- Keys -->
                    <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                        <h4 class="text-sm font-bold text-purple-800 mb-3">Key Preferences</h4>
                        ${keyUsage.length > 0 ? createBarChart(keyUsage.slice(0, 5), '#8b5cf6') : '<p class="text-gray-500 text-sm">No data yet</p>'}
                    </div>
                </div>

                <!-- Roman Numerals -->
                <div class="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                    <h4 class="text-sm font-bold text-amber-800 mb-3">Most Used Chords (Roman Numerals)</h4>
                    ${romanUsage.length > 0 ? createHorizontalBarChart(romanUsage.slice(0, 8), '#f59e0b') : '<p class="text-gray-500 text-sm">No data yet</p>'}
                </div>

                <!-- Quick Stats -->
                <div class="grid grid-cols-4 gap-3">
                    ${createStatBadge('Progressions', stats.totalProgressions, '#6366f1')}
                    ${createStatBadge('Borrowed', stats.borrowedChordCount, '#8b5cf6')}
                    ${createStatBadge('Sec. Dominants', stats.secondaryDominantCount, '#ec4899')}
                    ${createStatBadge('Avg VL Score', stats.avgVoiceLeadingScore || '—', '#14b8a6')}
                </div>

            </div>

            <!-- Footer -->
            <div class="px-6 py-3 bg-gray-50 border-t flex items-center justify-between">
                <button class="clear-data-btn text-sm text-red-500 hover:text-red-700 transition">
                    Reset History
                </button>
                <button onclick="window.hideCompositionInsights()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition">
                    Close
                </button>
            </div>
        </div>
    `;
}

/**
 * Create insight card HTML
 */
function createInsightCard(insight) {
    const scoreBar = insight.score !== undefined ? `
        <div class="mt-2 flex items-center gap-2">
            <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500" style="width: ${insight.score}%; background: ${insight.color}"></div>
            </div>
            <span class="text-xs font-medium text-gray-500">${insight.score}%</span>
        </div>
    ` : '';

    const actionButton = insight.action ? `
        <button class="mt-3 px-3 py-1.5 text-xs font-medium rounded-lg transition" style="background: ${insight.color}15; color: ${insight.color}; border: 1px solid ${insight.color}40">
            ${insight.action.label} →
        </button>
    ` : '';

    return `
        <div class="p-4 rounded-xl border" style="background: linear-gradient(135deg, ${insight.color}08, ${insight.color}03); border-color: ${insight.color}30">
            <div class="flex items-start gap-3">
                <span class="text-2xl">${insight.icon}</span>
                <div class="flex-1">
                    <h4 class="font-bold text-gray-800">${insight.title}</h4>
                    <p class="text-sm text-gray-600 mt-1">${insight.message}</p>
                    ${scoreBar}
                    ${actionButton}
                </div>
            </div>
        </div>
    `;
}

/**
 * Create vertical bar chart HTML
 */
function createBarChart(data, color) {
    const maxCount = Math.max(...data.map(d => d.count));

    return `
        <div class="space-y-2">
            ${data.map(item => `
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-600 w-16 truncate" title="${item.name}">${item.name}</span>
                    <div class="flex-1 h-4 bg-white/50 rounded overflow-hidden">
                        <div class="h-full rounded transition-all duration-300" style="width: ${(item.count / maxCount) * 100}%; background: ${color}"></div>
                    </div>
                    <span class="text-xs font-medium text-gray-700 w-8 text-right">${item.count}</span>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Create horizontal bar chart for roman numerals
 */
function createHorizontalBarChart(data, color) {
    const maxCount = Math.max(...data.map(d => d.count));

    return `
        <div class="flex flex-wrap gap-2">
            ${data.map(item => `
                <div class="flex flex-col items-center">
                    <div class="w-10 h-16 bg-white/50 rounded-t overflow-hidden flex flex-col justify-end">
                        <div class="w-full rounded-t transition-all duration-300" style="height: ${(item.count / maxCount) * 100}%; background: ${color}"></div>
                    </div>
                    <span class="text-xs font-bold text-gray-700 mt-1">${item.name}</span>
                    <span class="text-[10px] text-gray-500">${item.count}</span>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Create stat badge HTML
 */
function createStatBadge(label, value, color) {
    return `
        <div class="bg-white rounded-lg p-3 border border-gray-200 text-center">
            <div class="text-2xl font-bold" style="color: ${color}">${value}</div>
            <div class="text-xs text-gray-500">${label}</div>
        </div>
    `;
}

/**
 * Add dashboard styles
 */
function addDashboardStyles() {
    if (document.getElementById('insights-dashboard-styles')) return;

    const style = document.createElement('style');
    style.id = 'insights-dashboard-styles';
    style.textContent = `
        #composition-insights-dashboard {
            animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

// ============================================================================
// MANUAL TRACKING
// ============================================================================

/**
 * Manually track current progression (exposed globally)
 */
export function trackProgression() {
    trackCurrentProgression('manual');
}

// Note: All functions exported inline with 'export function' declarations
