/**
 * Song Search Module
 * Provides functionality to search for songs and import their chord progressions
 * 
 * NOTE: This currently uses a demo database with limited songs.
 * For production use, integrate with a real chord progression API such as:
 * - Ultimate Guitar API (requires API key)
 * - Hooktheory API (requires API key)
 * - Chordify API (requires API key)
 * - Or implement custom web scraping (check legal/ethical implications)
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
 * Search for song chords in the database
 * In production, this would call a real API
 */
export function searchSongChords() {
    const searchInput = document.getElementById('song-search-input');
    const resultsContainer = document.getElementById('song-search-results');
    
    if (!searchInput || !resultsContainer) return;
    
    const query = searchInput.value.trim().toLowerCase();
    
    if (query.length < 2) {
        resultsContainer.innerHTML = '<p class="text-sm text-gray-500 italic">Enter at least 2 characters to search...</p>';
        return;
    }
    
    // Search the demo database and preserve original indices
    const results = DEMO_SONG_DATABASE.map((song, originalIndex) => ({
        ...song,
        originalIndex
    })).filter(songWithIndex => {
        const songText = `${songWithIndex.title} ${songWithIndex.artist}`.toLowerCase();
        return songText.includes(query);
    });
    
    // Display results
    if (results.length === 0) {
        resultsContainer.innerHTML = '<p class="text-sm text-gray-500 italic">No songs found. Try searching for "Let It Be", "Stand By Me", or "Wonderwall".</p>';
        return;
    }
    
    resultsContainer.innerHTML = results.map((songWithIndex) => `
        <div class="bg-white p-3 rounded-lg border border-purple-200 hover:border-purple-400 transition">
            <div class="flex items-start justify-between gap-3">
                <div class="flex-1">
                    <h4 class="font-bold text-gray-800 text-sm">${escapeHtml(songWithIndex.title)}</h4>
                    <p class="text-xs text-gray-600">${escapeHtml(songWithIndex.artist)}</p>
                    <p class="text-xs text-gray-500 mt-1"><strong>Key:</strong> ${escapeHtml(songWithIndex.key)}</p>
                    <div class="flex flex-wrap gap-1 mt-2">
                        ${songWithIndex.chords.map(chord => `<span class="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs font-semibold rounded">${escapeHtml(chord)}</span>`).join('')}
                    </div>
                </div>
                <button onclick="window.importSongProgression && window.importSongProgression(${songWithIndex.originalIndex})" class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow transition whitespace-nowrap">
                    Import
                </button>
            </div>
        </div>
    `).join('');
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

