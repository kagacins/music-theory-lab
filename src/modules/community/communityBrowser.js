/**
 * Community Browser UI Component
 *
 * Modal for browsing and searching community submissions.
 * Allows users to discover, preview, and load shared progressions.
 */

import { getAuthToken, isSignedIn } from './authService.js';
import { getCompositionState } from '../state/compositionState.js';
import { getCurrentKey } from '../state/trainerState.js';

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

            <!-- Content area - more padding efficiency -->
            <div id="browser-content" class="flex-1 overflow-y-auto p-3">
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

        const response = await fetch(`/.netlify/functions/submissions?${params.toString()}`);
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

        const response = await fetch(`/.netlify/functions/submission-families?${params.toString()}`);
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
 * Render progression families (grouped view)
 */
function renderFamilies() {
    const container = document.getElementById('browser-results');

    container.innerHTML = currentFamilies.map(family => {
        const c = family.canonical;
        const hasVariants = family.variantCount > 1;
        const isExpanded = expandedFamilies.has(family.baseHash);

        return `
            <div class="family-card bg-white dark:bg-gray-700 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-600 ${hasVariants ? 'ring-1 ring-indigo-200 dark:ring-indigo-800' : ''}">
                <div class="p-3">
                    <!-- Progression (prominent) -->
                    <div class="mb-2 p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded text-sm font-mono text-indigo-700 dark:text-indigo-300 truncate" title="${c.normalizedProgression || ''}">
                        ${c.normalizedProgression || 'No progression'}
                    </div>

                    <!-- Variant badge (if has variants) -->
                    ${hasVariants ? `
                        <button onclick="window.toggleFamilyExpand && window.toggleFamilyExpand('${family.baseHash}')"
                                class="w-full mb-2 px-2 py-1 text-xs rounded flex items-center justify-between gap-1 ${isExpanded ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}">
                            <span class="flex items-center gap-1">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2"/>
                                </svg>
                                ${family.variantCount} variations
                            </span>
                            <span class="flex items-center gap-1 text-[10px] opacity-75">
                                ${family.variantInfo.hasDurationVariants ? '⏱️' : ''}
                                ${family.variantInfo.hasInversionVariants ? '🔄' : ''}
                                ${family.variantInfo.hasKeyVariants ? '🎹' : ''}
                                <svg class="w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                                </svg>
                            </span>
                        </button>
                    ` : ''}

                    <!-- Canonical submission info -->
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-1.5 min-w-0 flex-1">
                            ${c.author?.avatarUrl ?
                                `<img src="${c.author.avatarUrl}" class="w-4 h-4 rounded-full shrink-0">` :
                                `<span class="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[8px] shrink-0">${(c.author?.displayName || 'A').charAt(0)}</span>`}
                            <span class="text-xs text-gray-600 dark:text-gray-400 truncate">${c.author?.displayName || 'Anon'}</span>
                        </div>
                        <div class="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 shrink-0">
                            <span title="Key">${c.keySignature || 'C'}</span>
                            <span title="Upvotes" class="flex items-center gap-0.5">
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"/></svg>
                                ${family.totalUpvotes}
                            </span>
                        </div>
                    </div>

                    <!-- Canonical title -->
                    <h4 class="text-xs font-medium text-gray-800 dark:text-white truncate mb-2" title="${c.title}">
                        ${c.title}
                    </h4>

                    <!-- Actions -->
                    <div class="flex gap-1">
                        <button onclick="window.loadCommunitySubmission && window.loadCommunitySubmission('${c.id}')"
                                class="flex-1 px-2 py-1 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded transition-colors">
                            Load
                        </button>
                        <button onclick="window.viewCommunitySubmission && window.viewCommunitySubmission('${c.id}')"
                                class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-300 rounded transition-colors">
                            View
                        </button>
                    </div>
                </div>

                <!-- Expanded variants list -->
                ${isExpanded && hasVariants ? `
                    <div class="border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 p-2 space-y-1">
                        <p class="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Variations:</p>
                        ${family.variants.map(v => `
                            <div class="flex items-center justify-between p-1.5 bg-white dark:bg-gray-700 rounded text-xs">
                                <div class="flex-1 min-w-0">
                                    <span class="text-gray-800 dark:text-white truncate block">${v.title}</span>
                                    <span class="text-[10px] text-gray-500 dark:text-gray-400">
                                        ${v.differences.length > 0 ? v.differences.join(', ') : 'same as original'}
                                    </span>
                                </div>
                                <div class="flex items-center gap-1 shrink-0 ml-2">
                                    <span class="text-[10px] text-gray-400 flex items-center gap-0.5">
                                        <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"/></svg>
                                        ${v.upvoteCount || 0}
                                    </span>
                                    <button onclick="window.loadCommunitySubmission && window.loadCommunitySubmission('${v.id}')"
                                            class="px-1.5 py-0.5 text-[10px] bg-indigo-500 hover:bg-indigo-600 text-white rounded transition-colors">
                                        Load
                                    </button>
                                </div>
                            </div>
                        `).join('')}
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
 * @returns {Promise<string|null>} Selected key or null if cancelled
 */
function showKeyPickerModal(submissionTitle, originalKey) {
    return new Promise((resolve) => {
        // Get user's current working key
        let currentKey = 'C';
        try {
            currentKey = getCurrentKey() || 'C';
        } catch (e) {
            console.warn('[KeyPicker] Could not get current key, defaulting to C');
        }

        // Check if current key is a common key
        const isCurrentKeyCommon = COMMON_KEYS.includes(currentKey);

        const modal = document.createElement('div');
        modal.id = 'key-picker-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4';

        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                <!-- Header -->
                <div class="px-5 py-4 bg-gradient-to-r from-indigo-500 to-purple-600">
                    <h3 class="text-lg font-bold text-white">Choose a Key</h3>
                    <p class="text-sm text-white/80 mt-1">Load "${submissionTitle}" in your preferred key</p>
                </div>

                <div class="p-5">
                    <!-- Original key info -->
                    <div class="mb-4 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                        <span class="text-gray-500 dark:text-gray-400">Originally saved in: </span>
                        <span class="font-medium text-gray-700 dark:text-gray-300">${originalKey}</span>
                    </div>

                    <!-- Current key (if common) -->
                    ${isCurrentKeyCommon ? `
                        <div class="mb-4">
                            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Your Current Key</p>
                            <button data-key="${currentKey}" class="key-btn px-4 py-2 rounded-lg font-semibold text-white bg-indigo-500 hover:bg-indigo-600 ring-2 ring-indigo-300 dark:ring-indigo-700 transition-all">
                                ${currentKey}
                            </button>
                        </div>
                    ` : ''}

                    <!-- Common keys -->
                    <div class="mb-4">
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Common Keys</p>
                        <div class="flex flex-wrap gap-2">
                            ${COMMON_KEYS.filter(k => k !== currentKey || !isCurrentKeyCommon).map(key => `
                                <button data-key="${key}" class="key-btn px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                    ${key}
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <!-- All keys dropdown for less common keys -->
                    <div class="mb-4">
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Other Keys</p>
                        <select id="key-picker-select" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500">
                            <option value="">Select a key...</option>
                            ${ALL_KEYS.filter(k => !COMMON_KEYS.includes(k)).map(key => `
                                <option value="${key}" ${key === currentKey && !isCurrentKeyCommon ? 'selected' : ''}>${key}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-5 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-end gap-3">
                    <button id="key-picker-cancel" class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                        Cancel
                    </button>
                    <button id="key-picker-confirm" class="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                        Load in Selected Key
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        let selectedKey = null;

        // Handle key button clicks
        modal.querySelectorAll('.key-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove selection from all buttons
                modal.querySelectorAll('.key-btn').forEach(b => {
                    b.classList.remove('bg-indigo-500', 'text-white', 'ring-2', 'ring-indigo-300', 'dark:ring-indigo-700');
                    b.classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
                });
                // Clear select dropdown
                const select = modal.querySelector('#key-picker-select');
                select.value = '';

                // Highlight selected button
                btn.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
                btn.classList.add('bg-indigo-500', 'text-white', 'ring-2', 'ring-indigo-300', 'dark:ring-indigo-700');

                selectedKey = btn.dataset.key;
                modal.querySelector('#key-picker-confirm').disabled = false;
            });
        });

        // Handle select dropdown
        modal.querySelector('#key-picker-select').addEventListener('change', (e) => {
            if (e.target.value) {
                // Remove selection from all buttons
                modal.querySelectorAll('.key-btn').forEach(b => {
                    b.classList.remove('bg-indigo-500', 'text-white', 'ring-2', 'ring-indigo-300', 'dark:ring-indigo-700');
                    b.classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300');
                });
                selectedKey = e.target.value;
                modal.querySelector('#key-picker-confirm').disabled = false;
            }
        });

        // If current key is common, pre-select it
        if (isCurrentKeyCommon) {
            const currentKeyBtn = modal.querySelector(`[data-key="${currentKey}"]`);
            if (currentKeyBtn) {
                selectedKey = currentKey;
                modal.querySelector('#key-picker-confirm').disabled = false;
            }
        }

        // Handle confirm
        modal.querySelector('#key-picker-confirm').addEventListener('click', () => {
            modal.remove();
            resolve(selectedKey);
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

    container.innerHTML = currentSubmissions.map(submission => `
        <div class="submission-card bg-white dark:bg-gray-700 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-600">
            <div class="p-3">
                <!-- Progression preview (prominent) -->
                <div class="mb-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs font-mono text-gray-700 dark:text-gray-300 truncate" title="${submission.normalized_progression || ''}">
                    ${submission.normalized_progression || 'No progression'}
                </div>

                <!-- Header row -->
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-1.5 min-w-0 flex-1">
                        ${submission.author?.avatarUrl ?
                            `<img src="${submission.author.avatarUrl}" class="w-4 h-4 rounded-full shrink-0">` :
                            `<span class="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white text-[8px] shrink-0">${(submission.author?.displayName || 'A').charAt(0)}</span>`}
                        <span class="text-xs text-gray-600 dark:text-gray-400 truncate">${submission.author?.displayName || 'Anon'}</span>
                    </div>
                    <span class="text-[10px] px-1.5 py-0.5 rounded ${
                        submission.submission_type === 'full-composition'
                            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300'
                            : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'
                    }">
                        ${submission.submission_type === 'full-composition' ? 'Full' : 'Chords'}
                    </span>
                </div>

                <!-- Title -->
                <h4 class="text-xs font-medium text-gray-800 dark:text-white truncate mb-2" title="${submission.title}">
                    ${submission.title}
                </h4>

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
                    <button onclick="window.viewCommunitySubmission && window.viewCommunitySubmission('${submission.id}')"
                            class="flex-1 px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded transition-colors">
                        View
                    </button>
                    <button onclick="window.loadCommunitySubmission && window.loadCommunitySubmission('${submission.id}')"
                            class="flex-1 px-2 py-1 text-[10px] bg-indigo-500 hover:bg-indigo-600 text-white rounded transition-colors">
                        Load
                    </button>
                </div>
            </div>
        </div>
    `).join('');

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

/**
 * View a single submission in detail
 */
export async function viewCommunitySubmission(submissionId) {
    // For now, just show a simple alert with submission info
    // In future, this could open a detailed modal

    try {
        const response = await fetch(`/.netlify/functions/submission/${submissionId}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to load submission');
        }

        const submission = result.submission;

        // Create a simple detail modal
        const detailModal = document.createElement('div');
        detailModal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4';
        detailModal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 class="text-xl font-bold text-gray-800 dark:text-white">${submission.title}</h3>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="flex-1 overflow-y-auto p-6">
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

                    <div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg mb-4">
                        <p class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Progression:</p>
                        <p class="font-mono text-lg text-indigo-600 dark:text-indigo-400">${submission.normalizedProgression || 'N/A'}</p>
                    </div>

                    <div class="grid grid-cols-2 gap-4 mb-4 text-sm">
                        <div><span class="font-semibold text-gray-700 dark:text-gray-300">Key:</span> <span class="text-gray-600 dark:text-gray-400">${submission.keySignature}</span></div>
                        <div><span class="font-semibold text-gray-700 dark:text-gray-300">Time:</span> <span class="text-gray-600 dark:text-gray-400">${submission.timeSignature?.numerator || 4}/${submission.timeSignature?.denominator || 4}</span></div>
                        <div><span class="font-semibold text-gray-700 dark:text-gray-300">BPM:</span> <span class="text-gray-600 dark:text-gray-400">${submission.bpm}</span></div>
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
                    <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                        Close
                    </button>
                    <button onclick="window.loadCommunitySubmission && window.loadCommunitySubmission('${submissionId}'); this.closest('.fixed').remove();"
                            class="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors">
                        Load into Workspace
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(detailModal);

        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) {
                detailModal.remove();
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
        const response = await fetch(`/.netlify/functions/submission/${submissionId}`);
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

            console.log('[Community Load] New format detected:', {
                formatVersion: compositionData.formatVersion,
                submissionType: compositionData.submissionType,
                isFullComposition
            });
        } else if (Array.isArray(compositionData)) {
            // Legacy format - direct array of chords
            progressionData = compositionData;
            console.log('[Community Load] Legacy format detected (chord array)');
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

        // Determine the key to use
        let targetKey;

        if (isFullComposition) {
            // Full compositions: use saved key (specific pitches matter)
            // Just confirm before loading
            const confirmMsg = `Load "${submission.title}" into your workspace?\n\nThis full composition will replace your current work including melody and bass.`;
            if (!confirm(confirmMsg)) {
                return;
            }
            targetKey = originalKey;
            console.log('[Community Load] Full composition - using saved key:', targetKey);
        } else {
            // Chord progressions: show key picker
            // Progressions are fundamentally about harmonic relationships, not specific pitches
            const selectedKey = await showKeyPickerModal(submission.title, originalKey);

            if (!selectedKey) {
                // User cancelled
                console.log('[Community Load] Key picker cancelled');
                return;
            }

            targetKey = selectedKey;
            console.log('[Community Load] Chord progression - user selected key:', targetKey);
        }

        console.log('[Community Load] Extracted metadata:', {
            originalKey,
            targetKey,
            timeSignature,
            tempo,
            isFullComposition
        });

        // Get composition state
        const compositionState = getCompositionState();

        if (!compositionState) {
            throw new Error('Composition state not available');
        }

        // CRITICAL: Update the key in trainerState FIRST before any sync operations
        if (window.setCurrentKey) {
            console.log('[Community Load] Calling setCurrentKey with:', targetKey);
            window.setCurrentKey(targetKey);
        }

        // For full compositions, use applyProjectToState-like logic
        if (isFullComposition && isNewFormat) {
            await loadFullComposition(compositionState, compositionData, submission.title);
        } else {
            // For chord progressions (new or legacy format)
            // Pass both original and target key to handle transposition
            await loadChordProgression(compositionState, progressionData, {
                originalKey,
                targetKey,
                timeSignature,
                tempo
            });
        }

        // Update tempo if available
        if (window.setTempo && tempo) {
            window.setTempo(tempo);
        }

        // Update time signature for audio playback
        const timeSigString = `${timeSignature.num}/${timeSignature.denom}`;
        if (window.setTimeSignature) {
            console.log('[Community Load] Calling setTimeSignature with:', timeSigString);
            window.setTimeSignature(timeSigString);
        }

        // Trigger UI refresh - order matters!
        console.log('[Community Load] Before UI refresh - compositionState.metadata:', compositionState.metadata);
        if (window.refreshNotationFromProgression) {
            console.log('[Community Load] Calling refreshNotationFromProgression');
            window.refreshNotationFromProgression();
        }
        console.log('[Community Load] After refreshNotationFromProgression - compositionState.metadata:', compositionState.metadata);
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
        const successMsg = isFullComposition
            ? `Loaded full composition "${submission.title}"`
            : `Loaded "${submission.title}" in ${targetKey}`;

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

    const syncOptions = {
        key: effectiveKey,
        timeSignature
    };

    // Update metadata
    if (compositionState.metadata) {
        compositionState.metadata.key = effectiveKey;
        compositionState.metadata.timeSignature = timeSignature;
        compositionState.metadata.tempo = tempo;
        console.log('[Community Load] compositionState.metadata updated:', compositionState.metadata);
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
        console.log(`[Community Load] Transposing progression from ${originalKey} to ${targetKey}`);
        window.transposeProgression(originalKey, targetKey);
    }
}

/**
 * Load a full composition (complete format with measures, hairpins, slurs, etc.)
 * Similar to applyProjectToState from projectManager.js
 */
async function loadFullComposition(compositionState, compositionData, title) {
    console.log('[Community Load] Loading full composition:', title);

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

// Export for window access
window.showCommunityBrowser = showCommunityBrowser;
window.hideCommunityBrowser = hideCommunityBrowser;
window.viewCommunitySubmission = viewCommunitySubmission;
window.loadCommunitySubmission = loadCommunitySubmission;
window.refreshCommunityBrowser = refreshCommunityBrowser;

export default {
    initCommunityBrowser,
    showCommunityBrowser,
    hideCommunityBrowser,
    viewCommunitySubmission,
    loadCommunitySubmission,
    refreshCommunityBrowser
};
