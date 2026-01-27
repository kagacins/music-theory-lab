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
import { isSignedIn, getCurrentUser, getAuthToken, getSubmissionDisplayName } from './authService.js';
import { generateDuplicateDetectionData, extractChordsFromComposition } from './duplicateDetection.js';
import { getCompositionState } from '../state/compositionState.js';
import { getCurrentKey } from '../state/trainerState.js';
import { DEFAULT_TIME_SIGNATURE } from '../../data/music-data.js';
import { getProgressionChordLimit, updateOwnSubmission } from '../admin/adminService.js';
import {
    getLoadedSubmissionContext,
    hasLoadedSubmissionContext,
    clearLoadedSubmissionContext
} from './loadedSubmissionContext.js';
import { toast } from '../ui/toastNotifications.js';
import { showAlertModal } from '../ui/modals.js';

// Modal state
let modalElement = null;
let tags = null;
let selectedTags = new Set();
let currentDuplicateInfo = null;
let editModeState = null; // Stores { submissionId, existingData } when in edit mode
let saveAsNewMode = false; // True when user chose "Save as New" from the update dialog

/**
 * Initialize the share modal (creates the DOM element)
 */
export function initShareModal() {
    if (modalElement) return;

    modalElement = document.createElement('div');
    modalElement.id = 'share-modal';
    modalElement.className = 'fixed inset-0 bg-black bg-opacity-50 hidden z-[9999] flex items-center justify-center p-4';
    modalElement.style.pointerEvents = 'auto';
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

                    <!-- Submitting As -->
                    <div id="share-author-section" class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Submitting as</p>
                                <p id="share-author-name" class="text-base font-medium text-gray-900 dark:text-white">Loading...</p>
                            </div>
                            <div class="flex items-center gap-3">
                                <button type="button" id="share-author-settings" class="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    </svg>
                                    Change
                                </button>
                            </div>
                        </div>
                        <div class="mt-3 flex items-center gap-2">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" id="share-anonymous" class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
                                <span class="text-sm text-gray-600 dark:text-gray-400">Submit anonymously</span>
                            </label>
                            <span class="text-xs text-gray-400" title="Your submission will still be linked to your account, but displayed as 'Anonymous' to other users">(?)</span>
                        </div>
                        <p id="share-author-hint" class="mt-2 text-xs text-gray-500 dark:text-gray-400 hidden"></p>
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
                            <label class="flex items-start p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/30">
                                <input type="radio" name="share-type" value="full-composition" class="sr-only" checked>
                                <span class="flex flex-col">
                                    <span class="text-sm font-semibold text-gray-800 dark:text-white">Full Composition</span>
                                    <span class="text-xs text-gray-500 dark:text-gray-400">Everything including notation</span>
                                    <span class="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Preserves complete work</span>
                                </span>
                            </label>
                            <label class="flex items-start p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:border-indigo-300 transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 dark:has-[:checked]:bg-indigo-900/30">
                                <input type="radio" name="share-type" value="chord-progression" class="sr-only">
                                <span class="flex flex-col">
                                    <span class="text-sm font-semibold text-gray-800 dark:text-white">Chord Progression</span>
                                    <span class="text-xs text-gray-500 dark:text-gray-400">Chords, inversions, key, beats</span>
                                    <span class="text-xs text-amber-600 dark:text-amber-400 mt-1">No melody/bass/notation</span>
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
            <div id="share-modal-footer" class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between hidden">
                <button id="share-cancel-btn" class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                    Cancel
                </button>
                <div class="flex items-center gap-3">
                    <button id="share-draft-btn" class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
                        </svg>
                        Save as Draft
                    </button>
                    <button id="share-submit-btn" class="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-lg shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                        </svg>
                        Publish
                    </button>
                </div>
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

        // BASS PRESERVATION: Store bass data keyed by chord ID
        // This enables bass edits to survive chord reordering across save/load cycles
        bassDataByChordId: compositionState.bassDataByChordId ?
            Object.fromEntries(compositionState.bassDataByChordId) : {},

        // Additional notation data
        tempoMarkings: compositionState.tempoMarkings ? [...compositionState.tempoMarkings] : [],
        repeatSigns: compositionState.repeatSigns ? [...compositionState.repeatSigns] : [],
        hairpins: compositionState.hairpins ? [...compositionState.hairpins] : [],
        slurs: compositionState.slurs ? [...compositionState.slurs] : [],
        voltaBrackets: compositionState.voltaBrackets ? [...compositionState.voltaBrackets] : []
    };
}

/**
 * Show dialog asking whether to Update existing submission or Save as New
 * Called when Share Progression is clicked and there's a loaded submission context
 */
async function showUpdateOrSaveNewDialog(loadedContext) {
    // Create dialog element
    let dialog = document.getElementById('update-or-new-dialog');
    if (!dialog) {
        dialog = document.createElement('div');
        dialog.id = 'update-or-new-dialog';
        dialog.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
        document.body.appendChild(dialog);
    }

    const truncatedTitle = loadedContext.title.length > 40
        ? loadedContext.title.substring(0, 40) + '...'
        : loadedContext.title;

    dialog.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-amber-500 to-orange-500">
                <div class="flex items-center gap-3">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <h2 class="text-lg font-bold text-white">Update or Save as New?</h2>
                </div>
            </div>

            <!-- Content -->
            <div class="p-6">
                <p class="text-gray-700 dark:text-gray-300 mb-6">
                    You loaded <span class="font-semibold text-amber-600 dark:text-amber-400">"${truncatedTitle}"</span> for editing.
                    What would you like to do?
                </p>

                <div class="space-y-3">
                    <!-- Update Option -->
                    <button id="update-existing-btn" class="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border-2 border-amber-300 dark:border-amber-600 rounded-xl hover:border-amber-500 dark:hover:border-amber-400 transition-colors text-left">
                        <div class="flex-shrink-0 w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                            </svg>
                        </div>
                        <div>
                            <div class="font-semibold text-gray-900 dark:text-white">Update "${truncatedTitle}"</div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">Save changes to your existing submission (creates version history)</div>
                        </div>
                    </button>

                    <!-- Save as New Option -->
                    <button id="save-as-new-btn" class="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-2 border-blue-300 dark:border-blue-600 rounded-xl hover:border-blue-500 dark:hover:border-blue-400 transition-colors text-left">
                        <div class="flex-shrink-0 w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                            </svg>
                        </div>
                        <div>
                            <div class="font-semibold text-gray-900 dark:text-white">Save as New Submission</div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">Create a new separate submission (won't affect the original)</div>
                        </div>
                    </button>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-end">
                <button id="cancel-update-dialog-btn" class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                    Cancel
                </button>
            </div>
        </div>
    `;

    dialog.classList.remove('hidden');

    // Handle button clicks
    return new Promise((resolve) => {
        const updateBtn = document.getElementById('update-existing-btn');
        const saveNewBtn = document.getElementById('save-as-new-btn');
        const cancelBtn = document.getElementById('cancel-update-dialog-btn');

        const closeDialog = () => {
            dialog.classList.add('hidden');
        };

        updateBtn.onclick = () => {
            closeDialog();
            // Open share modal in edit mode with the loaded context
            showShareModal({
                editMode: true,
                submissionId: loadedContext.submissionId,
                existingData: {
                    title: loadedContext.title,
                    description: loadedContext.description,
                    status: loadedContext.status,
                    submissionType: loadedContext.submissionType,
                    category: loadedContext.category
                },
                skipEditCheck: true // Prevent infinite loop
            });
            resolve('update');
        };

        saveNewBtn.onclick = () => {
            closeDialog();
            // Open share modal as new - DON'T clear context yet
            // Context will be cleared after successful submission
            // This way if user cancels, they can still choose to Update
            showShareModal({ skipEditCheck: true, saveAsNew: true });
            resolve('new');
        };

        cancelBtn.onclick = () => {
            closeDialog();
            resolve('cancel');
        };

        // Close on backdrop click
        dialog.onclick = (e) => {
            if (e.target === dialog) {
                closeDialog();
                resolve('cancel');
            }
        };
    });
}

/**
 * Show the share modal
 * Duplicate detection is deferred until user clicks "Publish" (not for drafts)
 *
 * @param {Object} options - Optional configuration
 * @param {boolean} options.editMode - Whether to open in edit mode for an existing submission
 * @param {string} options.submissionId - The submission ID if in edit mode
 * @param {Object} options.existingData - The existing submission data (title, description, etc.)
 */
export async function showShareModal(options = {}) {
    if (!modalElement) {
        initShareModal();
    }

    // Check if user is signed in
    if (!isSignedIn()) {
        toast.warning('Please sign in to share with the community.');
        return;
    }

    // Reset state
    selectedTags.clear();
    currentDuplicateInfo = null;

    // Track if this is a "Save as New" flow (user chose to create new instead of update)
    saveAsNewMode = options.saveAsNew || false;

    // Handle edit mode - can be set explicitly via options OR detected from loaded submission context
    if (options.editMode && options.submissionId) {
        // Explicit edit mode (from old code path or direct call)
        editModeState = {
            submissionId: options.submissionId,
            existingData: options.existingData || {}
        };
    } else if (!options.skipEditCheck && hasLoadedSubmissionContext()) {
        // A submission was loaded for editing - show choice dialog
        const loadedContext = getLoadedSubmissionContext();
        await showUpdateOrSaveNewDialog(loadedContext);
        return; // Dialog will call showShareModal again with appropriate options
    } else {
        editModeState = null;
    }

    // Show modal with loading state briefly while we prepare form
    modalElement.classList.remove('hidden');
    document.getElementById('share-loading').classList.remove('hidden');
    document.getElementById('share-duplicate').classList.add('hidden');
    document.getElementById('share-form').classList.add('hidden');
    document.getElementById('share-modal-footer').classList.add('hidden');

    // Update header for edit mode
    const headerTitle = modalElement.querySelector('h2');
    if (headerTitle) {
        if (editModeState) {
            headerTitle.innerHTML = `
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                Edit Submission
            `;
        } else {
            headerTitle.innerHTML = `
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                </svg>
                Share with Community
            `;
        }
    }

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
        // We'll use this for the form and check for duplicates only when publishing
        let dupData;
        try {
            dupData = await generateDuplicateDetectionData(chords, key);
        } catch (hashError) {
            console.error('[Share] Error generating hash, using fallback:', hashError);
            // Fallback - create basic dupData without hashes
            dupData = {
                baseHash: 'fallback-' + Date.now(),
                variantHash: 'fallback-variant-' + Date.now(),
                normalized: chords.map(c => c.root + (c.type === 'Minor' ? 'm' : '')).join(' - '),
                hasCustomDurations: false,
                hasInversions: false
            };
        }

        // Hide loading and show form directly
        // Duplicate detection is deferred to when user clicks "Publish"
        document.getElementById('share-loading').classList.add('hidden');
        await showShareForm(dupData, key, compState);

    } catch (error) {
        console.error('[Share] Error preparing share modal:', error);
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
                        `<img src="${match.author.avatarUrl}" class="w-10 h-10 rounded-full" referrerpolicy="no-referrer" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="w-10 h-10 rounded-full bg-indigo-500 items-center justify-center text-white font-bold" style="display:none;">${match.author.displayName.charAt(0)}</div>` :
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
                        `<img src="${match.author.avatarUrl}" class="w-10 h-10 rounded-full" referrerpolicy="no-referrer" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="w-10 h-10 rounded-full bg-indigo-500 items-center justify-center text-white font-bold" style="display:none;">${match.author?.displayName?.charAt(0) || '?'}</div>` :
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

    if (!form) {
        console.error('[Share] share-form element not found!');
        return;
    }
    if (!footer) {
        console.error('[Share] share-modal-footer element not found!');
        return;
    }

    // Store duplicate data for submission (including both hashes)
    form.dataset.baseHash = dupData.baseHash;
    form.dataset.variantHash = dupData.variantHash;
    form.dataset.hash = dupData.baseHash; // Legacy
    form.dataset.normalized = dupData.normalized;
    form.dataset.key = key;
    form.dataset.isVariant = isVariant ? 'true' : 'false';
    form.dataset.parentSubmissionId = parentSubmissionId || '';
    form.dataset.hasCustomDurations = dupData.hasCustomDurations ? 'true' : 'false';
    form.dataset.hasInversions = dupData.hasInversions ? 'true' : 'false';

    // Get settings and metadata from composition state
    const settings = compState?.getSettings?.() || compState?.settings || {};
    const metadata = compState?.metadata || {};
    // Time signature is in metadata with { num, denom } format
    const timeSigNum = metadata.timeSignature?.num || 4;
    const timeSigDenom = metadata.timeSignature?.denom || 4;
    const tempo = metadata.tempo || 120;

    // Get chord count and segments for validation
    const chordSegments = compState?.getChordSegments?.() || [];
    const chordCount = chordSegments.length;

    // Check for N.C. (No Chord) in the progression
    const hasNoChord = chordSegments.some(segment =>
        segment.chord?.type === 'No Chord' || segment.chord?.type === 'N.C.'
    );

    // Store validation flags in form data
    form.dataset.chordCount = chordCount.toString();
    form.dataset.hasNoChord = hasNoChord ? 'true' : 'false';

    // Get chord limit setting (async but non-blocking for UI)
    let chordLimitWarning = '';
    try {
        const limitSetting = await getProgressionChordLimit();
        if (limitSetting?.enabled && limitSetting?.limit) {
            const maxChords = limitSetting.limit;
            if (chordCount > maxChords) {
                chordLimitWarning = `
                    <div class="mt-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                        <p class="text-sm text-red-700 dark:text-red-300 font-medium flex items-center gap-2">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                            </svg>
                            Chord limit exceeded
                        </p>
                        <p class="text-xs text-red-600 dark:text-red-400 mt-1">
                            Chord progressions are limited to <strong>${maxChords} chords</strong>. Your progression has ${chordCount} chords.
                            Please reduce the number of chords to submit as a chord progression, or submit as a full composition instead.
                        </p>
                    </div>
                `;
                // Store limit info for validation
                form.dataset.chordLimitExceeded = 'true';
                form.dataset.chordLimit = maxChords.toString();
            } else {
                form.dataset.chordLimitExceeded = 'false';
                // Show info about the limit if it's getting close
                if (chordCount >= maxChords - 2) {
                    chordLimitWarning = `
                        <div class="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded text-xs text-yellow-700 dark:text-yellow-400">
                            <strong>Note:</strong> Chord progressions are limited to ${maxChords} chords. You have ${chordCount}.
                        </div>
                    `;
                }
            }
        } else {
            form.dataset.chordLimitExceeded = 'false';
        }
    } catch (err) {
        console.warn('[Share] Could not fetch chord limit:', err);
        form.dataset.chordLimitExceeded = 'false';
    }

    // Build validation warnings
    let validationWarnings = chordLimitWarning;

    // Minimum chord count warning (applies to publishing both types)
    if (chordCount < 3) {
        validationWarnings += `
            <div class="mt-2 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p class="text-sm text-amber-700 dark:text-amber-300 font-medium flex items-center gap-2">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    Minimum chord count not met
                </p>
                <p class="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    At least <strong>3 chords</strong> are required to publish. You have ${chordCount} chord${chordCount !== 1 ? 's' : ''}.
                    You can save as a draft with any number of chords.
                </p>
            </div>
        `;
        form.dataset.minChordsNotMet = 'true';
    } else {
        form.dataset.minChordsNotMet = 'false';
    }

    // N.C. chord warning (shown dynamically based on submission type selection)
    // We'll add the warning HTML but control visibility via JavaScript when type changes
    if (hasNoChord) {
        validationWarnings += `
            <div id="nc-chord-warning" class="mt-2 p-3 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg">
                <p class="text-sm text-orange-700 dark:text-orange-300 font-medium flex items-center gap-2">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    Contains N.C. (No Chord)
                </p>
                <p class="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    Chord progressions with "N.C." cannot be published. Remove N.C. chords or submit as a "Full Composition" instead.
                    Drafts can be saved with N.C. chords.
                </p>
            </div>
        `;
    }

    // Populate preview
    const preview = document.getElementById('share-preview');
    preview.innerHTML = `
        <div class="grid grid-cols-2 gap-2 text-xs">
            <div><span class="font-semibold">Key:</span> ${key}</div>
            <div><span class="font-semibold">Time:</span> ${timeSigNum}/${timeSigDenom}</div>
            <div><span class="font-semibold">BPM:</span> ${tempo}</div>
            <div><span class="font-semibold">Chords:</span> ${chordCount}</div>
        </div>
        <div class="mt-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
            <span class="font-semibold">Progression:</span>
            <span class="font-mono text-indigo-600 dark:text-indigo-400">${dupData.normalized}</span>
        </div>
        ${validationWarnings}
    `;

    // Show form and footer FIRST, then load async content
    // This ensures the form is visible even if tags/author loading fails
    form.classList.remove('hidden');
    footer.classList.remove('hidden');

    // Set up footer buttons
    document.getElementById('share-cancel-btn').onclick = hideShareModal;
    document.getElementById('share-draft-btn').onclick = () => handleSubmit('draft');
    document.getElementById('share-submit-btn').onclick = () => handleSubmit('published');

    // Update button text for edit mode
    const submitBtn = document.getElementById('share-submit-btn');
    const draftBtn = document.getElementById('share-draft-btn');
    if (editModeState) {
        submitBtn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Update
        `;
        // Hide draft button in edit mode - existing submission already has a status
        draftBtn.classList.add('hidden');
    } else {
        submitBtn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
            </svg>
            Publish
        `;
        draftBtn.classList.remove('hidden');
    }

    // Pre-fill title from composition metadata (if not empty and not in edit mode)
    // This helps users by suggesting their composition's title
    if (!editModeState) {
        const titleInput = document.getElementById('share-title');
        const compositionTitle = compState?.metadata?.title || compState?.getTitle?.();
        if (titleInput && compositionTitle && compositionTitle.trim()) {
            titleInput.value = compositionTitle.trim();
        }
    }

    // Pre-fill form with existing data in edit mode
    if (editModeState && editModeState.existingData) {
        const data = editModeState.existingData;
        const titleInput = document.getElementById('share-title');
        const descriptionInput = document.getElementById('share-description');

        // Pre-fill title and make it read-only in edit mode
        if (data.title) {
            titleInput.value = data.title;
            titleInput.readOnly = true;
            titleInput.classList.add('bg-gray-100', 'dark:bg-gray-600', 'cursor-not-allowed');
            titleInput.title = 'Title cannot be changed when updating. Use "Save as New" to create a new submission with a different title.';

            // Add a visual indicator that title is locked
            const titleLabel = titleInput.closest('div').querySelector('label');
            if (titleLabel && !titleLabel.querySelector('.edit-mode-lock')) {
                const lockIcon = document.createElement('span');
                lockIcon.className = 'edit-mode-lock ml-2 text-gray-400 text-xs';
                lockIcon.innerHTML = `
                    <svg class="w-3.5 h-3.5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                    (locked)
                `;
                titleLabel.appendChild(lockIcon);
            }
        }

        // Pre-fill description with hint about documenting changes
        if (data.description) {
            descriptionInput.value = data.description;
        }

        // Add hint about documenting changes in description
        const descriptionLabel = descriptionInput.closest('div').querySelector('label');
        if (descriptionLabel && !descriptionLabel.querySelector('.edit-mode-hint')) {
            const hintSpan = document.createElement('span');
            hintSpan.className = 'edit-mode-hint ml-2 text-amber-600 dark:text-amber-400 text-xs font-normal';
            hintSpan.textContent = '(Consider noting what you changed)';
            descriptionLabel.appendChild(hintSpan);
        }

        // Pre-select submission type
        if (data.submissionType) {
            const typeRadio = document.querySelector(`input[name="share-type"][value="${data.submissionType}"]`);
            if (typeRadio) {
                typeRadio.checked = true;
                // Trigger change event to update styling
                typeRadio.dispatchEvent(new Event('change'));
            }
        }

        // Pre-select category
        if (data.category) {
            const categoryRadio = document.querySelector(`input[name="share-category"][value="${data.category}"]`);
            if (categoryRadio) {
                categoryRadio.checked = true;
                // Trigger change event to update styling
                categoryRadio.dispatchEvent(new Event('change'));
            }
        }
    } else {
        // Reset title input state for non-edit mode
        const titleInput = document.getElementById('share-title');
        titleInput.readOnly = false;
        titleInput.classList.remove('bg-gray-100', 'dark:bg-gray-600', 'cursor-not-allowed');
        titleInput.title = '';

        // Remove any edit mode indicators
        const lockIcon = document.querySelector('.edit-mode-lock');
        if (lockIcon) lockIcon.remove();
        const hintSpan = document.querySelector('.edit-mode-hint');
        if (hintSpan) hintSpan.remove();
    }

    // Set up form event listeners
    setupFormListeners();

    // Load tags (non-blocking - form is already visible)
    try {
        await loadTags();
    } catch (error) {
        console.error('[Share] Error loading tags:', error);
    }

    // Populate author section (non-blocking - form is already visible)
    try {
        await populateAuthorSection();
    } catch (error) {
        console.error('[Share] Error populating author section:', error);
    }
}

/**
 * Populate the author section with display name and set up event listeners
 */
async function populateAuthorSection() {
    const authorNameEl = document.getElementById('share-author-name');
    const authorHintEl = document.getElementById('share-author-hint');
    const anonymousCheckbox = document.getElementById('share-anonymous');
    const settingsBtn = document.getElementById('share-author-settings');

    // Get the display name info with timeout fallback
    let displayInfo;
    try {
        displayInfo = await getSubmissionDisplayName();
    } catch (err) {
        // Fallback if fetch fails
        displayInfo = { displayName: 'User', isUsername: false, hasUsername: false };
    }

    // Ensure we have valid displayInfo
    if (!displayInfo || !displayInfo.displayName) {
        displayInfo = { displayName: 'User', isUsername: false, hasUsername: false };
    }

    // Update the display
    if (displayInfo.isUsername) {
        authorNameEl.textContent = `@${displayInfo.displayName}`;
        authorHintEl.classList.add('hidden');
    } else {
        authorNameEl.textContent = displayInfo.displayName;
        if (!displayInfo.hasUsername) {
            authorHintEl.textContent = 'This is your Google account name. Set a username in Profile Settings for more privacy.';
            authorHintEl.classList.remove('hidden');
        } else {
            authorHintEl.classList.add('hidden');
        }
    }

    // Reset anonymous checkbox
    anonymousCheckbox.checked = false;

    // Handle anonymous checkbox change
    anonymousCheckbox.onchange = () => {
        if (anonymousCheckbox.checked) {
            authorNameEl.textContent = 'Anonymous';
            authorNameEl.classList.add('italic', 'text-gray-500');
            authorHintEl.textContent = 'Your submission will be linked to your account but displayed as "Anonymous" to others.';
            authorHintEl.classList.remove('hidden');
        } else {
            authorNameEl.classList.remove('italic', 'text-gray-500');
            if (displayInfo.isUsername) {
                authorNameEl.textContent = `@${displayInfo.displayName}`;
                authorHintEl.classList.add('hidden');
            } else {
                authorNameEl.textContent = displayInfo.displayName;
                if (!displayInfo.hasUsername) {
                    authorHintEl.textContent = 'This is your Google account name. Set a username in Profile Settings for more privacy.';
                    authorHintEl.classList.remove('hidden');
                }
            }
        }
    };

    // Handle settings button click - open profile settings modal
    settingsBtn.onclick = () => {
        if (window.showProfileSettingsModal) {
            window.showProfileSettingsModal();
        }
    };
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
            toast.warning('You can select up to 10 tags.');
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

    // Show/hide N.C. warning based on submission type
    const typeRadios = document.querySelectorAll('input[name="share-type"]');
    const ncWarning = document.getElementById('nc-chord-warning');

    function updateNcWarningVisibility() {
        if (!ncWarning) return;
        const selectedType = document.querySelector('input[name="share-type"]:checked')?.value;
        // Only show N.C. warning for chord-progression type
        if (selectedType === 'chord-progression') {
            ncWarning.classList.remove('hidden');
        } else {
            ncWarning.classList.add('hidden');
        }
    }

    typeRadios.forEach(radio => {
        radio.addEventListener('change', updateNcWarningVisibility);
    });

    // Initial state - hide warning if full-composition is selected
    updateNcWarningVisibility();

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
 * @param {string} status - 'published' or 'draft'
 */
async function handleSubmit(status = 'published') {
    const submitBtn = document.getElementById('share-submit-btn');
    const draftBtn = document.getElementById('share-draft-btn');
    const form = document.getElementById('share-form');
    const isDraft = status === 'draft';

    // Get form values
    const title = document.getElementById('share-title').value.trim();
    const description = document.getElementById('share-description').value.trim();
    const submissionType = document.querySelector('input[name="share-type"]:checked')?.value;
    const category = document.querySelector('input[name="share-category"]:checked')?.value;
    const originalTitle = document.getElementById('share-original-title')?.value.trim();
    const originalArtist = document.getElementById('share-original-artist')?.value.trim();
    const isAnonymous = document.getElementById('share-anonymous')?.checked || false;

    // Validation
    if (!title || title.length < 3) {
        await showAlertModal({
            title: 'Title Required',
            message: 'Please enter a title (at least 3 characters).',
            type: 'warning'
        });
        document.getElementById('share-title').focus();
        return;
    }

    if (!submissionType) {
        await showAlertModal({
            title: 'Type Required',
            message: 'Please select a submission type.',
            type: 'warning'
        });
        return;
    }

    if (!category) {
        await showAlertModal({
            title: 'Category Required',
            message: 'Please select a category.',
            type: 'warning'
        });
        return;
    }

    // ==========================================
    // PUBLISHING VALIDATION (not applied to drafts)
    // ==========================================
    if (!isDraft) {
        // Check minimum chord count for publishing
        if (form.dataset.minChordsNotMet === 'true') {
            const chordCount = form.dataset.chordCount || '0';
            await showAlertModal({
                title: 'More Chords Required',
                message: `At least 3 chords are required to publish. You have ${chordCount} chord(s). You can save as a draft with any number of chords.`,
                type: 'warning'
            });
            return;
        }

        // Check for N.C. (No Chord) in chord-progression submissions
        if (submissionType === 'chord-progression' && form.dataset.hasNoChord === 'true') {
            await showAlertModal({
                title: 'N.C. Not Allowed',
                message: 'Chord progressions cannot contain "N.C." (No Chord) when publishing. Remove the N.C. chord, submit as a "Full Composition" instead, or save as a draft.',
                type: 'warning'
            });
            return;
        }

        // Check chord limit for chord-progression submissions
        if (submissionType === 'chord-progression' && form.dataset.chordLimitExceeded === 'true') {
            const limit = form.dataset.chordLimit || 'unknown';
            await showAlertModal({
                title: 'Chord Limit Exceeded',
                message: `Chord progressions are limited to ${limit} chords. Please reduce the number of chords or submit as a "Full Composition" instead.`,
                type: 'warning'
            });
            return;
        }
    }

    // Disable buttons
    submitBtn.disabled = true;
    draftBtn.disabled = true;
    if (isDraft) {
        draftBtn.innerHTML = `
            <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Saving...
        `;
    } else {
        submitBtn.innerHTML = `
            <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Checking...
        `;
    }

    try {
        // Get composition data based on submission type
        const compState = getCompositionState();
        const compositionData = createCompositionDataForSharing(compState, submissionType);
        const metadata = compState?.metadata || {};

        // Time signature is in metadata with { num, denom } format
        const timeSigNum = metadata.timeSignature?.num || 4;
        const timeSigDenom = metadata.timeSignature?.denom || 4;
        const tempo = metadata.tempo || 120;

        // Check if this is a variant submission (user already confirmed via variant warning)
        let isVariant = form.dataset.isVariant === 'true';
        let parentSubmissionId = form.dataset.parentSubmissionId || null;

        // Get auth token (automatically handles refresh if token is expiring)
        const token = await getAuthToken();
        if (!token) {
            throw new Error('Your session has expired. Please sign in again.');
        }

        // Only check for duplicates when PUBLISHING chord-progressions (not for drafts or full-compositions)
        // Drafts can be saved without duplicate checks - they're work in progress
        // Full compositions are unique due to melody/arrangement and don't need duplicate detection
        if (!isDraft && !isVariant && submissionType === 'chord-progression') {
            submitBtn.innerHTML = `
                <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"></circle>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Checking for duplicates...
            `;

            // Check for duplicates via API
            const dupResponse = await fetch('/.netlify/functions/check-duplicate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    baseHash: form.dataset.baseHash,
                    variantHash: form.dataset.variantHash,
                    progressionHash: form.dataset.baseHash,
                    submissionType: 'chord-progression',
                    userKeySignature: form.dataset.key,
                    hasCustomDurations: form.dataset.hasCustomDurations === 'true',
                    hasInversions: form.dataset.hasInversions === 'true'
                })
            });

            const dupResult = await dupResponse.json();

            if (dupResult.isDuplicate) {
                // Exact duplicate found - show the duplicate UI
                resetButtons();
                document.getElementById('share-form').classList.add('hidden');
                document.getElementById('share-modal-footer').classList.add('hidden');
                showDuplicateFound(dupResult, form.dataset.normalized);
                return;
            } else if (dupResult.isVariant) {
                // Variant found - show variant warning and let user decide
                resetButtons();
                document.getElementById('share-form').classList.add('hidden');
                document.getElementById('share-modal-footer').classList.add('hidden');

                // Store duplicate info for variant submission
                currentDuplicateInfo = dupResult;

                // Create dupData object for variant warning
                const dupData = {
                    baseHash: form.dataset.baseHash,
                    variantHash: form.dataset.variantHash,
                    normalized: form.dataset.normalized,
                    hasCustomDurations: form.dataset.hasCustomDurations === 'true',
                    hasInversions: form.dataset.hasInversions === 'true'
                };

                showVariantWarning(dupResult, dupData, form.dataset.key, compState);
                return;
            }

            // No duplicate - continue with publishing
            submitBtn.innerHTML = `
                <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"></circle>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Publishing...
            `;
        }

        // ==========================================
        // EDIT MODE - Update existing submission
        // ==========================================
        if (editModeState) {

            submitBtn.innerHTML = `
                <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"></circle>
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Updating...
            `;

            try {
                const result = await updateOwnSubmission(editModeState.submissionId, {
                    title,
                    description: description || null,
                    compositionData,
                    baseHash: form.dataset.baseHash,
                    variantHash: form.dataset.variantHash,
                    progressionHash: form.dataset.baseHash,
                    normalizedProgression: form.dataset.normalized,
                    keySignature: form.dataset.key,
                    timeSignatureNum: timeSigNum,
                    timeSignatureDenom: timeSigDenom,
                    bpm: tempo,
                    chordCount: (compState?.getChordSegments?.() || []).length,
                    measureCount: (compState?.getMeasures?.() || []).length,
                    tags: Array.from(selectedTags)
                });

                // Success! Clear the loaded submission context since we've updated
                clearLoadedSubmissionContext();
                hideShareModal();
                showSuccessMessage(result.submissionId, false, true); // isEdit = true
                return;

            } catch (updateError) {
                console.error('[Share] Update error:', updateError);
                throw new Error(updateError.message || 'Failed to update submission');
            }
        }

        // ==========================================
        // CREATE NEW SUBMISSION
        // ==========================================

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
                parentSubmissionId,
                // Anonymous submission
                isAnonymous,
                // Draft or published status
                status
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || (isDraft ? 'Failed to save draft' : 'Failed to publish'));
        }

        // Success! If this was a "Save as New" flow, clear the loaded context
        if (saveAsNewMode) {
            clearLoadedSubmissionContext();
            saveAsNewMode = false;
        }
        hideShareModal();
        showSuccessMessage(result.submissionId, isDraft);

    } catch (error) {
        console.error('Error saving submission:', error);
        toast.error(`${isDraft ? 'Failed to save draft' : 'Failed to publish'}: ${error.message}`);
    } finally {
        resetButtons();
    }

    function resetButtons() {
        submitBtn.disabled = false;
        draftBtn.disabled = false;

        // Reset to appropriate state based on edit mode
        if (editModeState) {
            submitBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Update
            `;
        } else {
            submitBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                </svg>
                Publish
            `;
            draftBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
                </svg>
                Save as Draft
            `;
        }
    }
}

/**
 * Show success message after sharing
 * @param {string} submissionId - The submission ID
 * @param {boolean} isDraft - Whether this was saved as a draft
 * @param {boolean} isEdit - Whether this was an edit of existing submission
 */
function showSuccessMessage(submissionId, isDraft = false, isEdit = false) {
    // Create a temporary toast notification
    const toast = document.createElement('div');

    let bgColor, content;
    if (isEdit) {
        bgColor = 'bg-amber-500';
        content = `
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <div>
                <span class="font-semibold block">Submission updated!</span>
                <span class="text-sm opacity-90">Previous version saved to history</span>
            </div>
        `;
    } else if (isDraft) {
        bgColor = 'bg-blue-500';
        content = `
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
            </svg>
            <div>
                <span class="font-semibold block">Draft saved!</span>
                <span class="text-sm opacity-90">Access it from My Submissions</span>
            </div>
        `;
    } else {
        bgColor = 'bg-green-500';
        content = `
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span class="font-semibold">Successfully published to the community!</span>
        `;
    }

    toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-4 rounded-lg shadow-xl z-50 flex items-center gap-3 animate-slide-up`;
    toast.innerHTML = content;
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
