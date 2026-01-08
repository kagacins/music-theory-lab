/**
 * Song Search Module
 * Provides functionality to search for songs and import their chord progressions
 * 
 * Features:
 * - Local demo database search (fast, limited songs)
 * - Internet search via Google Custom Search API (requires API key)
 * - Fallback to Ultimate Guitar search (opens in new tab)
 * 
 * To enable Google Custom Search:
 * 1. Get a Google Custom Search API key from https://console.cloud.google.com/
 * 2. Create a Custom Search Engine at https://cse.google.com/
 * 3. Set window.GOOGLE_SEARCH_API_KEY and window.GOOGLE_SEARCH_ENGINE_ID in your code
 */

import { SHARP_NOTES, FLAT_NOTES, ALL_NOTES, ENHARMONIC_MAP } from '../../data/music-data.js';
import { toast } from '../ui/toastNotifications.js';
import { showAlertModal } from '../ui/modals.js';

// Song database - loaded from JSON file
let DEMO_SONG_DATABASE = [];

// Fallback database in case JSON fails to load
const FALLBACK_SONG_DATABASE = [
    {
        title: "Let It Be",
        artist: "The Beatles",
        key: "C",
        chords: ["C", "G", "Am", "F", "C", "G", "F", "C"]
    },
    {
        title: "Stand By Me",
        artist: "Ben E. King",
        key: "A",
        chords: ["A", "F#m", "D", "E", "A", "F#m", "D", "E"]
    }
];

// Load song database from JSON file
let databaseLoadPromise = null;

/**
 * Load the song database from JSON file
 * @returns {Promise<Array>} Promise that resolves to the song database array
 */
async function loadSongDatabase() {
    if (databaseLoadPromise) {
        return databaseLoadPromise;
    }
    
    databaseLoadPromise = (async () => {
        try {
            // Try multiple possible paths for the JSON file
            const possiblePaths = [
                '/src/data/song-database.json',
                './src/data/song-database.json',
                'src/data/song-database.json'
            ];
            
            let response = null;
            for (const path of possiblePaths) {
                try {
                    response = await fetch(path);
                    if (response.ok) {
                        break;
                    }
                } catch (e) {
                    // Try next path
                    continue;
                }
            }
            
            if (response && response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    DEMO_SONG_DATABASE = data;
                    return DEMO_SONG_DATABASE;
                }
            }
            throw new Error('Invalid or empty database');
        } catch (error) {
            console.warn('Failed to load song database from JSON, using fallback:', error);
            // Use fallback database if JSON load fails
            DEMO_SONG_DATABASE = FALLBACK_SONG_DATABASE;
            return DEMO_SONG_DATABASE;
        }
    })();
    
    return databaseLoadPromise;
}

// Initialize database loading immediately
loadSongDatabase();

// Rate limiting configuration
// Note: This is a client-side limit for user experience.
// You should ALSO set a quota in Google Cloud Console (hard limit enforced by Google).
// See GOOGLE_API_QUOTA_SETUP.md for instructions.
const DAILY_SEARCH_LIMIT = 100; // Free tier limit (should match Google Cloud quota)
const SEARCH_COUNT_KEY = 'google_search_count';
const SEARCH_DATE_KEY = 'google_search_date';

// Search mode: 'api' (local + Google API) or 'free' (DuckDuckGo scraping)
let currentSearchMode = 'api';

/**
 * Get the current search mode
 * @returns {string} 'api' or 'free'
 */
export function getSearchMode() {
    return currentSearchMode;
}

/**
 * Toggle between API and free search modes
 */
export function toggleSearchMode() {
    const toggle = document.getElementById('free-search-toggle');
    currentSearchMode = toggle?.checked ? 'free' : 'api';

    // Update UI labels
    const localLabel = document.getElementById('search-mode-local-label');
    const freeLabel = document.getElementById('search-mode-free-label');
    const description = document.getElementById('search-mode-description');
    const searchCountDisplay = document.getElementById('search-count-display');

    if (currentSearchMode === 'free') {
        localLabel?.classList.remove('text-purple-600');
        localLabel?.classList.add('text-gray-400');
        freeLabel?.classList.remove('text-gray-400');
        freeLabel?.classList.add('text-green-600');
        if (description) {
            description.innerHTML = '<strong>Free Search Mode:</strong> Searches online chord databases via DuckDuckGo. No API key required, unlimited searches!';
        }
        if (searchCountDisplay) {
            searchCountDisplay.innerHTML = '<em>Free mode - no daily limits</em>';
        }
    } else {
        localLabel?.classList.remove('text-gray-400');
        localLabel?.classList.add('text-purple-600');
        freeLabel?.classList.remove('text-green-600');
        freeLabel?.classList.add('text-gray-400');
        if (description) {
            description.innerHTML = '<strong>Local + API Mode:</strong> Searches local database first, then Google Custom Search API (requires API key). Uses daily quota.';
        }
        updateSearchCountDisplay();
    }

}

/**
 * Get today's date as a string (YYYY-MM-DD)
 * @returns {string} Today's date
 */
function getTodayDateString() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

/**
 * Get the current daily search count
 * @returns {number} Current search count for today
 */
function getDailySearchCount() {
    const storedDate = localStorage.getItem(SEARCH_DATE_KEY);
    const today = getTodayDateString();
    
    // If it's a new day, reset the count
    if (storedDate !== today) {
        localStorage.setItem(SEARCH_DATE_KEY, today);
        localStorage.setItem(SEARCH_COUNT_KEY, '0');
        return 0;
    }
    
    // Return stored count
    const count = parseInt(localStorage.getItem(SEARCH_COUNT_KEY) || '0', 10);
    return isNaN(count) ? 0 : count;
}

/**
 * Increment the daily search count
 * @returns {number} New count after incrementing
 */
function incrementDailySearchCount() {
    const count = getDailySearchCount() + 1;
    localStorage.setItem(SEARCH_COUNT_KEY, count.toString());
    return count;
}

/**
 * Check if daily search limit has been reached
 * @returns {boolean} True if limit reached, false otherwise
 */
function isDailyLimitReached() {
    return getDailySearchCount() >= DAILY_SEARCH_LIMIT;
}

/**
 * Get remaining searches for today
 * @returns {number} Remaining searches
 */
function getRemainingSearches() {
    return Math.max(0, DAILY_SEARCH_LIMIT - getDailySearchCount());
}

/**
 * Update the search count display in the UI
 */
function updateSearchCountDisplay() {
    const display = document.getElementById('search-count-display');
    if (!display) return;
    
    const count = getDailySearchCount();
    const remaining = getRemainingSearches();
    
    if (count >= DAILY_SEARCH_LIMIT) {
        display.innerHTML = `<strong class="text-yellow-800">Daily limit reached:</strong> ${count}/${DAILY_SEARCH_LIMIT} searches used today. Limit resets at midnight.`;
    } else if (remaining <= 10) {
        display.innerHTML = `<strong class="text-orange-800">${remaining} searches remaining today</strong> (${count}/${DAILY_SEARCH_LIMIT} used)`;
    } else {
        display.innerHTML = `${count}/${DAILY_SEARCH_LIMIT} internet searches used today (${remaining} remaining)`;
    }
}

/**
 * Toggle the song search panel visibility
 */
export function toggleSongSearchPanel(event = null) {
    // If event is provided, check if click was in the right 25% zone (collapse zone)
    if (event && event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        const clickX = event.clientX;
        const rightZoneStart = rect.right - (rect.width * 0.25);

        // If click was NOT in the right zone, don't toggle (unless clicking chevron)
        const clickedChevron = event.target.closest('[id$="-chevron"]') ||
                               event.target.closest('.chevron-icon') ||
                               event.target.closest('svg[class*="rotate"]');

        if (clickX < rightZoneStart && !clickedChevron) {
            return;
        }
    }

    const panel = document.getElementById('song-search-panel');
    const chevron = document.getElementById('song-search-chevron');

    if (panel && chevron) {
        const isHidden = panel.classList.contains('hidden');
        if (isHidden) {
            panel.classList.remove('hidden');
            chevron.classList.add('rotate-180');
            // Update search count display when panel opens
            updateSearchCountDisplay();
        } else {
            panel.classList.add('hidden');
            chevron.classList.remove('rotate-180');
        }

        // Save panel state
        if (window.savePanelState) {
            window.savePanelState('song-search-panel', !isHidden);
        }
    }
}

/**
 * Search for song chords - searches local database first, then internet
 * Supports two modes: 'api' (local + Google API) and 'free' (DuckDuckGo scraping)
 */
export async function searchSongChords() {
    const searchInput = document.getElementById('song-search-input');
    const resultsContainer = document.getElementById('song-search-results');

    if (!searchInput || !resultsContainer) return;

    const query = searchInput.value.trim();

    if (query.length < 2) {
        resultsContainer.innerHTML = '<p class="text-sm text-gray-500 italic">Enter at least 2 characters to search...</p>';
        return;
    }

    // Hide previous suggestions
    const suggestionsContainer = document.getElementById('chord-suggestions-container');
    if (suggestionsContainer) suggestionsContainer.classList.add('hidden');

    // Show loading state
    resultsContainer.innerHTML = '<div class="flex items-center gap-2 text-sm text-gray-600"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div> Searching...</div>';

    // Check which search mode we're in
    if (currentSearchMode === 'free') {
        // Free search mode - use DuckDuckGo scraping
        await performFreeSearch(query, resultsContainer);
        return;
    }

    // API mode - original behavior
    // Ensure database is loaded before searching
    await loadSongDatabase();

    const queryLower = query.toLowerCase();

    // First, search the local demo database
    const localResults = DEMO_SONG_DATABASE.map((song, originalIndex) => ({
        ...song,
        originalIndex,
        source: 'local'
    })).filter(songWithIndex => {
        const songText = `${songWithIndex.title} ${songWithIndex.artist}`.toLowerCase();
        return songText.includes(queryLower);
    });

    // Only search the internet if no local results found (to save API calls)
    let internetResults = [];
    let rateLimitReached = false;

    if (localResults.length === 0) {
        // No local results, search the internet (only if under daily limit)
        if (isDailyLimitReached()) {
            rateLimitReached = true;
        } else {
            // Check if we have API credentials before attempting search
            const hasApiCredentials = window.GOOGLE_SEARCH_API_KEY && window.GOOGLE_SEARCH_ENGINE_ID;

            if (hasApiCredentials) {
                try {
                    internetResults = await searchInternetForChords(query);
                    // Increment count after successful API call attempt
                    incrementDailySearchCount();
                } catch (error) {
                    console.warn('Internet search failed:', error);
                    // Still increment on error to prevent retry loops
                    // (API call was attempted, even if it failed)
                    incrementDailySearchCount();
                }
                // Update display after incrementing
                updateSearchCountDisplay();
            }
        }
    } else {
        console.log(`Found ${localResults.length} local result(s), skipping internet search to save API calls.`);
    }
    
    // Combine results (local first, then internet)
    const allResults = [...localResults, ...internetResults];
    
    // Display results
    if (allResults.length === 0) {
        let message = '<p class="text-sm text-gray-500 italic">No songs found in local database.</p>';
        
        if (rateLimitReached) {
            const remaining = getRemainingSearches();
            message += `
                <div class="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p class="text-sm text-yellow-800"><strong>Daily search limit reached:</strong> You've used all ${DAILY_SEARCH_LIMIT} free searches for today. Internet search is disabled until tomorrow.</p>
                    <p class="text-xs text-yellow-700 mt-1">Local database searches are still available.</p>
                </div>
            `;
        }
        
        message += `
            <div class="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p class="text-sm text-blue-800 mb-2">Try searching on Ultimate Guitar:</p>
                <button onclick="window.openUltimateGuitarSearch && window.openUltimateGuitarSearch('${escapeHtml(query)}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow transition">
                    Search Ultimate Guitar
                </button>
            </div>
        `;
        
        resultsContainer.innerHTML = `<div class="space-y-3">${message}</div>`;
        return;
    }
    
    // Show rate limit warning if approaching limit
    const remaining = getRemainingSearches();
    let rateLimitWarning = '';
    if (rateLimitReached) {
        rateLimitWarning = `
            <div class="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p class="text-sm text-yellow-800"><strong>Daily search limit reached:</strong> You've used all ${DAILY_SEARCH_LIMIT} free searches for today. Internet search results are not available until tomorrow.</p>
            </div>
        `;
    } else if (remaining <= 10 && remaining > 0) {
        rateLimitWarning = `
            <div class="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p class="text-sm text-orange-800"><strong>Search limit warning:</strong> You have ${remaining} internet search${remaining === 1 ? '' : 'es'} remaining today (out of ${DAILY_SEARCH_LIMIT} free searches).</p>
            </div>
        `;
    }
    
    resultsContainer.innerHTML = rateLimitWarning + allResults.map((song) => {
        if (song.source === 'local') {
            // Local database result with import button
            return `
        <div class="bg-white p-3 rounded-lg border border-purple-200 hover:border-purple-400 transition">
            <div class="flex items-start justify-between gap-3">
                <div class="flex-1">
                            <h4 class="font-bold text-gray-800 text-sm">${escapeHtml(song.title)}</h4>
                            <p class="text-xs text-gray-600">${escapeHtml(song.artist)}</p>
                            <p class="text-xs text-gray-500 mt-1"><strong>Key:</strong> ${escapeHtml(song.key)}</p>
                    <div class="flex flex-wrap gap-1 mt-2">
                                ${song.chords.map(chord => `<span class="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs font-semibold rounded">${escapeHtml(chord)}</span>`).join('')}
                            </div>
                        </div>
                        <button onclick="window.importSongProgression && window.importSongProgression(${song.originalIndex})" class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow transition whitespace-nowrap">
                            Import
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Internet search result with link
            // Store song data in data attribute to avoid JSON escaping issues
            const songData = encodeURIComponent(JSON.stringify(song));
            return `
                <div class="bg-white p-3 rounded-lg border border-blue-200 hover:border-blue-400 transition">
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex-1">
                            <h4 class="font-bold text-gray-800 text-sm">${escapeHtml(song.title)}</h4>
                            <p class="text-xs text-gray-600">${escapeHtml(song.artist || 'Unknown Artist')}</p>
                            ${song.key ? `<p class="text-xs text-gray-500 mt-1"><strong>Key:</strong> ${escapeHtml(song.key)}</p>` : ''}
                            ${song.chords && song.chords.length > 0 ? `
                                <div class="flex flex-wrap gap-1 mt-2">
                                    ${song.chords.map(chord => `<span class="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded">${escapeHtml(chord)}</span>`).join('')}
                                </div>
                            ` : ''}
                            <p class="text-xs text-gray-500 mt-2">Source: ${escapeHtml(song.sourceName || 'Internet')}</p>
                        </div>
                        <div class="flex flex-col gap-2">
                            ${song.chords && song.chords.length > 0 ? `
                                <button onclick="const songData = JSON.parse(decodeURIComponent('${songData}')); window.importInternetSongProgression && window.importInternetSongProgression(songData);" class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow transition whitespace-nowrap">
                    Import
                </button>
                            ` : ''}
                            ${song.url ? `
                                <a href="${escapeHtml(song.url)}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow transition whitespace-nowrap text-center">
                                    View
                                </a>
                            ` : ''}
                        </div>
            </div>
        </div>
            `;
        }
    }).join('');
}

/**
 * Search the internet for chord progressions
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of song results
 */
async function searchInternetForChords(query) {
    const results = [];
    
    // Try Google Custom Search (uses Netlify function if available, or direct API if keys are in window)
    try {
        const googleResults = await searchGoogleForChords(query);
        results.push(...googleResults);
    } catch (error) {
        console.warn('Internet search failed:', error);
    }
    
    return results;
}

/**
 * Search Google Custom Search for chord progressions
 * Uses Netlify function if available, falls back to direct API call if API keys are in window
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of song results
 */
async function searchGoogleForChords(query) {
    // Try Netlify function first (most secure - API key hidden on server)
    const netlifyFunctionUrl = '/.netlify/functions/searchChords';
    
    try {
        const response = await fetch(`${netlifyFunctionUrl}?query=${encodeURIComponent(query)}`);
        
        if (response.ok) {
            const data = await response.json();
            return parseGoogleSearchResults(data);
        } else if (response.status === 404) {
            // Netlify function not available, fall back to direct API call
        } else {
            throw new Error(`Function error: ${response.status}`);
        }
    } catch (error) {
        // If Netlify function fails, try direct API call (for local dev or non-Netlify deployments)
    }
    
    // Fallback: Direct API call (requires API keys in window object)
    const apiKey = window.GOOGLE_SEARCH_API_KEY;
    const engineId = window.GOOGLE_SEARCH_ENGINE_ID;
    
    if (!apiKey || !engineId) {
        throw new Error('API credentials not available. Use Netlify function or set window.GOOGLE_SEARCH_API_KEY and window.GOOGLE_SEARCH_ENGINE_ID');
    }
    
    // Search for chord progressions on popular sites
    const searchQuery = `${query} chords site:ultimate-guitar.com OR site:chordify.net OR site:hooktheory.com`;
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(searchQuery)}&num=10`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Google Search API error: ${response.status}`);
        }
        
        const data = await response.json();
        return parseGoogleSearchResults(data);
    } catch (error) {
        console.error('Google Custom Search error:', error);
        throw error;
    }
}

/**
 * Parse Google Search API results into song objects
 * @param {Object} data - Google Search API response
 * @returns {Array} Array of song result objects
 */
function parseGoogleSearchResults(data) {
    const results = [];
    
    if (data.items && data.items.length > 0) {
        data.items.forEach((item) => {
            // Extract song title and artist from the search result
            const titleMatch = item.title.match(/^(.+?)\s*[-–—]\s*(.+?)\s*[-–—]?\s*Chords?/i);
            const title = titleMatch ? titleMatch[1].trim() : item.title.split(' - ')[0].trim();
            const artist = titleMatch ? titleMatch[2].trim() : (item.title.split(' - ')[1] || '').replace(/Chords?/i, '').trim();
            
            // Try to extract chords from snippet (basic parsing)
            const chords = extractChordsFromText(item.snippet || '');
            
            // Try to extract key from snippet (look for "Key:", "in [key]", etc.)
            let detectedKey = null;
            const snippet = item.snippet || '';
            const keyMatch = snippet.match(/\b(?:key|in)\s*:?\s*([A-G][#b]?)\b/i);
            if (keyMatch) {
                detectedKey = keyMatch[1];
            } else if (chords.length > 0) {
                // Fall back to detecting from chords
                detectedKey = detectKeyFromChords(chords);
            }
            
            results.push({
                title: title || item.title,
                artist: artist || 'Unknown',
                chords: chords,
                key: detectedKey,
                url: item.link,
                source: 'internet',
                sourceName: getSourceName(item.link)
            });
        });
    }
    
    return results;
}

/**
 * Extract chord names from text
 * @param {string} text - Text to extract chords from
 * @returns {Array<string>} Array of chord names
 */
function extractChordsFromText(text) {
    // Common chord pattern: letter, optional sharp/flat, optional minor/maj/7/etc.
    const chordPattern = /\b([A-G][#b]?(?:m|maj|dim|aug|sus|add)?(?:[0-9]|b[0-9]|#[0-9])*(?:\/[A-G][#b]?)?)\b/gi;
    const matches = text.match(chordPattern);
    
    if (!matches) return [];
    
    // Remove duplicates and filter out common false positives
    const uniqueChords = [...new Set(matches.map(m => m.trim()))];
    const filtered = uniqueChords.filter(chord => {
        // Filter out common false positives
        const lower = chord.toLowerCase();
        return !['am', 'pm', 'cm', 'mm', 'dm'].includes(lower) || 
               ['Am', 'Cm', 'Dm', 'Em', 'Fm', 'Gm'].includes(chord);
    });
    
    return filtered.slice(0, 20); // Limit to 20 chords
}

/**
 * Get source name from URL
 * @param {string} url - URL
 * @returns {string} Source name
 */
function getSourceName(url) {
    if (url.includes('ultimate-guitar.com')) return 'Ultimate Guitar';
    if (url.includes('chordify.net')) return 'Chordify';
    if (url.includes('hooktheory.com')) return 'Hooktheory';
    if (url.includes('songsterr.com')) return 'Songsterr';
    return 'Internet';
}

/**
 * Open Ultimate Guitar search in a new tab
 * @param {string} query - Search query
 */
export function openUltimateGuitarSearch(query) {
    const searchUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}`;
    window.open(searchUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Import a song progression from internet search results
 * @param {Object} song - Song object from internet search
 */
export async function importInternetSongProgression(song) {
    if (!song.chords || song.chords.length === 0) {
        showAlertModal({
            title: 'No Chords Available',
            message: 'No chord progression available for this song. Please click "View" to see the full chord chart.',
            type: 'warning'
        });
        return;
    }
    
    // Confirm with user
    const confirmed = confirm(`Import "${song.title}" by ${song.artist || 'Unknown'}?\n\nThis will replace your current chord progression.\n\nChords: ${song.chords.join(' → ')}`);
    
    if (!confirmed) return;
    
    // Detect which enharmonic preference the progression uses
    const progressionPreference = detectEnharmonicPreference(song.chords);
    
    // Switch enharmonic preference to match the progression
    const currentPreference = window.getEnharmonicPreference ? window.getEnharmonicPreference() : 'sharp';
    if (progressionPreference !== currentPreference) {
        switchEnharmonicPreference(progressionPreference);
        // Wait a bit for the preference change to take effect
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Use key from song object if available, otherwise detect from chords
    const detectedKey = song.key || detectKeyFromChords(song.chords);
    
    // Import the progression
    if (window.setProgressionKey && detectedKey) {
        // Convert key to match enharmonic preference (after switching)
        const convertedKey = convertToEnharmonicPreference(detectedKey);
        window.setProgressionKey(convertedKey);
    }
    
    if (window.clearProgression) {
        window.clearProgression();
    }
    
    // Play shutter sound only once at the beginning of import
    let shutterSoundPlayed = false;
    if (!shutterSoundPlayed && window.getAudioIsReady && window.getCameraShutter) {
        const audioIsReady = window.getAudioIsReady();
        const cameraShutter = window.getCameraShutter();
        // Only play if buffer is loaded
        if (audioIsReady && cameraShutter && cameraShutter.loaded) {
            cameraShutter.start();
            shutterSoundPlayed = true;
        }
    }
    
    // Add each chord to the progression (skip shutter sound for all chords)
    // Use longer delay to ensure each chord is fully processed before adding the next
    song.chords.forEach((chordSymbol, index) => {
        setTimeout(() => {
            addParsedChordToProgression(chordSymbol, detectedKey || 'C', false);
        }, index * 100); // Increased from 10ms to 100ms for better reliability
    });
    
    // Mark progression as ready
    if (window.setIsReady) {
        window.setIsReady(true);
    } else if (window.trainerState) {
        window.trainerState.isReady = true;
    }
    
    // Update UI
    const updateDelay = (song.chords.length * 100) + 200; // Increased delay to match new chord addition timing
    setTimeout(() => {
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay();
        }
        if (window.updateProgressionControlsUI) {
            window.updateProgressionControlsUI();
        }
        
        // Expand and scroll to Current Chord Progression section
        expandAndScrollToProgressionSection();
        
        toast.success(`Successfully imported "${song.title}"! ${song.chords.length} chords added.`);
    }, updateDelay);
}

/**
 * Expand the Current Chord Progression section and scroll to it
 */
function expandAndScrollToProgressionSection() {
    // Determine which tab we're on
    const currentTab = window.currentTab || 'melody';

    let panelId, toggleId, chevronId;
    if (currentTab === 'melody') {
        panelId = 'chord-progression-card-panel';
        toggleId = 'chord-progression-card-toggle';
        chevronId = 'chord-progression-card-chevron';
    } else {
        // If not on melody tab, switch to melody tab first
        if (window.switchTab) {
            window.switchTab('melody');
        }
        panelId = 'chord-progression-card-panel';
        toggleId = 'chord-progression-card-toggle';
        chevronId = 'chord-progression-card-chevron';
    }
    
    const panel = document.getElementById(panelId);
    const toggle = document.getElementById(toggleId);
    const chevron = document.getElementById(chevronId);
    
    if (panel && toggle) {
        // Expand the panel if it's collapsed
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            if (chevron) {
                chevron.classList.add('rotate-180');
            }
        }
        
        // Scroll to the section with smooth behavior, accounting for keyboard height
        setTimeout(() => {
            // Get keyboard height to ensure section is visible above keyboard
            const keyboardSection = document.getElementById('keyboard-section');
            const keyboardHeight = keyboardSection ? keyboardSection.offsetHeight : 0;
            const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 80;
            
            // Get the toggle button's position (this is the section header)
            const toggleRect = toggle.getBoundingClientRect();
            const currentScrollY = window.scrollY || window.pageYOffset;
            
            // Calculate the desired position: we want the toggle button to be visible
            // just above the keyboard, with enough space to see the panel content below it
            // Use a smaller offset to prevent scrolling too far
            const viewportHeight = window.innerHeight;
            const spaceAboveKeyboard = viewportHeight - keyboardHeight - headerHeight;
            
            // We want the toggle to be positioned in the upper portion of the visible area above the keyboard
            // This ensures the panel content below the toggle is also visible
            const desiredTogglePosition = headerHeight + 60; // Position toggle 60px below header
            
            // Calculate how much we need to scroll
            const toggleCurrentPosition = currentScrollY + toggleRect.top;
            const scrollAmount = toggleCurrentPosition - desiredTogglePosition;
            
            // Calculate target scroll position
            let targetY = currentScrollY - scrollAmount;
            
            // Ensure we don't scroll too far (don't scroll past the top of the page)
            if (targetY < 0) {
                targetY = 0;
            }
            
            // Scroll to position that shows the section above the keyboard
            window.scrollTo({
                top: targetY,
                behavior: 'smooth'
            });
        }, 100);
    }
}

/**
 * Detect key from chord progression (improved heuristic)
 * @param {Array<string>} chords - Array of chord symbols
 * @returns {string|null} Detected key or null
 */
function detectKeyFromChords(chords) {
    if (!chords || chords.length === 0) return 'C';
    
    // Count occurrences of each root note
    const rootCounts = {};
    chords.forEach(chord => {
        const root = chord.match(/^([A-G][#b]?)/)?.[1];
        if (root) {
            rootCounts[root] = (rootCounts[root] || 0) + 1;
        }
    });
    
    // Find the most common root (likely the key)
    let maxCount = 0;
    let likelyKey = null;
    for (const [root, count] of Object.entries(rootCounts)) {
        if (count > maxCount) {
            maxCount = count;
            likelyKey = root;
        }
    }
    
    // If we have a tie or want better detection, check for common progressions
    // For now, use the most common root as a simple heuristic
    // Convert to match enharmonic preference
    if (likelyKey) {
        likelyKey = convertToEnharmonicPreference(likelyKey);
    }
    
    return likelyKey || 'C'; // Default to C if can't detect
}

/**
 * Detect which enharmonic preference a chord progression uses
 * Counts how many flats vs sharps are in the progression
 * @param {Array<string>} chords - Array of chord symbols
 * @returns {string} 'flat' or 'sharp'
 */
function detectEnharmonicPreference(chords) {
    if (!chords || chords.length === 0) return 'sharp'; // Default
    
    let flatCount = 0;
    let sharpCount = 0;
    
    chords.forEach(chord => {
        const root = chord.match(/^([A-G][#b]?)/)?.[1];
        if (root) {
            if (root.includes('b')) {
                flatCount++;
            } else if (root.includes('#')) {
                sharpCount++;
            }
        }
    });
    
    // If more flats than sharps, prefer flats; otherwise prefer sharps
    // If equal, prefer sharps (default)
    return flatCount > sharpCount ? 'flat' : 'sharp';
}

/**
 * Switch the enharmonic preference to match the chord progression
 * @param {string} preference - 'flat' or 'sharp'
 */
function switchEnharmonicPreference(preference) {
    if (!window.setEnharmonicPreference) {
        console.warn('setEnharmonicPreference not available');
        return;
    }
    
    // Set the preference
    window.setEnharmonicPreference(preference);
    
    // Update window.enharmonicPreference for modules that access it
    if (window.getEnharmonicPreference) {
        window.enharmonicPreference = window.getEnharmonicPreference();
    }
    
    // Update the toggle checkbox
    const toggle = document.getElementById('enharmonic-toggle');
    if (toggle) {
        toggle.checked = preference === 'flat';
        
        // Update indicator colors
        const sharpIndicator = document.getElementById('sharp-indicator');
        const flatIndicator = document.getElementById('flat-indicator');
        
        if (preference === 'sharp') {
            if (sharpIndicator) {
                sharpIndicator.classList.remove('text-gray-500');
                sharpIndicator.classList.add('text-indigo-300');
            }
            if (flatIndicator) {
                flatIndicator.classList.remove('text-indigo-300');
                flatIndicator.classList.add('text-gray-500');
            }
        } else {
            if (flatIndicator) {
                flatIndicator.classList.remove('text-gray-500');
                flatIndicator.classList.add('text-indigo-300');
            }
            if (sharpIndicator) {
                sharpIndicator.classList.remove('text-indigo-300');
                sharpIndicator.classList.add('text-gray-500');
            }
        }
    }
    
    // Refresh all tabs to reflect the change
    if (window.refreshAllTabs) {
        window.refreshAllTabs();
    }
}

/**
 * Convert a note to match the current enharmonic preference
 * Only converts if the note doesn't match the current preference
 * @param {string} note - Note name (e.g., "Ab", "G#")
 * @returns {string} Note name matching current enharmonic preference
 */
function convertToEnharmonicPreference(note) {
    // Get current enharmonic preference
    const enharmonicPreference = window.getEnharmonicPreference ? window.getEnharmonicPreference() : 'sharp';
    const targetArray = enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
    
    // If note is already in target array, return it (no conversion needed)
    if (targetArray.includes(note)) {
        return note;
    }
    
    // Find the note in ALL_NOTES to get its index
    let noteIndex = ALL_NOTES.indexOf(note);
    if (noteIndex === -1) {
        // Try to find via enharmonic map (e.g., "Ab" -> "G#")
        const mappedNote = ENHARMONIC_MAP && ENHARMONIC_MAP[note];
        if (mappedNote) {
            noteIndex = ALL_NOTES.indexOf(mappedNote);
        }
    }
    
    if (noteIndex === -1) {
        console.warn(`Could not find note ${note} in note arrays`);
        return note; // Return original if can't convert
    }
    
    // Return the note from the target array
    return targetArray[noteIndex];
}

/**
 * Parse a chord symbol and add it to the progression
 * @param {string} chordSymbol - Chord symbol like "C", "Am", "F#m7", "Gsus4", "Ab", "Bbm"
 * @param {string} key - The key of the song
 * @param {boolean} playShutterSound - Whether to play the shutter sound (default: false)
 */
function addParsedChordToProgression(chordSymbol, key, playShutterSound = false, inversion = 0) {
    // Parse the chord symbol
    // Format: [Root][Accidental?][Type][Extensions?]
    // Examples: C, Am, F#m7, Gsus4, Cmaj7, Dm7b5, Ab, Bbm
    
    const match = chordSymbol.match(/^([A-G])([#b]?)(.*)$/);
    if (!match) {
        console.warn(`Could not parse chord symbol: ${chordSymbol}`);
        return;
    }
    
    let root = match[1] + match[2]; // e.g., "C", "F#", "Bb", "Ab"
    const typeAndExtensions = match[3]; // e.g., "m", "m7", "maj7", "sus4", "7b5", ""
    
    // Only convert root if it doesn't match the current enharmonic preference
    // (We already switched the preference to match the progression, so this should rarely be needed)
    root = convertToEnharmonicPreference(root);
    
    // Determine chord type from the suffix
    let chordType = 'major'; // default
    if (typeAndExtensions.startsWith('m') && !typeAndExtensions.startsWith('maj')) {
        chordType = 'minor';
    } else if (typeAndExtensions.includes('dim')) {
        chordType = 'diminished';
    } else if (typeAndExtensions.includes('aug')) {
        chordType = 'augmented';
    } else if (typeAndExtensions.includes('sus')) {
        chordType = typeAndExtensions.includes('sus2') ? 'sus2' : 'sus4';
    } else if (typeAndExtensions.includes('7')) {
        if (typeAndExtensions.includes('maj7') || typeAndExtensions.includes('M7')) {
            chordType = 'major7';
        } else if (typeAndExtensions.startsWith('m7')) {
            chordType = 'minor7';
        } else {
            chordType = 'dominant7';
        }
    } else if (typeAndExtensions.includes('9')) {
        chordType = 'dominant9';
    }
    
    // Build chord manually by calling the chord functions
    // This approach simulates selecting the chord in the builder and adding it
    if (window.selectBuilderChordBySymbol) {
        try {
            // Get progression length before adding
            const trainerStateBefore = window.getTrainerState ? window.getTrainerState() : null;
            const lengthBefore = trainerStateBefore && trainerStateBefore.progressionData ? trainerStateBefore.progressionData.length : 0;
            
            // Call the function to select and add the chord (pass playShutterSound and inversion parameters)
            window.selectBuilderChordBySymbol(root, chordType, playShutterSound, inversion);
            
            // Verify the chord was added by checking progression length after a short delay
            setTimeout(() => {
                const trainerStateAfter = window.getTrainerState ? window.getTrainerState() : null;
                if (trainerStateAfter && trainerStateAfter.progressionData) {
                    const lengthAfter = trainerStateAfter.progressionData.length;
                    if (lengthAfter > lengthBefore) {
                        const inversionText = inversion > 0 ? ` (inv. ${inversion})` : '';
                        console.log(`✓ Added chord ${chordSymbol} (${root} ${chordType}${inversionText}). Progression: ${lengthBefore} → ${lengthAfter} chords.`);
                    } else {
                        console.warn(`⚠ Chord ${chordSymbol} (${root} ${chordType}) was not added. Progression length unchanged: ${lengthBefore}`);
                    }
                }
            }, 50);
        } catch (error) {
            console.error(`Error adding chord ${chordSymbol} (${root} ${chordType}):`, error);
        }
    } else {
        console.warn(`Chord building functions not available for: ${chordSymbol}`);
    }
}

/**
 * Import a song's chord progression into the current progression
 * @param {number} songIndex - Index in the DEMO_SONG_DATABASE
 */
export async function importSongProgression(songIndex) {
    // Ensure database is loaded
    await loadSongDatabase();
    
    if (songIndex < 0 || songIndex >= DEMO_SONG_DATABASE.length) {
        toast.error('Invalid song selection.');
        return;
    }
    
    const song = DEMO_SONG_DATABASE[songIndex];
    
    // Confirm with user
    const confirmed = confirm(`Import "${song.title}" by ${song.artist}?\n\nThis will replace your current chord progression.\n\nKey: ${song.key}\nChords: ${song.chords.join(' → ')}`);
    
    if (!confirmed) return;
    
    // Detect which enharmonic preference the progression uses
    const progressionPreference = detectEnharmonicPreference(song.chords);
    
    // Switch enharmonic preference to match the progression
    const currentPreference = window.getEnharmonicPreference ? window.getEnharmonicPreference() : 'sharp';
    if (progressionPreference !== currentPreference) {
        switchEnharmonicPreference(progressionPreference);
        // Wait a bit for the preference change to take effect
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Import the progression
    // We need to access the progression management functions
    if (window.setProgressionKey && song.key) {
        // Convert key to match enharmonic preference (after switching)
        const convertedKey = convertToEnharmonicPreference(song.key);
        window.setProgressionKey(convertedKey);
    }
    
    if (window.clearProgression) {
        window.clearProgression();
    }
    
    // Play shutter sound only once at the beginning of import
    let shutterSoundPlayed = false;
    if (!shutterSoundPlayed && window.getAudioIsReady && window.getCameraShutter) {
        const audioIsReady = window.getAudioIsReady();
        const cameraShutter = window.getCameraShutter();
        // Only play if buffer is loaded
        if (audioIsReady && cameraShutter && cameraShutter.loaded) {
            cameraShutter.start();
            shutterSoundPlayed = true;
        }
    }
    
    // Add each chord to the progression (skip shutter sound for all chords)
    // Use a small delay between additions to ensure each chord is fully processed
    // This prevents state conflicts when adding multiple chords quickly
    // Support inversions if provided in the song data
    song.chords.forEach((chordSymbol, index) => {
        setTimeout(() => {
            // Check if inversions array exists and has an inversion for this chord
            let inversion = 0; // Default to root position
            if (song.inversions && Array.isArray(song.inversions) && index < song.inversions.length) {
                const inversionValue = song.inversions[index];
                // Ensure inversion is a valid number (0, 1, 2, etc.)
                if (typeof inversionValue === 'number' && inversionValue >= 0) {
                    inversion = inversionValue;
                }
            }
            addParsedChordToProgression(chordSymbol, song.key, false, inversion);
        }, index * 100); // Increased delay for consistency
    });
    
    // Mark progression as ready so Step button and Auto Play work
    // Use setIsReady from trainerState if available, or set it via window
    if (window.setIsReady) {
        window.setIsReady(true);
    } else if (window.trainerState) {
        // Fallback: set directly if available
        window.trainerState.isReady = true;
    }
    
    // Update UI - render display and update controls after all chords are added
    // Calculate delay based on number of chords (100ms per chord + 200ms buffer for consistency)
    const updateDelay = (song.chords.length * 100) + 200;
    setTimeout(() => {
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay();
        }
        if (window.updateProgressionControlsUI) {
            window.updateProgressionControlsUI();
        }
        
        // Expand and scroll to Current Chord Progression section
        expandAndScrollToProgressionSection();
        
        // Show success message
        toast.success(`Successfully imported "${song.title}" by ${song.artist}! ${song.chords.length} chords added.`);
    }, updateDelay);
}

/**
 * Helper function to escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Get the song database (for testing or external use)
 * @returns {Promise<Array>} - Promise that resolves to array of song objects
 */
export async function getSongDatabase() {
    await loadSongDatabase();
    return DEMO_SONG_DATABASE;
}

/**
 * Perform a free search using DuckDuckGo scraping
 * @param {string} query - Search query
 * @param {HTMLElement} resultsContainer - Container to display results
 */
async function performFreeSearch(query, resultsContainer) {
    try {
        const chords = await searchFreeOnlineChords(query);

        if (chords.length === 0) {
            resultsContainer.innerHTML = `
                <div class="space-y-3">
                    <p class="text-sm text-gray-500 italic">No chords found automatically for "${escapeHtml(query)}".</p>
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p class="text-sm text-blue-800 mb-2">Try searching manually:</p>
                        <div class="flex flex-wrap gap-2">
                            <a href="https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}"
                               target="_blank" rel="noopener"
                               class="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition">
                                Ultimate Guitar
                            </a>
                            <a href="https://chordify.net/search/${encodeURIComponent(query)}"
                               target="_blank" rel="noopener"
                               class="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition">
                                Chordify
                            </a>
                        </div>
                    </div>
                </div>
            `;
            return;
        }


        // Generate suggestions by comparing with current progression
        const suggestions = generateChordSuggestions(chords);
        displayChordSuggestions(suggestions);

        // Display the found chords
        resultsContainer.innerHTML = `
            <div class="bg-white p-4 rounded-lg border border-green-200">
                <div class="flex items-center justify-between mb-3">
                    <h4 class="font-bold text-gray-800 text-sm">Chords found for "${escapeHtml(query)}"</h4>
                    <span class="text-xs text-green-600 font-medium">${chords.length} chords</span>
                </div>
                <div class="flex flex-wrap gap-2 mb-3">
                    ${chords.map(chord => `
                        <button onclick="window.highlightChordInProgression && window.highlightChordInProgression('${escapeHtml(chord)}')"
                                class="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 text-sm font-semibold rounded-lg border border-green-300 transition"
                                title="Click to highlight matching chords in your progression">
                            ${escapeHtml(chord)}
                        </button>
                    `).join('')}
                </div>
                <div class="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                    <a href="https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}"
                       target="_blank" rel="noopener"
                       class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                        </svg>
                        View on Ultimate Guitar
                    </a>
                    <a href="https://chordify.net/search/${encodeURIComponent(query)}"
                       target="_blank" rel="noopener"
                       class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                        </svg>
                        View on Chordify
                    </a>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('[SongSearch] Free search error:', error);
        resultsContainer.innerHTML = `
            <div class="space-y-3">
                <div class="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p class="text-sm text-red-800">Search failed: ${escapeHtml(error.message)}</p>
                </div>
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p class="text-sm text-blue-800 mb-2">Try searching manually:</p>
                    <div class="flex flex-wrap gap-2">
                        <a href="https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}"
                           target="_blank" rel="noopener"
                           class="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition">
                            Ultimate Guitar
                        </a>
                    </div>
                </div>
            </div>
        `;
    }
}

/**
 * Highlight chords in the current progression that match an online chord
 * @param {string} chordName - Chord name to highlight
 */
export function highlightChordInProgression(chordName) {

    // Get the progression display
    const progressionDisplay = document.getElementById('progression-display') ||
                               document.getElementById('melody-progression-display');

    if (!progressionDisplay) {
        return;
    }

    // Normalize chord name for comparison
    const normalizeChord = (c) => {
        return c.replace(/maj/gi, '')
                .replace(/min/gi, 'm')
                .replace(/M(?![a-z])/g, '')
                .trim()
                .toUpperCase();
    };

    const targetNormalized = normalizeChord(chordName);
    const targetRoot = targetNormalized.match(/^[A-G][#B]?/)?.[0];

    // Find all chord cards in the progression
    const chordCards = progressionDisplay.querySelectorAll('.chord-card, [data-chord-index]');

    // Clear previous highlights
    chordCards.forEach(card => {
        card.classList.remove('ring-2', 'ring-green-500', 'ring-yellow-500', 'bg-green-50', 'bg-yellow-50');
    });

    let matchCount = 0;

    chordCards.forEach(card => {
        // Try to get chord name from various attributes
        const cardChord = card.getAttribute('data-chord') ||
                         card.querySelector('.chord-name')?.textContent ||
                         card.querySelector('.font-bold')?.textContent ||
                         '';

        const cardNormalized = normalizeChord(cardChord);
        const cardRoot = cardNormalized.match(/^[A-G][#B]?/)?.[0];

        // Handle enharmonic equivalents
        const enharmonicMap = {
            'C#': 'DB', 'DB': 'C#',
            'D#': 'EB', 'EB': 'D#',
            'F#': 'GB', 'GB': 'F#',
            'G#': 'AB', 'AB': 'G#',
            'A#': 'BB', 'BB': 'A#'
        };

        const rootsMatch = targetRoot && cardRoot && (
            targetRoot === cardRoot ||
            targetRoot === enharmonicMap[cardRoot] ||
            enharmonicMap[targetRoot] === cardRoot
        );

        if (cardNormalized === targetNormalized ||
            (targetRoot && targetNormalized === targetRoot && cardNormalized === cardRoot)) {
            // Exact match - highlight green
            card.classList.add('ring-2', 'ring-green-500', 'bg-green-50');
            matchCount++;
        } else if (rootsMatch) {
            // Root matches but quality differs - highlight yellow (potential upgrade)
            card.classList.add('ring-2', 'ring-yellow-500', 'bg-yellow-50');
        }
    });

    // Show a brief message
    if (matchCount > 0) {
        console.log(`[SongSearch] Found ${matchCount} matching chord(s)`);
    } else if (targetRoot) {
    }
}

/**
 * Search for chords using free DuckDuckGo scraping
 * @param {string} query - Search query
 * @returns {Promise<Array<string>>} Array of chord names found
 */
async function searchFreeOnlineChords(query) {

    // Use CORS proxies to fetch search results
    const corsProxies = [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?',
    ];

    let html = null;

    for (const proxy of corsProxies) {
        try {
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + ' chords')}`;
            const response = await fetch(proxy + encodeURIComponent(searchUrl), {
                headers: { 'Accept': 'text/html' }
            });

            if (response.ok) {
                html = await response.text();
                break;
            }
        } catch (e) {
            console.warn(`[SongSearch] Proxy ${proxy} failed:`, e.message);
        }
    }

    if (!html) {
        throw new Error('All CORS proxies failed');
    }

    // Parse the HTML to extract chords
    return parseFreeSearchResults(html);
}

/**
 * Parse search results HTML to extract chord names
 * @param {string} html - Raw HTML from search results
 * @returns {Array<string>} Array of chord names
 */
function parseFreeSearchResults(html) {
    const chords = new Set();

    // Strip HTML tags to get plain text
    const plainText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[^;]+;/g, ' ')
        .replace(/\s+/g, ' ');

    // Chord pattern: Letter + optional sharp/flat + optional quality + optional bass note
    const chordPattern = /\b([A-G][#b]?)(m|maj7?|min|dim|aug|7|9|11|13|sus[24]?|add[0-9]+|M7)?(\/[A-G][#b]?)?\b/g;

    let match;
    while ((match = chordPattern.exec(plainText)) !== null) {
        const fullChord = match[0];
        if (fullChord.length === 1) continue;
        if (/^[A-G](nd|re|ut|id|ll|ve|nt|ng|ed|er|ly|es|st)$/i.test(fullChord)) continue;
        chords.add(fullChord);
    }

    // Look for chord progressions in common formats
    const progressionPattern = /([A-G][#b]?(?:m|maj7?|min|dim|aug|7|9|sus[24]?)?)\s*[-–—,]\s*([A-G][#b]?(?:m|maj7?|min|dim|aug|7|9|sus[24]?)?)/gi;
    while ((match = progressionPattern.exec(plainText)) !== null) {
        if (match[1].length > 1) chords.add(match[1]);
        if (match[2].length > 1) chords.add(match[2]);
    }

    // Sort by musical order
    const sortOrder = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

    return Array.from(chords)
        .filter(c => c.length >= 2 && /^[A-G]/.test(c))
        .sort((a, b) => {
            const rootA = a.match(/^[A-G][#b]?/)?.[0] || '';
            const rootB = b.match(/^[A-G][#b]?/)?.[0] || '';
            return sortOrder.indexOf(rootA) - sortOrder.indexOf(rootB);
        })
        .slice(0, 20);
}

/**
 * Compare current progression with online chords and generate suggestions
 * Uses pattern recognition to suggest chord quality improvements
 * @param {Array<string>} onlineChords - Chords found online
 * @returns {Array<Object>} Array of suggestion objects {original, suggested, reason}
 */
export function generateChordSuggestions(onlineChords) {
    const suggestions = [];

    // Get current progression chords
    const trainerState = window.getTrainerState ? window.getTrainerState() : null;
    const progressionData = trainerState?.progressionData || [];

    if (progressionData.length === 0) {
        return suggestions;
    }

    // Extract root notes from current progression
    const currentChords = progressionData.map(item => {
        // Handle different chord data structures
        if (typeof item === 'string') return item;
        if (item.chord) return item.chord;
        if (item.chordSymbol) return item.chordSymbol;
        if (item.root && item.type) {
            const typeMap = {
                'major': '', 'minor': 'm', 'dominant7': '7', 'major7': 'maj7',
                'minor7': 'm7', 'diminished': 'dim', 'augmented': 'aug',
                'sus2': 'sus2', 'sus4': 'sus4', 'dominant9': '9'
            };
            return item.root + (typeMap[item.type] || '');
        }
        return null;
    }).filter(Boolean);


    // Normalize chord for comparison (extract root + basic quality)
    const normalizeChord = (chord) => {
        return chord
            .replace(/maj/gi, '')
            .replace(/min/gi, 'm')
            .toUpperCase();
    };

    // Get root from chord
    const getRoot = (chord) => {
        const match = chord.match(/^[A-G][#b]?/i);
        return match ? match[0].toUpperCase() : null;
    };

    // Get quality from chord (m, 7, maj7, dim, etc.)
    const getQuality = (chord) => {
        const root = getRoot(chord);
        if (!root) return '';
        return chord.substring(root.length).toLowerCase();
    };

    // Check for each chord in current progression
    currentChords.forEach(currentChord => {
        const currentRoot = getRoot(currentChord);
        const currentQuality = getQuality(currentChord);

        if (!currentRoot) return;

        // Look for online chords with same root but different quality
        onlineChords.forEach(onlineChord => {
            const onlineRoot = getRoot(onlineChord);
            const onlineQuality = getQuality(onlineChord);

            if (!onlineRoot) return;

            // Check if roots match (considering enharmonics)
            const enharmonicMap = {
                'C#': 'Db', 'Db': 'C#',
                'D#': 'Eb', 'Eb': 'D#',
                'F#': 'Gb', 'Gb': 'F#',
                'G#': 'Ab', 'Ab': 'G#',
                'A#': 'Bb', 'Bb': 'A#'
            };

            const rootsMatch = currentRoot === onlineRoot ||
                currentRoot === enharmonicMap[onlineRoot] ||
                enharmonicMap[currentRoot] === onlineRoot;

            if (rootsMatch && currentQuality !== onlineQuality) {
                // Check if online version is more specific (has more info)
                const isUpgrade = onlineQuality.length > currentQuality.length ||
                    (onlineQuality.includes('7') && !currentQuality.includes('7')) ||
                    (onlineQuality.includes('9') && !currentQuality.includes('9')) ||
                    (onlineQuality.includes('maj') && !currentQuality.includes('maj')) ||
                    (onlineQuality.includes('sus') && !currentQuality.includes('sus'));

                if (isUpgrade) {
                    // Check if we already have this suggestion
                    const exists = suggestions.some(s =>
                        s.original === currentChord && s.suggested === onlineChord
                    );

                    if (!exists) {
                        let reason = '';
                        if (onlineQuality.includes('7') && !currentQuality.includes('7')) {
                            reason = 'Add 7th for richer sound';
                        } else if (onlineQuality.includes('9') && !currentQuality.includes('9')) {
                            reason = 'Add 9th for jazz/soul feel';
                        } else if (onlineQuality.includes('maj7') && currentQuality === '') {
                            reason = 'Major 7th adds warmth';
                        } else if (onlineQuality.includes('sus')) {
                            reason = 'Suspended chord adds tension';
                        } else {
                            reason = 'More specific chord voicing';
                        }

                        suggestions.push({
                            original: currentChord,
                            suggested: onlineChord,
                            reason: reason
                        });
                    }
                }
            }
        });
    });

    return suggestions;
}

/**
 * Display chord suggestions in the UI
 * @param {Array<Object>} suggestions - Array of suggestion objects
 */
function displayChordSuggestions(suggestions) {
    const container = document.getElementById('chord-suggestions-container');
    const list = document.getElementById('chord-suggestions-list');

    if (!container || !list) return;

    if (suggestions.length === 0) {
        container.classList.add('hidden');
        return;
    }

    list.innerHTML = suggestions.map(s => `
        <div class="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-yellow-300 shadow-sm">
            <span class="text-sm font-medium text-gray-600">${escapeHtml(s.original)}</span>
            <svg class="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
            </svg>
            <button onclick="window.applySuggestedChord && window.applySuggestedChord('${escapeHtml(s.original)}', '${escapeHtml(s.suggested)}')"
                    class="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-bold rounded transition"
                    title="${escapeHtml(s.reason)}">
                ${escapeHtml(s.suggested)}
            </button>
            <span class="text-xs text-gray-500 italic hidden md:inline">${escapeHtml(s.reason)}</span>
        </div>
    `).join('');

    container.classList.remove('hidden');
}

/**
 * Apply a suggested chord improvement to the progression
 * @param {string} original - Original chord to replace
 * @param {string} suggested - Suggested replacement chord
 */
export function applySuggestedChord(original, suggested) {

    // Get current progression
    const trainerState = window.getTrainerState ? window.getTrainerState() : null;
    const progressionData = trainerState?.progressionData || [];

    if (progressionData.length === 0) {
        toast.warning('No progression to modify');
        return;
    }

    // Find the chord to replace
    const normalizeForCompare = (chord) => {
        return chord.replace(/maj/gi, '').replace(/min/gi, 'm').toUpperCase();
    };

    const originalNorm = normalizeForCompare(original);
    let found = false;

    for (let i = 0; i < progressionData.length; i++) {
        const item = progressionData[i];
        let itemChord = '';

        if (typeof item === 'string') {
            itemChord = item;
        } else if (item.chord) {
            itemChord = item.chord;
        } else if (item.chordSymbol) {
            itemChord = item.chordSymbol;
        } else if (item.root && item.type) {
            const typeMap = {
                'major': '', 'minor': 'm', 'dominant7': '7', 'major7': 'maj7',
                'minor7': 'm7', 'diminished': 'dim', 'augmented': 'aug'
            };
            itemChord = item.root + (typeMap[item.type] || '');
        }

        if (normalizeForCompare(itemChord) === originalNorm) {
            // Found the chord - use the chord builder to replace it
            if (window.selectChordCardByIndex) {
                window.selectChordCardByIndex(i);
            }

            // Parse and apply the new chord
            const match = suggested.match(/^([A-G])([#b]?)(.*)$/);
            if (match) {
                const root = match[1] + match[2];
                const quality = match[3];

                let chordType = 'major';
                if (quality.startsWith('m') && !quality.startsWith('maj')) {
                    chordType = 'minor';
                } else if (quality.includes('dim')) {
                    chordType = 'diminished';
                } else if (quality.includes('aug')) {
                    chordType = 'augmented';
                } else if (quality.includes('sus')) {
                    chordType = quality.includes('sus2') ? 'sus2' : 'sus4';
                } else if (quality.includes('7')) {
                    if (quality.includes('maj7') || quality.includes('M7')) {
                        chordType = 'major7';
                    } else if (quality.startsWith('m7')) {
                        chordType = 'minor7';
                    } else {
                        chordType = 'dominant7';
                    }
                } else if (quality.includes('9')) {
                    chordType = 'dominant9';
                }

                // Update the chord at this position
                if (window.updateChordAtIndex) {
                    window.updateChordAtIndex(i, root, chordType);
                    found = true;
                    break;
                }
            }
        }
    }

    if (found) {
        // Refresh the display
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay();
        }
    } else {
        console.warn(`[SongSearch] Could not find chord ${original} in progression`);
        toast.warning(`Could not find ${original} in your progression to replace`);
    }
}

