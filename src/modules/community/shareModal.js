/**
 * Share Modal UI Component
 *
 * Modal for sharing compositions/progressions with the community.
 * Includes duplicate detection before showing the form.
 *
 * Supports two submission types:
 * - "chord-progression": Saves chord cards with durations/inversions, bass, sections (no melody)
 * - "full-composition": Saves everything including melody, dynamics, hairpins, slurs, etc.
 *
 * Uses a variant system for duplicate detection:
 * - Base hash: SHA-256 of chord sequence only (groups progressions into "families")
 * - Variant hash: SHA-256 including durations + inversions (identifies specific variations)
 */

import { supabase } from './supabaseClient.js';
import { isSignedIn, getCurrentUser, getAuthToken } from './authService.js';
import { generateDuplicateDetectionData, extractChordsFromComposition } from './duplicateDetection.js';
import { getCompositionState } from '../state/compositionState.js';
import { getCurrentKey } from '../state/trainerState.js';
import { DEFAULT_TIME_SIGNATURE } from '../../data/music-data.js';

// Modal state
let modalElement = null;
let tags = null;
let selectedTags = new Set();
let currentDuplicateInfo = null;

/**
 * Initialize the share modal (creates the DOM element)
 */
export function initShareModal() {
    if (modalElement) return;

    modalElement = document.createElement('div');
    modalElement.id = 'share-modal';
    modalElement.className = 'fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center p-4';
    modalElement.innerHTML = getModalHTML();
    document.body.appendChild(modalElement);

    // Close on backdrop click
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            hideShareModal();
        }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modalElement.classList.contains('hidden')) {
            hideShareModal();
        }
    });
}

/**
 * Get the modal HTML template
 */
function getModalHTML() {
    return `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-indigo-500 to-purple-600">
                <h2 class="text-xl font-bold text-white flex items-center gap-2">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                    </svg>
                    Share with Community
                </h2>
                <button id="share-modal-close" class="text-white hover:text-gray-200 transition-colors">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <!-- Content (scrollable) -->
            <div id="share-modal-content" class="flex-1 overflow-y-auto p-6">
                <!-- Loading state -->
                <div id="share-loading" class="flex flex-col items-center justify-center py-12">
                    <div class="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent mb-4"></div>
                    <p class="text-gray-600 dark:text-gray-400">Checking for similar progressions...</p>
                </div>

                <!-- Duplicate found state -->
                <div id="share-duplicate" class="hidden">
                    <!-- Filled dynamically -->
                </div>

                <!-- Share form -->
                <div id="share-form" class="hidden space-y-6">
                    <!-- Title -->
                    <div>
                        <label for="share-title" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Title <span class="text-red-500">*</span>
                        </label>
                        <input type="text" id="share-title"
                               class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                               placeholder="Give your composition a name..." maxlength="100">
                    </div>

                    <!-- Description -->
                    <div>
                        <label for="share-description" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Description
                        </label>
                        <textarea id="share-description" rows="3"
                                  class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white resize-none"
                                  placeholder="Tell others about this composition..." maxlength="500"></textarea>
                    </div>

                    <!-- Submission Type -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Submission Type <span class="text-red-500">*</span>
                        </label>
                        <div class="grid grid-cols-2 gap-3">
                            <label class="flex items-center p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/30">
                                <input type="radio" name="share-type" value="chord-progression" class="sr-only" checked>
                                <span class="flex flex-col">
                                    <span class="text-sm font-semibold text-gray-800 dark:text-white">Chord Progression</span>
                                    <span class="text-xs text-gray-500 dark:text-gray-400">Just the chord sequence</span>
                                </span>
                            </label>
                            <label class="flex items-center p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/30">
                                <input type="radio" name="share-type" value="full-composition" class="sr-only">
                                <span class="flex flex-col">
                                    <span class="text-sm font-semibold text-gray-800 dark:text-white">Full Composition</span>
                                    <span class="text-xs text-gray-500 dark:text-gray-400">Includes bass & melody</span>
                                </span>
                            </label>
                        </div>
                    </div>

                    <!-- Category -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Category <span class="text-red-500">*</span>
                        </label>
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <label class="flex items-center p-2 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/30">
                                <input type="radio" name="share-category" value="original" class="sr-only" checked>
                                <span class="text-sm text-gray-700 dark:text-gray-300">Original</span>
                            </label>
                            <label class="flex items-center p-2 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/30">
                                <input type="radio" name="share-category" value="arrangement" class="sr-only">
                                <span class="text-sm text-gray-700 dark:text-gray-300">Arrangement</span>
                            </label>
                            <label class="flex items-center p-2 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/30">
                                <input type="radio" name="share-category" value="educational" class="sr-only">
                                <span class="text-sm text-gray-700 dark:text-gray-300">Educational</span>
                            </label>
                            <label class="flex items-center p-2 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/30">
                                <input type="radio" name="share-category" value="exercise" class="sr-only">
                                <span class="text-sm text-gray-700 dark:text-gray-300">Exercise</span>
                            </label>
                            <label class="flex items-center p-2 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/30">
                                <input type="radio" name="share-category" value="analysis" class="sr-only">
                                <span class="text-sm text-gray-700 dark:text-gray-300">Analysis</span>
                            </label>
                        </div>
                    </div>

                    <!-- Attribution (for arrangements/analysis) -->
                    <div id="share-attribution" class="hidden space-y-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p class="text-sm font-semibold text-gray-700 dark:text-gray-300">Attribution (Optional)</p>
                        <div class="grid grid-cols-2 gap-3">
                            <input type="text" id="share-original-title"
                                   class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                                   placeholder="Original song title">
                            <input type="text" id="share-original-artist"
                                   class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white"
                                   placeholder="Original artist">
                        </div>
                    </div>

                    <!-- Tags -->
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Tags <span class="text-xs font-normal text-gray-500">(Select up to 10)</span>
                        </label>
                        <div id="share-tags-container" class="space-y-4">
                            <!-- Tags loaded dynamically -->
                            <div class="text-center py-4 text-gray-500">Loading tags...</div>
                        </div>
                    </div>

                    <!-- Preview -->
                    <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Preview</p>
                        <div id="share-preview" class="text-sm text-gray-600 dark:text-gray-400">
                            <!-- Filled dynamically -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div id="share-modal-footer" class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3 hidden">
                <button id="share-cancel-btn" class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                    Cancel
                </button>
                <button id="share-submit-btn" class="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-lg shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    Share
                </button>
            </div>
        </div>
    `;
}

/**
 * Create composition data for community sharing
 * Similar to projectManager.createProjectData() but tailored for community submissions
 *
 * @param {Object} compositionState - The CompositionState instance
 * @param {string} submissionType - 'chord-progression' or 'full-composition'
 * @returns {Object} Composition data to store in database
 */
function createCompositionDataForSharing(compositionState, submissionType) {
    // Get progression data from compositionState
    const progressionData = compositionState.exportToProgressionData();

    // For chord-progression: save ONLY key, chords, durations, inversions
    // This is a minimal format for sharing just the harmonic structure
    if (submissionType === 'chord-progression') {
        return {
            formatVersion: '1.1.0',
            submissionType: 'chord-progression',

            // Essential metadata
            metadata: {
                tempo: compositionState.metadata?.tempo || 120,
                timeSignature: compositionState.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE,
                key: getCurrentKey() || compositionState.metadata?.key || 'C'
            },

            // Chord progression with durations and inversions
            // Each chord has: root, type, beats, inversion, notes
            progressionData: progressionData
        };
    }

    // For full-composition: save EVERYTHING (like .imtl file)
    // Serialize BuildingBlockSequences
    const bassBlockSequence = compositionState.bassBlockSequence ?
        compositionState.bassBlockSequence.toJSON() : null;
    const trebleBlockSequence = compositionState.trebleBlockSequence ?
        compositionState.trebleBlockSequence.toJSON() : null;

    // Create full measures data
    let measuresData = [];
    if (compositionState.measures) {
        measuresData = JSON.parse(JSON.stringify(compositionState.measures));
    }

    return {
        // Format version for compatibility checking
        formatVersion: '1.1.0',
        submissionType: 'full-composition',

        // Full composition metadata
        metadata: {
            title: compositionState.metadata?.title || 'Untitled',
            composer: compositionState.metadata?.composer || '',
            tempo: compositionState.metadata?.tempo || 120,
            timeSignature: compositionState.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE,
            key: getCurrentKey() || compositionState.metadata?.key || 'C'
        },

        // Composition settings
        settings: {
            autoGenerateBass: compositionState.settings?.autoGenerateBass || false,
            voiceLeadingStrict: compositionState.settings?.voiceLeadingStrict || true,
            bassPattern: compositionState.settings?.bassPattern || 'root-fifth',
            highlightChordTones: compositionState.settings?.highlightChordTones || true,
            autoHarmonize: compositionState.settings?.autoHarmonize || false,
            showChordSpans: compositionState.settings?.showChordSpans || true
        },

        // Chord progression (chord cards with durations and inversions)
        progressionData: progressionData,

        // Song sections (verse, chorus, etc. groupings)
        sections: compositionState.exportSections ? compositionState.exportSections() : [],

        // Building block sequences
        bassBlockSequence: bassBlockSequence,
        trebleBlockSequence: trebleBlockSequence,

        // Full measures data (preserves multi-voice notation - Voice 1 & Voice 2)
        measures: measuresData,

        // Additional notation data
        tempoMarkings: compositionState.tempoMarkings ? [...compositionState.tempoMarkings] : [],
        repeatSigns: compositionState.repeatSigns ? [...compositionState.repeatSigns] : [],
        hairpins: compositionState.hairpins ? [...compositionState.hairpins] : [],
        slurs: compositionState.slurs ? [...compositionState.slurs] : [],
        voltaBrackets: compositionState.voltaBrackets ? [...compositionState.voltaBrackets] : []
    };
}

/**
 * Show the share modal and check for duplicates
 */
export async function showShareModal() {
    if (!modalElement) {
        initShareModal();
    }

    // Check if user is signed in
    if (!isSignedIn()) {
        alert('Please sign in to share with the community.');
        return;
    }

    // Reset state
    selectedTags.clear();
    currentDuplicateInfo = null;

    // Show modal with loading state
    modalElement.classList.remove('hidden');
    document.getElementById('share-loading').classList.remove('hidden');
    document.getElementById('share-duplicate').classList.add('hidden');
    document.getElementById('share-form').classList.add('hidden');
    document.getElementById('share-modal-footer').classList.add('hidden');

    // Set up close button
    document.getElementById('share-modal-close').onclick = hideShareModal;

    try {
        // Get composition data
        const compState = getCompositionState();
        const { chords, key } = extractChordsFromComposition(compState);

        if (!chords || chords.length === 0) {
            document.getElementById('share-loading').classList.add('hidden');
            document.getElementById('share-duplicate').classList.remove('hidden');
            document.getElementById('share-duplicate').innerHTML = `
                <div class="text-center py-12">
                    <div class="text-5xl mb-4">🎵</div>
                    <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-2">No Progression Found</h3>
                    <p class="text-gray-600 dark:text-gray-400 mb-6">Add some chords to your progression before sharing.</p>
                    <button onclick="window.hideShareModal && window.hideShareModal()" class="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                        Close
                    </button>
                </div>
            `;
            return;
        }

        // Generate duplicate detection data (includes both base and variant hashes)
        const dupData = await generateDuplicateDetectionData(chords, key);

        console.log('[Share] Duplicate detection data:', {
            baseHash: dupData.baseHash?.substring(0, 16) + '...',
            variantHash: dupData.variantHash?.substring(0, 16) + '...',
            normalized: dupData.normalized,
            hasCustomDurations: dupData.hasCustomDurations,
            hasInversions: dupData.hasInversions
        });

        // Check for duplicates via API (send both base and variant hashes)
        const response = await fetch('/.netlify/functions/check-duplicate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                baseHash: dupData.baseHash,
                variantHash: dupData.variantHash,
                // Legacy field for backward compatibility
                progressionHash: dupData.baseHash,
                submissionType: 'chord-progression',
                userKeySignature: key,
                hasCustomDurations: dupData.hasCustomDurations,
                hasInversions: dupData.hasInversions
            })
        });

        const result = await response.json();

        document.getElementById('share-loading').classList.add('hidden');

        if (result.isDuplicate) {
            // Show duplicate found UI (exact match on both base and variant)
            currentDuplicateInfo = result;
            showDuplicateFound(result, dupData.normalized);
        } else if (result.isVariant) {
            // Show variant warning UI (same chords but different durations/inversions)
            currentDuplicateInfo = result;
            showVariantWarning(result, dupData, key, compState);
        } else {
            // Show share form (completely new progression)
            showShareForm(dupData, key, compState);
        }

    } catch (error) {
        console.error('Error preparing share modal:', error);
        document.getElementById('share-loading').classList.add('hidden');
        document.getElementById('share-duplicate').classList.remove('hidden');
        document.getElementById('share-duplicate').innerHTML = `
            <div class="text-center py-12">
                <div class="text-5xl mb-4">⚠️</div>
                <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-2">Something went wrong</h3>
                <p class="text-gray-600 dark:text-gray-400 mb-6">${error.message || 'Unable to prepare sharing. Please try again.'}</p>
                <button onclick="window.hideShareModal && window.hideShareModal()" class="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    Close
                </button>
            </div>
        `;
    }
}

/**
 * Show the duplicate found UI
 */
function showDuplicateFound(result, normalizedProgression) {
    const match = result.matchingSubmission;
    const container = document.getElementById('share-duplicate');

    container.innerHTML = `
        <div class="text-center">
            <div class="text-5xl mb-4">🎵</div>
            <h3 class="text-2xl font-bold text-gray-800 dark:text-white mb-2">Great Minds Think Alike!</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-6">
                This chord progression has already been shared with the community.
                ${result.userKeySignature !== match.keySignature ?
                    `Even though yours is in <strong>${result.userKeySignature}</strong> and the existing one is in <strong>${match.keySignature}</strong>, they're functionally the same:` :
                    'Here\'s the existing submission:'}
            </p>

            <div class="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                <p class="text-lg font-mono text-indigo-700 dark:text-indigo-300">${normalizedProgression}</p>
            </div>

            <div class="bg-white dark:bg-gray-700 rounded-lg shadow-md p-4 mb-6 text-left">
                <div class="flex items-start gap-3">
                    ${match.author.avatarUrl ?
                        `<img src="${match.author.avatarUrl}" class="w-10 h-10 rounded-full">` :
                        `<div class="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">${match.author.displayName.charAt(0)}</div>`}
                    <div class="flex-1">
                        <h4 class="font-bold text-gray-800 dark:text-white">${match.title}</h4>
                        <p class="text-sm text-gray-500 dark:text-gray-400">by ${match.author.displayName} • ${match.upvoteCount} upvotes</p>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Key: ${match.keySignature} • ${match.tags.join(', ') || 'No tags'}</p>
                    </div>
                </div>
                <div class="flex gap-2 mt-4">
                    <button onclick="window.viewCommunitySubmission && window.viewCommunitySubmission('${match.id}')"
                            class="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-colors">
                        View Submission
                    </button>
                    <button onclick="window.loadCommunitySubmission && window.loadCommunitySubmission('${match.id}')"
                            class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded-lg text-sm font-semibold transition-colors">
                        Load into Workspace
                    </button>
                </div>
            </div>

            <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6 text-left">
                <p class="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                    <span>💡</span> Want to share something unique?
                </p>
                <ul class="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
                    <li>Add more chords to make it distinct</li>
                    <li>Try different chord qualities (e.g., Cmaj7 instead of C)</li>
                    <li>Include your own melody/bass arrangement</li>
                    <li>Share as an "Arrangement" with unique voicings</li>
                </ul>
            </div>

            <div class="flex justify-center gap-3">
                <button onclick="window.hideShareModal && window.hideShareModal()"
                        class="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    Go Back and Modify
                </button>
            </div>
        </div>
    `;

    container.classList.remove('hidden');
}

/**
 * Show variant warning UI when base progression exists but variant is unique
 * Allows user to submit as a variant of the existing progression
 */
function showVariantWarning(result, dupData, key, compState) {
    const match = result.matchingSubmission;
    const container = document.getElementById('share-duplicate');

    // Describe what makes this a variant
    const variantDetails = [];
    if (dupData.hasCustomDurations) {
        variantDetails.push('different chord durations');
    }
    if (dupData.hasInversions) {
        variantDetails.push('chord inversions');
    }
    const variantDescription = variantDetails.length > 0
        ? variantDetails.join(' and ')
        : 'different rhythmic arrangement';

    container.innerHTML = `
        <div class="text-center">
            <div class="text-5xl mb-4">🎼</div>
            <h3 class="text-2xl font-bold text-gray-800 dark:text-white mb-2">Similar Progression Found</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
                A progression with the same chord sequence already exists, but yours has <strong>${variantDescription}</strong>.
            </p>

            <div class="mb-4 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                <p class="text-lg font-mono text-indigo-700 dark:text-indigo-300">${dupData.normalized}</p>
                <p class="text-xs text-indigo-500 dark:text-indigo-400 mt-2">
                    ${dupData.hasCustomDurations ? '⏱️ Custom durations' : ''}
                    ${dupData.hasInversions ? '🔄 Uses inversions' : ''}
                </p>
            </div>

            <div class="bg-white dark:bg-gray-700 rounded-lg shadow-md p-4 mb-6 text-left">
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Existing submission:</p>
                <div class="flex items-start gap-3">
                    ${match.author?.avatarUrl ?
                        `<img src="${match.author.avatarUrl}" class="w-10 h-10 rounded-full">` :
                        `<div class="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">${match.author?.displayName?.charAt(0) || '?'}</div>`}
                    <div class="flex-1">
                        <h4 class="font-bold text-gray-800 dark:text-white">${match.title}</h4>
                        <p class="text-sm text-gray-500 dark:text-gray-400">by ${match.author?.displayName || 'Unknown'} • ${match.upvoteCount || 0} upvotes</p>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Key: ${match.keySignature || 'Unknown'}</p>
                    </div>
                </div>
            </div>

            <div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-6 text-left">
                <p class="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-2 flex items-center gap-2">
                    <span>✨</span> You can still share this as a variant!
                </p>
                <p class="text-sm text-emerald-700 dark:text-emerald-300">
                    Your version will be linked to the original progression, helping users discover different arrangements and voicings.
                </p>
            </div>

            <div class="flex justify-center gap-3">
                <button onclick="window.hideShareModal && window.hideShareModal()"
                        class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                    Cancel
                </button>
                <button id="continue-as-variant-btn"
                        class="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-lg shadow transition-all">
                    Continue as Variant
                </button>
            </div>
        </div>
    `;

    container.classList.remove('hidden');

    // Add click handler for "Continue as Variant" button
    document.getElementById('continue-as-variant-btn').onclick = () => {
        container.classList.add('hidden');
        // Mark this as a variant submission
        showShareForm(dupData, key, compState, true, match.id);
    };
}

/**
 * Show the share form
 * @param {boolean} isVariant - Whether this is being submitted as a variant
 * @param {string} parentSubmissionId - ID of parent submission if this is a variant
 */
async function showShareForm(dupData, key, compState, isVariant = false, parentSubmissionId = null) {
    const form = document.getElementById('share-form');
    const footer = document.getElementById('share-modal-footer');

    // Store duplicate data for submission (including both hashes)
    form.dataset.baseHash = dupData.baseHash;
    form.dataset.variantHash = dupData.variantHash;
    form.dataset.hash = dupData.baseHash; // Legacy
    form.dataset.normalized = dupData.normalized;
    form.dataset.key = key;
    form.dataset.isVariant = isVariant ? 'true' : 'false';
    form.dataset.parentSubmissionId = parentSubmissionId || '';

    // Get settings and metadata from composition state
    const settings = compState?.getSettings?.() || compState?.settings || {};
    const metadata = compState?.metadata || {};
    // Time signature is in metadata with { num, denom } format
    const timeSigNum = metadata.timeSignature?.num || 4;
    const timeSigDenom = metadata.timeSignature?.denom || 4;
    const tempo = metadata.tempo || 120;

    // Populate preview
    const preview = document.getElementById('share-preview');
    preview.innerHTML = `
        <div class="grid grid-cols-2 gap-2 text-xs">
            <div><span class="font-semibold">Key:</span> ${key}</div>
            <div><span class="font-semibold">Time:</span> ${timeSigNum}/${timeSigDenom}</div>
            <div><span class="font-semibold">BPM:</span> ${tempo}</div>
            <div><span class="font-semibold">Chords:</span> ${(compState?.getChordSegments?.() || []).length}</div>
        </div>
        <div class="mt-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
            <span class="font-semibold">Progression:</span>
            <span class="font-mono text-indigo-600 dark:text-indigo-400">${dupData.normalized}</span>
        </div>
    `;

    // Load tags
    await loadTags();

    // Set up form event listeners
    setupFormListeners();

    // Show form and footer
    form.classList.remove('hidden');
    footer.classList.remove('hidden');

    // Set up footer buttons
    document.getElementById('share-cancel-btn').onclick = hideShareModal;
    document.getElementById('share-submit-btn').onclick = handleSubmit;
}

/**
 * Load tags from the API
 */
async function loadTags() {
    const container = document.getElementById('share-tags-container');

    try {
        const response = await fetch('/.netlify/functions/tags');
        const result = await response.json();

        if (!result.success || !result.tags) {
            throw new Error('Failed to load tags');
        }

        tags = result.tags;

        // Render tags grouped by category
        const categoryLabels = {
            genre: 'Genre',
            mood: 'Mood',
            theory: 'Theory Concepts',
            difficulty: 'Difficulty',
            special: 'Special'
        };

        container.innerHTML = Object.entries(tags).map(([category, tagList]) => `
            <div>
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">${categoryLabels[category] || category}</p>
                <div class="flex flex-wrap gap-2">
                    ${tagList.map(tag => `
                        <button type="button"
                                class="tag-btn px-3 py-1 text-xs rounded-full border transition-all
                                       ${selectedTags.has(tag.id) ?
                                         'bg-indigo-500 text-white border-indigo-500' :
                                         'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-300'}"
                                data-tag-id="${tag.id}" data-tag-name="${tag.name}">
                            ${tag.name}
                        </button>
                    `).join('')}
                </div>
            </div>
        `).join('');

        // Add click handlers to tags
        container.querySelectorAll('.tag-btn').forEach(btn => {
            btn.addEventListener('click', () => toggleTag(btn));
        });

    } catch (error) {
        console.error('Error loading tags:', error);
        container.innerHTML = `<p class="text-sm text-red-500">Failed to load tags. You can still share without them.</p>`;
    }
}

/**
 * Toggle a tag selection
 */
function toggleTag(btn) {
    const tagId = parseInt(btn.dataset.tagId, 10);

    if (selectedTags.has(tagId)) {
        selectedTags.delete(tagId);
        btn.classList.remove('bg-indigo-500', 'text-white', 'border-indigo-500');
        btn.classList.add('bg-white', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300', 'border-gray-300', 'dark:border-gray-600');
    } else {
        if (selectedTags.size >= 10) {
            alert('You can select up to 10 tags.');
            return;
        }
        selectedTags.add(tagId);
        btn.classList.add('bg-indigo-500', 'text-white', 'border-indigo-500');
        btn.classList.remove('bg-white', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300', 'border-gray-300', 'dark:border-gray-600');
    }
}

/**
 * Set up form event listeners
 */
function setupFormListeners() {
    // Show/hide attribution based on category
    const categoryRadios = document.querySelectorAll('input[name="share-category"]');
    const attributionSection = document.getElementById('share-attribution');

    categoryRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const showAttribution = ['arrangement', 'analysis'].includes(radio.value);
            attributionSection.classList.toggle('hidden', !showAttribution);
        });
    });

    // Style radio buttons when checked
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const name = radio.name;
            document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
                const label = r.closest('label');
                if (label) {
                    if (r.checked) {
                        label.classList.add('border-indigo-500', 'bg-indigo-50', 'dark:bg-indigo-900/30');
                        label.classList.remove('border-gray-200', 'dark:border-gray-600');
                    } else {
                        label.classList.remove('border-indigo-500', 'bg-indigo-50', 'dark:bg-indigo-900/30');
                        label.classList.add('border-gray-200', 'dark:border-gray-600');
                    }
                }
            });
        });
    });
}

/**
 * Handle form submission
 */
async function handleSubmit() {
    const submitBtn = document.getElementById('share-submit-btn');
    const form = document.getElementById('share-form');

    // Get form values
    const title = document.getElementById('share-title').value.trim();
    const description = document.getElementById('share-description').value.trim();
    const submissionType = document.querySelector('input[name="share-type"]:checked')?.value;
    const category = document.querySelector('input[name="share-category"]:checked')?.value;
    const originalTitle = document.getElementById('share-original-title')?.value.trim();
    const originalArtist = document.getElementById('share-original-artist')?.value.trim();

    // Validation
    if (!title || title.length < 3) {
        alert('Please enter a title (at least 3 characters).');
        document.getElementById('share-title').focus();
        return;
    }

    if (!submissionType) {
        alert('Please select a submission type.');
        return;
    }

    if (!category) {
        alert('Please select a category.');
        return;
    }

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sharing...';

    try {
        // Get composition data based on submission type
        const compState = getCompositionState();
        const compositionData = createCompositionDataForSharing(compState, submissionType);
        const metadata = compState?.metadata || {};

        // Time signature is in metadata with { num, denom } format
        const timeSigNum = metadata.timeSignature?.num || 4;
        const timeSigDenom = metadata.timeSignature?.denom || 4;
        const tempo = metadata.tempo || 120;

        // Check if this is a variant submission
        const isVariant = form.dataset.isVariant === 'true';
        const parentSubmissionId = form.dataset.parentSubmissionId || null;

        // Get auth token
        const token = await getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        console.log('[Share] Submitting with:', {
            submissionType,
            keySignature: form.dataset.key,
            timeSignatureNum: timeSigNum,
            timeSignatureDenom: timeSigDenom,
            bpm: tempo,
            baseHash: form.dataset.baseHash?.substring(0, 16) + '...',
            variantHash: form.dataset.variantHash?.substring(0, 16) + '...',
            isVariant,
            parentSubmissionId,
            compositionDataSize: JSON.stringify(compositionData).length
        });

        // Submit to API
        const response = await fetch('/.netlify/functions/submissions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title,
                description: description || null,
                submissionType,
                category,
                originalTitle: originalTitle || null,
                originalArtist: originalArtist || null,
                tags: Array.from(selectedTags),
                compositionData,
                // New hash fields for variant system
                baseHash: form.dataset.baseHash,
                variantHash: form.dataset.variantHash,
                // Legacy field for backward compatibility
                progressionHash: form.dataset.baseHash,
                normalizedProgression: form.dataset.normalized,
                keySignature: form.dataset.key,
                timeSignatureNum: timeSigNum,
                timeSignatureDenom: timeSigDenom,
                bpm: tempo,
                chordCount: (compState?.getChordSegments?.() || []).length,
                measureCount: (compState?.getMeasures?.() || []).length,
                // Variant metadata
                isVariant,
                parentSubmissionId
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to share');
        }

        // Success!
        hideShareModal();
        showSuccessMessage(result.submissionId);

    } catch (error) {
        console.error('Error sharing:', error);
        alert(`Failed to share: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Share';
    }
}

/**
 * Show success message after sharing
 */
function showSuccessMessage(submissionId) {
    // Create a temporary toast notification
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-xl z-50 flex items-center gap-3 animate-slide-up';
    toast.innerHTML = `
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span class="font-semibold">Successfully shared with the community!</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Hide the share modal
 */
export function hideShareModal() {
    if (modalElement) {
        modalElement.classList.add('hidden');
    }
}

// Export for window access
window.showShareModal = showShareModal;
window.hideShareModal = hideShareModal;

export default {
    initShareModal,
    showShareModal,
    hideShareModal
};
