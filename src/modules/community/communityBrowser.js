/**
 * Community Browser UI Component
 *
 * Modal for browsing and searching community submissions.
 * Allows users to discover, preview, and load shared progressions.
 */

import { getAuthToken, isSignedIn } from './authService.js';
import { getCompositionState } from '../state/compositionState.js';
import { getCurrentKey } from '../state/trainerState.js';
import { getInvertedChordNotes } from '../utils/noteUtils.js';
import { CHORD_DEFINITIONS } from '../../data/music-data.js';
import { submitFlag } from '../admin/adminService.js';

// Request timeout in milliseconds (prevents Chrome lockups)
const FETCH_TIMEOUT = 10000;

/**
 * Fetch with timeout to prevent Chrome lockups when server is unresponsive
 */
async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        return response;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timed out - server may be unavailable');
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Escape HTML special characters for safe rendering
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

// Common keys (beginner-friendly, ordered by popularity/ease)
const COMMON_KEYS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab'];
// All available keys (including sharps/flats)
const ALL_KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

// Browser state
let browserModal = null;
let currentSubmissions = [];
let currentFamilies = [];
let currentPage = 1;
let totalPages = 1;
let currentFilters = {
    search: '',
    type: '',
    category: '',
    key: '',
    sort: 'newest'
};
let isLoading = false;
let viewMode = 'grouped'; // 'grouped' or 'flat'
let expandedFamilies = new Set();

/**
 * Initialize the community browser modal
 */
export function initCommunityBrowser() {
    if (browserModal) return;

    browserModal = document.createElement('div');
    browserModal.id = 'community-browser-modal';
    browserModal.className = 'fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center p-4';
    browserModal.innerHTML = getBrowserHTML();
    document.body.appendChild(browserModal);

    // Close on backdrop click
    browserModal.addEventListener('click', (e) => {
        if (e.target === browserModal) {
            hideCommunityBrowser();
        }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !browserModal.classList.contains('hidden')) {
            hideCommunityBrowser();
        }
    });
}

/**
 * Get the browser modal HTML
 */
function getBrowserHTML() {
    return `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            <!-- Header - more compact -->
            <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-500 to-purple-600">
                <div class="flex items-center justify-between gap-4">
                    <h2 class="text-lg font-bold text-white flex items-center gap-2 shrink-0">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                        Community
                    </h2>

                    <!-- Search bar - inline with header -->
                    <div class="flex-1 max-w-xl flex gap-2">
                        <div class="flex-1 relative">
                            <input type="text" id="browser-search" placeholder="Search..."
                                   class="w-full px-3 py-1.5 pl-8 text-sm bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50">
                            <svg class="w-4 h-4 absolute left-2.5 top-2 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            </svg>
                        </div>
                        <button id="browser-search-btn" class="px-3 py-1.5 text-sm bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors">
                            Search
                        </button>
                    </div>

                    <button id="browser-close-btn" class="text-white hover:text-gray-200 transition-colors shrink-0">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Filters bar - more compact -->
            <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex flex-wrap gap-2 items-center">
                <!-- View mode toggle -->
                <div class="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden mr-2">
                    <button id="browser-view-grouped" class="px-2 py-1 text-xs bg-indigo-500 text-white" title="Group by progression">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                        </svg>
                    </button>
                    <button id="browser-view-flat" class="px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300" title="Show all">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                        </svg>
                    </button>
                </div>

                <select id="browser-filter-type" class="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    <option value="">All Types</option>
                    <option value="chord-progression">Progressions</option>
                    <option value="full-composition">Compositions</option>
                </select>
                <select id="browser-filter-category" class="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    <option value="">All Categories</option>
                    <option value="original">Original</option>
                    <option value="arrangement">Arrangement</option>
                    <option value="educational">Educational</option>
                    <option value="exercise">Exercise</option>
                    <option value="analysis">Analysis</option>
                </select>
                <select id="browser-filter-key" class="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    <option value="">All Keys</option>
                    <option value="C">C</option>
                    <option value="G">G</option>
                    <option value="D">D</option>
                    <option value="A">A</option>
                    <option value="E">E</option>
                    <option value="B">B</option>
                    <option value="F">F</option>
                    <option value="Bb">Bb</option>
                    <option value="Eb">Eb</option>
                    <option value="Ab">Ab</option>
                </select>
                <select id="browser-filter-sort" class="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    <option value="newest">Newest</option>
                    <option value="popular">Popular</option>
                    <option value="trending">Trending</option>
                    <option value="variants">Most Variants</option>
                </select>
                <button id="browser-clear-filters" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                    Clear
                </button>
            </div>

            <!-- Content area - min-height ensures room for 2 rows of cards when variations aren't expanded -->
            <div id="browser-content" class="flex-1 overflow-y-auto p-3 min-h-[500px]">
                <!-- Loading state -->
                <div id="browser-loading" class="flex flex-col items-center justify-center py-8">
                    <div class="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent mb-3"></div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
                </div>

                <!-- Results grid - tighter grid -->
                <div id="browser-results" class="hidden grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    <!-- Cards rendered here -->
                </div>

                <!-- Empty state -->
                <div id="browser-empty" class="hidden flex flex-col items-center justify-center py-8">
                    <div class="text-4xl mb-3">🎵</div>
                    <h3 class="text-lg font-bold text-gray-800 dark:text-white mb-1">No submissions found</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Try adjusting your filters.</p>
                </div>

                <!-- Error state -->
                <div id="browser-error" class="hidden flex flex-col items-center justify-center py-8">
                    <div class="text-4xl mb-3">⚠️</div>
                    <h3 class="text-lg font-bold text-gray-800 dark:text-white mb-1">Something went wrong</h3>
                    <p class="text-gray-600 dark:text-gray-400 mb-4" id="browser-error-message">Unable to load submissions.</p>
                    <button onclick="window.refreshCommunityBrowser && window.refreshCommunityBrowser()" class="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors">
                        Try Again
                    </button>
                </div>
            </div>

            <!-- Pagination - more compact -->
            <div id="browser-pagination" class="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between hidden">
                <p class="text-xs text-gray-600 dark:text-gray-400" id="browser-page-info">
                    1-20 of 100
                </p>
                <div class="flex gap-1">
                    <button id="browser-prev-btn" class="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        ← Prev
                    </button>
                    <button id="browser-next-btn" class="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        Next →
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Show the community browser
 */
export async function showCommunityBrowser() {
    if (!browserModal) {
        initCommunityBrowser();
    }

    browserModal.classList.remove('hidden');
    setupBrowserEventListeners();

    // Reset state
    currentPage = 1;
    currentFilters = {
        search: '',
        type: '',
        category: '',
        key: '',
        sort: 'newest'
    };
    expandedFamilies.clear();

    // Load initial submissions based on view mode
    await loadContent();
}

/**
 * Hide the community browser
 */
export function hideCommunityBrowser() {
    if (browserModal) {
        browserModal.classList.add('hidden');
    }
}

/**
 * Set up event listeners for the browser
 */
function setupBrowserEventListeners() {
    // Close button
    document.getElementById('browser-close-btn').onclick = hideCommunityBrowser;

    // View mode toggles
    const groupedBtn = document.getElementById('browser-view-grouped');
    const flatBtn = document.getElementById('browser-view-flat');

    updateViewModeButtons();

    groupedBtn.onclick = () => {
        if (viewMode !== 'grouped') {
            viewMode = 'grouped';
            updateViewModeButtons();
            currentPage = 1;
            expandedFamilies.clear();
            loadContent();
        }
    };
    flatBtn.onclick = () => {
        if (viewMode !== 'flat') {
            viewMode = 'flat';
            updateViewModeButtons();
            currentPage = 1;
            loadContent();
        }
    };

    // Search
    const searchInput = document.getElementById('browser-search');
    const searchBtn = document.getElementById('browser-search-btn');

    searchInput.value = currentFilters.search;
    searchBtn.onclick = () => {
        currentFilters.search = searchInput.value.trim();
        currentPage = 1;
        loadContent();
    };
    searchInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            currentFilters.search = searchInput.value.trim();
            currentPage = 1;
            loadContent();
        }
    };

    // Filters
    const typeFilter = document.getElementById('browser-filter-type');
    const categoryFilter = document.getElementById('browser-filter-category');
    const keyFilter = document.getElementById('browser-filter-key');
    const sortFilter = document.getElementById('browser-filter-sort');

    typeFilter.value = currentFilters.type;
    categoryFilter.value = currentFilters.category;
    keyFilter.value = currentFilters.key;
    sortFilter.value = currentFilters.sort;

    typeFilter.onchange = () => {
        currentFilters.type = typeFilter.value;
        currentPage = 1;
        loadContent();
    };
    categoryFilter.onchange = () => {
        currentFilters.category = categoryFilter.value;
        currentPage = 1;
        loadContent();
    };
    keyFilter.onchange = () => {
        currentFilters.key = keyFilter.value;
        currentPage = 1;
        loadContent();
    };
    sortFilter.onchange = () => {
        currentFilters.sort = sortFilter.value;
        currentPage = 1;
        loadContent();
    };

    // Clear filters
    document.getElementById('browser-clear-filters').onclick = () => {
        currentFilters = { search: '', type: '', category: '', key: '', sort: 'newest' };
        searchInput.value = '';
        typeFilter.value = '';
        categoryFilter.value = '';
        keyFilter.value = '';
        sortFilter.value = 'newest';
        currentPage = 1;
        loadContent();
    };

    // Pagination
    document.getElementById('browser-prev-btn').onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            loadContent();
        }
    };
    document.getElementById('browser-next-btn').onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadContent();
        }
    };
}

/**
 * Update view mode button styles
 */
function updateViewModeButtons() {
    const groupedBtn = document.getElementById('browser-view-grouped');
    const flatBtn = document.getElementById('browser-view-flat');

    if (viewMode === 'grouped') {
        groupedBtn.className = 'px-2 py-1 text-xs bg-indigo-500 text-white';
        flatBtn.className = 'px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    } else {
        groupedBtn.className = 'px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300';
        flatBtn.className = 'px-2 py-1 text-xs bg-indigo-500 text-white';
    }
}

/**
 * Load content based on current view mode
 */
async function loadContent() {
    if (viewMode === 'grouped') {
        await loadFamilies();
    } else {
        await loadSubmissions();
    }
}

/**
 * Load submissions from the API
 */
async function loadSubmissions() {
    if (isLoading) return;
    isLoading = true;

    // Show loading state
    document.getElementById('browser-loading').classList.remove('hidden');
    document.getElementById('browser-results').classList.add('hidden');
    document.getElementById('browser-empty').classList.add('hidden');
    document.getElementById('browser-error').classList.add('hidden');
    document.getElementById('browser-pagination').classList.add('hidden');

    try {
        // Build query params
        const params = new URLSearchParams();
        params.append('page', currentPage.toString());
        params.append('limit', '20');
        params.append('sort', currentFilters.sort);

        if (currentFilters.search) {
            params.append('search', currentFilters.search);
        }
        if (currentFilters.type) {
            params.append('type', currentFilters.type);
        }
        if (currentFilters.category) {
            params.append('category', currentFilters.category);
        }
        if (currentFilters.key) {
            params.append('key', currentFilters.key);
        }

        const response = await fetchWithTimeout(`/.netlify/functions/submissions?${params.toString()}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to load submissions');
        }

        currentSubmissions = result.submissions;
        totalPages = result.pagination.totalPages;

        document.getElementById('browser-loading').classList.add('hidden');

        if (currentSubmissions.length === 0) {
            document.getElementById('browser-empty').classList.remove('hidden');
        } else {
            renderSubmissions();
            updatePagination(result.pagination);
        }

    } catch (error) {
        console.error('Error loading submissions:', error);
        document.getElementById('browser-loading').classList.add('hidden');
        document.getElementById('browser-error').classList.remove('hidden');
        document.getElementById('browser-error-message').textContent = error.message;
    } finally {
        isLoading = false;
    }
}

/**
 * Load progression families from the API (grouped view)
 */
async function loadFamilies() {
    if (isLoading) return;
    isLoading = true;

    // Show loading state
    document.getElementById('browser-loading').classList.remove('hidden');
    document.getElementById('browser-results').classList.add('hidden');
    document.getElementById('browser-empty').classList.add('hidden');
    document.getElementById('browser-error').classList.add('hidden');
    document.getElementById('browser-pagination').classList.add('hidden');

    try {
        // Build query params
        const params = new URLSearchParams();
        params.append('page', currentPage.toString());
        params.append('limit', '20');
        params.append('sort', currentFilters.sort);

        if (currentFilters.search) {
            params.append('search', currentFilters.search);
        }
        if (currentFilters.type) {
            params.append('type', currentFilters.type);
        }
        if (currentFilters.category) {
            params.append('category', currentFilters.category);
        }
        if (currentFilters.key) {
            params.append('key', currentFilters.key);
        }

        const response = await fetchWithTimeout(`/.netlify/functions/submission-families?${params.toString()}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to load submissions');
        }

        currentFamilies = result.families;
        totalPages = result.pagination.totalPages;

        document.getElementById('browser-loading').classList.add('hidden');

        if (currentFamilies.length === 0) {
            document.getElementById('browser-empty').classList.remove('hidden');
        } else {
            renderFamilies();
            updatePagination(result.pagination);
        }

    } catch (error) {
        console.error('Error loading families:', error);
        document.getElementById('browser-loading').classList.add('hidden');
        document.getElementById('browser-error').classList.remove('hidden');
        document.getElementById('browser-error-message').textContent = error.message;
    } finally {
        isLoading = false;
    }
}

/**
 * Format a difference badge for variant display
 */
function formatDifferenceBadge(diff, details) {
    let tooltipText = '';
    let displayText = diff;

    if (diff === 'durations' && details?.durations) {
        const d = details.durations;
        tooltipText = d.summary;
        displayText = '⏱ ' + d.summary;
    } else if (diff === 'inversions' && details?.inversions) {
        const inv = details.inversions;
        tooltipText = inv.summary;
        displayText = '🎹 ' + inv.summary;
    } else if (diff.startsWith('key:')) {
        displayText = '🎵 ' + diff;
    }

    const escapedTooltip = (tooltipText || diff).replace(/"/g, '&quot;');
    return '<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-600" title="' + escapedTooltip + '">' + displayText + '</span>';
}

/**
 * Render a single variant row in the expanded variants list
 */
function renderVariantRow(v) {
    const differencesHtml = v.differences.length > 0
        ? v.differences.map(diff => formatDifferenceBadge(diff, v.details)).join('')
        : '<span class="italic">same as original</span>';

    return '<div class="flex items-center justify-between p-1.5 bg-white dark:bg-gray-700 rounded text-xs group">' +
        '<div class="flex-1 min-w-0">' +
            '<span class="text-gray-800 dark:text-white truncate block">' + v.title + '</span>' +
            '<div class="text-[10px] text-gray-500 dark:text-gray-400 flex flex-wrap gap-1 mt-0.5">' +
                differencesHtml +
            '</div>' +
        '</div>' +
        '<div class="flex items-center gap-1 shrink-0 ml-2">' +
            // Upvote button (clickable)
            '<button onclick="event.stopPropagation(); window.upvoteSubmission && window.upvoteSubmission(\'' + v.id + '\', this)" ' +
                'class="upvote-btn text-[10px] text-gray-400 hover:text-indigo-500 flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors" title="Upvote">' +
                '<svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"/></svg>' +
                '<span class="upvote-count">' + (v.upvoteCount || 0) + '</span>' +
            '</button>' +
            // Play button
            '<button onclick="event.stopPropagation(); window.playSubmissionPreview && window.playSubmissionPreview(\'' + v.id + '\', this)" ' +
                'class="play-btn px-1.5 py-0.5 text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors flex items-center gap-0.5" title="Play preview">' +
                '<svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>' +
                '<span class="play-text">Play</span>' +
            '</button>' +
            // View button
            '<button onclick="event.stopPropagation(); window.viewCommunitySubmission && window.viewCommunitySubmission(\'' + v.id + '\')" ' +
                'class="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-300 rounded transition-colors">' +
                'View' +
            '</button>' +
            // Load/Append button
            '<button onclick="event.stopPropagation(); window.loadCommunitySubmission && window.loadCommunitySubmission(\'' + v.id + '\')" ' +
                'class="px-1.5 py-0.5 text-[10px] bg-indigo-500 hover:bg-indigo-600 text-white rounded transition-colors">' +
                'Load/Append' +
            '</button>' +
            // Report button
            '<button onclick="event.stopPropagation(); window.showReportModal && window.showReportModal(\'' + v.id + '\', \'' + escapeHtml(v.title || 'Untitled') + '\')" ' +
                'class="px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-600 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors" title="Report">' +
                '<svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>' +
            '</button>' +
        '</div>' +
    '</div>';
}

/**
 * Render progression families (grouped view)
 */
function renderFamilies() {
    const container = document.getElementById('browser-results');

    container.innerHTML = currentFamilies.map(family => {
        const c = family.canonical;
        const hasVariants = family.variantCount > 1;
        const isExpanded = expandedFamilies.has(family.baseHash);

        // Format author display - displayName from backend may already include @ prefix
        const authorDisplay = c.author?.displayName || 'anon';
        // Only add @ if not already present
        const formattedAuthor = authorDisplay.startsWith('@') ? authorDisplay : `@${authorDisplay}`;
        // Get first letter for avatar, stripping @ if present
        const avatarLetter = (authorDisplay.replace(/^@/, '') || 'A').charAt(0);

        return `
            <div class="family-card bg-white dark:bg-gray-700 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-600 ${hasVariants ? 'ring-1 ring-indigo-200 dark:ring-indigo-800' : ''} flex flex-col">
                <div class="p-3 flex flex-col flex-1">
                    <!-- Canonical submission info -->
                    <div class="flex items-center justify-between mb-1">
                        <div class="flex items-center gap-1.5 min-w-0 flex-1">
                            ${c.author?.avatarUrl ?
                                `<img src="${c.author.avatarUrl}" class="w-4 h-4 rounded-full shrink-0">` :
                                `<span class="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[8px] shrink-0">${avatarLetter}</span>`}
                            <span class="text-xs text-gray-600 dark:text-gray-400 truncate">${formattedAuthor}</span>
                        </div>
                        <div class="flex items-center gap-2 text-[10px] shrink-0">
                            <!-- Type indicator -->
                            <span class="px-1.5 py-0.5 rounded ${
                                c.submissionType === 'full-composition'
                                    ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300'
                                    : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'
                            }" title="${c.submissionType === 'full-composition' ? 'Full Composition with melody/bass' : 'Chord Progression only'}">
                                ${c.submissionType === 'full-composition' ? '🎼 Full' : '🎹 Chords'}
                            </span>
                            <span class="text-gray-500 dark:text-gray-400" title="Key">${c.keySignature || 'C'}</span>
                            <span title="Upvotes" class="flex items-center gap-0.5 text-gray-500 dark:text-gray-400">
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"/></svg>
                                ${family.totalUpvotes}
                            </span>
                        </div>
                    </div>

                    <!-- Title (moved above progression) -->
                    <h4 class="text-sm font-semibold text-gray-800 dark:text-white truncate mb-2" title="${c.title}">
                        ${c.title}
                    </h4>

                    <!-- Progression (scrollable with tooltip) -->
                    <div class="mb-2 p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded text-sm font-mono text-indigo-700 dark:text-indigo-300 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-indigo-300 dark:scrollbar-thumb-indigo-600" title="${c.normalizedProgression || ''}">
                        ${c.normalizedProgression || 'No progression'}
                    </div>

                    <!-- Variant badge (if has variants) - moved below progression -->
                    ${hasVariants ? `
                        <button onclick="window.toggleFamilyExpand && window.toggleFamilyExpand('${family.baseHash}')"
                                class="w-full mb-2 px-2 py-1.5 text-xs rounded-lg flex items-center justify-between gap-1 border-2 cursor-pointer transition-all ${isExpanded ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-400 dark:border-indigo-500' : 'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:from-indigo-50 hover:to-purple-50 dark:hover:from-indigo-900/40 dark:hover:to-purple-900/40'}">
                            <span class="flex items-center gap-1.5 font-medium">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2"/>
                                </svg>
                                ${family.variantCount} variations
                            </span>
                            <span class="flex items-center gap-1 text-[10px]">
                                ${family.variantInfo.hasDurationVariants ? '⏱️' : ''}
                                ${family.variantInfo.hasInversionVariants ? '🔄' : ''}
                                ${family.variantInfo.hasKeyVariants ? '🎹' : ''}
                                <svg class="w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                                </svg>
                            </span>
                        </button>
                    ` : ''}

                    <!-- Spacer to push actions to bottom -->
                    <div class="flex-1"></div>

                    <!-- Actions (always at bottom) -->
                    <div class="flex gap-1 mt-auto">
                        <!-- Upvote button -->
                        <button onclick="window.upvoteSubmission && window.upvoteSubmission('${c.id}', this)"
                                class="upvote-btn px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-gray-600 dark:text-gray-300 rounded transition-colors flex items-center gap-1" title="Upvote">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"/></svg>
                            <span class="upvote-count">${c.upvoteCount || 0}</span>
                        </button>
                        <!-- Play preview button -->
                        <button onclick="window.playSubmissionPreview && window.playSubmissionPreview('${c.id}', this)"
                                class="play-btn px-2 py-1 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors flex items-center gap-1" title="Play preview">
                            <svg class="w-3 h-3 play-icon" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            <svg class="w-3 h-3 stop-icon hidden" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12"/></svg>
                        </button>
                        <!-- View button -->
                        <button onclick="window.viewCommunitySubmission && window.viewCommunitySubmission('${c.id}')"
                                class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-300 rounded transition-colors">
                            View
                        </button>
                        <!-- Load/Append button -->
                        <button onclick="window.loadCommunitySubmission && window.loadCommunitySubmission('${c.id}')"
                                class="flex-1 px-2 py-1 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded transition-colors">
                            Load/Append
                        </button>
                        <!-- Report button -->
                        <button onclick="window.showReportModal && window.showReportModal('${c.id}', '${escapeHtml(c.title || 'Untitled')}')"
                                class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors" title="Report">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                        </button>
                    </div>
                </div>

                <!-- Expanded variants list -->
                ${isExpanded && hasVariants ? `
                    <div class="border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-2 space-y-1">
                        <p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Variations:</p>
                        ${family.variants.map(v => renderVariantRow(v)).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    container.classList.remove('hidden');
}

/**
 * Toggle family expansion
 */
function toggleFamilyExpand(baseHash) {
    if (expandedFamilies.has(baseHash)) {
        expandedFamilies.delete(baseHash);
    } else {
        expandedFamilies.add(baseHash);
    }
    renderFamilies();
}

// Export for window access
window.toggleFamilyExpand = toggleFamilyExpand;

/**
 * Show key picker modal for loading chord progressions
 * @param {string} submissionTitle - Title of the submission
 * @param {string} originalKey - Original key the submission was saved in
 * @param {object} options - Additional options
 * @param {boolean} options.showAppendOption - Whether to show the append option (default: true)
 * @returns {Promise<{key: string, mode: 'replace'|'append'}|null>} Selected key and mode, or null if cancelled
 */
function showKeyPickerModal(submissionTitle, originalKey, options = {}) {
    const { showAppendOption = true } = options;

    return new Promise((resolve) => {
        // Get user's current working key
        let currentKey = 'C';
        try {
            currentKey = getCurrentKey() || 'C';
        } catch (e) {
            console.warn('[KeyPicker] Could not get current key, defaulting to C');
        }

        // Check if original key is a common key
        const isOriginalKeyCommon = COMMON_KEYS.includes(originalKey);

        // Check if user has existing progression
        const compState = getCompositionState();
        const hasExistingProgression = compState &&
            ((compState.getChordSegments?.()?.length || 0) > 0 ||
             (compState.storedProgressionData?.length || 0) > 0);

        const modal = document.createElement('div');
        modal.id = 'key-picker-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4';

        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                <!-- Header -->
                <div class="px-5 py-4 bg-gradient-to-r from-indigo-500 to-purple-600">
                    <h3 class="text-lg font-bold text-white">Load Progression</h3>
                    <p class="text-sm text-white/80 mt-1">"${submissionTitle}"</p>
                </div>

                <div class="p-5">
                    <!-- Load Mode Selection (only if user has existing progression) -->
                    ${showAppendOption && hasExistingProgression ? `
                        <div class="mb-4">
                            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Load Mode</p>
                            <div class="flex gap-2">
                                <button data-mode="replace" class="mode-btn flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white ring-2 ring-indigo-300 dark:ring-indigo-700 transition-all">
                                    <div class="font-semibold">Replace</div>
                                    <div class="text-xs opacity-80">Clear current work</div>
                                </button>
                                <button data-mode="append" class="mode-btn flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all">
                                    <div class="font-semibold">Append</div>
                                    <div class="text-xs opacity-80">Add to current</div>
                                </button>
                            </div>
                        </div>
                    ` : ''}

                    <!-- Original key info -->
                    <div class="mb-4 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                        <span class="text-gray-500 dark:text-gray-400">Originally saved in: </span>
                        <span class="font-medium text-gray-700 dark:text-gray-300">${originalKey}</span>
                    </div>

                    <!-- Key Selection Section (shown for Replace mode) -->
                    <div id="key-selection-section">
                        <!-- Key Selection Header -->
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider" id="key-selection-label">
                            Select Key
                        </p>

                        <!-- Common keys -->
                        <div class="mb-3">
                            <div class="flex flex-wrap gap-2">
                                ${COMMON_KEYS.map(key => `
                                    <button data-key="${key}" class="key-btn px-3 py-1.5 rounded-lg text-sm font-medium ${key === originalKey ? 'bg-indigo-500 text-white ring-2 ring-indigo-300 dark:ring-indigo-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400'} transition-colors">
                                        ${key}
                                    </button>
                                `).join('')}
                            </div>
                        </div>

                        <!-- All keys dropdown for less common keys -->
                        <div class="mb-2">
                            <select id="key-picker-select" class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500">
                                <option value="">Other keys...</option>
                                ${ALL_KEYS.filter(k => !COMMON_KEYS.includes(k)).map(key => `
                                    <option value="${key}" ${key === originalKey ? 'selected' : ''}>${key}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- Append Mode Info (shown when Append is selected) -->
                    <div id="append-mode-info" class="hidden">
                        <div class="px-4 py-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
                            <div class="flex items-center gap-2 mb-2">
                                <svg class="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                <span class="font-medium text-emerald-700 dark:text-emerald-300">Transposing to your current key</span>
                            </div>
                            <p class="text-sm text-emerald-600 dark:text-emerald-400 mb-2">
                                This progression will be transposed to <strong>${currentKey}</strong> to match your current workspace.
                            </p>
                            <p class="text-xs text-emerald-500 dark:text-emerald-500">
                                💡 To transpose the entire composition after loading, use the Key selector in the Composition Studio.
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-5 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-end gap-3">
                    <button id="key-picker-cancel" class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                        Cancel
                    </button>
                    <button id="key-picker-confirm" class="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors">
                        Load
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Pre-select original key
        let selectedKey = isOriginalKeyCommon ? originalKey : (ALL_KEYS.includes(originalKey) ? originalKey : 'C');
        let selectedMode = 'replace'; // Default mode

        // If original key is not common, check if dropdown has it
        if (!isOriginalKeyCommon && ALL_KEYS.filter(k => !COMMON_KEYS.includes(k)).includes(originalKey)) {
            const select = modal.querySelector('#key-picker-select');
            if (select) {
                select.value = originalKey;
            }
        }

        // Handle mode button clicks (replace vs append)
        modal.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove selection from all mode buttons
                modal.querySelectorAll('.mode-btn').forEach(b => {
                    b.classList.remove('bg-indigo-500', 'bg-emerald-500', 'text-white', 'ring-2', 'ring-indigo-300', 'ring-emerald-300', 'dark:ring-indigo-700', 'dark:ring-emerald-700');
                    b.classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
                });

                // Highlight selected mode button
                btn.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
                selectedMode = btn.dataset.mode;

                const keySelectionSection = modal.querySelector('#key-selection-section');
                const appendModeInfo = modal.querySelector('#append-mode-info');
                const confirmBtn = modal.querySelector('#key-picker-confirm');

                if (selectedMode === 'append') {
                    btn.classList.add('bg-emerald-500', 'text-white', 'ring-2', 'ring-emerald-300', 'dark:ring-emerald-700');
                    // Hide key selection, show append info
                    keySelectionSection.classList.add('hidden');
                    appendModeInfo.classList.remove('hidden');
                    // For append, always use user's current key
                    selectedKey = currentKey;
                    confirmBtn.textContent = 'Append';
                    confirmBtn.classList.remove('bg-indigo-500', 'hover:bg-indigo-600');
                    confirmBtn.classList.add('bg-emerald-500', 'hover:bg-emerald-600');
                } else {
                    btn.classList.add('bg-indigo-500', 'text-white', 'ring-2', 'ring-indigo-300', 'dark:ring-indigo-700');
                    // Show key selection, hide append info
                    keySelectionSection.classList.remove('hidden');
                    appendModeInfo.classList.add('hidden');
                    // Restore key selection to original key
                    selectedKey = isOriginalKeyCommon ? originalKey : (ALL_KEYS.includes(originalKey) ? originalKey : 'C');
                    confirmBtn.textContent = 'Load';
                    confirmBtn.classList.remove('bg-emerald-500', 'hover:bg-emerald-600');
                    confirmBtn.classList.add('bg-indigo-500', 'hover:bg-indigo-600');
                }
            });
        });

        // Handle key button clicks
        modal.querySelectorAll('.key-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove selection from all key buttons
                modal.querySelectorAll('.key-btn').forEach(b => {
                    b.classList.remove('bg-indigo-500', 'text-white', 'ring-2', 'ring-indigo-300', 'dark:ring-indigo-700');
                    b.classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
                });
                // Clear select dropdown
                const select = modal.querySelector('#key-picker-select');
                if (select) select.value = '';

                // Highlight selected button
                btn.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
                btn.classList.add('bg-indigo-500', 'text-white', 'ring-2', 'ring-indigo-300', 'dark:ring-indigo-700');

                selectedKey = btn.dataset.key;
            });
        });

        // Handle select dropdown
        const selectEl = modal.querySelector('#key-picker-select');
        if (selectEl) {
            selectEl.addEventListener('change', (e) => {
                if (e.target.value) {
                    // Remove selection from all key buttons
                    modal.querySelectorAll('.key-btn').forEach(b => {
                        b.classList.remove('bg-indigo-500', 'text-white', 'ring-2', 'ring-indigo-300', 'dark:ring-indigo-700');
                        b.classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
                    });
                    selectedKey = e.target.value;
                }
            });
        }

        // Handle confirm - return object with key and mode
        modal.querySelector('#key-picker-confirm').addEventListener('click', () => {
            modal.remove();
            resolve({ key: selectedKey, mode: selectedMode });
        });

        // Handle cancel
        modal.querySelector('#key-picker-cancel').addEventListener('click', () => {
            modal.remove();
            resolve(null);
        });

        // Handle backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                resolve(null);
            }
        });

        // Handle escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
                resolve(null);
            }
        };
        document.addEventListener('keydown', handleEscape);
    });
}

/**
 * Render submissions to the grid (flat view - more compact)
 */
function renderSubmissions() {
    const container = document.getElementById('browser-results');

    container.innerHTML = currentSubmissions.map(submission => {
        // Format author display - displayName from backend may already include @ prefix
        const authorDisplay = submission.author?.displayName || 'anon';
        // Only add @ if not already present
        const formattedAuthor = authorDisplay.startsWith('@') ? authorDisplay : `@${authorDisplay}`;
        // Get first letter for avatar, stripping @ if present
        const avatarLetter = (authorDisplay.replace(/^@/, '') || 'A').charAt(0);

        return `
        <div class="submission-card bg-white dark:bg-gray-700 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-600">
            <div class="p-3">
                <!-- Header row -->
                <div class="flex items-center justify-between mb-1">
                    <div class="flex items-center gap-1.5 min-w-0 flex-1">
                        ${submission.author?.avatarUrl ?
                            `<img src="${submission.author.avatarUrl}" class="w-4 h-4 rounded-full shrink-0">` :
                            `<span class="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[8px] shrink-0">${avatarLetter}</span>`}
                        <span class="text-xs text-gray-600 dark:text-gray-400 truncate">${formattedAuthor}</span>
                    </div>
                    <span class="text-[10px] px-1.5 py-0.5 rounded ${
                        submission.submission_type === 'full-composition'
                            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300'
                            : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'
                    }">
                        ${submission.submission_type === 'full-composition' ? 'Full' : 'Chords'}
                    </span>
                </div>

                <!-- Title (moved above progression) -->
                <h4 class="text-sm font-semibold text-gray-800 dark:text-white truncate mb-2" title="${submission.title}">
                    ${submission.title}
                </h4>

                <!-- Progression preview (scrollable with tooltip) -->
                <div class="mb-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs font-mono text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600" title="${submission.normalized_progression || ''}">
                    ${submission.normalized_progression || 'No progression'}
                </div>

                <!-- Compact meta + stats row -->
                <div class="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-2">
                    <div class="flex items-center gap-2">
                        <span class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                            ${submission.key_signature || 'C'}
                        </span>
                        <span>${submission.chord_count || 0} chords</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span title="Upvotes">▲ ${submission.upvote_count || 0}</span>
                        <span title="Views">👁 ${submission.view_count || 0}</span>
                    </div>
                </div>

                <!-- Tags (condensed) -->
                ${submission.tags && submission.tags.length > 0 ? `
                    <div class="flex flex-wrap gap-1 mb-2">
                        ${submission.tags.slice(0, 2).map(tag => `
                            <span class="px-1.5 py-0.5 text-[9px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">
                                ${tag.name}
                            </span>
                        `).join('')}
                        ${submission.tags.length > 2 ? `<span class="text-[9px] text-gray-400">+${submission.tags.length - 2}</span>` : ''}
                    </div>
                ` : ''}

                <!-- Actions (compact) -->
                <div class="flex gap-1.5">
                    <!-- Upvote button -->
                    <button onclick="window.upvoteSubmission && window.upvoteSubmission('${submission.id}', this)"
                            class="upvote-btn px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-gray-600 dark:text-gray-300 rounded transition-colors flex items-center gap-1" title="Upvote">
                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"/></svg>
                        <span class="upvote-count">${submission.upvote_count || 0}</span>
                    </button>
                    <!-- Play preview button -->
                    <button onclick="window.playSubmissionPreview && window.playSubmissionPreview('${submission.id}', this)"
                            class="play-btn px-2 py-1 text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors flex items-center gap-1" title="Play preview">
                        <svg class="w-3 h-3 play-icon" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        <svg class="w-3 h-3 stop-icon hidden" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12"/></svg>
                    </button>
                    <!-- View button -->
                    <button onclick="window.viewCommunitySubmission && window.viewCommunitySubmission('${submission.id}')"
                            class="px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded transition-colors">
                        View
                    </button>
                    <!-- Load/Append button -->
                    <button onclick="window.loadCommunitySubmission && window.loadCommunitySubmission('${submission.id}')"
                            class="flex-1 px-2 py-1 text-[10px] bg-indigo-500 hover:bg-indigo-600 text-white rounded transition-colors">
                        Load/Append
                    </button>
                    <!-- Report button -->
                    <button onclick="window.showReportModal && window.showReportModal('${submission.id}', '${escapeHtml(submission.title || 'Untitled')}')"
                            class="px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-600 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors" title="Report">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    </button>
                </div>
            </div>
        </div>
    `;
    }).join('');

    container.classList.remove('hidden');
}

/**
 * Update pagination controls
 */
function updatePagination(pagination) {
    const paginationContainer = document.getElementById('browser-pagination');
    const pageInfo = document.getElementById('browser-page-info');
    const prevBtn = document.getElementById('browser-prev-btn');
    const nextBtn = document.getElementById('browser-next-btn');

    const start = (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.page * pagination.limit, pagination.total);

    pageInfo.textContent = `Showing ${start}-${end} of ${pagination.total}`;

    prevBtn.disabled = pagination.page <= 1;
    nextBtn.disabled = pagination.page >= pagination.totalPages;

    paginationContainer.classList.remove('hidden');
}

// ============================================================================
// PREVIEW NOTATION & AUDIO HELPERS
// ============================================================================

// Track currently playing preview notes
let _previewPlayingNotes = null;
let _previewPlayingInstrument = null;
let _previewPlaybackTimeout = null;
let _previewIsPlaying = false;

/**
 * Ensure audio system is ready for preview playback
 */
function ensurePreviewAudioReady() {
    if (window.initAudio) window.initAudio();
    const audioIsReady = window.getAudioIsReady && window.getAudioIsReady();
    if (!audioIsReady) return false;
    if (window.Tone && window.Tone.context.state !== 'running') {
        window.Tone.start();
    }
    return true;
}

/**
 * Play a single chord for preview
 */
function playPreviewChord(chord, key) {
    stopPreviewChord();

    try {
        if (!ensurePreviewAudioReady()) return;

        let notes = [];

        // Use chord's notes if available
        if (chord.notes && chord.notes.length > 0) {
            notes = [...chord.notes];
        } else {
            // Generate notes from chord properties (use null to derive enharmonic from key)
            const res = getInvertedChordNotes(
                chord.root,
                chord.type,
                chord.inversion || 0,
                key,
                0,
                null,
                'full'
            );
            notes = res?.specificNotes || [];
        }

        if (notes.length === 0) return;

        const instrument = window.getInstrument && window.getInstrument();
        if (!instrument) return;

        const baseTime = window.Tone?.now?.() || undefined;
        instrument.triggerAttack(notes, baseTime);

        _previewPlayingNotes = notes;
        _previewPlayingInstrument = instrument;

    } catch (e) {
        console.warn('[Preview] Could not play chord:', e);
    }
}

/**
 * Stop preview chord playback
 */
function stopPreviewChord() {
    if (_previewPlayingNotes && _previewPlayingInstrument) {
        try {
            const releaseTime = window.Tone?.now?.() || undefined;
            _previewPlayingInstrument.triggerRelease(_previewPlayingNotes, releaseTime);
        } catch (e) {
            // Silently ignore
        }
        _previewPlayingNotes = null;
        _previewPlayingInstrument = null;
    }
}

/**
 * Play entire progression preview
 */
function playProgressionPreview(chords, key, bpm = 120, onChordChange = null, onComplete = null) {
    stopProgressionPreview();

    if (!chords || chords.length === 0) return;
    if (!ensurePreviewAudioReady()) return;

    _previewIsPlaying = true;
    const beatDuration = 60 / bpm; // seconds per beat
    const chordDuration = beatDuration * 2; // 2 beats per chord for preview

    let currentIndex = 0;

    function playNextChord() {
        if (!_previewIsPlaying || currentIndex >= chords.length) {
            stopProgressionPreview();
            if (onComplete) onComplete();
            return;
        }

        const chord = chords[currentIndex];
        if (onChordChange) onChordChange(currentIndex);
        playPreviewChord(chord, key);

        currentIndex++;
        _previewPlaybackTimeout = setTimeout(() => {
            stopPreviewChord();
            setTimeout(playNextChord, 50); // Small gap between chords
        }, chordDuration * 1000);
    }

    playNextChord();
}

/**
 * Stop progression preview playback
 */
function stopProgressionPreview() {
    _previewIsPlaying = false;
    if (_previewPlaybackTimeout) {
        clearTimeout(_previewPlaybackTimeout);
        _previewPlaybackTimeout = null;
    }
    stopPreviewChord();
}

// Track which button is currently playing for UI state
let _currentPlayingButton = null;

/**
 * Play a submission preview from the browser list
 * Fetches submission data and plays the progression
 */
async function playSubmissionPreview(submissionId, buttonElement) {
    // If already playing this submission, stop it
    if (_currentPlayingButton === buttonElement && _previewIsPlaying) {
        stopProgressionPreview();
        updatePlayButtonUI(buttonElement, false);
        _currentPlayingButton = null;
        return;
    }

    // Stop any currently playing preview
    if (_currentPlayingButton) {
        stopProgressionPreview();
        updatePlayButtonUI(_currentPlayingButton, false);
    }

    try {
        // Fetch submission data
        const response = await fetchWithTimeout(`/.netlify/functions/submission/${submissionId}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to load submission');
        }

        const submission = result.submission;
        const key = submission.keySignature || 'C';
        const bpm = submission.bpm || 120;

        // Extract chord data
        let chords = [];
        const compositionData = submission.compositionData;
        if (compositionData) {
            if (compositionData.formatVersion && compositionData.progressionData) {
                chords = compositionData.progressionData;
            } else if (Array.isArray(compositionData)) {
                chords = compositionData;
            }
        }

        if (chords.length === 0) {
            console.warn('[playSubmissionPreview] No chords to play');
            return;
        }

        // Update button UI
        _currentPlayingButton = buttonElement;
        updatePlayButtonUI(buttonElement, true);

        // Play the progression
        playProgressionPreview(
            chords,
            key,
            bpm,
            null, // No chord change callback needed for list preview
            () => {
                // On complete
                updatePlayButtonUI(buttonElement, false);
                _currentPlayingButton = null;
            }
        );

    } catch (error) {
        console.error('[playSubmissionPreview] Error:', error);
        updatePlayButtonUI(buttonElement, false);
        _currentPlayingButton = null;
    }
}

/**
 * Update play button UI state
 */
function updatePlayButtonUI(button, isPlaying) {
    if (!button) return;
    const playIcon = button.querySelector('.play-icon');
    const stopIcon = button.querySelector('.stop-icon');
    if (playIcon) playIcon.classList.toggle('hidden', isPlaying);
    if (stopIcon) stopIcon.classList.toggle('hidden', !isPlaying);
}

// Export for window access
window.playSubmissionPreview = playSubmissionPreview;

/**
 * Upvote a submission
 */
async function upvoteSubmission(submissionId, buttonElement) {
    console.log('[upvoteSubmission] Called with submissionId:', submissionId);
    console.log('[upvoteSubmission] Button element:', buttonElement);

    // Check if user is signed in
    if (!isSignedIn()) {
        console.log('[upvoteSubmission] User not signed in');
        alert('Please sign in to upvote submissions.');
        return;
    }
    console.log('[upvoteSubmission] User is signed in');

    try {
        console.log('[upvoteSubmission] Getting auth token...');
        const token = await getAuthToken();
        if (!token) {
            console.log('[upvoteSubmission] No token returned');
            alert('Authentication error. Please sign in again.');
            return;
        }
        console.log('[upvoteSubmission] Got token, making API call...');

        const response = await fetchWithTimeout('/.netlify/functions/upvote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ submissionId })
        });

        console.log('[upvoteSubmission] Response status:', response.status);
        const result = await response.json();
        console.log('[upvoteSubmission] Response body:', result);

        if (!response.ok) {
            throw new Error(result.error || 'Failed to upvote');
        }

        console.log('[upvoteSubmission] Success! Action:', result.action);

        // Update ALL upvote buttons for this submission (it may appear in multiple places)
        const allUpvoteButtons = document.querySelectorAll(`button[onclick*="upvoteSubmission"][onclick*="${submissionId}"]`);
        console.log('[upvoteSubmission] Found', allUpvoteButtons.length, 'buttons to update');

        allUpvoteButtons.forEach((btn, index) => {
            const countSpan = btn.querySelector('.upvote-count');
            const currentCount = parseInt(countSpan?.textContent) || 0;
            console.log(`[upvoteSubmission] Button ${index}: currentCount=${currentCount}, countSpan=`, countSpan);

            if (result.action === 'added') {
                // Upvote was added
                if (countSpan) {
                    countSpan.textContent = currentCount + 1;
                    console.log(`[upvoteSubmission] Button ${index}: Updated count to`, currentCount + 1);
                }
                btn.classList.add('text-indigo-500', 'bg-indigo-100', 'dark:bg-indigo-900/50');
                btn.classList.remove('text-gray-400', 'text-gray-600', 'bg-gray-100');
            } else if (result.action === 'removed') {
                // Upvote was removed (toggled off)
                if (countSpan) {
                    countSpan.textContent = Math.max(0, currentCount - 1);
                    console.log(`[upvoteSubmission] Button ${index}: Updated count to`, Math.max(0, currentCount - 1));
                }
                btn.classList.remove('text-indigo-500', 'bg-indigo-100', 'dark:bg-indigo-900/50');
                btn.classList.add('text-gray-600', 'bg-gray-100');
            }
        });

    } catch (error) {
        console.error('[upvoteSubmission] Error:', error);
        alert('Failed to upvote: ' + error.message);
    }
}

// Export for window access
window.upvoteSubmission = upvoteSubmission;

/**
 * Get chord symbol for display
 */
function getChordSymbol(root, type) {
    const symbol = CHORD_DEFINITIONS[type]?.symbol ?? '';
    return `${root}${symbol}`;
}

/**
 * Render chord notation preview using VexFlow with grand staff
 * Creates a display with treble and bass clef showing chords
 */
/**
 * Render notation preview for a submission
 * Handles both full compositions (with stored treble/bass voices) and chord progressions
 *
 * @param {HTMLElement} container - Container element for the preview
 * @param {Object} compositionData - Full composition data object
 * @param {string} key - Key signature
 */
function renderNotationPreview(container, compositionData, key) {
    if (!container) {
        return;
    }

    // Handle legacy calls that pass chords array directly
    let chords = [];
    let measures = null;
    let isFullComposition = false;

    if (Array.isArray(compositionData)) {
        // Legacy: passed chords array directly
        chords = compositionData;
    } else if (compositionData && typeof compositionData === 'object') {
        // New format: full composition data
        if (compositionData.submissionType === 'full-composition' && compositionData.measures) {
            isFullComposition = true;
            measures = compositionData.measures;
        }
        if (compositionData.progressionData) {
            chords = compositionData.progressionData;
        }
    }

    if (!isFullComposition && (!chords || chords.length === 0)) {
        container.innerHTML = '<p class="text-gray-500 text-sm italic">No chords to display</p>';
        return;
    }

    // Check if VexFlow is available
    if (typeof VexFlow === 'undefined') {
        container.innerHTML = '<p class="text-gray-500 text-sm italic">Notation preview unavailable</p>';
        return;
    }

    try {
        const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, StaveConnector, Dot } = VexFlow;

        // Calculate dimensions for grand staff
        const itemCount = isFullComposition ? measures.length : chords.length;
        const itemsPerLine = Math.min(itemCount, 4);
        const numLines = Math.ceil(itemCount / 4);
        const measureWidth = 120;
        const staveX = 40; // Increased from 10 to make room for brace
        const trebleY = 30;
        const bassY = 120;
        const systemHeight = 180;
        const width = Math.min(itemsPerLine * measureWidth + staveX + 40, 580);
        const height = numLines * systemHeight + 20;

        // Create canvas with white background
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.style.backgroundColor = '#ffffff';
        container.innerHTML = '';
        container.style.backgroundColor = '#ffffff';
        container.style.maxHeight = '300px';
        container.style.overflowY = 'auto';
        container.style.overflowX = 'auto';
        container.style.borderRadius = '8px';
        container.appendChild(canvas);

        // Create renderer
        const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
        renderer.resize(width, height);
        const context = renderer.getContext();

        // Fill white background
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);

        // IMPORTANT: Set stroke and fill to black for all notation elements
        context.strokeStyle = '#000000';
        context.fillStyle = '#000000';

        // Get key signature info
        const keyAccidentals = getKeyAccidentalsForPreview(key);
        const vexKey = getVexFlowKeyForPreview(key);

        // Render based on composition type
        if (isFullComposition) {
            renderFullCompositionPreview(context, measures, key, keyAccidentals, vexKey, {
                Stave, StaveNote, Voice, Formatter, Accidental, StaveConnector, Dot,
                staveX, trebleY, bassY, systemHeight, width, numLines
            });
        } else {
            renderChordProgressionPreview(context, chords, key, keyAccidentals, vexKey, {
                Stave, StaveNote, Voice, Formatter, Accidental, StaveConnector, Dot,
                staveX, trebleY, bassY, systemHeight, width, numLines
            });
        }

    } catch (e) {
        console.error('[renderNotationPreview] Error:', e);
        container.innerHTML = '<p class="text-gray-500 text-sm italic">Could not render notation</p>';
    }
}

/**
 * Render full composition preview using stored treble/bass voices
 */
function renderFullCompositionPreview(context, measures, _key, keyAccidentals, vexKey, vf) {
    const { Stave, StaveNote, Voice, Formatter, StaveConnector,
            staveX, trebleY, bassY, systemHeight, width, numLines } = vf;

    for (let lineIdx = 0; lineIdx < numLines; lineIdx++) {
        const lineMeasures = measures.slice(lineIdx * 4, (lineIdx + 1) * 4);
        const baseY = lineIdx * systemHeight;

        // Create treble stave
        const staveWidth = width - staveX - 20;
        const trebleStave = new Stave(staveX, baseY + trebleY, staveWidth);
        if (lineIdx === 0) {
            trebleStave.addClef('treble');
            try { trebleStave.addKeySignature(vexKey); } catch (e) { /* ignore */ }
        }
        trebleStave.setContext(context).draw();

        // Create bass stave
        const bassStave = new Stave(staveX, baseY + bassY, staveWidth);
        if (lineIdx === 0) {
            bassStave.addClef('bass');
            try { bassStave.addKeySignature(vexKey); } catch (e) { /* ignore */ }
        }
        bassStave.setContext(context).draw();

        // Draw brace and connectors
        if (lineIdx === 0) {
            const brace = new StaveConnector(trebleStave, bassStave);
            brace.setType(StaveConnector.type.BRACE);
            brace.setContext(context).draw();

            const lineConnector = new StaveConnector(trebleStave, bassStave);
            lineConnector.setType(StaveConnector.type.SINGLE_LEFT);
            lineConnector.setContext(context).draw();
        }

        const rightLine = new StaveConnector(trebleStave, bassStave);
        rightLine.setType(StaveConnector.type.SINGLE_RIGHT);
        rightLine.setContext(context).draw();

        // Create notes from stored voices
        const trebleVexNotes = [];
        const bassVexNotes = [];
        let totalTrebleBeats = 0;
        let totalBassBeats = 0;

        for (const measure of lineMeasures) {
            // Process treble voices (Voice 1 and Voice 2)
            const trebleVoices = measure.notation?.treble?.voices || [];
            const trebleNotes = trebleVoices.flatMap(v => v?.notes || []);

            if (trebleNotes.length > 0) {
                for (const note of trebleNotes) {
                    const vexNote = createVexNoteFromStoredNote(note, 'treble', keyAccidentals, vf);
                    if (vexNote) {
                        trebleVexNotes.push(vexNote);
                        totalTrebleBeats += getNoteDurationBeats(note);
                    }
                }
            } else {
                // Add whole rest for empty measure
                trebleVexNotes.push(new StaveNote({
                    clef: 'treble',
                    keys: ['b/4'],
                    duration: 'wr'
                }));
                totalTrebleBeats += 4;
            }

            // Process bass voices (Voice 1 and Voice 2)
            const bassVoices = measure.notation?.bass?.voices || [];
            const bassNotes = bassVoices.flatMap(v => v?.notes || []);

            if (bassNotes.length > 0) {
                for (const note of bassNotes) {
                    const vexNote = createVexNoteFromStoredNote(note, 'bass', keyAccidentals, vf);
                    if (vexNote) {
                        bassVexNotes.push(vexNote);
                        totalBassBeats += getNoteDurationBeats(note);
                    }
                }
            } else {
                // Add whole rest for empty measure
                bassVexNotes.push(new StaveNote({
                    clef: 'bass',
                    keys: ['d/3'],
                    duration: 'wr'
                }));
                totalBassBeats += 4;
            }
        }

        // Draw treble voice
        if (trebleVexNotes.length > 0) {
            try {
                const trebleVoice = new Voice({ num_beats: totalTrebleBeats, beat_value: 4 }).setStrict(false);
                trebleVoice.addTickables(trebleVexNotes);
                new Formatter().joinVoices([trebleVoice]).format([trebleVoice], staveWidth - 80);
                trebleVoice.draw(context, trebleStave);
            } catch (e) {
                console.warn('[renderFullCompositionPreview] Treble voice error:', e.message);
            }
        }

        // Draw bass voice
        if (bassVexNotes.length > 0) {
            try {
                const bassVoice = new Voice({ num_beats: totalBassBeats, beat_value: 4 }).setStrict(false);
                bassVoice.addTickables(bassVexNotes);
                new Formatter().joinVoices([bassVoice]).format([bassVoice], staveWidth - 80);
                bassVoice.draw(context, bassStave);
            } catch (e) {
                console.warn('[renderFullCompositionPreview] Bass voice error:', e.message);
            }
        }
    }
}

/**
 * Render chord progression preview - all chord notes in bass clef
 */
function renderChordProgressionPreview(context, chords, key, keyAccidentals, vexKey, vf) {
    const { Stave, StaveNote, Voice, Formatter, Accidental, StaveConnector, Dot,
            staveX, trebleY, bassY, systemHeight, width, numLines } = vf;

    for (let lineIdx = 0; lineIdx < numLines; lineIdx++) {
        const lineChords = chords.slice(lineIdx * 4, (lineIdx + 1) * 4);
        const baseY = lineIdx * systemHeight;

        // Create treble stave
        const staveWidth = width - staveX - 20;
        const trebleStave = new Stave(staveX, baseY + trebleY, staveWidth);
        if (lineIdx === 0) {
            trebleStave.addClef('treble');
            try { trebleStave.addKeySignature(vexKey); } catch (e) { /* ignore */ }
        }
        trebleStave.setContext(context).draw();

        // Create bass stave
        const bassStave = new Stave(staveX, baseY + bassY, staveWidth);
        if (lineIdx === 0) {
            bassStave.addClef('bass');
            try { bassStave.addKeySignature(vexKey); } catch (e) { /* ignore */ }
        }
        bassStave.setContext(context).draw();

        // Draw brace and connectors
        if (lineIdx === 0) {
            const brace = new StaveConnector(trebleStave, bassStave);
            brace.setType(StaveConnector.type.BRACE);
            brace.setContext(context).draw();

            const lineConnector = new StaveConnector(trebleStave, bassStave);
            lineConnector.setType(StaveConnector.type.SINGLE_LEFT);
            lineConnector.setContext(context).draw();
        }

        const rightLine = new StaveConnector(trebleStave, bassStave);
        rightLine.setType(StaveConnector.type.SINGLE_RIGHT);
        rightLine.setContext(context).draw();

        // Create notes - ALL chord notes go to bass clef (chord progressions are accompaniment)
        const bassNotes = [];
        const trebleNotes = [];
        let totalBeats = 0;

        for (const chord of lineChords) {
            const vexNotes = getVexNotesForChordGrandStaff(chord, key, keyAccidentals);
            const chordBeats = chord.beats || 4;
            const vexDuration = beatsToVexDuration(chordBeats);
            totalBeats += chordBeats;

            // All notes go to bass clef for chord progressions
            const bassKeys = vexNotes.map(n => n.vexKey);
            const bassAccidentals = vexNotes.map(n => n.accidental);

            if (bassKeys.length > 0) {
                const bassNote = new StaveNote({
                    clef: 'bass',
                    keys: bassKeys,
                    duration: vexDuration.duration
                });
                bassAccidentals.forEach((acc, idx) => {
                    if (acc) bassNote.addModifier(new Accidental(acc), idx);
                });
                // Add dot if needed
                if (vexDuration.dotted) {
                    Dot.buildAndAttach([bassNote], { all: true });
                }
                bassNotes.push(bassNote);
            } else {
                // Rest in bass
                bassNotes.push(new StaveNote({
                    clef: 'bass',
                    keys: ['d/3'],
                    duration: vexDuration.duration + 'r'
                }));
            }

            // Add rest in treble to match
            const trebleRest = new StaveNote({
                clef: 'treble',
                keys: ['b/4'],
                duration: vexDuration.duration + 'r'
            });
            trebleNotes.push(trebleRest);
        }

        // Draw bass voice
        if (bassNotes.length > 0) {
            try {
                const bassVoice = new Voice({ num_beats: totalBeats, beat_value: 4 }).setStrict(false);
                bassVoice.addTickables(bassNotes);
                new Formatter().joinVoices([bassVoice]).format([bassVoice], staveWidth - 80);
                bassVoice.draw(context, bassStave);
            } catch (e) {
                console.warn('[renderChordProgressionPreview] Bass voice error:', e.message);
            }
        }

        // Draw treble voice (rests)
        if (trebleNotes.length > 0) {
            try {
                const trebleVoice = new Voice({ num_beats: totalBeats, beat_value: 4 }).setStrict(false);
                trebleVoice.addTickables(trebleNotes);
                new Formatter().joinVoices([trebleVoice]).format([trebleVoice], staveWidth - 80);
                trebleVoice.draw(context, trebleStave);
            } catch (e) {
                console.warn('[renderChordProgressionPreview] Treble voice error:', e.message);
            }
        }
    }
}

/**
 * Create a VexFlow note from a stored note object
 */
function createVexNoteFromStoredNote(note, clef, keyAccidentals, vf) {
    const { StaveNote, Accidental, Dot } = vf;

    if (note.isRest) {
        const duration = toneToVexDuration(note.duration);
        return new StaveNote({
            clef,
            keys: [clef === 'treble' ? 'b/4' : 'd/3'],
            duration: duration + 'r'
        });
    }

    const pitches = note.pitches || [];
    if (pitches.length === 0) return null;

    const keys = [];
    const accidentals = [];

    for (const pitch of pitches) {
        const match = pitch.match(/^([A-G])([#b]?)(\d+)$/);
        if (!match) continue;

        const [, letter, accidental, octave] = match;
        keys.push(`${letter.toLowerCase()}${accidental}/${octave}`);

        // Determine if we need to show an accidental
        let displayAccidental = null;
        if (accidental === '#' && !keyAccidentals.sharps.has(letter)) {
            displayAccidental = '#';
        } else if (accidental === 'b' && !keyAccidentals.flats.has(letter)) {
            displayAccidental = 'b';
        } else if (!accidental && (keyAccidentals.sharps.has(letter) || keyAccidentals.flats.has(letter))) {
            displayAccidental = 'n';
        }
        accidentals.push(displayAccidental);
    }

    if (keys.length === 0) return null;

    const vexDuration = toneToVexDuration(note.duration);
    const staveNote = new StaveNote({
        clef,
        keys,
        duration: vexDuration
    });

    // Add accidentals
    accidentals.forEach((acc, idx) => {
        if (acc) staveNote.addModifier(new Accidental(acc), idx);
    });

    // Add dot if needed
    if (note.dotted) {
        Dot.buildAndAttach([staveNote], { all: true });
    }

    return staveNote;
}

/**
 * Convert Tone.js duration to VexFlow duration
 */
function toneToVexDuration(toneDuration) {
    const map = {
        '1n': 'w',
        '2n': 'h',
        '4n': 'q',
        '8n': '8',
        '16n': '16',
        '32n': '32'
    };
    // Handle dotted durations in the string (e.g., '2n.')
    const cleanDuration = toneDuration?.replace('.', '') || '4n';
    return map[cleanDuration] || 'q';
}

/**
 * Convert beats to VexFlow duration
 */
function beatsToVexDuration(beats) {
    // Map beats to VexFlow durations
    if (beats >= 6) return { duration: 'w', dotted: true }; // 6 beats = dotted whole
    if (beats >= 4) return { duration: 'w', dotted: false }; // 4 beats = whole
    if (beats >= 3) return { duration: 'h', dotted: true };  // 3 beats = dotted half
    if (beats >= 2) return { duration: 'h', dotted: false }; // 2 beats = half
    if (beats >= 1.5) return { duration: 'q', dotted: true }; // 1.5 beats = dotted quarter
    if (beats >= 1) return { duration: 'q', dotted: false };  // 1 beat = quarter
    if (beats >= 0.75) return { duration: '8', dotted: true }; // 0.75 = dotted eighth
    if (beats >= 0.5) return { duration: '8', dotted: false }; // 0.5 = eighth
    return { duration: '16', dotted: false }; // 0.25 = sixteenth
}

/**
 * Get the duration of a note in beats
 */
function getNoteDurationBeats(note) {
    const durationMap = {
        '1n': 4,
        '2n': 2,
        '4n': 1,
        '8n': 0.5,
        '16n': 0.25,
        '32n': 0.125
    };
    const cleanDuration = note.duration?.replace('.', '') || '4n';
    let beats = durationMap[cleanDuration] || 1;
    if (note.dotted || note.duration?.endsWith('.')) {
        beats *= 1.5;
    }
    return beats;
}

/**
 * Get VexFlow notes for chord with grand staff consideration
 */
function getVexNotesForChordGrandStaff(chord, key, keyAccidentals) {
    let notes = [];

    // Get notes from chord (use null to derive enharmonic from key)
    if (chord.notes && chord.notes.length > 0) {
        notes = chord.notes;
    } else {
        const res = getInvertedChordNotes(chord.root, chord.type, chord.inversion || 0, key, 0, null, 'full');
        notes = res?.specificNotes || [];
    }

    return notes.map(note => {
        const match = note.match(/^([A-G])([#b]?)(\d+)$/);
        if (!match) return null;

        const [, letter, accidental, octave] = match;
        const vexKey = `${letter.toLowerCase()}${accidental}/${octave}`;

        // Determine if we need to show an accidental
        let displayAccidental = null;
        if (accidental === '#' && !keyAccidentals.sharps.has(letter)) {
            displayAccidental = '#';
        } else if (accidental === 'b' && !keyAccidentals.flats.has(letter)) {
            displayAccidental = 'b';
        } else if (!accidental && (keyAccidentals.sharps.has(letter) || keyAccidentals.flats.has(letter))) {
            displayAccidental = 'n';
        }

        return { vexKey, accidental: displayAccidental };
    }).filter(n => n !== null);
}

/**
 * Get key signature accidentals for preview
 */
function getKeyAccidentalsForPreview(key) {
    const sharps = new Set();
    const flats = new Set();

    const sharpKeys = { 'G': ['F'], 'D': ['F', 'C'], 'A': ['F', 'C', 'G'], 'E': ['F', 'C', 'G', 'D'], 'B': ['F', 'C', 'G', 'D', 'A'], 'F#': ['F', 'C', 'G', 'D', 'A', 'E'], 'C#': ['F', 'C', 'G', 'D', 'A', 'E', 'B'] };
    const flatKeys = { 'F': ['B'], 'Bb': ['B', 'E'], 'Eb': ['B', 'E', 'A'], 'Ab': ['B', 'E', 'A', 'D'], 'Db': ['B', 'E', 'A', 'D', 'G'], 'Gb': ['B', 'E', 'A', 'D', 'G', 'C'] };

    if (sharpKeys[key]) sharpKeys[key].forEach(n => sharps.add(n));
    if (flatKeys[key]) flatKeys[key].forEach(n => flats.add(n));

    return { sharps, flats };
}

/**
 * Get VexFlow key signature string
 */
function getVexFlowKeyForPreview(key) {
    const keyMap = {
        'C': 'C', 'G': 'G', 'D': 'D', 'A': 'A', 'E': 'E', 'B': 'B',
        'F#': 'F#', 'C#': 'C#', 'F': 'F', 'Bb': 'Bb', 'Eb': 'Eb',
        'Ab': 'Ab', 'Db': 'Db', 'Gb': 'Gb', 'Cb': 'Cb'
    };
    return keyMap[key] || 'C';
}

/**
 * View a single submission in detail with notation preview and audio playback
 */
export async function viewCommunitySubmission(submissionId) {
    try {
        const response = await fetchWithTimeout(`/.netlify/functions/submission/${submissionId}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to load submission');
        }

        const submission = result.submission;
        const key = submission.keySignature || 'C';
        const bpm = submission.bpm || 120;

        // Extract chord data from compositionData
        let chords = [];
        const compositionData = submission.compositionData;
        if (compositionData) {
            if (compositionData.formatVersion && compositionData.progressionData) {
                chords = compositionData.progressionData;
            } else if (Array.isArray(compositionData)) {
                chords = compositionData;
            }
        }

        // Create detail modal with notation preview and audio
        const detailModal = document.createElement('div');
        detailModal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4';
        detailModal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 class="text-xl font-bold text-gray-800 dark:text-white">${submission.title}</h3>
                    <button id="view-modal-close" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="flex-1 overflow-y-auto p-6">
                    <!-- Author info -->
                    <div class="flex items-center gap-3 mb-4">
                        ${submission.author?.avatarUrl ?
                            `<img src="${submission.author.avatarUrl}" class="w-10 h-10 rounded-full">` :
                            `<div class="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">${(submission.author?.displayName || 'A').charAt(0)}</div>`}
                        <div>
                            <p class="font-semibold text-gray-800 dark:text-white">${submission.author?.displayName || 'Anonymous'}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400">${new Date(submission.createdAt).toLocaleDateString()}</p>
                        </div>
                    </div>

                    ${submission.description ? `<p class="text-gray-600 dark:text-gray-400 mb-4">${submission.description}</p>` : ''}

                    <!-- Progression info -->
                    <div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg mb-4">
                        <p class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Progression:</p>
                        <p class="font-mono text-lg text-indigo-600 dark:text-indigo-400">${submission.normalizedProgression || 'N/A'}</p>
                    </div>

                    <!-- Audio playback controls -->
                    <div class="mb-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg">
                        <div class="flex items-center justify-between mb-3">
                            <p class="text-sm font-semibold text-gray-700 dark:text-gray-300">Audio Preview</p>
                            <button id="play-progression-btn" class="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors">
                                <svg id="play-icon" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                </svg>
                                <svg id="stop-icon" class="w-5 h-5 hidden" fill="currentColor" viewBox="0 0 24 24">
                                    <rect x="6" y="6" width="12" height="12"/>
                                </svg>
                                <span id="play-btn-text">Play All</span>
                            </button>
                        </div>
                        <!-- Chord buttons for individual playback -->
                        <div id="chord-buttons" class="flex flex-wrap gap-2">
                            ${chords.map((chord, idx) => {
                                const symbol = getChordSymbol(chord.root, chord.type);
                                const invLabel = chord.inversion ? `<sup>${chord.inversion}</sup>` : '';
                                return `<button data-chord-idx="${idx}" class="chord-play-btn px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-gray-700 dark:text-gray-300">${symbol}${invLabel}</button>`;
                            }).join('')}
                        </div>
                    </div>

                    <!-- Notation preview -->
                    <div class="mb-4">
                        <p class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notation Preview</p>
                        <div id="notation-preview" class="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600 overflow-x-auto flex justify-center">
                            <p class="text-gray-400 text-sm">Loading notation...</p>
                        </div>
                    </div>

                    <!-- Metadata grid -->
                    <div class="grid grid-cols-2 gap-4 mb-4 text-sm">
                        <div><span class="font-semibold text-gray-700 dark:text-gray-300">Key:</span> <span class="text-gray-600 dark:text-gray-400">${key}</span></div>
                        <div><span class="font-semibold text-gray-700 dark:text-gray-300">Time:</span> <span class="text-gray-600 dark:text-gray-400">${submission.timeSignature?.numerator || 4}/${submission.timeSignature?.denominator || 4}</span></div>
                        <div><span class="font-semibold text-gray-700 dark:text-gray-300">BPM:</span> <span class="text-gray-600 dark:text-gray-400">${bpm}</span></div>
                        <div><span class="font-semibold text-gray-700 dark:text-gray-300">Chords:</span> <span class="text-gray-600 dark:text-gray-400">${submission.chordCount}</span></div>
                    </div>

                    ${submission.tags && submission.tags.length > 0 ? `
                        <div class="flex flex-wrap gap-2 mb-4">
                            ${submission.tags.map(tag => `
                                <span class="px-3 py-1 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full">
                                    ${tag.name}
                                </span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                    <button id="view-modal-close-btn" class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                        Close
                    </button>
                    <button id="view-modal-load-btn" class="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors">
                        Load into Workspace
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(detailModal);

        // Render notation preview
        const notationContainer = detailModal.querySelector('#notation-preview');
        const hasNotationData = chords.length > 0 || (compositionData?.submissionType === 'full-composition' && compositionData?.measures?.length > 0);
        if (hasNotationData) {
            setTimeout(() => {
                renderNotationPreview(notationContainer, compositionData, key);
            }, 100);
        } else {
            notationContainer.innerHTML = '<p class="text-gray-400 text-sm italic">No chord data available</p>';
        }

        // Track playback state
        let isPlaying = false;

        // Play progression button
        const playBtn = detailModal.querySelector('#play-progression-btn');
        const playIcon = detailModal.querySelector('#play-icon');
        const stopIcon = detailModal.querySelector('#stop-icon');
        const playBtnText = detailModal.querySelector('#play-btn-text');

        function updatePlayButton(playing) {
            isPlaying = playing;
            playIcon.classList.toggle('hidden', playing);
            stopIcon.classList.toggle('hidden', !playing);
            playBtnText.textContent = playing ? 'Stop' : 'Play All';
        }

        playBtn.addEventListener('click', () => {
            if (isPlaying) {
                stopProgressionPreview();
                updatePlayButton(false);
                // Clear any active chord highlighting
                detailModal.querySelectorAll('.chord-play-btn').forEach(btn => {
                    btn.classList.remove('bg-indigo-500', 'text-white', 'border-indigo-500');
                });
            } else {
                updatePlayButton(true);
                playProgressionPreview(
                    chords,
                    key,
                    bpm,
                    (chordIdx) => {
                        // Highlight current chord
                        detailModal.querySelectorAll('.chord-play-btn').forEach((btn, idx) => {
                            if (idx === chordIdx) {
                                btn.classList.add('bg-indigo-500', 'text-white', 'border-indigo-500');
                            } else {
                                btn.classList.remove('bg-indigo-500', 'text-white', 'border-indigo-500');
                            }
                        });
                    },
                    () => {
                        // On complete
                        updatePlayButton(false);
                        detailModal.querySelectorAll('.chord-play-btn').forEach(btn => {
                            btn.classList.remove('bg-indigo-500', 'text-white', 'border-indigo-500');
                        });
                    }
                );
            }
        });

        // Individual chord playback buttons (hold to play)
        detailModal.querySelectorAll('.chord-play-btn').forEach((btn) => {
            const idx = parseInt(btn.dataset.chordIdx);
            const chord = chords[idx];

            btn.addEventListener('mousedown', () => {
                playPreviewChord(chord, key);
                btn.classList.add('bg-indigo-500', 'text-white', 'border-indigo-500');
            });

            btn.addEventListener('mouseup', () => {
                stopPreviewChord();
                btn.classList.remove('bg-indigo-500', 'text-white', 'border-indigo-500');
            });

            btn.addEventListener('mouseleave', () => {
                stopPreviewChord();
                btn.classList.remove('bg-indigo-500', 'text-white', 'border-indigo-500');
            });

            // Touch support
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                playPreviewChord(chord, key);
                btn.classList.add('bg-indigo-500', 'text-white', 'border-indigo-500');
            });

            btn.addEventListener('touchend', () => {
                stopPreviewChord();
                btn.classList.remove('bg-indigo-500', 'text-white', 'border-indigo-500');
            });
        });

        // Close button handlers
        const closeModal = () => {
            stopProgressionPreview();
            detailModal.remove();
        };

        detailModal.querySelector('#view-modal-close').addEventListener('click', closeModal);
        detailModal.querySelector('#view-modal-close-btn').addEventListener('click', closeModal);

        // Load button
        detailModal.querySelector('#view-modal-load-btn').addEventListener('click', () => {
            stopProgressionPreview();
            window.loadCommunitySubmission && window.loadCommunitySubmission(submissionId);
            detailModal.remove();
        });

        // Close on backdrop click
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) {
                closeModal();
            }
        });

    } catch (error) {
        console.error('Error viewing submission:', error);
        alert('Failed to load submission details: ' + error.message);
    }
}

/**
 * Load a community submission into the workspace
 *
 * Supports multiple composition data formats:
 * 1. Legacy: Array of chord objects (old format)
 * 2. Chord Progression: { formatVersion, submissionType: 'chord-progression', metadata, progressionData }
 * 3. Full Composition: { formatVersion, submissionType: 'full-composition', metadata, progressionData, measures, hairpins, etc. }
 *
 * For chord progressions (not full compositions), shows a key picker so the user can
 * load the progression in any key they prefer. Full compositions load with their saved key.
 */
export async function loadCommunitySubmission(submissionId) {
    try {
        // Include auth token if available (required for loading drafts)
        const headers = {};
        const token = await getAuthToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetchWithTimeout(`/.netlify/functions/submission/${submissionId}`, { headers });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to load submission');
        }

        const submission = result.submission;
        const compositionData = submission.compositionData;

        // Detect format and extract progression data
        let progressionData;
        let isFullComposition = false;
        let isNewFormat = false;

        if (compositionData && compositionData.formatVersion) {
            // New format (chord-progression or full-composition)
            isNewFormat = true;
            isFullComposition = compositionData.submissionType === 'full-composition';
            progressionData = compositionData.progressionData;

        } else if (Array.isArray(compositionData)) {
            // Legacy format - direct array of chords
            progressionData = compositionData;
        } else {
            throw new Error('No valid composition data found');
        }

        if (!progressionData || !Array.isArray(progressionData) || progressionData.length === 0) {
            throw new Error('No valid progression data found');
        }

        // Extract metadata from new format or from submission
        const dataMetadata = isNewFormat ? compositionData.metadata : null;
        const originalKey = dataMetadata?.key || submission.keySignature || 'C';
        const timeSignature = dataMetadata?.timeSignature || {
            num: submission.timeSignature?.numerator || 4,
            denom: submission.timeSignature?.denominator || 4
        };
        const tempo = dataMetadata?.tempo || submission.bpm || 120;

        // Determine the key and load mode to use
        let targetKey;
        let loadMode = 'replace'; // 'replace' or 'append'

        if (isFullComposition) {
            // Full compositions: use saved key (specific pitches matter)
            // Just confirm before loading
            const confirmMsg = `Load "${submission.title}" into your workspace?\n\nThis full composition will replace your current work including melody and bass.`;
            if (!confirm(confirmMsg)) {
                return;
            }
            targetKey = originalKey;
        } else {
            // Chord progressions: show key picker with mode selection
            const pickerResult = await showKeyPickerModal(submission.title, originalKey);

            if (!pickerResult) {
                return;
            }

            targetKey = pickerResult.key;
            loadMode = pickerResult.mode || 'replace';
        }

        // Get composition state
        const compositionState = getCompositionState();

        if (!compositionState) {
            throw new Error('Composition state not available');
        }

        // For append mode, we'll transpose to the user's current key (not change it)
        // For replace mode, we set the key as before
        if (loadMode === 'replace') {
            // CRITICAL: Update the key in trainerState FIRST before any sync operations
            if (window.setCurrentKey) {
                window.setCurrentKey(targetKey);
            }
        }

        // For full compositions, use applyProjectToState-like logic
        if (isFullComposition && isNewFormat) {
            await loadFullComposition(compositionState, compositionData, submission.title);
        } else if (loadMode === 'append') {
            // Append mode: add chords to existing progression
            await appendChordProgression(compositionState, progressionData, {
                originalKey,
                targetKey,
                timeSignature,
                tempo
            });
        } else {
            // Replace mode: clear and load new progression
            await loadChordProgression(compositionState, progressionData, {
                originalKey,
                targetKey,
                timeSignature,
                tempo
            });
        }

        // Update tempo if available (only in replace mode)
        if (loadMode === 'replace' && window.setTempo && tempo) {
            window.setTempo(tempo);
        }

        // Update time signature for audio playback (only in replace mode)
        if (loadMode === 'replace') {
            const timeSigString = `${timeSignature.num}/${timeSignature.denom}`;
            if (window.setTimeSignature) {
                window.setTimeSignature(timeSigString);
            }
        }

        // Trigger UI refresh - order matters!
        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
        }
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay();
        }

        // Update key display in all locations (including melody-workbench-key-display)
        if (window.syncProgressionToMelodyTab) {
            window.syncProgressionToMelodyTab();
        }

        // Close the FAB submenus without closing the entire FAB
        if (window.closeFabSubmenus) {
            window.closeFabSubmenus();
        }

        // Close browser modal
        hideCommunityBrowser();

        // Show success message
        let successMsg;
        if (isFullComposition) {
            successMsg = `Loaded full composition "${submission.title}"`;
        } else if (loadMode === 'append') {
            successMsg = `Appended "${submission.title}" (transposed to ${targetKey})`;
        } else {
            successMsg = `Loaded "${submission.title}" in ${targetKey}`;
        }

        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-xl z-50 flex items-center gap-3';
        toast.innerHTML = `
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span class="font-semibold">${successMsg}</span>
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('opacity-0', 'transition-opacity');
            setTimeout(() => toast.remove(), 300);
        }, 3000);

    } catch (error) {
        console.error('Error loading submission:', error);
        alert('Failed to load submission: ' + error.message);
    }
}

/**
 * Load a chord progression (minimal format) into composition state
 * Supports transposition: if targetKey differs from originalKey, chords are transposed.
 */
async function loadChordProgression(compositionState, progressionData, options) {
    const { originalKey, targetKey, timeSignature, tempo } = options;

    // Determine the effective key - target key if transposing, original if same
    const effectiveKey = targetKey || originalKey;

    // Update metadata
    if (compositionState.metadata) {
        compositionState.metadata.key = effectiveKey;
        compositionState.metadata.timeSignature = timeSignature;
        compositionState.metadata.tempo = tempo;
    }

    // Clear sections before loading new data
    if (compositionState.sections) {
        compositionState.sections = [];
    }

    // Sync the progression data - this sets up storedProgressionData and measures
    // First load with the ORIGINAL key to get the chords in their saved state
    if (compositionState.syncWithProgressionData) {
        compositionState.syncWithProgressionData(progressionData, {
            key: originalKey || effectiveKey,
            timeSignature
        });
    }

    // Rebuild chord segments
    if (compositionState.buildChordSegments) {
        compositionState.buildChordSegments();
    }

    // Initialize bass block sequence for the new progression
    if (compositionState.initializeBassBlockSequence) {
        compositionState.initializeBassBlockSequence(progressionData);
    }

    // If user selected a different key, transpose the progression
    if (targetKey && originalKey && targetKey !== originalKey && window.transposeProgression) {
        window.transposeProgression(originalKey, targetKey);
    }
}

/**
 * Append a chord progression to the existing progression
 * Transposes the new chords to match the user's current key
 */
async function appendChordProgression(compositionState, progressionData, options) {
    const { originalKey, targetKey } = options;

    // Calculate transposition interval (semitones)
    const NOTE_TO_SEMITONE = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };

    const SEMITONE_TO_NOTE_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const SEMITONE_TO_NOTE_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

    const fromSemitone = NOTE_TO_SEMITONE[originalKey] || 0;
    const toSemitone = NOTE_TO_SEMITONE[targetKey] || 0;
    const interval = (toSemitone - fromSemitone + 12) % 12;

    // Determine if target key uses flats
    const usesFlats = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'].includes(targetKey);
    const noteArray = usesFlats ? SEMITONE_TO_NOTE_FLAT : SEMITONE_TO_NOTE_SHARP;

    // Transpose the new chords - regenerate notes with the new root
    const transposedChords = progressionData.map((chord) => {
        const rootSemitone = NOTE_TO_SEMITONE[chord.root];
        if (rootSemitone === undefined) return chord;

        const newSemitone = (rootSemitone + interval) % 12;
        const newRoot = noteArray[newSemitone];

        // Regenerate notes with the transposed root to avoid octave corruption
        // Use getInvertedChordNotes to properly generate notes for the new root
        const enharmonicPref = usesFlats ? 'flat' : 'sharp';
        const chordNotesResult = getInvertedChordNotes(
            newRoot,
            chord.type,
            chord.inversion || 0,
            targetKey,
            chord.octaveShift || 0,
            enharmonicPref,
            'full'
        );

        // Use regenerated notes, or fall back to empty array if generation failed
        const newNotes = chordNotesResult?.specificNotes || [];

        return {
            ...chord,
            root: newRoot,
            notes: newNotes
        };
    });

    // Get existing progression data
    const existingChords = compositionState.storedProgressionData || [];

    // Combine progressions
    const combinedChords = [...existingChords, ...transposedChords];

    // Sync the combined progression
    if (compositionState.syncWithProgressionData) {
        compositionState.syncWithProgressionData(combinedChords, {
            key: targetKey,
            timeSignature: compositionState.metadata?.timeSignature || { num: 4, denom: 4 }
        });
    }

    // Rebuild chord segments
    if (compositionState.buildChordSegments) {
        compositionState.buildChordSegments();
    }

    // Re-initialize bass block sequence for the combined progression
    if (compositionState.initializeBassBlockSequence) {
        compositionState.initializeBassBlockSequence(combinedChords);
    }
}

/**
 * Load a full composition (complete format with measures, hairpins, slurs, etc.)
 * Similar to applyProjectToState from projectManager.js
 */
async function loadFullComposition(compositionState, compositionData, title) {

    const metadata = compositionData.metadata || {};
    const settings = compositionData.settings || {};
    const progressionData = compositionData.progressionData || [];

    // 1. Update composition metadata
    compositionState.metadata = {
        ...compositionState.metadata,
        title: metadata.title || title,
        composer: metadata.composer || '',
        tempo: metadata.tempo || 120,
        timeSignature: metadata.timeSignature || { num: 4, denom: 4 },
        key: metadata.key || 'C'
    };

    // 2. Update composition settings
    compositionState.settings = {
        ...compositionState.settings,
        ...settings
    };

    // 3. Sync with progression data
    // NOTE: We call syncWithProgressionData to create the measure structure,
    // but then we'll restore the full notation data (including bass with ornaments)
    // from compositionData.measures afterward. The _skipBassRegenerationUntil flag
    // will prevent SUBSEQUENT syncs from overwriting our restored data.
    compositionState.syncWithProgressionData(progressionData, {
        preserveMelody: false,
        key: metadata.key,
        tempo: metadata.tempo,
        timeSignature: metadata.timeSignature
    });

    // 4. Load song sections
    if (compositionData.sections && compositionState.importSections) {
        compositionState.importSections(compositionData.sections);
    }

    // 5. Load bass BuildingBlockSequence
    if (compositionData.bassBlockSequence) {
        const { BuildingBlockSequence } = window.buildingBlockModule || {};
        if (BuildingBlockSequence) {
            compositionState.bassBlockSequence = BuildingBlockSequence.fromJSON(compositionData.bassBlockSequence);
            console.log('[Community Load] Bass BuildingBlockSequence loaded');
        }
    }

    // 6. Load treble BuildingBlockSequence
    if (compositionData.trebleBlockSequence) {
        const { BuildingBlockSequence } = window.buildingBlockModule || {};
        if (BuildingBlockSequence) {
            compositionState.trebleBlockSequence = BuildingBlockSequence.fromJSON(compositionData.trebleBlockSequence);
            console.log('[Community Load] Treble BuildingBlockSequence loaded');
        }
    }

    // 7. Restore ALL notation data from saved measures
    if (compositionData.measures && Array.isArray(compositionData.measures)) {
        const savedCount = compositionData.measures.length;
        const currentCount = compositionState.measures.length;
        console.log(`[Community Load] Restoring notation data. Saved: ${savedCount} measures, Current: ${currentCount} measures`);

        for (let i = 0; i < compositionData.measures.length && i < compositionState.measures.length; i++) {
            const savedMeasure = compositionData.measures[i];
            const currentMeasure = compositionState.measures[i];

            // Restore all treble voices
            if (savedMeasure.notation?.treble?.voices) {
                currentMeasure.notation.treble.voices = JSON.parse(JSON.stringify(savedMeasure.notation.treble.voices));
            }

            // Restore all bass voices
            if (savedMeasure.notation?.bass?.voices) {
                currentMeasure.notation.bass.voices = JSON.parse(JSON.stringify(savedMeasure.notation.bass.voices));
                if (savedMeasure.notation.bass.autoGenerated !== undefined) {
                    currentMeasure.notation.bass.autoGenerated = savedMeasure.notation.bass.autoGenerated;
                }
            }

            // Restore dynamics
            if (savedMeasure.notation?.dynamics) {
                currentMeasure.notation.dynamics = JSON.parse(JSON.stringify(savedMeasure.notation.dynamics));
            }
        }
        console.log('[Community Load] All measure notation data restored');

        // CRITICAL: Set flag to skip syncWithProgressionData calls for a short period
        // This prevents the bass notes (with ornaments, articulations, etc.) from being regenerated
        // during post-load sync cascades (multiple calls happen from various event handlers)
        compositionState._skipBassRegenerationUntil = Date.now() + 2000; // Skip for 2 seconds
    }

    // 8. Restore tempo markings
    if (compositionData.tempoMarkings && Array.isArray(compositionData.tempoMarkings)) {
        console.log('[Community Load] Restoring tempo markings:', compositionData.tempoMarkings.length);
        compositionState.tempoMarkings = [...compositionData.tempoMarkings];
    }

    // 9. Restore repeat signs
    if (compositionData.repeatSigns && Array.isArray(compositionData.repeatSigns)) {
        console.log('[Community Load] Restoring repeat signs:', compositionData.repeatSigns.length);
        compositionState.repeatSigns = [...compositionData.repeatSigns];
    }

    // 10. Restore hairpins (crescendo/decrescendo)
    if (compositionData.hairpins && Array.isArray(compositionData.hairpins)) {
        console.log('[Community Load] Restoring hairpins:', compositionData.hairpins.length);
        compositionState.hairpins = [...compositionData.hairpins];
    }

    // 11. Restore slurs
    if (compositionData.slurs && Array.isArray(compositionData.slurs)) {
        console.log('[Community Load] Restoring slurs:', compositionData.slurs.length);
        compositionState.slurs = [...compositionData.slurs];
        // Update next ID counter
        const maxSlurId = compositionData.slurs.reduce((max, s) => {
            const idNum = parseInt(s.id?.replace('sl_', '') || '0', 10);
            return Math.max(max, idNum);
        }, 0);
        compositionState._nextSlurId = maxSlurId + 1;
    }

    // 12. Restore volta brackets
    if (compositionData.voltaBrackets && Array.isArray(compositionData.voltaBrackets)) {
        console.log('[Community Load] Restoring volta brackets:', compositionData.voltaBrackets.length);
        compositionState.voltaBrackets = [...compositionData.voltaBrackets];
        // Update next ID counter
        const maxVoltaId = compositionData.voltaBrackets.reduce((max, v) => {
            const idNum = parseInt(v.id?.replace('volta_', '') || '0', 10);
            return Math.max(max, idNum);
        }, 0);
        compositionState._nextVoltaId = maxVoltaId + 1;
    }

    console.log('[Community Load] Full composition loaded successfully');
}

/**
 * Refresh the browser (reload current results)
 */
export function refreshCommunityBrowser() {
    loadSubmissions();
}

// ============================================================================
// REPORT/FLAG FUNCTIONALITY
// ============================================================================

let reportModal = null;

/**
 * Show the report modal for a submission
 */
export function showReportModal(submissionId, submissionTitle) {
    // Check if user is signed in
    if (!isSignedIn()) {
        alert('Please sign in to report content.');
        return;
    }

    // Create modal if it doesn't exist
    if (!reportModal) {
        reportModal = document.createElement('div');
        reportModal.id = 'report-modal';
        reportModal.className = 'fixed inset-0 bg-black bg-opacity-50 hidden z-[60] flex items-center justify-center p-4';
        document.body.appendChild(reportModal);

        // Close on backdrop click
        reportModal.addEventListener('click', (e) => {
            if (e.target === reportModal) {
                hideReportModal();
            }
        });
    }

    // Populate modal content
    reportModal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    Report Submission
                </h3>
                <button onclick="window.hideReportModal && window.hideReportModal()"
                        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Reporting: <span class="font-medium text-gray-800 dark:text-gray-200">${escapeHtml(submissionTitle)}</span>
            </p>

            <form id="report-form" class="space-y-4">
                <input type="hidden" id="report-submission-id" value="${submissionId}">

                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Reason for reporting <span class="text-red-500">*</span>
                    </label>
                    <select id="report-reason" required
                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent">
                        <option value="">Select a reason...</option>
                        <option value="spam">Spam or misleading content</option>
                        <option value="inappropriate">Inappropriate or offensive</option>
                        <option value="copyright">Copyright violation</option>
                        <option value="low_quality">Low quality or duplicate</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Additional details (optional)
                    </label>
                    <textarea id="report-description" rows="3" maxlength="500"
                              placeholder="Provide any additional context..."
                              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"></textarea>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span id="report-char-count">0</span>/500 characters
                    </p>
                </div>

                <div id="report-error" class="hidden text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-3 rounded-lg"></div>
                <div id="report-success" class="hidden text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 p-3 rounded-lg"></div>

                <div class="flex gap-3 pt-2">
                    <button type="button" onclick="window.hideReportModal && window.hideReportModal()"
                            class="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" id="report-submit-btn"
                            class="flex-1 px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        Submit Report
                    </button>
                </div>
            </form>
        </div>
    `;

    // Add character count listener
    const descriptionInput = reportModal.querySelector('#report-description');
    const charCount = reportModal.querySelector('#report-char-count');
    descriptionInput.addEventListener('input', () => {
        charCount.textContent = descriptionInput.value.length;
    });

    // Add form submit handler
    const form = reportModal.querySelector('#report-form');
    form.addEventListener('submit', handleReportSubmit);

    // Show modal
    reportModal.classList.remove('hidden');
}

/**
 * Hide the report modal
 */
export function hideReportModal() {
    if (reportModal) {
        reportModal.classList.add('hidden');
    }
}

/**
 * Handle report form submission
 */
async function handleReportSubmit(e) {
    e.preventDefault();

    const submissionId = document.getElementById('report-submission-id').value;
    const reason = document.getElementById('report-reason').value;
    const description = document.getElementById('report-description').value.trim();
    const submitBtn = document.getElementById('report-submit-btn');
    const errorDiv = document.getElementById('report-error');
    const successDiv = document.getElementById('report-success');

    // Validate
    if (!reason) {
        errorDiv.textContent = 'Please select a reason for reporting.';
        errorDiv.classList.remove('hidden');
        return;
    }

    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        Submitting...
    `;
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');

    try {
        await submitFlag(submissionId, reason, description || null);

        // Show success
        successDiv.textContent = 'Report submitted successfully. An admin will review it.';
        successDiv.classList.remove('hidden');

        // Hide modal after delay
        setTimeout(() => {
            hideReportModal();
        }, 2000);

    } catch (error) {
        console.error('[Report] Error submitting report:', error);
        errorDiv.textContent = error.message || 'Failed to submit report. Please try again.';
        errorDiv.classList.remove('hidden');

        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            Submit Report
        `;
    }
}

/**
 * Load composition data directly into the workspace
 * This is a shared utility for loading composition data from various sources
 * (e.g., version history, clipboard, etc.)
 *
 * @param {Object} compositionData - The composition data to load
 * @param {Object} options - Loading options
 * @param {string} options.title - Display title for the composition
 * @param {string} options.keySignature - Key signature (if not in compositionData)
 * @param {string} options.submissionType - 'full-composition' or 'chord-progression'
 */
export async function loadCompositionData(compositionData, options = {}) {
    if (!compositionData) {
        throw new Error('No composition data provided');
    }

    const compositionState = getCompositionState();
    if (!compositionState) {
        throw new Error('Composition state not available');
    }

    // Detect format
    const isNewFormat = compositionData && compositionData.formatVersion;
    const isFullComposition = isNewFormat
        ? compositionData.submissionType === 'full-composition'
        : options.submissionType === 'full-composition';

    // Get key from data or options
    const key = compositionData.metadata?.key || options.keySignature || 'C';

    // Set key before loading
    if (window.setCurrentKey) {
        window.setCurrentKey(key);
    }

    // Load based on type
    if (isFullComposition && isNewFormat) {
        await loadFullComposition(compositionState, compositionData, options.title || 'Untitled');
    } else {
        // For chord progressions, extract progression data and load
        const progressionData = isNewFormat
            ? compositionData.progressionData
            : (Array.isArray(compositionData) ? compositionData : null);

        if (!progressionData || !Array.isArray(progressionData)) {
            throw new Error('No valid progression data found');
        }

        const metadata = isNewFormat ? compositionData.metadata : {};
        const timeSignature = metadata.timeSignature || { num: 4, denom: 4 };
        const tempo = metadata.tempo || 120;

        await loadChordProgression(compositionState, progressionData, {
            originalKey: key,
            targetKey: key,
            timeSignature,
            tempo
        });
    }

    // Update UI
    if (window.syncProgressionToMelodyComposer) {
        window.syncProgressionToMelodyComposer();
    }
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }

    console.log('[Community] Composition data loaded successfully');
}

// Export for window access
window.showCommunityBrowser = showCommunityBrowser;
window.hideCommunityBrowser = hideCommunityBrowser;
window.viewCommunitySubmission = viewCommunitySubmission;
window.loadCommunitySubmission = loadCommunitySubmission;
window.loadCompositionData = loadCompositionData;
window.refreshCommunityBrowser = refreshCommunityBrowser;
window.showReportModal = showReportModal;
window.hideReportModal = hideReportModal;

export default {
    initCommunityBrowser,
    showCommunityBrowser,
    hideCommunityBrowser,
    viewCommunitySubmission,
    loadCommunitySubmission,
    loadCompositionData,
    refreshCommunityBrowser
};
