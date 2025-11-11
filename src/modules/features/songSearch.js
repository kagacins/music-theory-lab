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

// Demo database of popular songs with chord progressions
const DEMO_SONG_DATABASE = [
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
    },
    {
        title: "No Woman No Cry",
        artist: "Bob Marley",
        key: "C",
        chords: ["C", "G/B", "Am", "F", "C", "F", "C", "G"]
    },
    {
        title: "Every Breath You Take",
        artist: "The Police",
        key: "G",
        chords: ["G", "Em", "C", "D", "G", "Em", "C", "D"]
    },
    {
        title: "Wonderwall",
        artist: "Oasis",
        key: "Gb",
        chords: ["F#m7", "A", "Esus4", "Bm7", "F#m7", "A", "Esus4", "Bm7"]
    },
    {
        title: "Hallelujah",
        artist: "Leonard Cohen",
        key: "C",
        chords: ["C", "Am", "C", "Am", "F", "G", "C", "G"]
    },
    {
        title: "Hotel California",
        artist: "Eagles",
        key: "Bm",
        chords: ["Bm", "F#", "A", "E", "G", "D", "Em", "F#"]
    },
    {
        title: "Imagine",
        artist: "John Lennon",
        key: "C",
        chords: ["C", "Cmaj7", "F", "C", "Cmaj7", "F", "Am", "Dm"]
    },
    {
        title: "Somewhere Over the Rainbow",
        artist: "Israel Kamakawiwo'ole",
        key: "C",
        chords: ["C", "Em", "F", "C", "F", "E7", "Am", "F"]
    },
    {
        title: "Creep",
        artist: "Radiohead",
        key: "G",
        chords: ["G", "B", "C", "Cm", "G", "B", "C", "Cm"]
    }
];

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
    
    // Then search the internet
    let internetResults = [];
    try {
        internetResults = await searchInternetForChords(query);
    } catch (error) {
        console.warn('Internet search failed:', error);
    }
    
    // Combine results (local first, then internet)
    const allResults = [...localResults, ...internetResults];
    
    // Display results
    if (allResults.length === 0) {
        resultsContainer.innerHTML = `
            <div class="space-y-3">
                <p class="text-sm text-gray-500 italic">No songs found in local database.</p>
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p class="text-sm text-blue-800 mb-2">Try searching on Ultimate Guitar:</p>
                    <button onclick="window.openUltimateGuitarSearch && window.openUltimateGuitarSearch('${escapeHtml(query)}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow transition">
                        Search Ultimate Guitar
                    </button>
                </div>
            </div>
        `;
        return;
    }
    
    resultsContainer.innerHTML = allResults.map((song) => {
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
            
            results.push({
                title: title || item.title,
                artist: artist || 'Unknown',
                chords: chords,
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
export function importInternetSongProgression(song) {
    if (!song.chords || song.chords.length === 0) {
        alert('No chord progression available for this song. Please click "View" to see the full chord chart.');
        return;
    }
    
    // Confirm with user
    const confirmed = confirm(`Import "${song.title}" by ${song.artist || 'Unknown'}?\n\nThis will replace your current chord progression.\n\nChords: ${song.chords.join(' → ')}`);
    
    if (!confirmed) return;
    
    // Try to detect key from chords (simple heuristic)
    const detectedKey = detectKeyFromChords(song.chords);
    
    // Import the progression
    if (window.setProgressionKey && detectedKey) {
        window.setProgressionKey(detectedKey);
    }
    
    if (window.clearProgression) {
        window.clearProgression();
    }
    
    // Add each chord to the progression
    song.chords.forEach((chordSymbol, index) => {
        setTimeout(() => {
            addParsedChordToProgression(chordSymbol, detectedKey || 'C');
        }, index * 10);
    });
    
    // Mark progression as ready
    if (window.setIsReady) {
        window.setIsReady(true);
    } else if (window.trainerState) {
        window.trainerState.isReady = true;
    }
    
    // Update UI
    const updateDelay = (song.chords.length * 10) + 100;
    setTimeout(() => {
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay();
        }
        if (window.updateProgressionControlsUI) {
            window.updateProgressionControlsUI();
        }
        
        alert(`Successfully imported "${song.title}"!\n\n${song.chords.length} chords added to your progression.`);
    }, updateDelay);
    
    // Collapse the search panel
    const panel = document.getElementById('song-search-panel');
    const chevron = document.getElementById('song-search-chevron');
    if (panel && chevron) {
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }
}

/**
 * Detect key from chord progression (simple heuristic)
 * @param {Array<string>} chords - Array of chord symbols
 * @returns {string|null} Detected key or null
 */
function detectKeyFromChords(chords) {
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
    
    return likelyKey || 'C'; // Default to C if can't detect
}

/**
 * Parse a chord symbol and add it to the progression
 * @param {string} chordSymbol - Chord symbol like "C", "Am", "F#m7", "Gsus4"
 * @param {string} key - The key of the song
 */
function addParsedChordToProgression(chordSymbol, key) {
    // Parse the chord symbol
    // Format: [Root][Accidental?][Type][Extensions?]
    // Examples: C, Am, F#m7, Gsus4, Cmaj7, Dm7b5
    
    const match = chordSymbol.match(/^([A-G])([#b]?)(.*)$/);
    if (!match) {
        console.warn(`Could not parse chord symbol: ${chordSymbol}`);
        return;
    }
    
    const root = match[1] + match[2]; // e.g., "C", "F#", "Bb"
    const typeAndExtensions = match[3]; // e.g., "m", "m7", "maj7", "sus4", "7b5"
    
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
            window.selectBuilderChordBySymbol(root, chordType);
            // Verify the chord was added by checking progression length
            const trainerState = window.getTrainerState ? window.getTrainerState() : null;
            if (trainerState && trainerState.progressionData) {
                console.log(`Added chord ${chordSymbol} (${root} ${chordType}). Progression now has ${trainerState.progressionData.length} chords.`);
            }
        } catch (error) {
            console.error(`Error adding chord ${chordSymbol}:`, error);
        }
    } else {
        console.warn(`Chord building functions not available for: ${chordSymbol}`);
    }
}

/**
 * Import a song's chord progression into the current progression
 * @param {number} songIndex - Index in the DEMO_SONG_DATABASE
 */
export function importSongProgression(songIndex) {
    if (songIndex < 0 || songIndex >= DEMO_SONG_DATABASE.length) {
        alert('Invalid song selection.');
        return;
    }
    
    const song = DEMO_SONG_DATABASE[songIndex];
    
    // Confirm with user
    const confirmed = confirm(`Import "${song.title}" by ${song.artist}?\n\nThis will replace your current chord progression.\n\nKey: ${song.key}\nChords: ${song.chords.join(' → ')}`);
    
    if (!confirmed) return;
    
    // Import the progression
    // We need to access the progression management functions
    if (window.setProgressionKey) {
        window.setProgressionKey(song.key);
    }
    
    if (window.clearProgression) {
        window.clearProgression();
    }
    
    // Add each chord to the progression
    // Use a small delay between additions to ensure each chord is fully processed
    // This prevents state conflicts when adding multiple chords quickly
    song.chords.forEach((chordSymbol, index) => {
        setTimeout(() => {
            addParsedChordToProgression(chordSymbol, song.key);
        }, index * 10); // 10ms delay between each chord to ensure proper processing
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
    // Calculate delay based on number of chords (10ms per chord + 100ms buffer)
    const updateDelay = (song.chords.length * 10) + 100;
    setTimeout(() => {
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay();
        }
        if (window.updateProgressionControlsUI) {
            window.updateProgressionControlsUI();
        }
        
        // Update UI
        alert(`Successfully imported "${song.title}" by ${song.artist}!\n\n${song.chords.length} chords added to your progression.`);
    }, updateDelay);
    
    // Collapse the search panel
    const panel = document.getElementById('song-search-panel');
    const chevron = document.getElementById('song-search-chevron');
    if (panel && chevron) {
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }
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
 * @returns {Array} - Array of song objects
 */
export function getSongDatabase() {
    return DEMO_SONG_DATABASE;
}

