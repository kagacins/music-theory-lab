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
                    console.log(`Loaded ${DEMO_SONG_DATABASE.length} songs from database`);
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
export function toggleSongSearchPanel() {
    const panel = document.getElementById('song-search-panel');
    const chevron = document.getElementById('song-search-chevron');
    
    if (panel && chevron) {
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            chevron.classList.add('rotate-180');
            // Update search count display when panel opens
            updateSearchCountDisplay();
        } else {
            panel.classList.add('hidden');
            chevron.classList.remove('rotate-180');
        }
    }
}

/**
 * Search for song chords - searches local database first, then internet
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
    
    // Show loading state
    resultsContainer.innerHTML = '<div class="flex items-center gap-2 text-sm text-gray-600"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div> Searching...</div>';
    
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
            console.log('Daily search limit reached. Skipping internet search.');
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
            console.log('Netlify function not found, using direct API call');
        } else {
            throw new Error(`Function error: ${response.status}`);
        }
    } catch (error) {
        // If Netlify function fails, try direct API call (for local dev or non-Netlify deployments)
        console.log('Netlify function unavailable, trying direct API call:', error.message);
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
        alert('No chord progression available for this song. Please click "View" to see the full chord chart.');
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
        console.log(`Switching enharmonic preference from ${currentPreference} to ${progressionPreference} to match chord progression`);
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
    // Use a flag to ensure it only plays once even if function is called multiple times
    let shutterSoundPlayed = false;
    if (!shutterSoundPlayed && window.getAudioIsReady && window.getCameraShutter) {
        const audioIsReady = window.getAudioIsReady();
        const cameraShutter = window.getCameraShutter();
        if (audioIsReady && cameraShutter) {
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
        
        alert(`Successfully imported "${song.title}"!\n\n${song.chords.length} chords added to your progression.`);
    }, updateDelay);
}

/**
 * Expand the Current Chord Progression section and scroll to it
 */
function expandAndScrollToProgressionSection() {
    // Determine which tab we're on
    const currentTab = window.currentTab || 'trainer';
    
    let panelId, toggleId, chevronId;
    if (currentTab === 'trainer') {
        panelId = 'progression-visualization-panel';
        toggleId = 'progression-visualization-toggle';
        chevronId = 'progression-visualization-chevron';
    } else if (currentTab === 'melody') {
        panelId = 'melody-progression-panel';
        toggleId = 'melody-progression-toggle';
        chevronId = 'melody-progression-chevron';
    } else {
        // If not on trainer or melody tab, switch to trainer tab first
        if (window.switchTab) {
            window.switchTab('trainer');
        }
        panelId = 'progression-visualization-panel';
        toggleId = 'progression-visualization-toggle';
        chevronId = 'progression-visualization-chevron';
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
function addParsedChordToProgression(chordSymbol, key, playShutterSound = false) {
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
            
            // Call the function to select and add the chord (pass playShutterSound parameter)
            window.selectBuilderChordBySymbol(root, chordType, playShutterSound);
            
            // Verify the chord was added by checking progression length after a short delay
            setTimeout(() => {
                const trainerStateAfter = window.getTrainerState ? window.getTrainerState() : null;
                if (trainerStateAfter && trainerStateAfter.progressionData) {
                    const lengthAfter = trainerStateAfter.progressionData.length;
                    if (lengthAfter > lengthBefore) {
                        console.log(`✓ Added chord ${chordSymbol} (${root} ${chordType}). Progression: ${lengthBefore} → ${lengthAfter} chords.`);
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
        alert('Invalid song selection.');
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
        console.log(`Switching enharmonic preference from ${currentPreference} to ${progressionPreference} to match chord progression`);
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
    // Use a flag to ensure it only plays once even if function is called multiple times
    let shutterSoundPlayed = false;
    if (!shutterSoundPlayed && window.getAudioIsReady && window.getCameraShutter) {
        const audioIsReady = window.getAudioIsReady();
        const cameraShutter = window.getCameraShutter();
        if (audioIsReady && cameraShutter) {
            cameraShutter.start();
            shutterSoundPlayed = true;
        }
    }
    
    // Add each chord to the progression (skip shutter sound for all chords)
    // Use a small delay between additions to ensure each chord is fully processed
    // This prevents state conflicts when adding multiple chords quickly
    song.chords.forEach((chordSymbol, index) => {
        setTimeout(() => {
            addParsedChordToProgression(chordSymbol, song.key, false);
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
        alert(`Successfully imported "${song.title}" by ${song.artist}!\n\n${song.chords.length} chords added to your progression.`);
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

