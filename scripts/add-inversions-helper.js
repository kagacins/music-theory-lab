/**
 * Helper script to add inversions to song database
 * 
 * This script helps you add inversions to songs in the database.
 * You can run it with Node.js to interactively add inversions, or use it as a reference.
 * 
 * Usage:
 *   node scripts/add-inversions-helper.js
 * 
 * Or use the web-based tool in the app (see INVERSIONS_GUIDE.md)
 */

const fs = require('fs');
const path = require('path');

const DATABASE_PATH = path.join(__dirname, '../src/data/song-database.json');

/**
 * Load the song database
 */
function loadDatabase() {
    try {
        const data = fs.readFileSync(DATABASE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading database:', error);
        return null;
    }
}

/**
 * Save the song database
 */
function saveDatabase(songs) {
    try {
        const json = JSON.stringify(songs, null, 2);
        fs.writeFileSync(DATABASE_PATH, json, 'utf8');
        console.log('Database saved successfully!');
        return true;
    } catch (error) {
        console.error('Error saving database:', error);
        return false;
    }
}

/**
 * Suggest inversions based on voice leading principles
 * This is a helper - actual inversions should be verified by listening to the song
 * 
 * @param {Array<string>} chords - Array of chord symbols
 * @param {string} key - Key of the song
 * @returns {Array<number>} Suggested inversions
 */
function suggestInversions(chords, key) {
    const inversions = [];
    
    // Common voice leading patterns:
    // - Use first inversion (1) for smoother bass line movement
    // - Use second inversion (2) for passing chords or cadences
    // - Keep root position (0) for strong chord changes
    
    for (let i = 0; i < chords.length; i++) {
        const chord = chords[i];
        const prevChord = i > 0 ? chords[i - 1] : null;
        const nextChord = i < chords.length - 1 ? chords[i + 1] : null;
        
        // Default to root position
        let suggestion = 0;
        
        // Common patterns:
        // - I-V-I progressions often use first inversion on V
        // - IV-V-I progressions often use first inversion on IV or V
        // - Passing chords between I and V often use first or second inversion
        
        if (prevChord && nextChord) {
            // Check for common progressions
            const progression = `${prevChord}-${chord}-${nextChord}`;
            
            // I-V-I pattern: use first inversion on V
            if (progression.includes('I-V-I') || progression.includes('C-G-C') || progression.includes('F-C-F')) {
                if (chord.includes('V') || chord.includes('G') || chord.includes('C')) {
                    suggestion = 1;
                }
            }
            
            // IV-V-I pattern: use first inversion on IV or V
            if (progression.includes('IV-V-I') || progression.includes('F-G-C') || progression.includes('Bb-C-F')) {
                if (chord.includes('IV') || chord.includes('F') || chord.includes('Bb')) {
                    suggestion = 1;
                }
            }
        }
        
        inversions.push(suggestion);
    }
    
    return inversions;
}

/**
 * Add inversions to a song
 * 
 * @param {number} songIndex - Index of the song in the database
 * @param {Array<number>} inversions - Array of inversion values (0, 1, 2, etc.)
 */
function addInversionsToSong(songIndex, inversions) {
    const songs = loadDatabase();
    if (!songs) return false;
    
    if (songIndex < 0 || songIndex >= songs.length) {
        console.error('Invalid song index');
        return false;
    }
    
    const song = songs[songIndex];
    
    if (inversions.length !== song.chords.length) {
        console.error(`Inversions array length (${inversions.length}) must match chords array length (${song.chords.length})`);
        return false;
    }
    
    song.inversions = inversions;
    
    return saveDatabase(songs);
}

/**
 * Get songs without inversions
 */
function getSongsWithoutInversions() {
    const songs = loadDatabase();
    if (!songs) return [];
    
    return songs
        .map((song, index) => ({ ...song, index }))
        .filter(song => !song.inversions || song.inversions.length === 0);
}

/**
 * Interactive CLI tool
 */
function interactiveMode() {
    const songs = loadDatabase();
    if (!songs) {
        console.error('Failed to load database');
        return;
    }
    
    console.log('\n=== Song Database Inversion Helper ===\n');
    console.log(`Total songs: ${songs.length}`);
    
    const songsWithoutInversions = getSongsWithoutInversions();
    console.log(`Songs without inversions: ${songsWithoutInversions.length}\n`);
    
    if (songsWithoutInversions.length === 0) {
        console.log('All songs already have inversions!');
        return;
    }
    
    console.log('Songs without inversions:');
    songsWithoutInversions.forEach((song, i) => {
        console.log(`${i + 1}. ${song.title} by ${song.artist} (Key: ${song.key})`);
        console.log(`   Chords: ${song.chords.join(', ')}`);
        console.log(`   Suggested inversions: ${suggestInversions(song.chords, song.key).join(', ')}`);
        console.log('');
    });
    
    console.log('\nTo add inversions, use the addInversionsToSong() function or edit the JSON file directly.');
    console.log('Example:');
    console.log('  addInversionsToSong(0, [0, 0, 1, 0, 0, 0, 1, 0]);');
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadDatabase,
        saveDatabase,
        suggestInversions,
        addInversionsToSong,
        getSongsWithoutInversions
    };
}

// Run interactive mode if called directly
if (require.main === module) {
    interactiveMode();
}

